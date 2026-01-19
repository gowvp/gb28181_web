/**
 * SeamlessPlayer - 无缝 MP4 播放器
 *
 * 使用 mp4box.js + MSE 实现多个 MP4 文件无缝播放
 * 核心原理：将多个独立 MP4 文件的媒体数据追加到同一个 SourceBuffer，
 * 通过 timestampOffset 调整时间戳实现连续播放
 */

import {
  createFile,
  type ISOFile,
  type MP4BoxBuffer,
  type Track,
} from "mp4box";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/** 视频片段信息 */
export interface VideoSegment {
  /** 唯一标识 */
  id: number;
  /** 视频 URL */
  url: string;
  /** 时长（秒） */
  duration: number;
  /** 开始时间戳（毫秒），用于时间轴定位 */
  startTime?: number;
}

/** 播放器暴露的方法 */
export interface SeamlessPlayerRef {
  /** 开始播放 */
  play: () => void;
  /** 暂停 */
  pause: () => void;
  /** 跳转到指定时间（秒） */
  seek: (time: number) => void;
  /** 设置倍速 */
  setPlaybackRate: (rate: number) => void;
  /** 获取当前播放时间 */
  getCurrentTime: () => number;
  /** 获取总时长 */
  getDuration: () => number;
  /** 销毁播放器 */
  destroy: () => void;
}

/** 播放器属性 */
export interface SeamlessPlayerProps {
  /** 视频片段列表 */
  segments: VideoSegment[];
  /** 自动播放 */
  autoPlay?: boolean;
  /** 播放状态变化回调 */
  onPlayStateChange?: (playing: boolean) => void;
  /** 时间更新回调 */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** 加载进度回调 */
  onLoadProgress?: (loaded: number, total: number) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 播放结束回调 */
  onEnded?: () => void;
  /** 自定义样式 */
  className?: string;
}

/** 内部状态 */
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  loadedSegments: number;
  totalSegments: number;
}

/**
 * 无缝 MP4 播放器组件
 * 使用 mp4box.js 解析 MP4，通过 MSE 实现无缝拼接播放
 */
const SeamlessPlayer = forwardRef<SeamlessPlayerRef, SeamlessPlayerProps>(
  (
    {
      segments,
      autoPlay = false,
      onPlayStateChange,
      onTimeUpdate,
      onLoadProgress,
      onError,
      onEnded,
      className,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaSourceRef = useRef<MediaSource | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);
    const mp4boxFileRef = useRef<ISOFile | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // 播放状态
    const [state, setState] = useState<PlayerState>({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      loadedSegments: 0,
      totalSegments: segments.length,
    });

    // 累计时间偏移量，用于拼接多个文件
    const timestampOffsetRef = useRef(0);
    // 当前正在加载的片段索引
    const currentLoadingIndexRef = useRef(0);
    // 是否已初始化
    const initializedRef = useRef(false);
    // 待追加的 buffer 队列
    const pendingBuffersRef = useRef<ArrayBuffer[]>([]);
    // 是否正在追加
    const isAppendingRef = useRef(false);
    // codec 字符串
    const codecRef = useRef<string>("");

    /**
     * 追加 buffer 到 SourceBuffer（带队列处理）
     * MSE 要求同一时间只能有一个 appendBuffer 操作
     */
    const appendBuffer = useCallback((buffer: ArrayBuffer) => {
      const sourceBuffer = sourceBufferRef.current;
      if (!sourceBuffer || sourceBuffer.updating) {
        pendingBuffersRef.current.push(buffer);
        return;
      }

      try {
        isAppendingRef.current = true;
        sourceBuffer.appendBuffer(buffer);
      } catch (e) {
        console.error("appendBuffer error:", e);
        isAppendingRef.current = false;
      }
    }, []);

    /**
     * 处理队列中的待追加 buffer
     */
    const processBufferQueue = useCallback(() => {
      const sourceBuffer = sourceBufferRef.current;
      if (
        !sourceBuffer ||
        sourceBuffer.updating ||
        pendingBuffersRef.current.length === 0
      ) {
        isAppendingRef.current = false;
        return;
      }

      const buffer = pendingBuffersRef.current.shift();
      if (buffer) {
        try {
          sourceBuffer.appendBuffer(buffer);
        } catch (e) {
          console.error("processBufferQueue error:", e);
          isAppendingRef.current = false;
        }
      }
    }, []);

    /**
     * 加载并处理单个 MP4 文件
     */
    const loadSegment = useCallback(
      async (segment: VideoSegment, index: number) => {
        const controller = abortControllerRef.current;
        if (!controller) return;

        try {
          const response = await fetch(segment.url, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(
              `Failed to fetch ${segment.url}: ${response.status}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();

          // 创建 mp4box 文件实例处理此片段
          const mp4boxFile = createFile();

          // 存储解析出的 segments
          const mediaSegments: ArrayBuffer[] = [];
          let initSegment: ArrayBuffer | null = null;

          mp4boxFile.onError = (e: string) => {
            console.error(`MP4Box error for segment ${index}:`, e);
          };

          mp4boxFile.onReady = (info: { tracks: Track[] }) => {
            // 找到视频轨道
            const videoTrack = info.tracks.find(
              (t: Track) => t.type === "video"
            );
            if (!videoTrack) {
              console.error("No video track found");
              return;
            }

            // 保存 codec 信息（仅第一个文件）
            if (index === 0) {
              codecRef.current = `video/mp4; codecs="${videoTrack.codec}"`;
            }

            // 设置分片参数
            mp4boxFile.setSegmentOptions(videoTrack.id, null, {
              nbSamples: 100,
            });

            // 获取初始化段
            const initSegs = mp4boxFile.initializeSegmentation() as unknown as
              | { buffer: ArrayBuffer }[]
              | undefined;
            if (initSegs && initSegs.length > 0) {
              initSegment = initSegs[0].buffer;
            }

            // 开始生成媒体段
            mp4boxFile.start();
          };

          mp4boxFile.onSegment = (
            _id: number,
            _user: unknown,
            buffer: ArrayBuffer
          ) => {
            mediaSegments.push(buffer);
          };

          // 输入数据
          const mp4Buffer = arrayBuffer as MP4BoxBuffer;
          mp4Buffer.fileStart = 0;
          mp4boxFile.appendBuffer(mp4Buffer);
          mp4boxFile.flush();

          // 等待解析完成
          await new Promise((resolve) => setTimeout(resolve, 100));

          // 第一个文件时初始化 SourceBuffer
          if (index === 0 && initSegment && codecRef.current) {
            const mediaSource = mediaSourceRef.current;
            if (mediaSource && mediaSource.readyState === "open") {
              const sourceBuffer = mediaSource.addSourceBuffer(
                codecRef.current
              );
              sourceBufferRef.current = sourceBuffer;

              sourceBuffer.mode = "segments";

              // 监听 updateend 事件处理队列
              sourceBuffer.addEventListener("updateend", () => {
                processBufferQueue();

                // 检查是否所有片段都已加载完成
                if (
                  currentLoadingIndexRef.current >= segments.length &&
                  pendingBuffersRef.current.length === 0 &&
                  !sourceBuffer.updating
                ) {
                  if (mediaSource.readyState === "open") {
                    try {
                      mediaSource.endOfStream();
                    } catch (e) {
                      // ignore
                    }
                  }
                }
              });

              // 追加初始化段
              appendBuffer(initSegment);
            }
          }

          // 设置时间偏移量（从第二个文件开始）
          if (index > 0) {
            const sourceBuffer = sourceBufferRef.current;
            if (sourceBuffer && !sourceBuffer.updating) {
              // 等待之前的操作完成
              await new Promise<void>((resolve) => {
                const check = () => {
                  if (!sourceBuffer.updating) {
                    resolve();
                  } else {
                    setTimeout(check, 10);
                  }
                };
                check();
              });
              sourceBuffer.timestampOffset = timestampOffsetRef.current;
            }
          }

          // 追加媒体段
          for (const seg of mediaSegments) {
            appendBuffer(seg);
          }

          // 更新时间偏移量
          timestampOffsetRef.current += segment.duration;

          // 更新加载进度
          setState((prev) => ({
            ...prev,
            loadedSegments: index + 1,
            duration: timestampOffsetRef.current,
          }));

          onLoadProgress?.(index + 1, segments.length);

          // 清理
          mp4boxFile.stop();
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            console.error(`Error loading segment ${index}:`, e);
            onError?.(e as Error);
          }
        }
      },
      [segments, appendBuffer, processBufferQueue, onLoadProgress, onError]
    );

    /**
     * 初始化播放器
     */
    const initialize = useCallback(async () => {
      if (initializedRef.current || segments.length === 0) return;
      initializedRef.current = true;

      const video = videoRef.current;
      if (!video) return;

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      // 创建 MediaSource
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      video.src = URL.createObjectURL(mediaSource);

      // 等待 MediaSource 打开
      await new Promise<void>((resolve) => {
        mediaSource.addEventListener("sourceopen", () => resolve(), {
          once: true,
        });
      });

      // 依次加载所有片段
      for (let i = 0; i < segments.length; i++) {
        currentLoadingIndexRef.current = i + 1;
        await loadSegment(segments[i], i);
      }

      // 自动播放
      if (autoPlay) {
        video.play().catch(() => {});
      }
    }, [segments, loadSegment, autoPlay]);

    /**
     * 销毁播放器
     */
    const destroy = useCallback(() => {
      // 取消正在进行的请求
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      // 停止 mp4box
      mp4boxFileRef.current?.stop();
      mp4boxFileRef.current = null;

      // 清理 MediaSource
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }

      if (mediaSourceRef.current?.readyState === "open") {
        try {
          mediaSourceRef.current.endOfStream();
        } catch (e) {
          // ignore
        }
      }

      mediaSourceRef.current = null;
      sourceBufferRef.current = null;
      pendingBuffersRef.current = [];
      timestampOffsetRef.current = 0;
      currentLoadingIndexRef.current = 0;
      initializedRef.current = false;
      isAppendingRef.current = false;
    }, []);

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          videoRef.current?.play().catch(() => {});
        },
        pause: () => {
          videoRef.current?.pause();
        },
        seek: (time: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        },
        setPlaybackRate: (rate: number) => {
          if (videoRef.current) {
            videoRef.current.playbackRate = rate;
          }
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => videoRef.current?.duration ?? 0,
        destroy,
      }),
      [destroy]
    );

    // 初始化
    useEffect(() => {
      initialize();
      return () => {
        destroy();
      };
    }, [initialize, destroy]);

    // 监听视频事件
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlePlay = () => {
        setState((prev) => ({ ...prev, isPlaying: true }));
        onPlayStateChange?.(true);
      };

      const handlePause = () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
        onPlayStateChange?.(false);
      };

      const handleTimeUpdate = () => {
        const currentTime = video.currentTime;
        const duration = video.duration || 0;
        setState((prev) => ({ ...prev, currentTime, duration }));
        onTimeUpdate?.(currentTime, duration);
      };

      const handleEnded = () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
        onPlayStateChange?.(false);
        onEnded?.();
      };

      const handleError = () => {
        const error = video.error;
        if (error) {
          onError?.(new Error(`Video error: ${error.message}`));
        }
      };

      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("error", handleError);
      };
    }, [onPlayStateChange, onTimeUpdate, onEnded, onError]);

    return (
      <div className={className}>
        <video
          ref={videoRef}
          className="w-full h-full bg-black"
          playsInline
          controls
        />
        {/* 加载状态指示 */}
        {state.loadedSegments < state.totalSegments && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            加载中: {state.loadedSegments}/{state.totalSegments}
          </div>
        )}
      </div>
    );
  }
);

SeamlessPlayer.displayName = "SeamlessPlayer";

export default SeamlessPlayer;
