import { useEffect, useState } from "react";

interface LayoutOptions {
  aspectRatio?: number; // 播放器宽高比，默认 16/9
  headerHeight?: number; // 顶部留白/标题栏高度
  minWidth?: number; // 最小宽度，低于此宽度允许滚动 (iPhone 13 ~ 390px)
  sidebarWidth?: number; // 侧边栏宽度 (如果有)
  footerRef: React.RefObject<HTMLElement | null>; // 底部容器的引用，用于动态测量高度
}

interface LayoutResult {
  containerStyle: React.CSSProperties;
  contentStyle: React.CSSProperties;
  isSmallScreen: boolean;
}

export function usePlayerLayout(options: LayoutOptions): LayoutResult {
  const {
    aspectRatio = 16 / 9,
    headerHeight = 48,
    minWidth = 390,
    sidebarWidth = 0,
    footerRef,
  } = options;

  const [layout, setLayout] = useState<LayoutResult>({
    containerStyle: {},
    contentStyle: {},
    isSmallScreen: false,
  });

  // 存储实际测量到的底部高度
  const [footerHeight, setFooterHeight] = useState(100); // 初始估算值

  // 1. 监听 footer 高度变化
  useEffect(() => {
    const footerEl = footerRef.current;
    if (!footerEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // 使用 borderBoxSize 获取包含 padding/border 的高度
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          setFooterHeight(entry.borderBoxSize[0].blockSize);
        } else {
          setFooterHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(footerEl);
    return () => observer.disconnect();
  }, [footerRef]); // 依赖 footerRef

  // 2. 计算布局
  useEffect(() => {
    const calculateLayout = () => {
      // Drawer 内容区域高度 (sm:h-[95vh])
      const vh = window.innerHeight * 0.95;
      const vw = window.innerWidth - sidebarWidth;

      // 极致优化：容器内边距 (0.25rem top + 0.25rem bottom = 8px)
      // 之前是 32px，减少了 24px 的占用
      const containerPaddingY = 8;

      // 计算播放器最大可用高度
      // Available Height = Viewport - Header - Footer - Padding
      const maxPlayerHeight =
        vh - headerHeight - footerHeight - containerPaddingY;

      // 基于高度限制计算出的最大宽度
      const widthBasedOnHeightLimit = maxPlayerHeight * aspectRatio;

      let paddingX = 0;
      let shouldScroll = false;

      // 决策逻辑：
      // 1. 如果屏幕足够宽（宽于基于高度计算出的宽度），则限制宽度以防止高度溢出。
      if (vw > widthBasedOnHeightLimit) {
        // 需要左右留白来限制宽度
        paddingX = (vw - widthBasedOnHeightLimit) / 2;
      } else {
        // 2. 屏幕不够宽，宽度受限。
        const totalHeight =
          vw / aspectRatio + footerHeight + headerHeight + containerPaddingY;

        // 只有当溢出超过一定阈值（比如 2px）才开启滚动
        if (totalHeight > vh + 2) {
          shouldScroll = true;
        }
      }

      // 3. 最小宽度兜底
      if (vw - 2 * paddingX < minWidth) {
        paddingX = 0;
        shouldScroll = true;
      }

      paddingX = Math.max(0, paddingX);

      setLayout({
        containerStyle: {
          paddingLeft: `${paddingX}px`,
          paddingRight: `${paddingX}px`,
          // 减小上下 padding
          paddingTop: "0.25rem",
          paddingBottom: "0.25rem",
          width: "100%",
          height: "100%",
          overflowY: shouldScroll ? "auto" : "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: shouldScroll ? "flex-start" : "center",
        },
        contentStyle: {
          width: "100%",
          maxWidth: "100%",
        },
        isSmallScreen: vw < minWidth,
      });
    };

    calculateLayout();
    window.addEventListener("resize", calculateLayout);

    const timer = setTimeout(calculateLayout, 100);
    return () => {
      window.removeEventListener("resize", calculateLayout);
      clearTimeout(timer);
    };
  }, [aspectRatio, headerHeight, footerHeight, minWidth, sidebarWidth]);

  return layout;
}
