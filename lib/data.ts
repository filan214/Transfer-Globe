import clubsJson from "../public/data/clubs.json";
import transfersJson from "../public/data/transfers.json";
import type { Club, Transfer } from "./types";

export const clubs = clubsJson as Club[];
export const transfers = transfersJson as Transfer[];
