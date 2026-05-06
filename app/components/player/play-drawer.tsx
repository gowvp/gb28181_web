import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronDown, Copy } from "lucide-react";
import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Player, { type PlayerRef } from "~/components/player/player";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent } from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { copy2Clipboard } from "~/components/util/copy";
import ToolTips from "~/components/xui/tips";
import { PTZPanel } from "~/components/ptz-control/ptz-panel";
import { usePlayerLayout } from "~/hooks/use-player-layout";
import DeviceDetailView, {
  type DeviceDetailViewRef,
} from "~/pages/channels/device";
import { Play } from "~/service/api/channel/channel";
import { ErrorHandle } from "~/service/config/error";
import { rewriteStreamUrl } from "~/lib/utils";

export interface PlayDrawerRef {
  open: (item: any, options?: { hideSidebar?: boolean }) => void;
}

const PROTOCOLS_EXPANDED_KEY = "player_protocols_expanded";

export default function PlayDrawer({
  ref,
}: {
  ref: React.RefObject<PlayDrawerRef | null>;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const deviceDetailRef = useRef<DeviceDetailViewRef>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [currentChannelId, setCurrentChannelId] = useState<string>("");
  const [currentChannelExt, setCurrentChannelExt] = useState<any>(undefined);
  const [currentChannelType, setCurrentChannelType] = useState<string>("");
  const [currentChannelPtztype, setCurrentChannelPtztype] = useState<number>(0);
  // 协议选择器收缩/展开状态 - 从 localStorage 读取，默认收缩
  const [protocolsExpanded, setProtocolsExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(PROTOCOLS_EXPANDED_KEY) === "true";
    }
    return false;
  });

  // 切换协议展开状态并保存到 localStorage
  const toggleProtocolsExpanded = () => {
    const newValue = !protocolsExpanded;
    setProtocolsExpanded(newValue);
    localStorage.setItem(PROTOCOLS_EXPANDED_KEY, String(newValue));
  };

  // 使用布局计算 Hook（使用固定 footer 高度避免展开/收缩时视频位置变动）
  const layout = usePlayerLayout({
    headerHeight: 40,
    fixedFooterHeight: 120, // 固定高度，无论展开收缩都保持视频位置一致
    sidebarWidth:
      showSidebar && typeof window !== "undefined" && window.innerWidth >= 640
        ? 290
        : 0,
  });

  // 播放功能
  // 为什么: 默认走 ws_flv → Jessibuca 播放, 支持 H.265/H.264 软解(WASM);
  // WebRTC 延迟虽低但 H.265 兼容性差, 用户可通过顶部按钮手动切换。
  const { mutate: playMutate, data: playData } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      const item = data.data.items[0];
      const preferred = rewriteStreamUrl(
        item?.ws_flv || item?.http_flv || item?.webrtc || "",
      );
      setLink(preferred);
      playRef.current?.play(preferred);
    },
    onError: (error) => {
      ErrorHandle(error);
    },
  });

  React.useImperativeHandle(ref, () => ({
    open(item: any, options?: { hideSidebar?: boolean }) {
      console.log("打开播放详情，ID:", item.id);
      setCurrentChannelId(item.id);
      setCurrentChannelExt(item.ext);
      setCurrentChannelType(item.type || "");
      setCurrentChannelPtztype(item.ptztype ?? 0);

      if (options?.hideSidebar !== undefined) {
        setShowSidebar(!options.hideSidebar);
      } else {
        setShowSidebar(true);
      }

      // RTSP 类型通道需要触发播放请求才能启动拉流代理，无论 is_online 状态
      // 其他类型仅在线时才触发播放
      if (item.type === "RTSP" || item.is_online !== false) {
        playMutate(item.id);
      }
      setOpen(true);

      if (item.did && !options?.hideSidebar) {
        setTimeout(() => {
          deviceDetailRef.current?.showDetail(item.did);
        }, 100);
      }
    },
  }));

  const [open, setOpen] = React.useState(false);

  const playRef = useRef<PlayerRef>(null);

  const [link, setLink] = useState("");

  const [selected] = useState(0);

  // 关闭弹窗，并销毁播放器
  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      playRef.current?.destroy();
    }
  };

  const getStream = () => {
    if (!playData) {
      return null;
    }
    if (playData && playData.data?.items.length <= selected) {
      return null;
    }
    return playData.data.items[selected];
  };

  /** 通道列表卡片点击：就地切换播放，不重新打开窗口 */
  const handleChannelSwitch = useCallback((channel: any) => {
    setCurrentChannelId(channel.id);
    setCurrentChannelExt(channel.ext);
    setCurrentChannelType(channel.type || "");
    setCurrentChannelPtztype(channel.ptztype ?? 0);

    if (channel.type === "RTSP" || channel.is_online !== false) {
      playMutate(channel.id);
    }
  }, [playMutate]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] sm:h-[95vh]">
        <div className="flex flex-col sm:flex-row h-full overflow-hidden">
          {/* 播放器内容区域 - 背景色改为白色，移动端允许滚动以容纳 PTZ */}
          <div className="flex-1 bg-white overflow-y-auto sm:overflow-visible" style={layout.containerStyle}>
            {/* 播放器容器 */}
            <div style={layout.contentStyle}>
              <AspectRatio ratio={16 / 9}>
                <Player ref={playRef} link={link} />
              </AspectRatio>
            </div>

            {/* 底部信息 - 固定高度容器，通过 visibility 控制显隐避免视频位置变动 */}
            <div
              className="w-full mt-2"
              style={{ ...layout.contentStyle, height: "120px" }}
            >
              {/* ZLM 标签 - 点击展开/收缩整个底部区域 */}
              <div className="flex items-center my-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 font-medium transition-transform duration-200 hover:scale-105"
                  onClick={toggleProtocolsExpanded}
                >
                  {playData?.data?.items?.[selected]?.label || "ZLM"}
                  <span
                    className={`ml-1 transition-transform duration-300 ${
                      protocolsExpanded ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </Button>
              </div>

              {/* 地址输入框和协议按钮 - 固定高度，通过 opacity 和 visibility 控制显隐 */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  protocolsExpanded
                    ? "opacity-100 visible"
                    : "opacity-0 invisible"
                }`}
              >
                <Input
                  className="bg-gray-50 w-full my-2"
                  disabled
                  value={link}
                />
                <div className="flex flex-wrap gap-1.5 sm:gap-2.5 my-2">
                  {[
                    {
                      name: "WebRTC",
                      addr: rewriteStreamUrl(getStream()?.webrtc ?? ""),
                      copy: false,
                    },
                    {
                      name: "Jessibuca",
                      addr: rewriteStreamUrl(getStream()?.ws_flv ?? ""),
                      copy: false,
                    },
                    {
                      name: "HTTP_FLV",
                      addr: rewriteStreamUrl(getStream()?.http_flv ?? ""),
                      copy: true,
                    },
                    {
                      name: "WS_FLV",
                      addr: rewriteStreamUrl(getStream()?.ws_flv ?? ""),
                      copy: true,
                    },
                    {
                      name: "HLS",
                      addr: rewriteStreamUrl(getStream()?.hls ?? ""),
                      copy: true,
                    },
                    {
                      name: "RTMP",
                      addr: rewriteStreamUrl(getStream()?.rtmp ?? ""),
                      copy: true,
                    },
                    {
                      name: "RTSP",
                      addr: rewriteStreamUrl(getStream()?.rtsp ?? ""),
                      copy: true,
                    },
                  ].map((item, i) => (
                    <ToolTips
                      tips={
                        item.name === "Jessibuca"
                          ? (item.addr || t("no_address")) + " (H.265)"
                          : item.addr || t("no_address")
                      }
                      key={i}
                    >
                      <Button
                        size="sm"
                        variant={item.name === "Jessibuca" ? "default" : "outline"}
                        className={`text-[10px] h-6 px-1.5 sm:text-sm sm:h-9 sm:px-3 transition-all duration-200 ${
                          item.addr === link ? (item.name === "Jessibuca" ? "" : "border-gray-800") : ""
                        }`}
                        disabled={!item.addr}
                        onClick={() => {
                          if (!item.addr) return;

                          if (item.copy === true) {
                            copy2Clipboard(item.addr, {
                              title: t("stream_address_copied"),
                              description: item.addr,
                            });
                            return;
                          }

                          playRef.current?.play(item.addr);
                          setLink(item.addr);
                        }}
                      >
                        {item.copy && <Copy className="hidden sm:inline w-4 h-4 mr-1" />}
                        {item.name === "Jessibuca" ? "Jessibuca(H.265)" : item.name}
                      </Button>
                    </ToolTips>
                  ))}
                </div>
              </div>

            </div>

            {/* 移动端 PTZ 云台控制 - z-index 最高确保不被遮挡 */}
            {currentChannelId && (
              <div className="sm:hidden pb-4 mt-2 relative z-50">
                <PTZPanel
                  channelId={currentChannelId}
                  deviceType={currentChannelType || undefined}
                  ptztype={currentChannelPtztype}
                />
              </div>
            )}
          </div>

          {/* 设备详情/介绍 - 小屏幕时隐藏 */}
          {showSidebar && (
            <div className="hidden sm:block w-72 lg:w-[360px] bg-white overflow-y-auto">
              <DeviceDetailView
                ref={deviceDetailRef}
                channelId={currentChannelId}
                channelExt={currentChannelExt}
                channelType={currentChannelType}
                channelPtztype={currentChannelPtztype}
                onZoneSettings={() => {
                  if (!currentChannelId) return;
                  onOpenChange(false);
                  navigate(`/zones?cid=${encodeURIComponent(currentChannelId)}`);
                }}
                onChannelSwitch={handleChannelSwitch}
              />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
