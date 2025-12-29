import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bug, ChevronDown, Copy } from "lucide-react";
import * as React from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Player, { type PlayerRef } from "~/components/player/player";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent } from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { copy2Clipboard } from "~/components/util/copy";
import ToolTips from "~/components/xui/tips";
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
  const { mutate: playMutate, data: playData } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      setLink(data.data.items[0].http_flv ?? "");
      playRef.current?.play(data.data.items[0].http_flv ?? "");
    },
    onError: (error) => {
      ErrorHandle(error);
    },
  });

  React.useImperativeHandle(ref, () => ({
    open(item: any, options?: { hideSidebar?: boolean }) {
      console.log("打开播放详情，ID:", item.id);
      setCurrentChannelId(item.id);

      if (options?.hideSidebar !== undefined) {
        setShowSidebar(!options.hideSidebar);
      } else {
        setShowSidebar(true);
      }

      // 只有当 item.is_online 为 true 或者没有这个属性（默认在线，如rtmp/rtsp）时才自动播放
      if (item.is_online !== false) {
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] sm:h-[95vh]">
        <div className="flex flex-col sm:flex-row h-full overflow-hidden">
          {/* 播放器内容区域 - 背景色改为白色 */}
          <div className="flex-1 bg-white" style={layout.containerStyle}>
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
                <div className="flex flex-wrap gap-2 my-2">
                  {[
                    {
                      name: "HTTP_FLV",
                      addr: getStream()?.http_flv ?? "",
                      icon: null,
                    },
                    {
                      name: "WS_FLV",
                      addr: getStream()?.ws_flv ?? "",
                      icon: null,
                    },
                    {
                      name: "HLS",
                      addr: getStream()?.hls ?? "",
                      icon: <Bug className="w-4 h-4 mr-1" />,
                    },
                    {
                      name: "WebRTC",
                      addr: getStream()?.webrtc ?? "",
                      icon: <Copy className="w-4 h-4 mr-1" />,
                      copy: true,
                    },
                    {
                      name: "RTMP",
                      addr: getStream()?.rtmp ?? "",
                      icon: <Copy className="w-4 h-4 mr-1" />,
                      copy: true,
                    },
                    {
                      name: "RTSP",
                      addr: getStream()?.rtsp ?? "",
                      icon: <Copy className="w-4 h-4 mr-1" />,
                      copy: true,
                    },
                  ].map((item, i) => (
                    <ToolTips tips={item.addr || t("no_address")} key={i}>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`transition-all duration-200 ${
                          item.addr === link ? "border-gray-800" : ""
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
                        {item.icon}
                        {item.name}
                      </Button>
                    </ToolTips>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 设备详情/介绍 - 小屏幕时隐藏 */}
          {showSidebar && (
            <div className="hidden sm:block w-72 lg:w-[360px] bg-white overflow-y-auto">
              <DeviceDetailView
                ref={deviceDetailRef}
                channelId={currentChannelId}
                onZoneSettings={() => {
                  if (!currentChannelId) return;
                  onOpenChange(false);
                  navigate({
                    to: "/zones",
                    search: { cid: currentChannelId },
                  });
                }}
              />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
