import React, { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Modal } from "antd";
import logger from "~/lib/logger";

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

// 为什么: 用户期望不支持 H.265 时弹窗告知, 不自动降级。统一弹窗文案与触发点。
function showUnsupportedModal() {
  Modal.warning({
    title: "当前浏览器或设备不支持 H.265",
    content:
      "WebRTC 协商未建立, 可能由于浏览器未启用 H.265 硬件解码, 或设备无相应硬件支持。请尝试切换 HTTP_FLV / WS_FLV 协议观看。",
    okText: "知道了",
  });
}

function WebRTCPlayer({ ref }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const signaling = toSignalingURL(link);
    if (!signaling) {
      showUnsupportedModal();
      return;
    }

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    // 为什么: recvonly 模式下, 远端 track 到达才说明协商+解码链路可用。
    // 若超过 5 秒仍未到达, 多半是 H.265 不兼容或网络不通, 直接提示用户切协议。
    trackTimerRef.current = setTimeout(() => {
      if (pcRef.current === pc && !videoRef.current?.srcObject) {
        logger.error("WebRTCPlayer ~ no track within 5s, treat as unsupported");
        destroy();
        showUnsupportedModal();
      }
    }, 5000);

    pc.ontrack = (ev) => {
      if (videoRef.current && ev.streams[0]) {
        videoRef.current.srcObject = ev.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      logger.info("WebRTCPlayer ~ ice state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        destroy();
        showUnsupportedModal();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const ac = new AbortController();
      abortRef.current = ac;
      const resp = await fetch(signaling, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
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
      await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
      logger.info("WebRTCPlayer ~ setRemoteDescription ok");
    } catch (e) {
      logger.error("WebRTCPlayer ~ play failed:", e);
      destroy();
      showUnsupportedModal();
    }
  }, [destroy]);

  useImperativeHandle(ref, () => ({ play, destroy }), [play, destroy]);

  useEffect(() => {
    return () => destroy();
  }, [destroy]);

  return (
    <video
      ref={videoRef}
      className="min-w-full min-h-full rounded-lg bg-black"
      autoPlay
      playsInline
      muted
      controls={false}
    />
  );
}

export default WebRTCPlayer;
