import type React from "react";
import { useCallback, useImperativeHandle, useRef } from "react";
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
  const divRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Jessibuca | null>(null);
  // 当前播放的链接
  const currentLinkRef = useRef<string | null>(null);
  // 是否正在切换流（防止并发切换导致的问题）
  const isSwitchingRef = useRef(false);
  // 记录待播放的链接（用于切换过程中有新的播放请求）
  const pendingPlayRef = useRef<string | null>(null);

  // 创建 Jessibuca 配置
  const createConfig = useCallback((): Jessibuca.Config => {
    return {
      container: divRef.current!,
      // 注意，这里很重要!! 加载解码器的路径
      decoder: `${import.meta.env.VITE_BASENAME}assets/js/decoder.js`,
      debug: false,
      useMSE: true,
      isNotMute: false,
      showBandwidth: true, // 显示带宽
      loadingTimeout: 10,
      heartTimeout: 10,
      videoBuffer: 0.6,
      isResize: true,
      isFlv: true, // 启用 flv 协议解析
      operateBtns: {
        fullscreen: true,
        screenshot: true,
        play: true,
        audio: true,
        record: true,
      },
    };
  }, []);

  // 创建新的播放器实例
  const createPlayer = useCallback((): Promise<Jessibuca> => {
    return new Promise((resolve, reject) => {
      if (!divRef.current) {
        reject(new Error("容器不存在"));
        return;
      }

      const cfg = createConfig();
      const player = new window.Jessibuca(cfg);

      // 轮询检测播放器是否加载完成
      let attempts = 0;
      const maxAttempts = 50; // 最多等待 5 秒

      const checkLoaded = () => {
        attempts++;
        if (player.hasLoaded()) {
          logger.info("Jessibuca-player ~ 播放器加载完成");
          resolve(player);
        } else if (attempts < maxAttempts) {
          setTimeout(checkLoaded, 100);
        } else {
          reject(new Error("播放器加载超时"));
        }
      };
      checkLoaded();
    });
  }, [createConfig]);

  // 销毁当前播放器实例
  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      logger.info("Jessibuca-player ~ 销毁当前播放器实例");
      try {
        playerRef.current.destroy();
      } catch (e) {
        logger.warn("Jessibuca-player ~ destroy 失败:", e);
      }
      playerRef.current = null;
      currentLinkRef.current = null;
    }
  }, []);

  // 执行播放（切换流时会销毁并重建播放器，确保状态干净）
  const doPlay = useCallback(async (link: string) => {
    logger.info("Jessibuca-player ~ doPlay ~ link:", link);

    // 如果正在切换中，记录待播放链接并返回
    if (isSwitchingRef.current) {
      logger.warn("Jessibuca-player ~ doPlay ~ 正在切换中，记录待播放链接");
      pendingPlayRef.current = link;
      return;
    }

    // 如果播放的是相同链接，直接返回
    if (currentLinkRef.current === link && playerRef.current?.isPlaying()) {
      logger.info("Jessibuca-player ~ doPlay ~ 已在播放相同链接");
      return;
    }

    isSwitchingRef.current = true;

    try {
      // 如果有旧的播放器实例，先销毁它（确保状态干净）
      if (playerRef.current) {
        destroyPlayer();
        // 等待一小段时间确保资源完全释放
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 检查是否有更新的待播放链接
      if (pendingPlayRef.current && pendingPlayRef.current !== link) {
        const newLink = pendingPlayRef.current;
        pendingPlayRef.current = null;
        isSwitchingRef.current = false;
        doPlay(newLink);
        return;
      }

      // 创建新的播放器实例
      const player = await createPlayer();
      playerRef.current = player;

      // 再次检查是否有更新的待播放链接
      if (pendingPlayRef.current && pendingPlayRef.current !== link) {
        const newLink = pendingPlayRef.current;
        pendingPlayRef.current = null;
        isSwitchingRef.current = false;
        doPlay(newLink);
        return;
      }

      // 播放
      currentLinkRef.current = link;
      await player.play(link);
      logger.info("Jessibuca-player ~ play ~ success");
    } catch (e: unknown) {
      const error = e as Error;
      logger.error("Jessibuca-player ~ play ~ error:", error?.message || e);
      toastError("播放失败", { description: error?.message || "未知错误" });
    } finally {
      isSwitchingRef.current = false;

      // 处理在切换过程中新来的播放请求
      if (pendingPlayRef.current) {
        const newLink = pendingPlayRef.current;
        pendingPlayRef.current = null;
        doPlay(newLink);
      }
    }
  }, [createPlayer, destroyPlayer]);

  // 外部调用的播放方法
  const play = useCallback((link: string) => {
    logger.info("Jessibuca-player ~ play ~ link:", link);

    if (!divRef.current) {
      logger.error("Jessibuca-player ~ play ~ 容器不存在");
      toastError("播放器容器不存在");
      return;
    }

    doPlay(link);
  }, [doPlay]);

  // 销毁方法
  const destroy = useCallback(() => {
    logger.info("Jessibuca-player ~ destroy");
    pendingPlayRef.current = null;
    isSwitchingRef.current = false;
    destroyPlayer();
  }, [destroyPlayer]);

  useImperativeHandle(ref, () => ({
    play,
    destroy,
  }), [play, destroy]);

  return (
    <div
      className="min-w-full min-h-full rounded-lg bg-black"
      ref={divRef}
    />
  );
}

export default Player;
