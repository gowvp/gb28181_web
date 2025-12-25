import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import logger from "~/lib/logger";
import { toastError } from "../xui/toast";
import type Jessibuca from "./jessibuca";

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
  link?: string; // 播放的流地址
}

function Player({ ref }: PlayerProps) {
  useImperativeHandle(ref, () => ({
    play,
    destroy,
  }));

  const divRef = useRef<HTMLDivElement>(null);
  const p = useRef<Jessibuca>(null);
  // 记录待播放的链接（用于播放器加载完成后自动播放）
  const pendingPlayRef = useRef<string | null>(null);

  // 内部播放方法（不检查加载状态）- 使用 useCallback 包装以避免依赖问题
  const playInternal = useCallback((link: string) => {
    if (!p.current) {
      logger.error("Jessibuca-player ~ playInternal ~ 播放器未初始化");
      return;
    }

    p.current
      .play(link)
      .then(() => {
        logger.info("Jessibuca-player ~ play ~ success");
      })
      .catch((e: Error) => {
        toastError("播放失败", { description: e.message });
      });
  }, []);

  useEffect(() => {
    logger.info("Jessibuca-player useEffect ~ init jessibuca");

    // 播放器已经初始化，无需再次执行
    if (p.current) {
      logger.info(
        "Jessibuca-player useEffect ~ exist, hasload:",
        p.current.hasLoaded(),
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

    // 监听播放器初始化完成事件
    // 使用轮询检测播放器是否加载完成（Jessibuca没有提供ready事件）
    const checkLoaded = () => {
      if (p.current?.hasLoaded()) {
        logger.info("Jessibuca-player ~ 播放器加载完成");

        // 如果有待播放的链接，立即播放
        if (pendingPlayRef.current) {
          logger.info(
            "Jessibuca-player ~ 执行待播放链接:",
            pendingPlayRef.current,
          );
          const link = pendingPlayRef.current;
          pendingPlayRef.current = null;
          playInternal(link);
        }
      } else {
        // 继续轮询，每100ms检查一次
        setTimeout(checkLoaded, 100);
      }
    };

    // 启动加载检测
    checkLoaded();

    return () => {
      logger.info("Jessibuca-player ~ dispose");
    };
  }, [playInternal]);

  const play = (link: string) => {
    logger.info("Jessibuca-player ~ play ~ link:", link);

    if (!p.current) {
      logger.error("Jessibuca-player ~ play ~ 播放器未初始化");
      toastError("播放器未初始化");
      return;
    }

    // 如果播放器已加载完成，直接播放
    if (p.current.hasLoaded()) {
      playInternal(link);
    } else {
      // 如果未加载完成，记录待播放链接，等待加载完成后自动播放
      logger.info(
        "Jessibuca-player ~ play ~ 播放器正在加载中，将在加载完成后自动播放",
      );
      pendingPlayRef.current = link;

      // 设置超时检测（5秒后如果还未加载完成则提示错误）
      setTimeout(() => {
        if (pendingPlayRef.current === link) {
          logger.error("Jessibuca-player ~ play ~ 播放器加载超时");
          pendingPlayRef.current = null;
          toastError("播放器加载超时，请刷新页面重试");
        }
      }, 5000);
    }
  };

  const destroy = () => {
    logger.info("Jessibuca-player ~ destroy");

    // 清除待播放链接
    pendingPlayRef.current = null;

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
