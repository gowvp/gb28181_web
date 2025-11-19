import * as React from "react";
import { Cctv, Wifi } from "lucide-react";
import { Button as ShadcnButton } from "~/components/ui/button";
import { Drawer, DrawerContent } from "~/components/ui/drawer";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { Form, Input, Button } from "antd";
import { useTranslation } from "react-i18next";

/**
 * Mock设备数据接口
 */
interface DiscoveredDevice {
  ip: string;
  port: number;
  id: string;
}

/**
 * 设备发现组件
 * 支持移动端，从底部弹出
 * 功能：搜索局域网内的设备，点击设备后展示添加表单
 */
export default function DeviceDiscover({ ref }: { ref: React.RefObject<any> }) {
  const { t } = useTranslation("common");

  const [open, setOpen] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [, setSelectedDevice] = useState<DiscoveredDevice | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    ip: "",
    port: "",
    username: "",
    password: "",
    name: "",
  });

  React.useImperativeHandle(ref, () => ({
    open() {
      setOpen(true);
      startDiscovery();
    },
  }));

  // 开始发现设备
  const startDiscovery = () => {
    setIsDiscovering(true);
    setDevices([]);
    setShowForm(false);
    setSelectedDevice(null);

    // 1秒后开始逐个加载mock数据
    const mockDevices: DiscoveredDevice[] = [
      { ip: "192.168.1.100", port: 554, id: "device-1" },
      { ip: "192.168.1.101", port: 554, id: "device-2" },
      { ip: "192.168.1.102", port: 8000, id: "device-3" },
      { ip: "192.168.1.103", port: 554, id: "device-4" },
      { ip: "192.168.1.104", port: 8554, id: "device-5" },
      { ip: "192.168.1.105", port: 554, id: "device-6" },
    ];

    // 逐个添加设备，每个间隔150ms
    mockDevices.forEach((device, index) => {
      setTimeout(() => {
        setDevices((prev) => [...prev, device]);
      }, 1000 + index * 150);
    });

    // 所有设备加载完成后停止发现（1000ms + 6*150ms = 1900ms）
    setTimeout(() => {
      setIsDiscovering(false);
    }, 2000);
  };

  // 点击设备，展示添加表单
  const handleDeviceClick = (device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setFormData({
      ip: device.ip,
      port: device.port.toString(),
      username: "admin",
      password: "",
      name: `Camera ${device.ip}`,
    });
    setShowForm(true);
  };

  // 提交表单
  const handleSubmit = () => {
    console.log("添加设备:", formData);
    // TODO: 调用API添加设备
    setOpen(false);
    // 重置状态
    setTimeout(() => {
      setShowForm(false);
      setDevices([]);
      setIsDiscovering(false);
    }, 300);
  };

  // 关闭弹窗时重置状态
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setTimeout(() => {
        setShowForm(false);
        setDevices([]);
        setIsDiscovering(false);
      }, 300);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85vh] sm:h-[95vh]">
        <div className="relative h-full overflow-hidden">
          {/* 发现页面 */}
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-500 ease-in-out",
              showForm ? "-translate-x-full" : "translate-x-0"
            )}
          >
            <div className="h-full flex flex-col p-4 sm:p-6 overflow-hidden">
              {/* 标题 */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {t("device_discover")}
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  {t("device_discover_desc")}
                </p>
              </div>

              {/* 发现动画区域 */}
              <div className="flex-shrink-0 flex items-center justify-center py-8">
                <div className="relative">
                  {/* 使用可爱的搜索动画 */}
                  <div className="relative w-24 h-24">
                    {/* 背景圆圈动画 */}
                    {isDiscovering && (
                      <>
                        <div className="absolute inset-0 rounded-full bg-blue-200 animate-ping opacity-75" />
                        <div
                          className="absolute inset-0 rounded-full bg-blue-300 animate-ping opacity-50"
                          style={{ animationDelay: "0.2s" }}
                        />
                        <div
                          className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-25"
                          style={{ animationDelay: "0.4s" }}
                        />
                      </>
                    )}

                    {/* 中心图标 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white rounded-full p-4">
                        <Wifi
                          className={cn(
                            "w-10 h-10 text-blue-500",
                            isDiscovering && "animate-pulse"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 状态文字 */}
              <div className="text-center mb-4 flex-shrink-0">
                {isDiscovering ? (
                  <p className="text-blue-600 font-medium animate-pulse">
                    {t("device_discovering")}
                  </p>
                ) : devices.length > 0 ? (
                  <p className="text-green-600 font-medium">
                    {t("found_devices", { count: devices.length })}
                  </p>
                ) : (
                  <p className="text-gray-500">{t("waiting_search")}</p>
                )}
              </div>

              {/* 设备列表 */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="bg-white border border-gray-400 rounded-md p-2 hover:border-blue-500 transition-all duration-200 cursor-pointer group animate-in fade-in slide-in-from-bottom-4"
                      style={{
                        animationDuration: "300ms",
                        animationFillMode: "both",
                      }}
                      onClick={() => handleDeviceClick(device)}
                    >
                      <div className="flex flex-col items-center">
                        {/* 摄像头图标 */}
                        <div className="mb-1 p-1 bg-gray-100 rounded-full group-hover:bg-blue-50 transition-colors duration-200">
                          <Cctv className="w-4 h-4 text-gray-600 group-hover:text-blue-500 transition-colors duration-200" />
                        </div>

                        {/* 设备信息 */}
                        <div className="text-center w-full">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {device.ip}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {device.port}
                          </p>
                        </div>

                        {/* 添加按钮提示 */}
                        <div className="mt-1 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {t("click_to_add")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 重新搜索和手动添加按钮 */}
              {!isDiscovering && devices.length > 0 && (
                <div className="mt-4 flex justify-center gap-3 flex-shrink-0">
                  <ShadcnButton
                    variant="outline"
                    onClick={startDiscovery}
                    disabled={isDiscovering}
                  >
                    {t("rescan")}
                  </ShadcnButton>
                  <ShadcnButton
                    variant="outline"
                    onClick={() => {
                      setSelectedDevice(null);
                      setFormData({
                        ip: "",
                        port: "",
                        username: "admin",
                        password: "",
                        name: "",
                      });
                      setShowForm(true);
                    }}
                  >
                    {t("manual_add")}
                  </ShadcnButton>
                </div>
              )}
            </div>
          </div>

          {/* 添加表单页面 */}
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-500 ease-in-out bg-white",
              showForm ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto">
              {/* 顶部标题栏 - 返回按钮和添加按钮 */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <ShadcnButton
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                    className="mb-2"
                  >
                    ← {t("back")}
                  </ShadcnButton>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {t("add_device")}
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    {t("device_info_form")}
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<Cctv className="w-4 h-4" />}
                  onClick={handleSubmit}
                >
                  {t("add")}
                </Button>
              </div>

              {/* 表单 */}
              <div className="flex-1">
                <Form layout="vertical" size="large">
                  {/* IP地址 */}
                  <Form.Item
                    label={t("ip_address")}
                    required
                    rules={[{ required: true, message: t("input_ip") }]}
                  >
                    <Input
                      placeholder="192.168.1.100"
                      value={formData.ip}
                      onChange={(e) =>
                        setFormData({ ...formData, ip: e.target.value })
                      }
                    />
                  </Form.Item>

                  {/* 端口 */}
                  <Form.Item
                    label={t("port")}
                    required
                    rules={[{ required: true, message: t("input_port") }]}
                  >
                    <Input
                      type="number"
                      placeholder="554"
                      value={formData.port}
                      onChange={(e) =>
                        setFormData({ ...formData, port: e.target.value })
                      }
                    />
                  </Form.Item>

                  {/* 用户名 */}
                  <Form.Item
                    label={t("username")}
                    required
                    rules={[{ required: true, message: t("input_username") }]}
                  >
                    <Input
                      placeholder="admin"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                    />
                  </Form.Item>

                  {/* 密码 */}
                  <Form.Item
                    label={t("password")}
                    required
                    rules={[{ required: true, message: t("input_password") }]}
                  >
                    <Input.Password
                      placeholder={t("input_password")}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                    />
                  </Form.Item>

                  {/* 设备名称 */}
                  <Form.Item label={t("device_name")}>
                    <Input
                      placeholder={t("device_name_placeholder")}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </Form.Item>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
