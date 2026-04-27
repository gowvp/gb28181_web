import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  // 延迟显示加载动画，快速连接时避免闪烁
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) {
      spinnerTimerRef.current = setTimeout(() => setShowSpinner(true), 1000);
    } else {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
        spinnerTimerRef.current = null;
      }
      setShowSpinner(false);
    }
    return () => {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
      }
    };
  }, [loading]);

  const play = useCallback((link: string) => {
    logger.info("Player ~ play ~ link:", link);
    if (!isWebRTCLink(link)) {
      toastError("当前仅支持 WebRTC 播放", {
        description: "其他协议请点击按钮复制地址, 用外部播放器观看",
      });
      return;
    }
    setLoading(true);
    currentLinkRef.current = link;
    webrtcRef.current?.play(link).catch((e) => {
      logger.error("Player ~ play failed:", e);
    });
  }, []);

  const destroy = useCallback(() => {
    logger.info("Player ~ destroy");
    currentLinkRef.current = null;
    setLoading(false);
    webrtcRef.current?.destroy();
  }, []);

  /** WebRTC track 到达后关闭加载动画 */
  const handleTrackReady = useCallback(() => {
    setLoading(false);
  }, []);

  /** WebRTC 协商失败时也关闭加载动画，避免遮挡 warning */
  const handlePlayFailed = useCallback(() => {
    setLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ play, destroy }), [play, destroy]);

  return (
    <div className="min-w-full min-h-full rounded-lg bg-black relative">
      <div className="absolute inset-0">
        <WebRTCPlayer ref={webrtcRef} onTrackReady={handleTrackReady} onPlayFailed={handlePlayFailed} />
      </div>
      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white/80 text-sm">正在连接...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Player;
