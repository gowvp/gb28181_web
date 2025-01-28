import { POST } from "~/service/http";
import type { PlayResponse } from "./channel.d";

export async function Play(id: string) {
  return await POST<PlayResponse>(`/channels/${id}/play`);
}
