import { Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "~/lib/utils";

export interface GlassSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  width?: number | string;
}

/**
 * macOS 26 Tahoe Liquid Glass 搜索框
 * capsule 形状 + 半透明材质 + focus ring + 清除按钮
 */
function GlassSearch({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder = "Search",
  className,
  width = 200,
}: GlassSearchProps) {
  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        className="absolute left-2.5 w-3.5 h-3.5 pointer-events-none"
        style={{ color: "#6e6e73" }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch?.(value);
        }}
        placeholder={placeholder}
        className={cn(
          "h-7 pl-[30px] rounded-full text-[13px] text-[#1d1d1f] outline-none",
          "bg-white/45 backdrop-blur-[20px] backdrop-saturate-150",
          "border border-white/50",
          "shadow-[inset_0_1px_4px_rgba(0,0,0,0.06)]",
          "placeholder:text-[#8e8e93]",
          "transition-all duration-200",
          "focus:bg-white/70 focus:border-blue-500/50 focus:ring-[3px] focus:ring-blue-500/15",
          "font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text',system-ui,sans-serif]",
        )}
        style={{
          width,
          paddingRight: value ? 30 : 12,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-black/[0.08] border-none cursor-pointer p-0 hover:bg-black/[0.14] active:scale-90 transition-all"
        >
          <X className="w-3 h-3 text-[#6e6e73]" />
        </button>
      )}
    </div>
  );
}

export { GlassSearch };
