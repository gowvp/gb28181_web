import { useEffect, useRef, useState } from "react";
import {
  getCachedThumbBlob,
  requestCompressedThumb,
  setCachedThumbBlob,
} from "~/lib/alerts-image-pipeline";

type Props = {
  originalUrl: string;
  eager?: boolean;
  scrollRoot?: HTMLElement | null;
  alt: string;
  className?: string;
};

export function AlertThumbnail({
  originalUrl,
  eager = true,
  scrollRoot = null,
  alt,
  className = "",
}: Props) {
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
    if (!eager) {
      return;
    }
    cancelledRef.current = false;
    const gen = ++loadGenRef.current;

    const cached = getCachedThumbBlob(originalUrl);
    if (cached) {
      revokeCurrent();
      const u = URL.createObjectURL(cached);
      objectUrlRef.current = u;
      setThumbSrc(u);
      setPhase("ready");
      return () => {
        cancelledRef.current = true;
        loadGenRef.current += 1;
        revokeCurrent();
        setThumbSrc(null);
        setPhase("placeholder");
      };
    }

    setPhase("placeholder");
    void (async () => {
      try {
        const { buffer, mimeType } = await requestCompressedThumb(originalUrl, 1);
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

    return () => {
      cancelledRef.current = true;
      loadGenRef.current += 1;
      revokeCurrent();
      setThumbSrc(null);
      setPhase("placeholder");
    };
  }, [eager, originalUrl]);

  useEffect(() => {
    if (eager) {
      return;
    }
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
      { root: scrollRoot, rootMargin: "80% 0px", threshold: 0 },
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
  }, [eager, originalUrl, scrollRoot]);

  return (
    <div ref={containerRef} className={`relative aspect-video overflow-hidden ${className}`}>
      {phase !== "ready" ? (
        <div className="absolute inset-0 bg-slate-200/85" aria-hidden />
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
