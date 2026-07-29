import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "~/lib/utils";

/**
 * macOS 26 Tahoe Liquid Glass 风格按钮
 * 参考：WWDC25 Build an AppKit app with the new design (310)
 * - bordered buttons 默认 capsule 形状
 * - Liquid Glass 半透明材质 + backdrop-filter
 * - active 时 scale(0.96)
 */
const glassButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium cursor-pointer select-none",
    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text',system-ui,sans-serif]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "text-[#424245]",
          "bg-white/55 backdrop-blur-[20px] backdrop-saturate-150",
          "border border-white/60",
          "shadow-[0_1px_4px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.7)]",
          "hover:bg-white/75 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_0.5px_0_rgba(255,255,255,0.8)]",
          "active:bg-white/85",
        ].join(" "),
        ghost: [
          "text-[#6e6e73]",
          "bg-transparent",
          "border border-transparent",
          "hover:bg-white/40 hover:text-[#1d1d1f] hover:backdrop-blur-[20px]",
          "active:bg-white/55",
        ].join(" "),
        primary: [
          "text-white",
          "bg-[#0071e3]/90 backdrop-blur-[20px] backdrop-saturate-150",
          "border border-[#0071e3]/30",
          "shadow-[0_1px_4px_rgba(0,113,227,0.3),inset_0_0.5px_0_rgba(255,255,255,0.2)]",
          "hover:bg-[#0071e3] hover:shadow-[0_2px_8px_rgba(0,113,227,0.35),inset_0_0.5px_0_rgba(255,255,255,0.25)]",
          "active:bg-[#005bb5]",
        ].join(" "),
      },
      size: {
        sm: "h-[26px] px-3 text-[12px] rounded-full [&_svg]:size-3",
        default: "h-[32px] px-4 text-[13px] rounded-full [&_svg]:size-3.5",
        lg: "h-[36px] px-5 text-[14px] rounded-full [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

/** macOS 26 Liquid Glass 风格按钮 */
function GlassButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: GlassButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(glassButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { GlassButton, glassButtonVariants };
