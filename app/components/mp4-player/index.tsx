import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export interface VideoSegment {
  id: number | string;
  url: string;
  duration: number;
  startTime: number;
  endTime?: number;
}

export interface Mp4PlayerRef {
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number, autoPlay?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
}

export interface Mp4PlayerProps {
  segments: VideoSegment[];
  onTimeUpdate?: (timeSeconds: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onError?: (error: Error) => void;
  onSegmentError?: (segment: VideoSegment, error: Error) => void;
  onEnded?: () => void;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
}

type PendingSeek = {
  offsetSeconds: number;
  autoPlay: boolean;
};

const Mp4Player = forwardRef<Mp4PlayerRef, Mp4PlayerProps>(
  (
    {
      segments,
      onTimeUpdate,
      onDurationChange,
      onPlayStateChange,
      onError,
      onSegmentError,
      onEnded,
      className = "",
      autoPlay = false,
      controls = false,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentIndexRef = useRef(0);
    const accumulatedTimeRef = useRef(0);
    const pendingSeekRef = useRef<PendingSeek | null>(null);
    const isPlayingRef = useRef(false);
    const playbackRateRef = useRef(1);
    const mutedRef = useRef(false);
    const volumeRef = useRef(1);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onDurationChangeRef = useRef(onDurationChange);
    const onPlayStateChangeRef = useRef(onPlayStateChange);
    const onErrorRef = useRef(onError);
    const onSegmentErrorRef = useRef(onSegmentError);
    const onEndedRef = useRef(onEnded);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlayingState, setIsPlayingState] = useState(false);

    useEffect(() => {
      onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    useEffect(() => {
      onDurationChangeRef.current = onDurationChange;
    }, [onDurationChange]);

    useEffect(() => {
      onPlayStateChangeRef.current = onPlayStateChange;
    }, [onPlayStateChange]);

    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
      onSegmentErrorRef.current = onSegmentError;
    }, [onSegmentError]);

    useEffect(() => {
      onEndedRef.current = onEnded;
    }, [onEnded]);

    const emitPlayState = useCallback((playing: boolean) => {
      onPlayStateChangeRef.current?.(playing);
    }, []);

    const emitError = useCallback((error: Error) => {
      onErrorRef.current?.(error);
    }, []);

    const emitSegmentError = useCallback((segment: VideoSegment, error: Error) => {
      onSegmentErrorRef.current?.(segment, error);
    }, []);

    const emitEnded = useCallback(() => {
      onEndedRef.current?.();
    }, []);

    const totalDuration = useMemo(
      () => segments.reduce((sum, segment) => sum + Math.max(segment.duration, 0), 0),
      [segments],
    );

    const segmentsSignature = useMemo(
      () =>
        segments
          .map((segment) => `${segment.id}:${segment.url}:${segment.duration}:${segment.startTime}:${segment.endTime ?? ""}`)
          .join("|"),
      [segments],
    );

    useEffect(() => {
      onDurationChangeRef.current?.(totalDuration * 1000);
    }, [totalDuration]);

    const getAccumulatedTime = useCallback(
      (index: number) => {
        let sum = 0;
        for (let i = 0; i < index && i < segments.length; i += 1) {
          sum += Math.max(segments[i].duration, 0);
        }
        return sum;
      },
      [segments],
    );

    const syncMediaState = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = playbackRateRef.current;
      video.muted = mutedRef.current;
      video.volume = volumeRef.current;
    }, []);

    const applyPendingSeek = useCallback(() => {
      const video = videoRef.current;
      const pending = pendingSeekRef.current;
      const segment = segments[currentIndexRef.current];
      if (!video || !pending || !segment || video.readyState < 1) {
        return;
      }

      syncMediaState();

      const mediaDuration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : Math.max(segment.duration, 0);
      const clampedOffset = Math.min(Math.max(pending.offsetSeconds, 0), mediaDuration || 0);

      try {
        video.currentTime = Number.isFinite(clampedOffset) ? clampedOffset : 0;
      } catch {
        video.currentTime = 0;
      }

      pendingSeekRef.current = null;

      if (pending.autoPlay) {
        video
          .play()
          .then(() => {
            isPlayingRef.current = true;
            setIsPlayingState(true);
            emitPlayState(true);
          })
          .catch((error: unknown) => {
            emitError(toError(error));
          });
      }
    }, [emitError, emitPlayState, segments, syncMediaState]);

    const loadSegment = useCallback(
      (index: number, offsetSeconds = 0, autoPlayNext = false) => {
        const video = videoRef.current;
        const segment = segments[index];
        if (!video || !segment) return;

        currentIndexRef.current = index;
        setCurrentIndex(index);
        accumulatedTimeRef.current = getAccumulatedTime(index);
        pendingSeekRef.current = {
          offsetSeconds,
          autoPlay: autoPlayNext,
        };

        syncMediaState();

        if (video.src !== resolveUrl(segment.url)) {
          video.src = segment.url;
          video.load();
          return;
        }

        applyPendingSeek();
      },
      [applyPendingSeek, getAccumulatedTime, segments, syncMediaState],
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (segments.length === 0) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        currentIndexRef.current = 0;
        accumulatedTimeRef.current = 0;
        pendingSeekRef.current = null;
        isPlayingRef.current = false;
        setCurrentIndex(0);
        setIsPlayingState(false);
        emitPlayState(false);
        return;
      }

      const previousIndex = Math.min(currentIndexRef.current, segments.length - 1);
      loadSegment(previousIndex, 0, autoPlay && previousIndex === 0);
    }, [autoPlay, emitPlayState, loadSegment, segments.length, segmentsSignature]);

    const play = useCallback(() => {
      const video = videoRef.current;
      if (!video || segments.length === 0) return;

      syncMediaState();

      if (!video.src) {
        loadSegment(0, 0, true);
        return;
      }

      video
        .play()
        .then(() => {
          isPlayingRef.current = true;
          setIsPlayingState(true);
          emitPlayState(true);
        })
        .catch((error: unknown) => {
          emitError(toError(error));
        });
    }, [emitError, emitPlayState, loadSegment, segments.length, syncMediaState]);

    const pause = useCallback(() => {
      videoRef.current?.pause();
      isPlayingRef.current = false;
      setIsPlayingState(false);
      emitPlayState(false);
    }, [emitPlayState]);

    const resume = useCallback(() => {
      const video = videoRef.current;
      if (!video || segments.length === 0) return;

      syncMediaState();

      if (!video.src) {
        loadSegment(currentIndexRef.current, 0, true);
        return;
      }

      video
        .play()
        .then(() => {
          isPlayingRef.current = true;
          setIsPlayingState(true);
          emitPlayState(true);
        })
        .catch((error: unknown) => {
          emitError(toError(error));
        });
    }, [emitError, emitPlayState, loadSegment, segments.length, syncMediaState]);

    const stop = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      isPlayingRef.current = false;
      setIsPlayingState(false);
      emitPlayState(false);
      if (segments.length > 0) {
        loadSegment(0, 0, false);
      } else {
        video.removeAttribute("src");
        video.load();
      }
    }, [emitPlayState, loadSegment, segments.length]);

    const seek = useCallback(
      (time: number, autoPlayNext = false) => {
        if (segments.length === 0) return;

        const safeTime = Math.min(Math.max(time, 0), totalDuration);
        let accumulated = 0;

        for (let index = 0; index < segments.length; index += 1) {
          const segment = segments[index];
          const nextAccumulated = accumulated + Math.max(segment.duration, 0);
          const isLast = index === segments.length - 1;
          if (safeTime < nextAccumulated || isLast) {
            const offsetSeconds = Math.max(safeTime - accumulated, 0);
            loadSegment(index, offsetSeconds, autoPlayNext);
            if (index === currentIndexRef.current && videoRef.current?.readyState) {
              applyPendingSeek();
            }
            return;
          }
          accumulated = nextAccumulated;
        }
      },
      [applyPendingSeek, loadSegment, segments, totalDuration],
    );

    const setPlaybackRate = useCallback((rate: number) => {
      playbackRateRef.current = Number.isFinite(rate) && rate > 0 ? rate : 1;
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRateRef.current;
      }
    }, []);

    const getCurrentTime = useCallback(() => {
      return accumulatedTimeRef.current + (videoRef.current?.currentTime ?? 0);
    }, []);

    const getDuration = useCallback(() => totalDuration, [totalDuration]);

    const isPlaying = useCallback(() => isPlayingRef.current, []);

    const setMuted = useCallback((muted: boolean) => {
      mutedRef.current = muted;
      if (videoRef.current) {
        videoRef.current.muted = muted;
      }
    }, []);

    const setVolume = useCallback((volume: number) => {
      volumeRef.current = Math.min(Math.max(volume, 0), 1);
      if (videoRef.current) {
        videoRef.current.volume = volumeRef.current;
      }
    }, []);

    const getVolume = useCallback(() => volumeRef.current, []);

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
        isPlaying,
        setMuted,
        setVolume,
        getVolume,
      }),
      [getCurrentTime, getDuration, getVolume, isPlaying, pause, play, resume, seek, setMuted, setPlaybackRate, setVolume, stop],
    );

    const handleLoadedMetadata = useCallback(() => {
      applyPendingSeek();
    }, [applyPendingSeek]);

    const handleTimeUpdate = useCallback(() => {
      onTimeUpdateRef.current?.(getCurrentTime());
    }, [getCurrentTime]);

    const handleEnded = useCallback(() => {
      if (currentIndexRef.current < segments.length - 1) {
        loadSegment(currentIndexRef.current + 1, 0, true);
        return;
      }

      isPlayingRef.current = false;
      setIsPlayingState(false);
      emitPlayState(false);
      emitEnded();
    }, [emitEnded, emitPlayState, loadSegment, segments.length]);

    const handleError = useCallback(() => {
      const video = videoRef.current;
      const currentSegment = segments[currentIndexRef.current];
      const baseMessage = video?.error?.message || "Video error";
      const error = new Error(
        currentSegment
          ? `片段播放失败: ${currentSegment.url} - ${baseMessage}`
          : baseMessage,
      );

      if (currentSegment) {
        emitSegmentError(currentSegment, error);
      }

      if (currentIndexRef.current < segments.length - 1) {
        loadSegment(currentIndexRef.current + 1, 0, isPlayingRef.current);
      }

      emitError(error);
    }, [emitError, emitSegmentError, loadSegment, segments]);

    return (
      <video
        ref={videoRef}
        className={className}
        style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
        playsInline
        controls={controls}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={applyPendingSeek}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        onPlay={() => {
          isPlayingRef.current = true;
          setIsPlayingState(true);
          emitPlayState(true);
        }}
        onPause={() => {
          if (!videoRef.current?.ended) {
            isPlayingRef.current = false;
            setIsPlayingState(false);
            emitPlayState(false);
          }
        }}
        data-playing={isPlayingState ? "true" : "false"}
      />
    );
  },
);

Mp4Player.displayName = "Mp4Player";

function resolveUrl(url: string): string {
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.href).href;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export default Mp4Player;
