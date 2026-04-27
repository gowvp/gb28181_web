import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "antd";
import {
  GetMetadata,
  getMetadataKey,
  SaveMetadata,
} from "~/service/api/metadata/metadata";
import { ErrorHandle } from "~/service/config/error";
import logger from "~/lib/logger";

export const COVER_BLUR_KEY = "cover_blur";
export const COVER_BLUR_STORAGE_KEY = "gowvp_cover_blur";

/**
 * 基本设置面板
 * 为什么同时写 metadata + localStorage：metadata 是跨设备持久化源，
 * localStorage 是同设备快速读取缓存，登录时从 metadata 同步到 localStorage。
 */
export default function GeneralSettings() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [getMetadataKey, COVER_BLUR_KEY],
    queryFn: () => GetMetadata(COVER_BLUR_KEY),
    retry: false,
  });

  const blurEnabled = data?.data?.ext === "true";

  const { mutate, isPending } = useMutation({
    mutationFn: (enabled: boolean) =>
      SaveMetadata(COVER_BLUR_KEY, String(enabled)),
    onSuccess: (_, enabled) => {
      localStorage.setItem(COVER_BLUR_STORAGE_KEY, String(enabled));
      queryClient.invalidateQueries({
        queryKey: [getMetadataKey, COVER_BLUR_KEY],
      });
      // logger.debug("cover blur toggled", enabled);
    },
    onError: ErrorHandle,
  });

  return (
    <div>
      <h3 className="text-base font-medium mb-4">基本设置</h3>
      <div className="flex items-center justify-between py-3">
        <div>
          <div className="text-sm font-medium text-gray-900">封面毛玻璃</div>
          <div className="text-xs text-gray-500 mt-0.5">
            开启后所有通道封面加微弱模糊效果
          </div>
        </div>
        <Switch
          checked={blurEnabled}
          loading={isPending}
          onChange={(checked) => mutate(checked)}
        />
      </div>
    </div>
  );
}
