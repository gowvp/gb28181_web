import { Modal } from "antd";
import { KeyRound, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import AccountSettings from "./account_settings";
import GeneralSettings from "./general_settings";

/** 左侧菜单项定义 */
const menuItems = [
  { key: "account", label: "账户设置", icon: KeyRound },
  { key: "general", label: "基本设置", icon: SlidersHorizontal },
] as const;

type MenuKey = (typeof menuItems)[number]["key"];

/**
 * 全局设置弹窗
 * 为什么用 Modal 而非路由页面：设置是低频操作，弹窗避免离开当前上下文，
 * 且与 ZLM 节点就地编辑的交互范式一致。
 */
export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeKey, setActiveKey] = useState<MenuKey>("account");

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={768}
      destroyOnClose
      title="设置"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex min-h-[400px]">
        {/* 左侧菜单 */}
        <nav className="w-40 border-r border-gray-200 py-3 shrink-0">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveKey(item.key)}
              className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-colors ${
                activeKey === item.key
                  ? "bg-gray-100 text-gray-900 font-medium border-l-2 border-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* 右侧内容 */}
        <div className="flex-1 p-6">
          {activeKey === "account" && <AccountSettings onClose={onClose} />}
          {activeKey === "general" && <GeneralSettings />}
        </div>
      </div>
    </Modal>
  );
}
