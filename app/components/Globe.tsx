"use client";

import createGlobe, { type Globe as CobeGlobe } from "cobe";
import { useEffect, useRef, useState } from "react";
import type { ArcDatum, MarkerDatum, Mode } from "../../lib/types";
import { arcWidth, feeTier, formatFee } from "../../lib/encoding";
import {
  MARKER_COLOR,
  MIGRATION_COLOR,
  SELECTED_COLOR,
  TIER_COLORS,
  rgb,
  withAlpha,
} from "../../lib/palette";

interface GlobeProps {
  markers: MarkerDatum[];
  arcs: ArcDatum[];
  mode: Mode;
  selectedClubId: string | null;
  onSelectClub: (clubId: string | null) => void;
  /** Fly the camera to these coordinates whenever nonce changes. */
  focus: { lat: number; lng: number; nonce: number } | null;
}

/** COBE renders the sphere at this clip-space radius. */
const R = 0.8;
const BASE_THETA = 0.18;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.75;
/** Center the initial view on Europe (λ ≈ 10°E): phi = 3π/2 − λ. */
const INITIAL_PHI = (3 * Math.PI) / 2 - (10 * Math.PI) / 180;

function latLngToVec3(lat: number, lng: number): [number, number, number] {
  const r = (lat * Math.PI) / 180;
  const a = (lng * Math.PI) / 180 - Math.PI;
  const o = Math.cos(r);
  return [-o * Math.cos(a), Math.sin(r), o * Math.sin(a)];
}

interface Projected {
  x: number;
  y: number;
  /** Depth along the view axis; negative = far side of the globe. */
  z: number;
  visible: boolean;
}

/**
 * COBE's own vertex math (extracted from its shader) so overlay drawing and
 * hit-testing land exactly where COBE renders. `t` includes the point radius.
 */
function project(
  t: [number, number, number],
  phi: number,
  theta: number,
  w: number,
  h: number,
  scale: number,
): Projected {
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const c = cosPhi * t[0] + sinPhi * t[2];
  const s = sinPhi * sinTheta * t[0] + cosTheta * t[1] - cosPhi * sinTheta * t[2];
  const z = -sinPhi * cosTheta * t[0] + sinTheta * t[1] + cosPhi * cosTheta * t[2];
  const x = (((c / (w / h)) * scale + 1) / 2) * w;
  const y = ((-s * scale + 1) / 2) * h;
  // Behind the globe AND inside its silhouette → hidden.
  const visible = z >= 0 || c * c + s * s >= R * R;
  return { x, y, z, visible };
}

function slerp(
  a: [number, number, number],
  b: [number, number, number],
  omega: number,
  t: number,
): [number, number, number] {
  const so = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / so;
  const kb = Math.sin(t * omega) / so;
  return [
    ka * a[0] + kb * b[0],
    ka * a[1] + kb * b[1],
    ka * a[2] + kb * b[2],
  ];
}

function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Stroke the sub-range [a, b] (fractions of the polyline), skipping hidden points. */
function strokeRange(
  ctx: CanvasRenderingContext2D,
  pts: Projected[],
  a: number,
  b: number,
) {
  const n = pts.length - 1;
  const ai = Math.max(0, a) * n;
  const bi = Math.min(1, b) * n;
  if (bi <= ai) return;
  ctx.beginPath();
  let open = false;
  const lerpPt = (f: number) => {
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    const p = pts[i];
    const q = pts[i + 1];
    return {
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
      visible: p.visible && q.visible,
    };
  };
  const start = lerpPt(ai);
  if (start.visible) {
    ctx.moveTo(start.x, start.y);
    open = true;
  }
  for (let i = Math.ceil(ai); i <= Math.floor(bi); i++) {
    const p = pts[i];
    if (!p.visible) {
      open = false;
      continue;
    }
    if (open) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    open = true;
  }
  const end = lerpPt(bi);
  if (end.visible && open) ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

export default function Globe({
  markers,
  arcs,
  mode,
  selectedClubId,
  onSelectClub,
  focus,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cobeCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({ markers, arcs, mode, selectedClubId, onSelectClub, focus });
  propsRef.current = { markers, arcs, mode, selectedClubId, onSelectClub, focus };

  const [ready, setReady] = useState(false);
  const [tooltip, setTooltip] = useState<{ title: string; sub: string } | null>(null);

  const hoverRef = useRef<string | null>(null);
  const zoomByRef = useRef<(factor: number) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    const cobeCanvas = cobeCanvasRef.current;
    const overlay = overlayRef.current;
    if (!container || !cobeCanvas || !overlay) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    let globe: CobeGlobe | null = null;
    let raf = 0;
    let w = 0;
    let h = 0;
    let fitScale = 1;
    let zoom = 1;
    let zoomTarget = 1;
    let scale = 1;

    let phi = INITIAL_PHI;
    let theta = BASE_THETA;
    let velocity = 0;
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;
    let lastY = 0;
    let lastInteraction = 0;
    let lastFrame = 0;
    let pointer: { x: number; y: number } | null = null;
    let hoverArcKey: string | null = null;
    let fly: { phi: number; theta: number } | null = null;
    let lastFocusNonce = 0;
    let arcScreens: { arc: ArcDatum; pts: Projected[]; width: number }[] = [];
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; zoom: number } | null = null;

    zoomByRef.current = (factor: number) => {
      zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget * factor));
      lastInteraction = performance.now();
    };

    const destroyGlobe = () => {
      if (!globe) return;
      globe.destroy();
      globe = null;
      // COBE v2 wraps the canvas in its own div; unwrap so remount is clean.
      const wrapper = cobeCanvas.parentElement;
      if (wrapper && wrapper !== container) {
        container.insertBefore(cobeCanvas, wrapper);
        wrapper.remove();
      }
    };

    const setup = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      w = rect.width;
      h = rect.height;
      // Height sets the globe radius (0.4h); shrink on narrow screens so it fits.
      fitScale = Math.min(1, (1.1 * w) / h);
      scale = fitScale * zoom;
      for (const canvas of [cobeCanvas, overlay]) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      destroyGlobe();
      globe = createGlobe(cobeCanvas, {
        devicePixelRatio: dpr,
        width: w * dpr,
        height: h * dpr,
        phi,
        theta,
        dark: 1,
        diffuse: 1.8,
        mapSamples: 22000,
        mapBrightness: 7.5,
        mapBaseBrightness: 0.06,
        baseColor: rgb("#46587e"),
        markerColor: rgb(MARKER_COLOR),
        glowColor: rgb("#101a30"),
        markers: [],
        scale,
        offset: [0, 0],
      });
    };

    const markerRadiusPx = (size: number) => size * 0.5 * (R * (h / 2) * scale);

    const projectMarker = (m: MarkerDatum): Projected => {
      const v = latLngToVec3(m.club.lat, m.club.lng);
      const r = R + 0.005;
      return project([v[0] * r, v[1] * r, v[2] * r], phi, theta, w, h, scale);
    };

    const hitTest = (x: number, y: number) => {
      const { markers: ms } = propsRef.current;
      let best: { m: MarkerDatum; d: number } | null = null;
      for (const m of ms) {
        const p = projectMarker(m);
        if (!p.visible) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d <= Math.max(markerRadiusPx(m.size) + 4, 12) && (!best || d < best.d)) {
          best = { m, d };
        }
      }
      return best?.m ?? null;
    };

    const distToSegment = (x: number, y: number, p: Projected, q: Projected) => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / len2));
      return Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t));
    };

    const nearestArc = (x: number, y: number) => {
      let best: { arc: ArcDatum; d: number } | null = null;
      for (const s of arcScreens) {
        const threshold = Math.max(s.width + 4, 8);
        for (let i = 0; i < s.pts.length - 1; i++) {
          const p = s.pts[i];
          const q = s.pts[i + 1];
          if (!p.visible || !q.visible) continue;
          const d = distToSegment(x, y, p, q);
          if (d <= threshold && (!best || d < best.d)) best = { arc: s.arc, d };
        }
      }
      return best;
    };

    const draw = (now: number) => {
      const { markers: ms, arcs: as, mode: md, selectedClubId: sel, focus: fc } = propsRef.current;
      const ctx = overlay.getContext("2d");
      if (!ctx || !globe) return;

      // Time-based motion so speed is identical at any refresh rate.
      const dt = lastFrame === 0 ? 16.7 : Math.min(50, now - lastFrame);
      lastFrame = now;
      const frames = dt / 16.7;

      const zoomEase = reducedMotion ? 1 : 1 - Math.pow(0.8, frames);
      zoom += (zoomTarget - zoom) * zoomEase;
      if (Math.abs(zoomTarget - zoom) < 0.001) zoom = zoomTarget;
      scale = fitScale * zoom;
      const zoomAttr = zoom.toFixed(3);
      if (container.dataset.zoom !== zoomAttr) container.dataset.zoom = zoomAttr;

      if (fc && fc.nonce !== lastFocusNonce) {
        lastFocusNonce = fc.nonce;
        const phiTarget = (3 * Math.PI) / 2 - (fc.lng * Math.PI) / 180;
        // Approach the target the short way around.
        const twoPi = 2 * Math.PI;
        const delta = ((((phiTarget - phi) % twoPi) + 3 * Math.PI) % twoPi) - Math.PI;
        fly = {
          phi: phi + delta,
          theta: Math.max(-0.5, Math.min(0.8, ((fc.lat * Math.PI) / 180) * 0.6)),
        };
      }

      if (dragging) {
        // phi already advanced by pointer handler
      } else if (fly) {
        const ease = reducedMotion ? 1 : 1 - Math.pow(0.92, frames);
        phi += (fly.phi - phi) * ease;
        theta += (fly.theta - theta) * ease;
        if (Math.abs(fly.phi - phi) < 0.003 && Math.abs(fly.theta - theta) < 0.003) fly = null;
      } else {
        phi += velocity * frames;
        velocity *= Math.pow(0.94, frames);
        // Idle auto-rotation; hold still while the user is inspecting something.
        if (
          !reducedMotion &&
          now - lastInteraction > 300 &&
          !hoverRef.current &&
          !hoverArcKey
        ) {
          phi += 0.0016 * frames;
        }
      }
      globe.update({ phi, theta, scale });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // --- Arcs ---
      arcScreens = [];
      for (const arc of as) {
        const from = latLngToVec3(arc.fromClub.lat, arc.fromClub.lng);
        const to = latLngToVec3(arc.toClub.lat, arc.toClub.lng);
        const dot = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
        const omega = Math.acos(dot);
        if (omega < 1e-4) continue;

        const lift = 0.1 + 0.28 * Math.pow(omega / Math.PI, 0.7);
        const n = 36;
        const pts: Projected[] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const v = slerp(from, to, omega, t);
          const radius = R * (1 + lift * Math.sin(Math.PI * t)) + 0.005;
          pts.push(
            project([v[0] * radius, v[1] * radius, v[2] * radius], phi, theta, w, h, scale),
          );
        }

        const involvesSelection =
          sel !== null && (arc.fromClub.id === sel || arc.toClub.id === sel);
        const dimmed = sel !== null && !involvesSelection;
        const hovered = arc.key === hoverArcKey;
        const color =
          md === "money" ? TIER_COLORS[feeTier(arc.value > 0 ? arc.value : null)] : MIGRATION_COLOR;
        const width = arcWidth(md, arc.value);
        arcScreens.push({ arc, pts, width });

        ctx.strokeStyle = withAlpha(
          color,
          hovered ? 0.95 : dimmed ? 0.07 : reducedMotion ? 0.55 : 0.3,
        );
        ctx.lineWidth = hovered ? width + 0.8 : width;
        strokeRange(ctx, pts, 0, 1);

        if (!reducedMotion && !dimmed && !hovered) {
          // Traveling pulse: born at the seller, dies at the buyer.
          const phase = hash01(arc.key);
          const period = 2400 + phase * 1400;
          const head = ((now / period + phase) % 1) * 1.18;
          ctx.strokeStyle = withAlpha(color, 0.95);
          ctx.lineWidth = width + 0.4;
          strokeRange(ctx, pts, head - 0.18, head);
        }
      }

      // --- Markers ---
      let hoverPos: Projected | null = null;
      for (const m of ms) {
        const p = projectMarker(m);
        if (!p.visible) continue;
        const r = markerRadiusPx(m.size);
        const isSelected = m.club.id === sel;
        const isHovered = m.club.id === hoverRef.current;
        const dimmed = sel !== null && !isSelected;
        const color = isSelected ? SELECTED_COLOR : MARKER_COLOR;
        const alpha = dimmed ? 0.3 : 0.95;

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
        glow.addColorStop(0, withAlpha(color, alpha * 0.2));
        glow.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = withAlpha(color, alpha * 0.92);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.strokeStyle = withAlpha(SELECTED_COLOR, 0.9);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (isHovered) hoverPos = p;
      }

      // Pin the tooltip to its marker even while the globe rotates; arc
      // tooltips follow the pointer instead.
      const tip = tooltipRef.current;
      if (tip && hoverPos) {
        tip.style.transform = `translate(${Math.round(hoverPos.x)}px, ${Math.round(hoverPos.y)}px)`;
      } else if (tip && hoverArcKey && pointer) {
        tip.style.transform = `translate(${Math.round(pointer.x)}px, ${Math.round(pointer.y)}px)`;
      }

      raf = requestAnimationFrame(draw);
    };

    const clearHover = () => {
      if (hoverRef.current !== null || hoverArcKey !== null) {
        hoverRef.current = null;
        hoverArcKey = null;
        setTooltip(null);
        container.style.cursor = "grab";
      }
    };

    const pinchDist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Don't capture the pointer when the tap is on the zoom buttons —
      // capturing would retarget pointerup and swallow their click event.
      if ((e.target as HTMLElement | null)?.closest("[data-zoom-controls]")) return;
      fly = null;
      lastInteraction = performance.now();
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // Pointer may already be released (or synthetic); capture is best-effort.
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        // Second finger down: rotation becomes a pinch zoom.
        dragging = false;
        dragMoved = 999;
        pinchStart = { dist: pinchDist(), zoom: zoomTarget };
        return;
      }
      dragging = true;
      dragMoved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      container.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pinchStart && pointers.size >= 2) {
        zoomTarget = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, (pinchStart.zoom * pinchDist()) / pinchStart.dist),
        );
        lastInteraction = performance.now();
        return;
      }
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        dragMoved += Math.abs(dx) + Math.abs(dy);
        // Rotate less per pixel when zoomed in, so panning stays controllable.
        const speed = 0.005 / zoom;
        phi += dx * speed;
        theta = Math.max(-0.4, Math.min(0.9, theta + dy * speed * 0.6));
        velocity = dx * speed;
        lastX = e.clientX;
        lastY = e.clientY;
        lastInteraction = performance.now();
        return;
      }
      const { mode: md } = propsRef.current;
      const hit = hitTest(pointer.x, pointer.y);
      if (hit) {
        hoverArcKey = null;
        if (hit.club.id !== hoverRef.current) {
          hoverRef.current = hit.club.id;
          container.style.cursor = "pointer";
          const sub =
            hit.activity === 0
              ? "No activity this window"
              : md === "money"
                ? `€${Math.round(hit.activity * 10) / 10}m gross activity`
                : `${hit.activity} transfer${hit.activity === 1 ? "" : "s"}`;
          setTooltip({ title: hit.club.name, sub });
        }
        return;
      }
      const near = nearestArc(pointer.x, pointer.y);
      const key = near?.arc.key ?? null;
      if (hoverRef.current !== null) {
        hoverRef.current = null;
        container.style.cursor = "grab";
        if (!near) setTooltip(null);
      }
      if (key !== hoverArcKey) {
        hoverArcKey = key;
        if (near) {
          const a = near.arc;
          if (md === "money") {
            const t = a.transfers[0];
            setTooltip({
              title: t.playerName,
              sub: `${a.fromClub.name} → ${a.toClub.name} · ${formatFee(t.fee, t.feeType)}`,
            });
          } else {
            setTooltip({
              title: `${a.fromClub.name} → ${a.toClub.name}`,
              sub: `${a.value} player${a.value === 1 ? "" : "s"} this window`,
            });
          }
        } else {
          setTooltip(null);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (pointers.size === 1) {
        // One finger left after a pinch: keep rotating from where it is.
        const p = [...pointers.values()][0];
        lastX = p.x;
        lastY = p.y;
        dragging = true;
        dragMoved = 999;
        return;
      }
      const wasDragging = dragging;
      dragging = false;
      lastInteraction = performance.now();
      container.style.cursor = "grab";
      if (wasDragging && dragMoved < 6) {
        const rect = container.getBoundingClientRect();
        const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        propsRef.current.onSelectClub(hit?.club.id ?? null);
      }
    };

    const onPointerLeave = () => {
      pointer = null;
      clearHover();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTarget = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoomTarget * Math.exp(-e.deltaY * 0.0016)),
      );
      lastInteraction = performance.now();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("wheel", onWheel, { passive: false });

    setup();
    setReady(true);
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      if (Math.round(rect.width) !== Math.round(w) || Math.round(rect.height) !== Math.round(h)) {
        setup();
      }
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("wheel", onWheel);
      destroyGlobe();
    };
    // The rAF loop reads live props from propsRef; the effect only runs once.
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 touch-none transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      style={{ cursor: "grab" }}
      role="application"
      aria-label="Interactive transfer globe. Drag to rotate, click a club to see its window."
    >
      <canvas ref={cobeCanvasRef} className="block" />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />
      <div
        data-zoom-controls
        className="absolute bottom-16 right-3 z-20 flex flex-col overflow-hidden rounded-lg sm:bottom-14 sm:right-6"
      >
        <button
          onClick={() => zoomByRef.current(1.35)}
          aria-label="Zoom in"
          className="glass data h-9 w-9 text-base leading-none text-dim transition-colors hover:text-text"
        >
          +
        </button>
        <button
          onClick={() => zoomByRef.current(1 / 1.35)}
          aria-label="Zoom out"
          className="glass data -mt-px h-9 w-9 text-base leading-none text-dim transition-colors hover:text-text"
        >
          −
        </button>
      </div>
      {tooltip && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-10"
        >
          <div className="glass -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md px-3 py-2 text-center">
            <div className="display text-sm font-semibold tracking-wide">{tooltip.title}</div>
            <div className="data text-[10px] text-dim">{tooltip.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}
