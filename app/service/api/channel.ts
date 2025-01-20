import { POST } from "../http";
import type { PlayResponse } from "../model/channel";

export async function Play(id: string) {
  return await POST<PlayResponse>(`/channels/${id}/play`);
}
