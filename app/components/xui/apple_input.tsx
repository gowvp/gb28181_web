import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface AppleInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** 输入框上方标题标签 */
  label?: React.ReactNode;
  /** 标题右侧的附属信息或探测状态 */
  extra?: React.ReactNode;
  /** 候选推荐值列表（如可选 IP 或域名），将自动渲染于输入框下方 */
  candidates?: string[];
  /** 点击候选推荐值时的快捷回调 */
  onSelectCandidate?: (candidate: string) => void;
  /** 输入框内容变更回调 */
  onChange?: (val: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  /** 是否使用等宽字体（如 IP、域名、凭据字段等，默认 true） */
  fontMono?: boolean;
  /** 容器自定义外层 class */
  containerClassName?: string;
  /** 当作为密码输入框时，是否显示可切换明文的小眼睛按钮 */
  allowTogglePassword?: boolean;
}

/**
 * Apple 极简带标题输入框（AppleInput）
 * 1. 消除在各业务弹窗与设置页反复手写相同的 label/mb-1/rounded-xl/ring-2 模板代码；
 * 2. 原生支持输入框底部候选胶囊药丸渲染与一键点选填充；
 * 3. 密码输入支持原生小眼睛明文/密文一键切换；
 * 4. 业务层只需传递核心参数即可获得统一的交互质感。
 */
export function AppleInput({
  label,
  extra,
  candidates,
  onSelectCandidate,
  value,
  onChange,
  type = "text",
  fontMono = true,
  className = "",
  containerClassName = "",
  allowTogglePassword = false,
  ...restProps
}: AppleInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const currentVal = value !== undefined ? String(value) : "";
  const isPasswordType = type === "password";
  const actualType = isPasswordType && allowTogglePassword && showPassword ? "text" : type;

  return (
    <div className={containerClassName}>
      {(label || extra) && (
        <div className="mb-1 flex items-center justify-between">
          {label && (
            <label className="block text-xs font-semibold text-slate-700 select-none">
              {label}
            </label>
          )}
          {extra && <div className="text-[10px] text-slate-400 select-none">{extra}</div>}
        </div>
      )}

      <div className="relative">
        <input
          type={actualType}
          value={value}
          onChange={(e) => onChange?.(e.target.value, e)}
          className={`w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50/80 disabled:text-slate-400 disabled:border-slate-200/70 disabled:cursor-not-allowed transition-all ${
            isPasswordType && allowTogglePassword ? "pr-9" : ""
          } ${fontMono ? "font-mono" : ""} ${className}`}
          {...restProps}
        />

        {isPasswordType && allowTogglePassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded transition-colors"
            title={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {candidates && candidates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {candidates.map((cand) => {
            const isSelected = currentVal === cand;
            return (
              <button
                key={cand}
                type="button"
                onClick={() => onSelectCandidate?.(cand)}
                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-mono border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-200/90 text-slate-900 border-slate-300 font-semibold shadow-2xs"
                    : "bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/70 hover:text-slate-800"
                }`}
              >
                {cand}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AppleInput;
