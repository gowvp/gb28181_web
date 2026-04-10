import { GET, POST } from "~/service/config/http";

export interface MetadataItem {
  id: string;
  ext: string;
  created_by: string;
  last_updated_by: string;
  created_at: string;
  updated_at: string;
}

export const getMetadataKey = "getMetadata";

/** 按 ID 查询元数据 */
export async function GetMetadata(id: string) {
  return await GET<MetadataItem>(`/metadatas/${id}`);
}

/** 幂等保存元数据：已存在则更新，不存在则创建 */
export async function SaveMetadata(id: string, ext: string) {
  return await POST<MetadataItem>(`/metadatas/${id}`, { ext });
}
