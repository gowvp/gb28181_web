import { Bug, Copy } from "lucide-react";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import Player, { type PlayerRef } from "~/components/player/player";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { copy2Clipboard } from "~/components/util/copy";
import ToolTips from "~/components/xui/tips";
import type { PlayResponse } from "~/service/api/channel/state";
import { useTranslation } from "react-i18next";

export type PlayBoxRef = {
  play: (link: string, data: PlayResponse) => void;
};

function PlayBox({ ref }: { ref: React.RefObject<any> }) {
  const { t } = useTranslation("common");

  useEffect(() => {
    console.log("🚀 ~ PlayBox ~ useEffect:", useEffect);

    return () => {
      console.log("🚀 ~ dispose~ useEffect:", useEffect);
    };
  }, []);

  const [open, setOpen] = useState(false);
  const playRef = useRef<PlayerRef>(null);

  const [link, setLink] = useState("");

  const [data, setData] = useState<PlayResponse | null>(null);
  const [selected, setSelected] = useState(0);

  const getStream = () => {
    if (!data) {
      return null;
    }
    if (data && data?.items.length <= selected) {
      return null;
    }
    return data.items[selected];
  };

  useEffect(() => {
    console.log("🚀 ~ useEffect ~ play link:", link);
    playRef.current?.play(link);
    return () => {};
  }, [link]);

  useImperativeHandle(ref, () => ({
    play(link: string, data: PlayResponse) {
      setLink(link);
      setData(data);
      setOpen(true);
    },
  }));

  // 关闭弹窗，并销毁播放器
  const close = () => {
    setOpen(false);
    playRef.current?.destroy();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent onEscapeKeyDown={close} className="min-w-[80%]">
        <div>
          <AlertDialogHeader className="flex-none">
            <div className="flex justify-between">
              <AlertDialogTitle>{t("play")}</AlertDialogTitle>
              <Button variant="outline" onClick={close}>
                {t("close")}
              </Button>
            </div>
            <AlertDialogDescription className="flex-none"></AlertDialogDescription>
          </AlertDialogHeader>
          {/* 播放器设置一个最小宽高 */}
          <div className="min-h-[10rem] min-w-[40rem]">
            <AspectRatio ratio={16 / 9}>
              <Player ref={playRef} />
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
                {data?.items.map((item, i) => (
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
                          title: t("stream_address_copied"),
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

          <Input disabled value={link} />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PlayBox;
