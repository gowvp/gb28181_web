import type React from "react";
import { useCallback, useImperativeHandle, useRef } from "react";
import logger from "~/lib/logger";
import { toastError } from "../xui/toast";
import WebRTCPlayer, { type WebRTCPlayerRef } from "./webrtc-player";

export type PlayerRef = {
  play: (link: string) => void;
  destroy: () => void;
};

interface PlayerProps {
  ref: React.RefObject<PlayerRef | null>;
  link?: string;
}

// 为什么: WebRTC 是项目唯一保留的播放通道(低延迟+浏览器原生硬解),
// 其他协议仅作地址复制用, 不再内嵌播放器逻辑, 保持组件薄。
function isWebRTCLink(link: string): boolean {
  return /^webrtc:/i.test(link);
}

function Player({ ref }: PlayerProps) {
  const webrtcRef = useRef<WebRTCPlayerRef>(null);
  const currentLinkRef = useRef<string | null>(null);

  const play = useCallback((link: string) => {
    logger.info("Player ~ play ~ link:", link);
    if (!isWebRTCLink(link)) {
      toastError("当前仅支持 WebRTC 播放", {
        description: "其他协议请点击按钮复制地址, 用外部播放器观看",
      });
      return;
    }
    currentLinkRef.current = link;
    webrtcRef.current?.play(link).catch((e) => {
      logger.error("Player ~ play failed:", e);
    });
  }, []);

  const destroy = useCallback(() => {
    logger.info("Player ~ destroy");
    currentLinkRef.current = null;
    webrtcRef.current?.destroy();
  }, []);

  useImperativeHandle(ref, () => ({ play, destroy }), [play, destroy]);

  return (
    <div className="min-w-full min-h-full rounded-lg bg-black relative">
      <div className="absolute inset-0">
        <WebRTCPlayer ref={webrtcRef} />
      </div>
    </div>
  );
}

export default Player;
