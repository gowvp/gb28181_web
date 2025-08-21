import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_STATE_KEY = 'sidebar-open-state';

/**
 * 侧边栏状态管理 hook
 * 将侧边栏的展开/关闭状态持久化到 localStorage
 * 默认状态为开启
 */
export function useSidebarState() {
  // 从 localStorage 获取初始状态，默认为 true
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true; // 服务端渲染时默认为开启
    }

    try {
      const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
      return stored !== null ? JSON.parse(stored) : false;
    } catch (error) {
      console.warn('Failed to parse sidebar state from localStorage:', error);
      return true;
    }
  });

  // 当状态改变时，保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(isOpen));
    } catch (error) {
      console.warn('Failed to save sidebar state to localStorage:', error);
    }
  }, [isOpen]);

  // 切换侧边栏状态
  const toggleSidebar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // 打开侧边栏
  const openSidebar = useCallback(() => {
    setIsOpen(true);
  }, []);

  // 关闭侧边栏
  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 设置侧边栏状态的回调，用于监听外部状态变化
  const onStateChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return {
    isOpen,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    onStateChange, // 新增：用于监听外部状态变化
  };
}
