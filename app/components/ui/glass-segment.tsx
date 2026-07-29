import * as React from "react";
import { cn } from "~/lib/utils";

export interface GlassSegmentOption {
  label: string;
  value: string;
}

export interface GlassSegmentProps {
  options: GlassSegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * macOS 26 Tahoe Liquid Glass Segmented Control
 * capsule 容器 + capsule 选项 + Liquid Glass 材质
 */
function GlassSegment({ options, value, onChange, className }: GlassSegmentProps) {
  return (
    <div
      className={cn(
        "inline-flex p-[3px] gap-0 relative",
        "bg-white/35 backdrop-blur-[20px] backdrop-saturate-150",
        "border border-white/40",
        "shadow-[0_1px_6px_rgba(0,0,0,0.06)]",
        "rounded-full",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-[26px] px-3.5 rounded-full text-[13px] font-medium border-none cursor-pointer whitespace-nowrap",
              "transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              "active:scale-[0.96]",
              "font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text',system-ui,sans-serif]",
              active
                ? "text-[#1d1d1f] bg-white/85 shadow-[0_1px_4px_rgba(0,0,0,0.1),inset_0_0.5px_0_rgba(255,255,255,0.9)]"
                : "text-[#6e6e73] bg-transparent hover:text-[#1d1d1f]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export { GlassSegment };
