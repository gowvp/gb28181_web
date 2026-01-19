/**
 * HLS 回放播放器组件
 *
 * 独立的视频回放播放器，基于 hls.js 实现，支持：
 * - HLS (m3u8) 格式播放
 * - MP4 直接播放
 * - 倍速播放 (0.5x - 3x)
 * - 进度控制和跳转
 * - 时间更新回调（用于时间轴同步）
 *
 * 设计为独立组件，可迁移到其他项目或作为独立仓库使用
 * 不依赖任何本地项目文件，仅依赖 hls.js 库
 *
 * @example
 * ```tsx
 * import HlsPlayer, { type HlsPlayerRef } from '@/components/hls-player';
 *
 * const playerRef = useRef<HlsPlayerRef>(null);
 *
 * <HlsPlayer
 *   ref={playerRef}
 *   onTimeUpdate={(time) => setCurrentTime(time)}
 *   onDurationChange={(duration) => setDuration(duration)}
 * />
 *
 * // 播放 HLS
 * playerRef.current?.play('http://example.com/playlist.m3u8');
 *
 * // 设置倍速
 * playerRef.current?.setPlaybackRate(2);
 *
 * // 跳转到指定时间
 * playerRef.current?.seek(30); // 跳转到30秒
 * ```
 */

import Hls from "hls.js";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// ==================== 类型定义 ====================

export interface HlsPlayerRef {
  /** 播放指定 URL（支持 m3u8 和 mp4） */
  play: (url: string) => void;
  /** 暂停播放 */
  pause: () => void;
  /** 继续播放 */
  resume: () => void;
  /** 停止播放并释放资源 */
  stop: () => void;
  /** 跳转到指定时间（秒） */
  seek: (time: number) => void;
  /** 设置播放速率 */
  setPlaybackRate: (rate: number) => void;
  /** 获取当前播放时间（秒） */
  getCurrentTime: () => number;
  /** 获取总时长（秒） */
  getDuration: () => number;
  /** 是否正在播放 */
  isPlaying: () => boolean;
  /** 设置音量 (0-1) */
  setVolume: (volume: number) => void;
  /** 静音/取消静音 */
  setMuted: (muted: boolean) => void;
  /** 快进指定秒数 */
  forward: (seconds: number) => void;
  /** 快退指定秒数 */
  backward: (seconds: number) => void;
}

export interface HlsPlayerProps {
  /** 时间更新回调（毫秒） */
  onTimeUpdate?: (timeMs: number) => void;
  /** 总时长变化回调（毫秒） */
  onDurationChange?: (durationMs: number) => void;
  /** 播放状态变化回调 */
  onPlayStateChange?: (playing: boolean) => void;
  /** 加载状态变化回调 */
  onLoadingChange?: (loading: boolean) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 播放结束回调 */
  onEnded?: () => void;
  /** 自定义样式类名 */
  className?: string;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 是否静音 */
  muted?: boolean;
  /** 是否显示原生控件 */
  controls?: boolean;
}

// ==================== 组件实现 ====================

const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(
  (
    {
      onTimeUpdate,
      onDurationChange,
      onPlayStateChange,
      onLoadingChange,
      onError,
      onEnded,
      className = "",
      autoPlay = true,
      muted = true,
      controls = false,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const currentUrlRef = useRef<string>("");

    // 清理 HLS 实例
    const cleanup = useCallback(() => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      currentUrlRef.current = "";
    }, []);

    // 组件卸载时清理
    useEffect(() => {
      return () => {
        cleanup();
      };
    }, [cleanup]);

    // 播放指定 URL
    const play = useCallback(
      (url: string) => {
        if (!videoRef.current) return;

        // 如果是同一个 URL，直接播放
        if (url === currentUrlRef.current) {
          videoRef.current.play().catch(console.error);
          return;
        }

        // 清理之前的实例
        cleanup();
        currentUrlRef.current = url;
        onLoadingChange?.(true);

        const video = videoRef.current;

        // 判断是否为 HLS 格式
        const isHls = url.includes(".m3u8");

        if (isHls && Hls.isSupported()) {
          // 使用 hls.js 播放
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            // 针对 VOD 优化的配置
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
          });

          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            onLoadingChange?.(false);
            if (autoPlay) {
              video.play().catch(console.error);
            }
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              onLoadingChange?.(false);
              onError?.(new Error(`HLS Error: ${data.type} - ${data.details}`));

              // 尝试恢复
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              } else {
                cleanup();
              }
            }
          });

          hlsRef.current = hls;
        } else if (
          isHls &&
          video.canPlayType("application/vnd.apple.mpegurl")
        ) {
          // Safari 原生支持 HLS
          video.src = url;
          video.addEventListener(
            "loadedmetadata",
            () => {
              onLoadingChange?.(false);
              if (autoPlay) {
                video.play().catch(console.error);
              }
            },
            { once: true }
          );
        } else {
          // 直接播放 MP4
          video.src = url;
          video.addEventListener(
            "loadedmetadata",
            () => {
              onLoadingChange?.(false);
              if (autoPlay) {
                video.play().catch(console.error);
              }
            },
            { once: true }
          );
        }
      },
      [autoPlay, cleanup, onError, onLoadingChange]
    );

    // 暂停播放
    const pause = useCallback(() => {
      videoRef.current?.pause();
    }, []);

    // 继续播放
    const resume = useCallback(() => {
      videoRef.current?.play().catch(console.error);
    }, []);

    // 停止播放
    const stop = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      cleanup();
    }, [cleanup]);

    // 跳转到指定时间
    const seek = useCallback((time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    }, []);

    // 设置播放速率
    const setPlaybackRate = useCallback((rate: number) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    }, []);

    // 获取当前时间
    const getCurrentTime = useCallback(() => {
      return videoRef.current?.currentTime ?? 0;
    }, []);

    // 获取总时长
    const getDuration = useCallback(() => {
      return videoRef.current?.duration ?? 0;
    }, []);

    // 是否正在播放
    const getIsPlaying = useCallback(() => {
      return isPlaying;
    }, [isPlaying]);

    // 设置音量
    const setVolume = useCallback((volume: number) => {
      if (videoRef.current) {
        videoRef.current.volume = Math.max(0, Math.min(1, volume));
      }
    }, []);

    // 设置静音
    const setMuted = useCallback((mutedValue: boolean) => {
      if (videoRef.current) {
        videoRef.current.muted = mutedValue;
      }
    }, []);

    // 快进
    const forward = useCallback((seconds: number) => {
      if (videoRef.current) {
        const duration = videoRef.current.duration || 0;
        videoRef.current.currentTime = Math.min(
          duration,
          videoRef.current.currentTime + seconds
        );
      }
    }, []);

    // 快退
    const backward = useCallback((seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(
          0,
          videoRef.current.currentTime - seconds
        );
      }
    }, []);

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        play,
        pause,
        resume,
        stop,
        seek,
        setPlaybackRate,
        getCurrentTime,
        getDuration,
        isPlaying: getIsPlaying,
        setVolume,
        setMuted,
        forward,
        backward,
      }),
      [
        play,
        pause,
        resume,
        stop,
        seek,
        setPlaybackRate,
        getCurrentTime,
        getDuration,
        getIsPlaying,
        setVolume,
        setMuted,
        forward,
        backward,
      ]
    );

    // 视频事件处理
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        onTimeUpdate?.(videoRef.current.currentTime * 1000);
      }
    }, [onTimeUpdate]);

    const handleDurationChange = useCallback(() => {
      if (videoRef.current && !Number.isNaN(videoRef.current.duration)) {
        onDurationChange?.(videoRef.current.duration * 1000);
      }
    }, [onDurationChange]);

    const handlePlay = useCallback(() => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
    }, [onPlayStateChange]);

    const handlePause = useCallback(() => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    }, [onPlayStateChange]);

    const handleEnded = useCallback(() => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
      onEnded?.();
    }, [onPlayStateChange, onEnded]);

    const handleError = useCallback(() => {
      onLoadingChange?.(false);
      if (videoRef.current?.error) {
        onError?.(new Error(videoRef.current.error.message || "Video error"));
      }
    }, [onError, onLoadingChange]);

    const handleWaiting = useCallback(() => {
      onLoadingChange?.(true);
    }, [onLoadingChange]);

    const handlePlaying = useCallback(() => {
      onLoadingChange?.(false);
    }, [onLoadingChange]);

    return (
      <video
        ref={videoRef}
        className={`hls-player ${className}`}
        style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
        muted={muted}
        controls={controls}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
      />
    );
  }
);

HlsPlayer.displayName = "HlsPlayer";

export default HlsPlayer;
