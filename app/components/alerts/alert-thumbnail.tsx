import { useEffect, useRef, useState } from "react";
import {
  getCachedThumbBlob,
  requestCompressedThumb,
  setCachedThumbBlob,
} from "~/lib/alerts-image-pipeline";

type Props = {
  /** 完整图片 URL，列表只展示压缩缩略图，预览仍用此地址 */
  originalUrl: string;
  /** 滚动容器，用于 IntersectionObserver 根 */
  scrollRoot: HTMLElement | null;
  alt: string;
  className?: string;
};

/**
 * 为什么不直接写 img.src=原图：
 * 浏览器会立刻拉取并解码大位图；经 Worker 缩成 WebP 再展示，预览仍走原始 URL。
 */
export function AlertThumbnail({ originalUrl, scrollRoot, alt, className = "" }: Props) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<"placeholder" | "ready" | "error">("placeholder");
  const objectUrlRef = useRef<string | null>(null);
  const loadGenRef = useRef(0);
  const cancelledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const revokeCurrent = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !scrollRoot) {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        if (!entry.isIntersecting) {
          cancelledRef.current = true;
          loadGenRef.current += 1;
          revokeCurrent();
          setThumbSrc(null);
          setPhase("placeholder");
          return;
        }

        cancelledRef.current = false;
        const rootRect = scrollRoot.getBoundingClientRect();
        const box = entry.boundingClientRect;
        const inStrictViewport = box.bottom > rootRect.top && box.top < rootRect.bottom;
        const priority = inStrictViewport ? 0 : 1;

        const cached = getCachedThumbBlob(originalUrl);
        if (cached) {
          revokeCurrent();
          const u = URL.createObjectURL(cached);
          objectUrlRef.current = u;
          setThumbSrc(u);
          setPhase("ready");
          return;
        }

        const gen = ++loadGenRef.current;
        setPhase("placeholder");
        void (async () => {
          try {
            const { buffer, mimeType } = await requestCompressedThumb(originalUrl, priority);
            if (cancelledRef.current || gen !== loadGenRef.current) {
              return;
            }
            const blob = new Blob([buffer], { type: mimeType });
            setCachedThumbBlob(originalUrl, blob);
            revokeCurrent();
            const u = URL.createObjectURL(blob);
            objectUrlRef.current = u;
            setThumbSrc(u);
            setPhase("ready");
          } catch (e) {
            console.warn("[alerts] thumb compress failed", originalUrl, e);
            if (!cancelledRef.current && gen === loadGenRef.current) {
              setPhase("error");
            }
          }
        })();
      },
      { root: scrollRoot, rootMargin: "100% 0px", threshold: 0 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelledRef.current = true;
      loadGenRef.current += 1;
      revokeCurrent();
      setThumbSrc(null);
      setPhase("placeholder");
    };
  }, [originalUrl, scrollRoot]);

  return (
    <div ref={containerRef} className={`relative aspect-video overflow-hidden ${className}`}>
      {phase !== "ready" ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200/80 via-slate-100/90 to-slate-200/80"
          aria-hidden
        />
      ) : null}
      {thumbSrc ? (
        <img src={thumbSrc} alt={alt} className="relative z-[1] h-full w-full object-cover" decoding="async" />
      ) : null}
      {phase === "error" ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-slate-100 text-xs text-slate-400">
          —
        </div>
      ) : null}
    </div>
  );
}
