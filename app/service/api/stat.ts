import { GET } from "../http";
import type { FindStatResponse } from "../model/stat";

export async function FindStats() {
  return await GET<FindStatResponse>(`/stats`);
}
