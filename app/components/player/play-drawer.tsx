import * as React from "react";
import { Bug, Copy } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent } from "~/components/ui/drawer";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import Player, { type PlayerRef } from "~/components/player/player";
import { useRef, useState } from "react";
import { Play } from "~/service/api/channel/channel";
import { useMutation } from "@tanstack/react-query";
import { ErrorHandle } from "~/service/config/error";
import DeviceDetailView from "~/pages/channels/device";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { copy2Clipboard } from "~/components/util/copy";
import ToolTips from "~/components/xui/tips";
import { Input } from "~/components/ui/input";
import { useTranslation } from "react-i18next";
import { usePlayerLayout } from "~/hooks/use-player-layout";

export interface PlayDrawerRef {
  open: (item: any, options?: { hideSidebar?: boolean }) => void;
}

export default function PlayDrawer({
  ref,
}: {
  ref: React.RefObject<PlayDrawerRef | null>;
}) {
  const { t } = useTranslation("common");
  const deviceDetailRef = useRef<any>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // 底部容器引用，用于动态测量高度
  const footerRef = useRef<HTMLDivElement>(null);

  // 使用布局计算 Hook
  const layout = usePlayerLayout({
    headerHeight: 40,
    footerRef, // 传入 ref 代替固定高度
    sidebarWidth:
      showSidebar && typeof window !== "undefined" && window.innerWidth >= 640
        ? 320
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

  const [selected, setSelected] = useState(0);

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
          {/* 播放器内容区域 */}
          <div className="flex-1 bg-gray-100" style={layout.containerStyle}>
            {/* 播放器容器 */}
            <div style={layout.contentStyle}>
              <AspectRatio ratio={16 / 9}>
                <Player ref={playRef} link={link} />
              </AspectRatio>
            </div>

            {/* 底部信息 */}
            <div
              ref={footerRef}
              className="w-full mt-2"
              style={layout.contentStyle}
            >
              <Input className="bg-white w-full my-2" disabled value={link} />
              <div className="flex gap-2 items-start my-2">
                <Select
                  onValueChange={(v) => setSelected(Number(v))}
                  defaultValue={selected.toString()}
                >
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[4rem]">
                    {playData?.data?.items.map((item, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {item.label || `Stream ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex flex-wrap gap-2">
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
                        key={i}
                        className={item.addr === link ? "border-gray-800" : ""}
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
            <div className="hidden sm:block w-80 lg:w-96 border-l bg-white overflow-y-auto">
              <DeviceDetailView ref={deviceDetailRef} />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
