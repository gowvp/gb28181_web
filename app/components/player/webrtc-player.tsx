import { AlertTriangle } from "lucide-react";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import logger from "~/lib/logger";

const WARN_MSG =
  "WebRTC 协商失败! 请检查您的 Chrome 浏览器是否为 105 及以上版本。\n作为替代方案，您可以复制 HTTP_FLV 流地址到 VLC 播放器中打开。";

// 为什么: 流媒体服务端可能在信令成功后才开始推流，首次连接时 track 延迟到达是正常现象，
// 单次超时判定为故障会造成误报，所以用多次重试来容忍这种延迟。
const MAX_RETRIES = 3;
const TRACK_TIMEOUT_MS = 3000;
const LAST_ATTEMPT_TIMEOUT_MS = 6000;

export type WebRTCPlayerRef = {
  play: (link: string) => Promise<void>;
  destroy: () => void;
};

interface WebRTCPlayerProps {
  ref: React.RefObject<WebRTCPlayerRef | null>;
  onTrackReady?: () => void;
  onPlayFailed?: () => void;
}

// 为什么: ZLM 返回的 URL scheme 是 webrtc://, 浏览器无法直接识别, 需要按当前页面协议改写
// 成 http/https 做 HTTP 信令请求, 避免 mixed-content 被拦截。
function toSignalingURL(webrtcURL: string): string {
  if (!webrtcURL) return "";
  const scheme = typeof window !== "undefined" ? window.location.protocol : "http:";
  return webrtcURL.replace(/^webrtc:/i, scheme);
}

// 为什么: ZLM HTTP 信令是单次 offer/answer (非 trickle), 必须把带完整 a=candidate 的 SDP 一次性发过去。
// setLocalDescription 后 ICE gathering 是异步的, 不等 complete 就发送会导致 offer 里无 candidate,
// 浏览器建不起 ICE pair → 黑屏。这里等 gathering 完成或 2s 兜底超时。
function waitIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    const timer = setTimeout(done, timeoutMs);
  });
}

function WebRTCPlayer({ ref, onTrackReady, onPlayFailed }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (warning) onPlayFailed?.();
  }, [warning]);

  const destroy = useCallback(() => {
    if (trackTimerRef.current) {
      clearTimeout(trackTimerRef.current);
      trackTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
        pcRef.current.close();
      } catch (e) {
        logger.warn("WebRTCPlayer ~ close pc failed:", e);
      }
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 为什么: 单次连接可能因信令成功但流延迟到达而超时，提取为独立函数以支持外层重试。
  // 返回 true 表示 track 已到达，false 表示超时。抛异常表示信令/ICE 层面失败。
  const attemptConnect = useCallback(
    (signaling: string, attempt: number, timeoutMs: number): Promise<boolean> => {
      // 为什么: 新的重试必须中断前一次的信令请求和 PeerConnection，
      // 防止旧请求的响应干扰新连接状态。
      abortRef.current?.abort();
      abortRef.current = null;
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (_) {}
        pcRef.current = null;
      }

      return new Promise((resolve, reject) => {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        let settled = false;

        const cleanup = () => {
          if (trackTimerRef.current) {
            clearTimeout(trackTimerRef.current);
            trackTimerRef.current = null;
          }
        };

        const settle = (result: boolean | Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (result instanceof Error) {
            reject(result);
          } else {
            resolve(result);
          }
        };

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        trackTimerRef.current = setTimeout(() => {
          if (pcRef.current === pc && !videoRef.current?.srcObject) {
            logger.warn(`WebRTCPlayer ~ attempt ${attempt}/${MAX_RETRIES} no track within ${timeoutMs}ms`);
            try { pc.close(); } catch (_) {}
            if (pcRef.current === pc) pcRef.current = null;
            settle(false);
          }
        }, timeoutMs);

        pc.ontrack = (ev) => {
          logger.info(`WebRTCPlayer ~ attempt ${attempt} ontrack:`, ev.track.kind);
          const v = videoRef.current;
          const stream = ev.streams[0];
          if (!v || !stream) return;
          if (v.srcObject !== stream) {
            v.srcObject = stream;
            onTrackReady?.();
            v.play().catch((err) => {
              logger.warn("WebRTCPlayer ~ video.play rejected:", err);
            });
          }
          settle(true);
        };

        pc.oniceconnectionstatechange = () => {
          logger.info(`WebRTCPlayer ~ attempt ${attempt} ice state:`, pc.iceConnectionState);
          if (pc.iceConnectionState === "failed") {
            try { pc.close(); } catch (_) {}
            if (pcRef.current === pc) pcRef.current = null;
            settle(new Error("ICE connection failed"));
          }
        };

        pc.onconnectionstatechange = () => {
          logger.info(`WebRTCPlayer ~ attempt ${attempt} pc state:`, pc.connectionState);
        };

        (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await waitIceGatheringComplete(pc);

          const localSDP = pc.localDescription?.sdp || offer.sdp || "";
          logger.info(`WebRTCPlayer ~ attempt ${attempt} local candidates:`,
            (localSDP.match(/^a=candidate:/gm) || []).length);

          const ac = new AbortController();
          abortRef.current = ac;
          const signalingTimeout = setTimeout(() => ac.abort(), timeoutMs);
          let resp: Response;
          try {
            resp = await fetch(signaling, {
              method: "POST",
              headers: { "Content-Type": "application/sdp" },
              body: localSDP,
              signal: ac.signal,
            });
          } finally {
            clearTimeout(signalingTimeout);
          }
          if (!resp.ok) throw new Error(`signaling http ${resp.status}`);

          const text = await resp.text();
          let answerSDP = "";
          try {
            const obj = JSON.parse(text);
            if (obj.code !== 0) {
              throw new Error(`signaling code=${obj.code} msg=${obj.msg || "unknown"}`);
            }
            answerSDP = obj.sdp;
          } catch (_) {
            if (text.startsWith("v=")) {
              answerSDP = text;
            } else {
              throw new Error(`signaling bad response: ${text.slice(0, 120)}`);
            }
          }
          logger.info(`WebRTCPlayer ~ attempt ${attempt} remote candidates:`,
            (answerSDP.match(/^a=candidate:.*$/gm) || []).length);
          await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
          logger.info(`WebRTCPlayer ~ attempt ${attempt} setRemoteDescription ok`);
        })().catch((e) => {
          settle(e);
        });
      });
    },
    [onTrackReady],
  );

  const play = useCallback(async (link: string) => {
    logger.info("WebRTCPlayer ~ play ~ link:", link);
    destroy();
    setWarning(null);

    const signaling = toSignalingURL(link);
    if (!signaling) {
      setWarning(WARN_MSG);
      return;
    }

    for (let i = 1; i <= MAX_RETRIES; i++) {
      const timeout = i === MAX_RETRIES ? LAST_ATTEMPT_TIMEOUT_MS : TRACK_TIMEOUT_MS;
      try {
        const gotTrack = await attemptConnect(signaling, i, timeout);
        if (gotTrack) {
          logger.info(`WebRTCPlayer ~ attempt ${i} succeeded`);
          return;
        }
        logger.warn(`WebRTCPlayer ~ attempt ${i}/${MAX_RETRIES} timed out, ${i < MAX_RETRIES ? "retrying..." : "giving up"}`);
      } catch (e) {
        logger.error(`WebRTCPlayer ~ attempt ${i}/${MAX_RETRIES} error:`, e);
        if (i >= MAX_RETRIES) break;
        logger.info(`WebRTCPlayer ~ retrying after error...`);
      }
    }

    logger.error(`WebRTCPlayer ~ all ${MAX_RETRIES} attempts failed`);
    destroy();
    setWarning(WARN_MSG);
  }, [destroy, attemptConnect]);

  useImperativeHandle(ref, () => ({ play, destroy }), [play, destroy]);

  useEffect(() => {
    return () => destroy();
  }, [destroy]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="min-w-full min-h-full rounded-lg bg-black"
        autoPlay
        playsInline
        muted
        controls={false}
      />
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

export default WebRTCPlayer;
