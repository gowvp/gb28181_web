import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface NetworkModalShellProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  extra?: ReactNode;
  maxWidth?: string;
  children: ReactNode;
}

/**
 * 通用模态弹窗壳（NetworkModalShell）：
 * 1. 集中拦截并在弹窗开启时捕获 ESC 键；
 * 2. 统一 Apple Liquid Glass 风格质感、圆角、阴影与动画标准；
 * 3. 采用 createPortal 挂载至 document.body 并赋予高层级 z-[1050]，脱离父级组件尺寸与 CSS transform/filter 包含块束缚。
 */
export function NetworkModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  extra,
  maxWidth = "max-w-[440px]",
  children,
}: NetworkModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-[22px] bg-white/95 backdrop-blur-2xl border border-white/90 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {extra}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
