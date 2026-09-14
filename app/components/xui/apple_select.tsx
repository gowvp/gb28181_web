import React from "react";

export interface AppleSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** 下拉框上方标题标签 */
  label?: React.ReactNode;
  /** 标题右侧的附属信息（如探测网卡状态） */
  extra?: React.ReactNode;
  /** 容器自定义外层 class */
  containerClassName?: string;
}

/**
 * Apple 风格原生下拉选择框（AppleSelect）
 * 1. 采用 appearance-none 与自定义 SVG 下拉箭头；
 * 2. 箭头右侧保留充足呼吸边距，杜绝拥挤紧贴；
 * 3. 边框、圆角、高度与 AppleInput 保持对齐。
 */
export function AppleSelect({
  label,
  extra,
  children,
  className = "",
  containerClassName = "",
  ...restProps
}: AppleSelectProps) {
  return (
    <div className={containerClassName}>
      {(label || extra) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <label className="block text-xs font-semibold text-slate-700 select-none">
              {label}
            </label>
          )}
          {extra && (
            <div className="text-[10px] text-slate-400 select-none">{extra}</div>
          )}
        </div>
      )}
      <div className="relative">
        <select
          className={`w-full pl-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono transition-all appearance-none cursor-pointer text-slate-800 ${className}`}
          {...restProps}
        >
          {children}
        </select>
        {/* 自定义 Apple 风格下箭头，右侧距边缘 12px 留白 */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default AppleSelect;
