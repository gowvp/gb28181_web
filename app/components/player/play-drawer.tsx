import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronDown, Copy } from "lucide-react";
import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Player, { type PlayerRef } from "~/components/player/player";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { copy2Clipboard } from "~/components/util/copy";
import { PTZPanel } from "~/components/ptz-control/ptz-panel";
import { usePlayerLayout } from "~/hooks/use-player-layout";
import DeviceDetailView, {
  type DeviceDetailViewRef,
} from "~/pages/channels/device";
import { Play } from "~/service/api/channel/channel";
import { ErrorHandle } from "~/service/config/error";

export interface PlayDrawerRef {
  open: (item: any, options?: { hideSidebar?: boolean }) => void;
}

const PROTOCOLS_EXPANDED_KEY = "player_protocols_expanded";

// 播放区与菜单区各自保留同高顶隙，使圆角下方仍能看出左右分区。
const DRAWER_TOP_GAP = 17;

export default function PlayDrawer({
  ref,
}: {
  ref: React.RefObject<PlayDrawerRef | null>;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const deviceDetailRef = useRef<DeviceDetailViewRef>(null);
  const [actionBarPortal, setActionBarPortal] = useState<HTMLDivElement | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [currentChannelId, setCurrentChannelId] = useState<string>("");
  const [currentChannelDeviceId, setCurrentChannelDeviceId] = useState<string>("");
  const [currentChannelName, setCurrentChannelName] = useState<string>("");
  const [currentChannelExt, setCurrentChannelExt] = useState<any>(undefined);
  const [currentChannelType, setCurrentChannelType] = useState<string>("");
  const [currentChannelPtztype, setCurrentChannelPtztype] = useState<number>(0);
  const [selectedProtocol, setSelectedProtocol] = useState("WebRTC");
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
    headerHeight: DRAWER_TOP_GAP,
    fixedFooterHeight: 120, // 固定高度，无论展开收缩都保持视频位置一致
    sidebarWidth:
      showSidebar && typeof window !== "undefined" && window.innerWidth >= 640
        ? 311
        : 0,
  });

  // 播放功能
  // 为什么: WebRTC 端到端延迟最低(300~500ms), H.265 兼容浏览器优先走 WebRTC;
  // 不兼容的浏览器 WebRTCPlayer 内部会弹窗提示, 用户可手动切 FLV 兜底。
  const { mutate: playMutate, data: playData } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      const item = data.data.items[0];
      const preferred = item?.webrtc || item?.["ws-flv"] || item?.flv || "";
      setLink(preferred);
      setSelectedProtocol(preferred === item?.webrtc ? "WebRTC" : "WS-FLV");
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
      setCurrentChannelDeviceId(item.channel_id || "");
      setCurrentChannelName(item.name || "");
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
    setCurrentChannelDeviceId(channel.channel_id || "");
    setCurrentChannelName(channel.name || "");
    setCurrentChannelExt(channel.ext);
    setCurrentChannelType(channel.type || "");
    setCurrentChannelPtztype(channel.ptztype ?? 0);

    if (channel.type === "RTSP" || channel.is_online !== false) {
      playMutate(channel.id);
    }
  }, [playMutate]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] overflow-hidden border-0 shadow-[0_-4px_40px_rgba(0,0,0,0.12)] sm:h-[95vh]">
        <DrawerTitle className="sr-only">{currentChannelName || t("play")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("play")}</DrawerDescription>
        <div className="flex flex-col sm:flex-row h-full overflow-hidden">
          {/* 播放器内容区域 - 拆为黑底视频区 + 白底 footer，与 HTML 原型对齐 */}
          <div
            className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto sm:overflow-hidden"
            style={{ paddingTop: DRAWER_TOP_GAP }}
          >
            {/* 视频区域 - 黑底填充剩余空间，视频居中保持宽高比 */}
            <div
              className="flex-1 bg-black flex items-center justify-center min-h-0 overflow-hidden"
              style={{ paddingLeft: layout.containerStyle.paddingLeft, paddingRight: layout.containerStyle.paddingRight }}
            >
              <div style={layout.contentStyle} className="relative group">
                <AspectRatio ratio={16 / 9}>
                  <Player ref={playRef} link={link} />
                </AspectRatio>
              </div>
            </div>

            {/* 底部协议信息 - 白底全宽，独立于视频区域 */}
            <div
              className="w-full bg-white shrink-0"
              style={{ height: "120px", padding: "8px 16px 10px" }}
            >
              {/* 协议标签 - 点击展开/收缩整个底部区域 */}
              <div className="flex items-center min-h-6 mb-1.5">
                <button
                  type="button"
                  className="inline-flex h-6 w-[84px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-black/[0.06] bg-[#f5f5f7] px-2 text-[11px] font-semibold text-[#1d1d1f] transition-transform duration-200 hover:scale-105"
                  onClick={toggleProtocolsExpanded}
                >
                  {selectedProtocol}
                  <span
                    className={`ml-1 transition-transform duration-300 ${
                      protocolsExpanded ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>
                <div ref={setActionBarPortal} className="ml-2 flex min-w-0 items-center gap-1.5" />
              </div>

              {/* 地址输入框和协议按钮 - 固定高度，通过 opacity 和 visibility 控制显隐 */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  protocolsExpanded
                    ? "opacity-100 visible"
                    : "opacity-0 invisible"
                }`}
              >
                <div className="relative mb-1.5">
                  <Input
                    className="h-8 w-full rounded-full border-black/[0.05] bg-[#f5f5f7] py-0 pr-9 font-mono text-[11px] md:text-[11px] text-[#6e6e73] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                    value={link}
                  />
                  <button
                    type="button"
                    title="复制地址"
                    aria-label="复制地址"
                    disabled={!link}
                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[#6e6e73] transition-colors hover:bg-black/[0.06] hover:text-[#1d1d1f] disabled:pointer-events-none disabled:opacity-40"
                    onClick={() =>
                      copy2Clipboard(link, {
                        title: t("stream_address_copied"),
                        description: link,
                      })
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      name: "WebRTC",
                      addr: getStream()?.webrtc ?? "",
                      copy: false,
                    },
                    {
                      name: "FLV",
                      addr: getStream()?.flv ?? "",
                      copy: false,
                    },
                    {
                      name: "WS-FLV",
                      addr: getStream()?.["ws-flv"] ?? "",
                      copy: false,
                    },
                    {
                      name: "HLS",
                      addr: getStream()?.hls ?? "",
                      copy: true,
                    },
                    {
                      name: "RTMP",
                      addr: getStream()?.rtmp ?? "",
                      copy: true,
                    },
                    {
                      name: "RTSP",
                      addr: getStream()?.rtsp ?? "",
                      copy: true,
                    },
                  ].map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      title={item.copy ? "点击复制" : undefined}
                      className={`inline-flex h-6 items-center justify-center rounded-full border px-2.5 text-[10px] font-semibold tracking-wide transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 ${
                        item.addr === link
                          ? "bg-[#1d1d1f] text-white border-[#1d1d1f] hover:bg-[#1d1d1f]/90 hover:text-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                          : "bg-[#f5f5f7] border-black/[0.06] text-[#6e6e73]"
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
                        setSelectedProtocol(item.name);
                      }}
                    >
                      {item.copy && <Copy className="hidden sm:inline w-4 h-4 mr-1" />}
                      {item.name}
                    </button>
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
            <div
              className="hidden sm:block w-[311px] bg-[#f5f5f7] overflow-y-auto overflow-x-hidden border-l border-black/[0.06]"
              style={{ paddingTop: DRAWER_TOP_GAP }}
            >
              <DeviceDetailView
                ref={deviceDetailRef}
                actionBarPortal={actionBarPortal}
                channelId={currentChannelId}
                channelDeviceId={currentChannelDeviceId}
                channelName={currentChannelName}
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
