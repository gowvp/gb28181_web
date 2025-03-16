import { GET, POST } from "~/service/http";
import type { FindChannelsResponse, PlayResponse } from "./state";

export async function Play(id: string) {
  return await POST<PlayResponse>(`/channels/${id}/play`);
}

export const findChannelsKey = "findChannels";
export async function FindChannels(data: object) {
  return await GET<FindChannelsResponse>(`/channels`, data);
}
