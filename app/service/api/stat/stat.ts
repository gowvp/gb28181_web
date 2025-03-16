import { GET } from "../../http";
import type { FindStatResponse } from "./state";

export async function FindStats() {
  return await GET<FindStatResponse>(`/stats`);
}
