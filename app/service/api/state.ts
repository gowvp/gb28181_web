import { GET } from "../http";
import type { FindStatResponse } from "../model/state";

export async function FindStats() {
  return await GET<FindStatResponse>(`/stats`);
}
