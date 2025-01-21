import React, { useEffect, useImperativeHandle, useRef } from "react";
import type Jessibuca from "./jessibuca";
import { toastError } from "../xui/toast";

declare global {
  interface Window {
    Jessibuca: any;
  }
}

export type PlayerRef = {
  play: (link: string) => void;
  destroy: () => void;
};

interface PlayerProps {
  ref: React.RefObject<PlayerRef | null>;
  link: string; // 播放的流地址
}

function Player({ ref, link }: PlayerProps) {
  useImperativeHandle(ref, () => ({
    play,
    destroy,
  }));

  const divRef = useRef<HTMLDivElement>(null);
  const p = useRef<Jessibuca>(null);

  useEffect(() => {
    console.log("🚀 ~Jessibuca-player useEffect ~ init jessibuca", useEffect);

    // 播放器已经初始化，无需再次执行
    if (p.current) {
      console.log(
        "🚀 ~Jessibuca-player useEffect ~ exist, hasload:",
        p.current.hasLoaded()
      );
      return;
    }

    const cfg: Jessibuca.Config = {
      container: divRef.current!,
      // 注意，这里很重要!! 加载解码器的路径
      decoder: `${import.meta.env.VITE_BASENAME}assets/js/decoder.js`,
      debug: false,
      useMSE: true,
      isNotMute: false,
      showBandwidth: true, // 显示带宽
      loadingTimeout: 7, // 加载地址超时
      heartTimeout: 7, // 没有流数据，超时
      videoBuffer: 0.6,
      isResize: true,
      operateBtns: {
        fullscreen: true,
        screenshot: true,
        play: true,
        audio: true,
        record: true,
      },
    };
    p.current = new window.Jessibuca(cfg);

    // 如果传入了播放链接，在加载播放器以后就可以播放了
    if (link) {
      play(link);
    }
    return () => {
      console.log("🚀 ~ Jessibuca-player ~ dispose");
    };
  }, []);

  const play = (link: string) => {
    console.log("🚀 Jessibuca-player ~ play ~ link:", link);
    if (!p.current) {
      console.log("🚀 Jessibuca-player ~ play ~ 播放器未初始化:");
      toastError("播放器未初始化");
      return;
    }
    if (!p.current.hasLoaded()) {
      console.log("🚀 Jessibuca-player ~ play ~ 播放器未加载完成:");
      toastError("播放器未加载完成");
      return;
    }

    p.current
      .play(link)
      .then(() => {
        console.log("🚀 Jessibuca-player ~ play ~ success");
      })
      .catch((e) => {
        toastError("播放失败", { description: e.message });
      });
  };

  const destroy = () => {
    console.log("🚀 Jessibuca-player ~ play destroy");
    if (p.current) {
      p.current.destroy();
      p.current = null;
    }
  };

  return (
    <div
      className="min-w-full min-h-full rounded-lg bg-black"
      ref={divRef}
    ></div>
  );
}

export default Player;
