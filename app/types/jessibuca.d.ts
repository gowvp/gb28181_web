/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace Jessibuca {
  interface Config {
    container: HTMLElement | string;
    videoBuffer?: number;
    decoder?: string;
    forceNoOffscreen?: boolean;
    hiddenAutoPause?: boolean;
    hasAudio?: boolean;
    rotate?: boolean;
    isResize?: boolean;
    isFullResize?: boolean;
    isFlv?: boolean;
    debug?: boolean;
    timeout?: number;
    heartTimeout?: number;
    loadingTimeout?: number;
    supportDblclickFullscreen?: boolean;
    showBandwidth?: boolean;
    operateBtns?: {
      fullscreen?: boolean;
      screenshot?: boolean;
      play?: boolean;
      audio?: boolean;
      record?: boolean;
    };
    keepScreenOn?: boolean;
    isNotMute?: boolean;
    loadingText?: string;
    background?: string;
    useMSE?: boolean;
    useWCS?: boolean;
    hotKey?: boolean;
    autoWasm?: boolean;
    heartTimeoutReplay?: boolean;
    heartTimeoutReplayTimes?: number;
    loadingTimeoutReplay?: boolean;
    loadingTimeoutReplayTimes?: number;
    wasmDecodeErrorReplay?: boolean;
    openWebglAlignment?: boolean;
    wcsUseVideoRender?: boolean;
    controlAutoHide?: boolean;
    recordType?: "webm" | "mp4";
    useWebFullScreen?: boolean;
    autoUseSystemFullScreen?: boolean;
  }
}

declare class Jessibuca {
  constructor(config?: Jessibuca.Config);

  setDebug(flag: boolean): void;
  mute(): void;
  cancelMute(): void;
  audioResume(): void;
  setTimeout(): void;
  setScaleMode(mode: number): void;
  pause(): Promise<void>;
  close(): void;
  destroy(): void;
  clearView(): void;

  play(url?: string, options?: { headers: Record<string, string> }): Promise<void>;

  resize(): void;
  setBufferTime(time: number): void;
  setRotate(deg: number): void;
  setVolume(volume: number): void;
  hasLoaded(): boolean;
  setKeepScreenOn(): boolean;
  setFullscreen(flag: boolean): void;
  screenshot(filename?: string, format?: string, quality?: number, type?: string): string | void;
  startRecord(fileName: string, fileType: string): void;
  stopRecordAndSave(): void;
  isPlaying(): boolean;
  isMute(): boolean;
  isRecording(): boolean;
  toggleControlBar(isShow?: boolean): void;
  getControlBarShow(): boolean;

  on(event: string, callback: (...args: any[]) => void): void;
  off?(event: string, callback?: (...args: any[]) => void): void;
}

interface Window {
  Jessibuca: typeof Jessibuca;
}
