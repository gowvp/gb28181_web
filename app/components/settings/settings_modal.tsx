import { Info, KeyRound, Radio, Settings, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useState } from "react";
import { NetworkModalShell } from "~/components/network/network_modal_shell";
import AboutSettings from "./about_settings";
import AccountSettings from "./account_settings";
import GeneralSettings from "./general_settings";
import StreamSettings from "./stream_settings";

/** 左侧菜单项定义 */
const menuItems = [
  { key: "account" as const, label: "账户设置", icon: KeyRound },
  { key: "stream" as const, label: "收流配置", icon: Radio },
  { key: "general" as const, label: "基础配置", icon: SlidersHorizontal },
  { key: "about" as const, label: "关于OWL", icon: Info },
];

export type MenuKey = (typeof menuItems)[number]["key"];

/**
 * 全局设置弹窗
 * 升级为 NetworkModalShell 毛玻璃浮层，彻底脱离父容器约束。
 */
export default function SettingsModal({
  open,
  onClose,
  initialKey = "account",
}: {
  open: boolean;
  onClose: () => void;
  initialKey?: MenuKey;
}) {
  const [activeKey, setActiveKey] = useState<MenuKey>(initialKey);

  useEffect(() => {
    if (open) {
      setActiveKey(initialKey);
    }
  }, [open, initialKey]);

  return (
    <NetworkModalShell
      open={open}
      onClose={onClose}
      title="设置"
      subtitle="管理系统核心参数与服务偏好配置"
      icon={<Settings className="w-4 h-4" />}
      maxWidth="max-w-[660px]"
    >
      <div className="flex min-h-[400px] max-h-[70vh] overflow-hidden">
        {/* 左侧菜单：通透融入弹窗统一背景 */}
        <nav className="w-36 border-r border-slate-100 p-3 space-y-1 shrink-0 select-none">
          {menuItems.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveKey(item.key)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 border border-transparent"
                }`}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 右侧内容 */}
        <div className="flex-1 p-5.5 overflow-y-auto">
          {activeKey === "account" && <AccountSettings onClose={onClose} />}
          {activeKey === "stream" && <StreamSettings />}
          {activeKey === "general" && <GeneralSettings />}
          {activeKey === "about" && <AboutSettings />}
        </div>
      </div>
    </NetworkModalShell>
  );
}
