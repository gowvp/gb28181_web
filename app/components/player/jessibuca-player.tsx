import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import logger from "~/lib/logger";

// 为什么: jessibuca 是纯 H5 直播流播放器, 支持 H.265 软解 (WASM),
// 解决浏览器原生不支 H.265 解码的问题, 用于 IPC (海康/大华等) 视频流播放。
// 通过 script 标签动态加载, 避免全局依赖。
const JESSIBUCA_SCRIPT_PATH = "/web/jessibuca/jessibuca.js";
const DECODER_PATH = "/web/jessibuca/decoder.js";

/**
 * WebSocket-FLV 延时高 (300-1000ms), 但用 WASM 解码 H.265 是当前浏览器唯一可行的方案。
 * 设为 200ms 缓冲区以平衡延迟和流畅度。
 */
const VIDEO_BUFFER = 0.2;
const LOADING_TIMEOUT = 10;
const HEART_TIMEOUT = 10;

export type JessibucaPlayerRef = {
  play: (url: string) => void;
  destroy: () => void;
  getIsPlaying: () => boolean;
};

interface JessibucaPlayerProps {
  ref: React.RefObject<JessibucaPlayerRef | null>;
  onTrackReady?: () => void;
  onPlayFailed?: () => void;
}

/**
 * 动态加载 jessibuca 脚本
 * 使用单例模式避免重复加载
 */
let scriptLoadPromise: Promise<void> | null = null;

function loadJessibucaScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Jessibuca) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JESSIBUCA_SCRIPT_PATH;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("加载 jessibuca.js 失败"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

function JessibucaPlayer({ ref, onTrackReady, onPlayFailed }: JessibucaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<InstanceType<typeof Jessibuca> | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  // 延迟显示加载动画
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowSpinner(true), 800);
      return () => clearTimeout(timer);
    }
    setShowSpinner(false);
  }, [loading]);

  // 加载 script
  useEffect(() => {
    let cancelled = false;
    loadJessibucaScript()
      .then(() => {
        if (!cancelled) setScriptLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setScriptError(true);
          setWarning("加载 jessibuca 播放器核心失败，请检查网络或刷新页面重试");
        }
      });
    return () => { cancelled = true; };
  }, []);

  // 组件卸载时销毁
  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, []);

  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        logger.warn("JessibucaPlayer ~ destroy error:", e);
      }
      playerRef.current = null;
    }
  }, []);

  const play = useCallback((url: string) => {
    if (!scriptLoaded || !window.Jessibuca) {
      setWarning("jessibuca 播放器尚未加载完成，请稍后重试");
      onPlayFailed?.();
      return;
    }
    if (scriptError) {
      onPlayFailed?.();
      return;
    }
    if (!containerRef.current) {
      setWarning("播放器容器未就绪");
      onPlayFailed?.();
      return;
    }

    // 销毁旧实例
    destroyPlayer();
    setWarning(null);
    setLoading(true);

    try {
      const player = new window.Jessibuca({
        container: containerRef.current,
        decoder: DECODER_PATH,
        videoBuffer: VIDEO_BUFFER,
        loadingTimeout: LOADING_TIMEOUT,
        heartTimeout: HEART_TIMEOUT,
        isFlv: true,
        hasAudio: true,
        isResize: true,
        useMSE: true,
        useWCS: true,
        autoWasm: true,
        debug: false,
        showBandwidth: false,
        supportDblclickFullscreen: false,
        operateBtns: {
          fullscreen: true,
          screenshot: true,
          play: false,
          audio: false,
          record: false,
        },
      });

      playerRef.current = player;

      // 注册事件
      player.on("play", () => {
        logger.info("JessibucaPlayer ~ play started");
        setLoading(false);
        onTrackReady?.();
      });

      player.on("start", () => {
        logger.info("JessibucaPlayer ~ first frame rendered");
      });

      player.on("error", (err: unknown) => {
        logger.error("JessibucaPlayer ~ error:", err);
        setWarning("播放失败，请尝试切换协议或检查流地址");
        setLoading(false);
        onPlayFailed?.();
      });

      player.on("timeout", (type: unknown) => {
        logger.warn("JessibucaPlayer ~ timeout:", type);
      });

      // 开始播放
      player.play(url).catch((err: Error) => {
        logger.error("JessibucaPlayer ~ play failed:", err);
        setWarning("播放连接失败: " + (err.message || "未知错误"));
        setLoading(false);
        onPlayFailed?.();
      });
    } catch (e) {
      logger.error("JessibucaPlayer ~ init error:", e);
      setWarning("播放器初始化失败");
      setLoading(false);
      onPlayFailed?.();
    }
  }, [scriptLoaded, scriptError, destroyPlayer, onTrackReady, onPlayFailed]);

  const destroy = useCallback(() => {
    destroyPlayer();
    setWarning(null);
    setLoading(false);
  }, [destroyPlayer]);

  const getIsPlaying = useCallback(() => {
    return playerRef.current?.isPlaying() ?? false;
  }, []);

  useImperativeHandle(ref, () => ({ play, destroy, getIsPlaying }), [play, destroy, getIsPlaying]);

  return (
    <div className="relative w-full h-full">
      {/* jessibuca 渲染容器 */}
      <div
        ref={containerRef}
        className="min-w-full min-h-full rounded-lg bg-black"
      />

      {/* 加载动画 */}
      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white/80 text-sm">正在连接...</span>
          </div>
        </div>
      )}

      {/* 提示/错误 */}
      {warning && (
        <div
          className="absolute top-0 left-0 right-0 z-10 bg-amber-500/90 text-white text-xs md:text-sm px-3 py-1.5 flex items-start gap-2 rounded-t-lg shadow"
          role="alert"
        >
          <AlertTriangle className="shrink-0 w-4 h-4 mt-0.5" aria-hidden="true" />
          <span className="flex-1 break-words whitespace-pre-line leading-snug">{warning}</span>
          <button
            type="button"
            onClick={() => setWarning(null)}
            className="shrink-0 text-white/90 hover:text-white cursor-pointer leading-none px-1"
            aria-label="关闭警告"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default JessibucaPlayer;
