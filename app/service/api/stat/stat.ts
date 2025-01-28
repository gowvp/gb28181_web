import { GET } from "../../http";
import type { FindStatResponse } from "./stat.d";

export async function FindStats() {
  return await GET<FindStatResponse>(`/stats`);
}
