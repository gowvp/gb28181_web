/**
 * MP4 顺序播放器组件
 *
 * 使用原生 video 标签顺序播放 MP4 文件列表
 * 解决国标设备 G.711 音频无法通过 HLS.js/MSE 播放的问题
 * 浏览器原生 video 标签可以播放含有不支持音频编码的视频（只是没有声音）
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// ==================== 类型定义 ====================

export interface VideoSegment {
  /** 唯一标识 */
  id: number | string;
  /** MP4 文件 URL */
  url: string;
  /** 时长（秒） */
  duration: number;
  /** 开始时间戳（毫秒） */
  startTime: number;
}

export interface Mp4PlayerRef {
  /** 开始播放 */
  play: () => void;
  /** 暂停播放 */
  pause: () => void;
  /** 继续播放 */
  resume: () => void;
  /** 停止播放 */
  stop: () => void;
  /** 跳转到指定时间（秒，相对于整个播放列表） */
  seek: (time: number) => void;
  /** 设置播放速率 */
  setPlaybackRate: (rate: number) => void;
  /** 获取当前播放时间（秒，相对于整个播放列表） */
  getCurrentTime: () => number;
  /** 获取总时长（秒） */
  getDuration: () => number;
  /** 是否正在播放 */
  isPlaying: () => boolean;
  /** 设置静音 */
  setMuted: (muted: boolean) => void;
}

export interface Mp4PlayerProps {
  /** 视频片段列表 */
  segments: VideoSegment[];
  /** 时间更新回调（毫秒） */
  onTimeUpdate?: (timeMs: number) => void;
  /** 总时长变化回调（毫秒） */
  onDurationChange?: (durationMs: number) => void;
  /** 播放状态变化回调 */
  onPlayStateChange?: (playing: boolean) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 播放结束回调 */
  onEnded?: () => void;
  /** 自定义样式类名 */
  className?: string;
  /** 是否自动播放 */
  autoPlay?: boolean;
}

// ==================== 组件实现 ====================

const Mp4Player = forwardRef<Mp4PlayerRef, Mp4PlayerProps>(
  (
    {
      segments,
      onTimeUpdate,
      onDurationChange,
      onPlayStateChange,
      onError,
      onEnded,
      className = "",
      autoPlay = false,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRateState] = useState(1);
    // 累计已播放的时长（用于计算总进度）
    const accumulatedTimeRef = useRef(0);

    // 计算总时长
    const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

    // 通知总时长变化
    useEffect(() => {
      onDurationChange?.(totalDuration * 1000);
    }, [totalDuration, onDurationChange]);

    // 计算指定索引之前的累计时长
    const getAccumulatedTime = useCallback(
      (index: number) => {
        let time = 0;
        for (let i = 0; i < index && i < segments.length; i++) {
          time += segments[i].duration;
        }
        return time;
      },
      [segments]
    );

    // 播放当前片段
    const playCurrentSegment = useCallback(() => {
      if (!videoRef.current || segments.length === 0) return;
      if (currentIndex >= segments.length) {
        setIsPlaying(false);
        onPlayStateChange?.(false);
        onEnded?.();
        return;
      }

      const segment = segments[currentIndex];
      accumulatedTimeRef.current = getAccumulatedTime(currentIndex);

      videoRef.current.src = segment.url;
      videoRef.current.playbackRate = playbackRate;
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        })
        .catch((e) => {
          onError?.(e);
        });
    }, [
      currentIndex,
      segments,
      playbackRate,
      getAccumulatedTime,
      onPlayStateChange,
      onEnded,
      onError,
    ]);

    // 自动播放
    useEffect(() => {
      if (autoPlay && segments.length > 0) {
        playCurrentSegment();
      }
    }, [autoPlay, segments.length]); // 只在初始化时触发

    // 处理视频结束，播放下一个
    const handleEnded = useCallback(() => {
      if (currentIndex < segments.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
        onPlayStateChange?.(false);
        onEnded?.();
      }
    }, [currentIndex, segments.length, onPlayStateChange, onEnded]);

    // 当索引变化时播放新片段
    useEffect(() => {
      if (isPlaying && currentIndex < segments.length) {
        playCurrentSegment();
      }
    }, [currentIndex]); // 仅监听索引变化

    // 时间更新
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        const currentTime =
          accumulatedTimeRef.current + videoRef.current.currentTime;
        onTimeUpdate?.(currentTime * 1000);
      }
    }, [onTimeUpdate]);

    // 播放
    const play = useCallback(() => {
      if (segments.length === 0) return;
      if (currentIndex >= segments.length) {
        setCurrentIndex(0);
      }
      playCurrentSegment();
    }, [segments.length, currentIndex, playCurrentSegment]);

    // 暂停
    const pause = useCallback(() => {
      videoRef.current?.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    }, [onPlayStateChange]);

    // 继续
    const resume = useCallback(() => {
      videoRef.current
        ?.play()
        .then(() => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        })
        .catch(console.error);
    }, [onPlayStateChange]);

    // 停止
    const stop = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
      setCurrentIndex(0);
      setIsPlaying(false);
      accumulatedTimeRef.current = 0;
      onPlayStateChange?.(false);
    }, [onPlayStateChange]);

    // 跳转（相对于整个播放列表的时间）
    const seek = useCallback(
      (time: number) => {
        let accumulated = 0;
        for (let i = 0; i < segments.length; i++) {
          if (time < accumulated + segments[i].duration) {
            // 找到目标片段
            const offsetInSegment = time - accumulated;
            if (i !== currentIndex) {
              setCurrentIndex(i);
              accumulatedTimeRef.current = accumulated;
              // 等待视频加载后再 seek
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = offsetInSegment;
                }
              }, 100);
            } else if (videoRef.current) {
              videoRef.current.currentTime = offsetInSegment;
            }
            return;
          }
          accumulated += segments[i].duration;
        }
      },
      [segments, currentIndex]
    );

    // 设置播放速率
    const setPlaybackRate = useCallback((rate: number) => {
      setPlaybackRateState(rate);
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    }, []);

    // 获取当前时间
    const getCurrentTime = useCallback(() => {
      return accumulatedTimeRef.current + (videoRef.current?.currentTime ?? 0);
    }, []);

    // 获取总时长
    const getDuration = useCallback(() => {
      return totalDuration;
    }, [totalDuration]);

    // 是否正在播放
    const getIsPlaying = useCallback(() => {
      return isPlaying;
    }, [isPlaying]);

    // 设置静音
    const setMuted = useCallback((muted: boolean) => {
      if (videoRef.current) {
        videoRef.current.muted = muted;
      }
    }, []);

    // 暴露方法
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
        setMuted,
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
        setMuted,
      ]
    );

    const handleError = useCallback(() => {
      if (videoRef.current?.error) {
        onError?.(new Error(videoRef.current.error.message || "Video error"));
      }
    }, [onError]);

    return (
      <video
        ref={videoRef}
        className={className}
        style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        onPlay={() => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayStateChange?.(false);
        }}
      />
    );
  }
);

Mp4Player.displayName = "Mp4Player";

export default Mp4Player;
