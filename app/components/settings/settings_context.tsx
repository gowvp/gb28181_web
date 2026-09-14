import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import SettingsModal, { type MenuKey } from "./settings_modal";

interface SettingsContextValue {
  openSettings: (key?: MenuKey) => void;
  closeSettings: () => void;
  isOpen: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const OPEN_SETTINGS_EVENT = "gowvp:open-settings";

export interface OpenSettingsEventDetail {
  key?: MenuKey;
}

/**
 * 全局触发打开设置弹窗（支持深层组件或事件回调中无须透传 props 即刻调起）
 */
export function openGlobalSettings(key?: MenuKey) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<OpenSettingsEventDetail>(OPEN_SETTINGS_EVENT, {
        detail: { key },
      }),
    );
  }
}

/**
 * 为什么在根布局提供顶层 SettingsProvider：
 * 1. 彻底脱离所有局部子组件、按钮、悬浮菜单的 DOM 容器与 CSS transform 限制；
 * 2. 避免在桌面、卡片、顶部菜单等分散位置各自维护独立 SettingsModal 实例；
 * 3. 保证设置弹窗全屏视口居中、背景暗度与毛玻璃统一挂载。
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialKey, setInitialKey] = useState<MenuKey>("account");

  const openSettings = useCallback((key?: MenuKey) => {
    if (key) {
      setInitialKey(key);
    }
    setOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<OpenSettingsEventDetail>;
      openSettings(customEvent.detail?.key);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, handleEvent);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handleEvent);
  }, [openSettings]);

  return (
    <SettingsContext.Provider
      value={{ openSettings, closeSettings, isOpen: open }}
    >
      {children}
      <SettingsModal
        open={open}
        onClose={closeSettings}
        initialKey={initialKey}
      />
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      openSettings: (key?: MenuKey) => openGlobalSettings(key),
      closeSettings: () => {},
      isOpen: false,
    };
  }
  return ctx;
}
