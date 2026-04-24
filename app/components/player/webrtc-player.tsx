import { AlertTriangle } from "lucide-react";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import logger from "~/lib/logger";

const WARN_MSG =
  "WebRTC 协商未建立, 可能由于浏览器未启用 H.265 硬件解码, 或设备无相应硬件支持。请尝试切换 HTTP_FLV / WS_FLV 协议观看。";

export type WebRTCPlayerRef = {
  play: (link: string) => Promise<void>;
  destroy: () => void;
};

interface WebRTCPlayerProps {
  ref: React.RefObject<WebRTCPlayerRef | null>;
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

function WebRTCPlayer({ ref }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

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

  const play = useCallback(async (link: string) => {
    logger.info("WebRTCPlayer ~ play ~ link:", link);
    destroy();
    setWarning(null);

    const signaling = toSignalingURL(link);
    if (!signaling) {
      setWarning(WARN_MSG);
      return;
    }

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    // 为什么: recvonly 模式下, 远端 track 到达才说明协商+解码链路可用。
    // 需要预留 ICE gathering (≤2s) + 信令 (≤1s) + ICE 连通 (≤3s), 合计 8s 阈值更稳妥。
    // 超时仍未出画多半是 H.265 不兼容或网络不通, 直接提示用户切协议。
    trackTimerRef.current = setTimeout(() => {
      if (pcRef.current === pc && !videoRef.current?.srcObject) {
        logger.error("WebRTCPlayer ~ no track within 8s, treat as unsupported");
        destroy();
        setWarning(WARN_MSG);
      }
    }, 8000);

    pc.ontrack = (ev) => {
      logger.info("WebRTCPlayer ~ ontrack:", ev.track.kind);
      const v = videoRef.current;
      const stream = ev.streams[0];
      if (!v || !stream) return;
      // 为什么: video/audio 两次 ontrack 通常回传同一个 MediaStream, 重复赋值 srcObject
      // 会中断上一次的异步 play() 抛 AbortError 导致黑屏, 因此只在未绑定时设置并播放。
      if (v.srcObject !== stream) {
        v.srcObject = stream;
        v.play().catch((err) => {
          logger.warn("WebRTCPlayer ~ video.play rejected:", err);
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      logger.info("WebRTCPlayer ~ ice state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        destroy();
        setWarning(WARN_MSG);
      }
    };

    pc.onconnectionstatechange = () => {
      logger.info("WebRTCPlayer ~ pc state:", pc.connectionState);
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIceGatheringComplete(pc);

      const localSDP = pc.localDescription?.sdp || offer.sdp || "";
      logger.info("WebRTCPlayer ~ local sdp candidate count:",
        (localSDP.match(/^a=candidate:/gm) || []).length);

      const ac = new AbortController();
      abortRef.current = ac;
      const resp = await fetch(signaling, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: localSDP,
        signal: ac.signal,
      });
      if (!resp.ok) {
        throw new Error(`signaling http ${resp.status}`);
      }
      const text = await resp.text();
      // 为什么: ZLM 官方返回 JSON {code, sdp, ...}; 某些旧版可能直接返回 SDP 纯文本, 两种格式都兼容。
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
      const remoteCandidates = (answerSDP.match(/^a=candidate:.*$/gm) || []).map((l) =>
        l.replace(/^a=candidate:/, "")
      );
      logger.info("WebRTCPlayer ~ remote candidates:", remoteCandidates);
      await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
      logger.info("WebRTCPlayer ~ setRemoteDescription ok");
    } catch (e) {
      logger.error("WebRTCPlayer ~ play failed:", e);
      destroy();
      setWarning(WARN_MSG);
    }
  }, [destroy]);

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
          <span className="flex-1 break-words whitespace-normal leading-snug">{warning}</span>
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
