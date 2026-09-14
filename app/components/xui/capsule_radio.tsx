import React from "react";

export interface CapsuleRadioOption<T = string | number | boolean> {
  label: React.ReactNode;
  value: T;
  /** 是否使用等宽字体（如 zlm/lalmax 等标识符） */
  fontMono?: boolean;
}

export interface CapsuleRadioProps<T = string | number | boolean> {
  value?: T;
  onChange?: (val: T) => void;
  options: CapsuleRadioOption<T>[];
  className?: string;
  disabled?: boolean;
}

/**
 * 胶囊风格单选按钮（CapsuleRadio）：
 * 1. 对齐媒体核心引擎 ZLM / Lalmax 质感（拟物白底高光微阴影与柔和边框）；
 * 2. 替代通用 Antd Radio.Button，原生支持受控模式及 Antd Form.Item 自动状态注入；
 * 3. 提升设置面板的现代感与触觉反馈。
 */
export function CapsuleRadio<T extends string | number | boolean = string | number | boolean>({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
}: CapsuleRadioProps<T>) {
  return (
    <div
      className={`inline-flex p-0.5 rounded-full bg-slate-200/60 backdrop-blur-md border border-slate-200/80 shadow-inner select-none ${
        disabled ? "opacity-60 pointer-events-none" : ""
      } ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled && onChange) {
                onChange(option.value);
              }
            }}
            className={`h-6.5 px-3.5 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer active:scale-[0.96] select-none ${
              option.fontMono ? "font-mono" : ""
            } ${
              isActive
                ? "bg-white text-slate-900 shadow-[0_1px_4px_rgba(0,0,0,0.12),0_0.5px_0_rgba(255,255,255,0.9)_inset]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default CapsuleRadio;
