import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import logger from "~/lib/logger";
import { toastError } from "../xui/toast";
import WebRTCPlayer, { type WebRTCPlayerRef } from "./webrtc-player";
import JessibucaPlayer, { type JessibucaPlayerRef } from "./jessibuca-player";

export type PlayerRef = {
  play: (link: string) => void;
  destroy: () => void;
};

interface PlayerProps {
  ref: React.RefObject<PlayerRef | null>;
  link?: string;
}

type PlayMode = "webrtc" | "jessibuca" | null;

// 为什么: WebRTC 低延迟首选; Jessibuca (jessibuca) 通过 WASM 软解解决 H.265 播放问题,
// 适用于 IPC (海康/大华等) 的视频流。
function getPlayMode(link: string): PlayMode | null {
  if (/^webrtc:/i.test(link)) return "webrtc";
  if (/^ws(_flv)?:/i.test(link) || /^http(_flv)?:/i.test(link) || link.includes(".flv")) return "jessibuca";
  return null;
}

function Player({ ref }: PlayerProps) {
  const webrtcRef = useRef<WebRTCPlayerRef>(null);
  const jessibucaRef = useRef<JessibucaPlayerRef>(null);
  const currentLinkRef = useRef<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>(null);
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
    const mode = getPlayMode(link);
    if (!mode) {
      toastError("不支持的播放协议", {
        description: "请复制地址用外部播放器观看",
      });
      return;
    }

    setPlayMode(mode);
    setLoading(true);
    currentLinkRef.current = link;

    if (mode === "webrtc") {
      webrtcRef.current?.play(link).catch((e: Error) => {
        logger.error("Player ~ webrtc play failed:", e);
      });
    } else {
      jessibucaRef.current?.play(link);
    }
  }, []);

  const destroy = useCallback(() => {
    logger.info("Player ~ destroy");
    currentLinkRef.current = null;
    setLoading(false);
    setPlayMode(null);
    webrtcRef.current?.destroy();
    jessibucaRef.current?.destroy();
  }, []);

  const handleTrackReady = useCallback(() => {
    setLoading(false);
  }, []);

  const handlePlayFailed = useCallback(() => {
    setLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ play, destroy }), [play, destroy]);

  return (
    <div className="min-w-full min-h-full rounded-lg bg-black relative">
      {/* WebRTC 模式 */}
      {playMode !== "jessibuca" && (
        <div className="absolute inset-0" style={{ display: playMode === "webrtc" || playMode === null ? undefined : "none" }}>
          <WebRTCPlayer ref={webrtcRef} onTrackReady={handleTrackReady} onPlayFailed={handlePlayFailed} />
        </div>
      )}
      {/* Jessibuca 模式 */}
      {playMode !== "webrtc" && (
        <div className="absolute inset-0" style={{ display: playMode === "jessibuca" ? undefined : "none" }}>
          <JessibucaPlayer ref={jessibucaRef} onTrackReady={handleTrackReady} onPlayFailed={handlePlayFailed} />
        </div>
      )}
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
