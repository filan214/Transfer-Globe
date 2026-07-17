export type League =
  | "Premier League"
  | "La Liga"
  | "Serie A"
  | "Bundesliga"
  | "Ligue 1"
  | "Other";

export const LEAGUES: League[] = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Other",
];

export interface Club {
  id: string;
  name: string;
  league: League;
  country: string;
  lat: number;
  lng: number;
}

export type FeeType = "fee" | "loan" | "free";
export type WindowName = "summer" | "winter";

export interface Transfer {
  id: string;
  playerName: string;
  fromClubId: string;
  toClubId: string;
  /** Fee in millions of euros; null for loans and free transfers. */
  fee: number | null;
  feeType: FeeType;
  season: string; // e.g. "2024/25"
  window: WindowName;
}

export interface TransferWindow {
  season: string;
  window: WindowName;
}

export type Mode = "money" | "migration";

export interface MarkerDatum {
  club: Club;
  /** Money mode: summed fees (€m) in+out. Migration mode: transfer count. */
  activity: number;
  /** COBE marker size (fraction of globe radius). */
  size: number;
}

export interface ArcDatum {
  /** Stable key: transfer id (money mode) or route key (migration mode). */
  key: string;
  fromClub: Club;
  toClub: Club;
  transfers: Transfer[];
  /** Money mode: fee in €m (0 for loan/free). Migration mode: player count. */
  value: number;
}

export interface ClubStats {
  club: Club;
  transfersIn: Transfer[];
  transfersOut: Transfer[];
  /** Total fees paid for incoming players, €m. */
  spend: number;
  /** Total fees received for outgoing players, €m. */
  income: number;
  /** spend − income, €m. */
  netSpend: number;
  biggestSigning: Transfer | null;
}
