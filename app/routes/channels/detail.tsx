import * as React from "react";
import { Bug, Copy, Minus, Plus } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";

import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { CardHeader } from "~/components/ui/card";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import Player, { type PlayerRef } from "~/components/player/player";
import { useRef, useState } from "react";
import { Play } from "~/service/api/channel/channel";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ErrorHandle } from "~/service/error";
import type { PlayBoxRef } from "~/components/xui/play";
import { GetDevice, getDeviceKey } from "~/service/api/device/device";
import DeviceDetailView from "./device";
import type { ChannelItem } from "~/service/api/channel/channel.d";
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

type ChannelDetailViewRef = {
  open: (channel: ChannelItem) => void;
};

export default function ChannelDetailView({
  ref,
}: {
  ref: React.RefObject<any>;
}) {
  const deviceDetailRef = useRef<any>(null);

  // 播放功能
  const {
    mutate: playMutate,
    isPending: playIsPending,
    data: playData,
  } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      setLink(data.data.items[0].http_flv ?? "");
      playRef.current?.play(data.data.items[0].http_flv ?? "");
    },
    onError: (error) => {
      // setSelectedPlayID("");
      ErrorHandle(error);
    },
  });

  React.useImperativeHandle(ref, () => ({
    open(channel: ChannelItem) {
      console.log("打开频道详情，设备ID:", channel.device_id);

      if (channel.is_online) {
        playMutate(channel.id);
      }
      setOpen(true);

      setTimeout(() => {
        deviceDetailRef.current?.showDetail(channel.did);
      }, 100);
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
      <DrawerContent className="h-[95vh]">
        <div className="flex flex-row h-full">
          <DeviceDetailView ref={deviceDetailRef} />

          <div className="flex-1 bg-gray-100 p-2">
            {/* 播放器设置一个最小宽高 */}
            <div className="min-h-[10rem] min-w-[40rem]">
              <AspectRatio ratio={16 / 9}>
                <Player ref={playRef} link={link} />
              </AspectRatio>
            </div>

            {/* 播放地址 */}
            <div className="flex gap-2 items-center">
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
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2 my-2">
                {[
                  {
                    name: "HTTP_FLV",
                    addr: getStream()?.http_flv ?? "",
                    icon: "",
                  },
                  {
                    name: "WS_FLV",
                    addr: getStream()?.ws_flv ?? "",
                    icon: "",
                  },
                  {
                    name: "HLS",
                    addr: getStream()?.hls ?? "",
                    icon: <Bug />,
                  },
                  {
                    name: "WebRTC",
                    addr: getStream()?.webrtc ?? "",
                    icon: <Copy />,
                    copy: true,
                  },
                  {
                    name: "RTMP",
                    addr: getStream()?.rtmp ?? "",
                    icon: <Copy />,
                    copy: true,
                  },
                  {
                    name: "RTSP",
                    addr: getStream()?.rtsp ?? "",
                    icon: <Copy />,
                    copy: true,
                  },
                ].map((item, i) => (
                  <ToolTips tips={item.addr} key={i}>
                    <Button
                      size="sm"
                      variant="outline"
                      key={i}
                      className={item.addr == link ? "border-gray-800" : ""}
                      onClick={() => {
                        if (item.copy == true) {
                          copy2Clipboard(item.addr, {
                            title: "流地址已复制",
                            description: item.addr,
                          });
                          return;
                        }

                        playRef.current?.play(item.addr);
                        setLink(item.addr);
                      }}
                    >
                      {item.icon} {item.name}
                    </Button>
                  </ToolTips>
                ))}
              </div>
            </div>

            <Input className="bg-white" disabled value={link} />
          </div>
        </div>

        {/* <div className="mx-auto w-full max-w-sm">

          <div className="p-4 pb-0">
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => onClick(-10)}
                disabled={goal <= 200}
              >
                <Minus />
                <span className="sr-only">Decrease</span>
              </Button>
              <div className="flex-1 text-center">
                <div className="text-7xl font-bold tracking-tighter">
                  {goal}
                </div>
                <div className="text-[0.70rem] uppercase text-muted-foreground">
                  Calories/day
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => onClick(10)}
                disabled={goal >= 400}
              >
                <Plus />
                <span className="sr-only">Increase</span>
              </Button>
            </div>
            <div className="mt-3 h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <Bar
                    dataKey="goal"
                    style={
                      {
                        fill: "hsl(var(--foreground))",
                        opacity: 0.9,
                      } as React.CSSProperties
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <DrawerFooter>
            <Button>Submit</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div> */}
      </DrawerContent>
    </Drawer>
  );
}
