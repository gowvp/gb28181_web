import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, message } from "antd";
import { Cctv, Wifi } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button as ShadcnButton } from "~/components/ui/button";
import { Drawer, DrawerContent } from "~/components/ui/drawer";
import { cn } from "~/lib/utils";
import { AddDevice, findDevicesChannelsKey } from "~/service/api/device/device";
import { ErrorHandle } from "~/service/config/error";

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
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showRipples, setShowRipples] = useState(false); // 控制波纹显示
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    ip: "",
    port: "",
    username: "",
    password: "",
    name: "",
    type: "ONVIF",
  });

  // 添加设备的 mutation
  const addDeviceMutation = useMutation({
    mutationFn: AddDevice,
    onSuccess: () => {
      message.success(t("add_device_success"));
      // 刷新设备列表
      queryClient.invalidateQueries({ queryKey: [findDevicesChannelsKey] });
      // 关闭弹窗
      setOpen(false);
      stopDiscovery();
    },
    onError: (error: any) => {
      // 使用统一的错误处理函数
      ErrorHandle(error);
    },
  });

  React.useImperativeHandle(ref, () => ({
    open() {
      // 重置所有状态
      setShowForm(false);
      setDevices([]);
      setIsDiscovering(false);
      setShowRipples(false);
      setSelectedDevice(null);

      // 打开弹窗
      setOpen(true);

      // 延迟启动发现，确保动画从头开始
      setTimeout(() => {
        startDiscovery();
      }, 100);
    },
  }));

  // 开始发现设备
  const startDiscovery = () => {
    setIsDiscovering(true);
    setShowRipples(true);
    setDevices([]);
    setShowForm(false);
    setSelectedDevice(null);

    // 关闭之前的连接（如果存在）
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // 构建 SSE URL，使用环境变量配置的 API 基础路径
    const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";
    const sseUrl = `${baseURL}/onvif/discover`.replace("//", "/");

    // 创建 SSE 连接
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    // 监听 discover 事件
    eventSource.addEventListener("discover", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.addr) {
          // 解析地址 "192.168.1.231:8000"
          const [ip, port] = data.addr.split(":");
          const newDevice: DiscoveredDevice = {
            ip,
            port: parseInt(port, 10),
            id: `device-${data.addr}`,
          };

          // 添加设备到列表（避免重复）
          setDevices((prev) => {
            const exists = prev.some(
              (d) => d.ip === ip && d.port === newDevice.port,
            );
            if (exists) return prev;
            return [...prev, newDevice];
          });
        }
      } catch (error) {
        console.error("解析设备数据失败:", error);
      }
    });

    // 监听 end 事件
    eventSource.addEventListener("end", () => {
      console.log("收到 end 事件，停止发现");
      stopDiscovery();
    });

    // 监听错误
    eventSource.onerror = (error) => {
      console.error("SSE 连接错误:", error);
      stopDiscovery();
    };
  };

  // 停止发现
  const stopDiscovery = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsDiscovering(false);
    // 直接隐藏波纹，不延迟
    setShowRipples(false);
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
      type: "ONVIF",
    });
    setShowForm(true);
  };

  // 提交表单
  const handleSubmit = () => {
    // 验证表单
    if (
      !formData.ip ||
      !formData.port ||
      !formData.username ||
      !formData.password ||
      !formData.name
    ) {
      message.error(t("please_fill_required_fields"));
      return;
    }

    // 调用API添加设备
    addDeviceMutation.mutate({
      ip: formData.ip,
      port: parseInt(formData.port, 10),
      username: formData.username,
      password: formData.password,
      name: formData.name,
      type: formData.type,
    });
  };

  // 关闭弹窗时清理
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      stopDiscovery();
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85vh] sm:h-[95vh] bg-white">
        <div className="relative h-full overflow-hidden">
          {/* 发现页面 */}
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
              showForm ? "-translate-x-full" : "translate-x-0",
            )}
          >
            <div className="h-full flex flex-col overflow-hidden">
              {/* 标题区域 - Apple风格简洁标题 */}
              <div className="flex-shrink-0 text-center pt-8 pb-6 px-6">
                <h2 className="text-3xl font-semibold text-gray-900 tracking-tight">
                  {t("device_discover")}
                </h2>
              </div>

              {/* 发现动画区域 - 可收缩的logo */}
              <div
                className="flex-shrink-0 flex items-center justify-center transition-all duration-500 ease-out overflow-hidden"
                style={{
                  paddingTop:
                    isDiscovering || devices.length === 0 ? "3rem" : "1rem",
                  paddingBottom:
                    isDiscovering || devices.length === 0 ? "3rem" : "1rem",
                  height:
                    isDiscovering || devices.length === 0 ? "auto" : "0px",
                  opacity: isDiscovering || devices.length === 0 ? 1 : 0,
                }}
              >
                <div className="relative">
                  <div
                    className="relative transition-all duration-500 ease-out"
                    style={{
                      width:
                        isDiscovering || devices.length === 0 ? "8rem" : "0rem",
                      height:
                        isDiscovering || devices.length === 0 ? "8rem" : "0rem",
                    }}
                  >
                    {/* 渐变波纹动画 - 使用渐变色和更柔和的扩散 */}
                    {showRipples && (
                      <>
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(147, 197, 253, 0.2))",
                            animation: isDiscovering
                              ? "ripple 2s ease-out infinite"
                              : "ripple 2s ease-out 1",
                            transform: "scale(0)", // 初始隐藏，避免描边
                            animationFillMode: "forwards",
                          }}
                        />
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(147, 197, 253, 0.3))",
                            animation: isDiscovering
                              ? "ripple 2s ease-out infinite"
                              : "ripple 2s ease-out 1",
                            animationDelay: "0.666s",
                            transform: "scale(0)", // 初始隐藏
                            animationFillMode: "forwards",
                          }}
                        />
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(147, 197, 253, 0.4))",
                            animation: isDiscovering
                              ? "ripple 2s ease-out infinite"
                              : "ripple 2s ease-out 1",
                            animationDelay: "1.333s",
                            transform: "scale(0)", // 初始隐藏
                            animationFillMode: "forwards",
                          }}
                        />
                      </>
                    )}

                    {/* 中心图标 - 毛玻璃效果 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="bg-white/80 backdrop-blur-xl rounded-full p-5 shadow-lg border border-gray-200/50 transition-all duration-300 ease-out"
                        style={{
                          transform: isDiscovering ? "scale(1)" : "scale(0.95)",
                        }}
                      >
                        <Wifi
                          className={cn(
                            "w-12 h-12 text-blue-500 transition-all duration-300",
                            isDiscovering && "animate-pulse",
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 状态文字 - 更大更清晰 */}
              <div className="flex justify-center mb-6 flex-shrink-0 px-6">
                <div className="text-center">
                  {isDiscovering ? (
                    <p className="text-lg text-blue-600 font-medium animate-pulse">
                      {t("device_discovering")}
                    </p>
                  ) : devices.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-lg text-gray-600 font-medium">
                        {t("no_devices_found")}
                      </p>
                      <div className="text-sm text-gray-500 space-y-2 text-left bg-gray-50 rounded-2xl px-5 py-4">
                        <p>{t("discovery_tip_1")}</p>
                        <p>{t("discovery_tip_2")}</p>
                        <p>{t("discovery_tip_3")}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 设备列表 - Apple风格卡片 */}
              <div className="flex-1 overflow-y-auto flex justify-center px-6">
                <div className="w-full max-w-4xl">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {devices.map((device, index) => (
                      <div
                        key={device.id}
                        className="group cursor-pointer"
                        style={{
                          animation: `fadeInUp 0.4s ease-out ${
                            index * 0.05
                          }s both`,
                        }}
                        onClick={() => handleDeviceClick(device)}
                      >
                        <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-1">
                          <div className="flex flex-col items-center space-y-3">
                            {/* 摄像头图标 - 更大的图标区域 */}
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center group-hover:from-blue-100 group-hover:to-blue-200 transition-all duration-300">
                              <Cctv className="w-7 h-7 text-blue-600 group-hover:text-blue-700 transition-colors duration-300" />
                            </div>

                            {/* 设备信息 */}
                            <div className="text-center w-full space-y-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {device.ip}
                              </p>
                              <p className="text-xs text-gray-500 font-medium">
                                {t("port")}: {device.port}
                              </p>
                            </div>

                            {/* 添加指示器 */}
                            <div className="w-full pt-2 border-t border-gray-100">
                              <p className="text-xs text-blue-600 font-medium text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {t("click_to_add")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 底部按钮 - Apple风格圆角按钮 */}
              <div className="flex-shrink-0 px-6 py-6 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
                <div className="flex justify-center gap-3 max-w-md mx-auto">
                  {isDiscovering ? (
                    <ShadcnButton
                      variant="outline"
                      onClick={stopDiscovery}
                      className="flex-1 h-12 rounded-full text-base font-medium border-2 hover:bg-gray-50"
                    >
                      {t("stop_discover")}
                    </ShadcnButton>
                  ) : (
                    <>
                      <ShadcnButton
                        variant="outline"
                        onClick={startDiscovery}
                        className="flex-1 h-12 rounded-full text-base font-medium border-2 hover:bg-gray-50"
                      >
                        {t("rescan")}
                      </ShadcnButton>
                      <ShadcnButton
                        onClick={() => {
                          setSelectedDevice(null);
                          setFormData({
                            ip: "",
                            port: "",
                            username: "admin",
                            password: "",
                            name: "",
                            type: "ONVIF",
                          });
                          setShowForm(true);
                        }}
                        className="flex-1 h-12 rounded-full text-base font-medium bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {t("manual_add")}
                      </ShadcnButton>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 添加表单页面 - Apple风格表单 */}
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] bg-white flex flex-col",
              showForm ? "translate-x-0" : "translate-x-full",
            )}
          >
            {/* 固定顶部标题栏 */}
            <div className="flex-shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-10 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between max-w-2xl mx-auto">
                <ShadcnButton
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full px-4"
                >
                  ← {t("back")}
                </ShadcnButton>
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                  {t("add_device")}
                </h2>
                <Button
                  type="primary"
                  shape="round"
                  size="large"
                  icon={<Cctv className="w-4 h-4" />}
                  onClick={handleSubmit}
                  loading={addDeviceMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 border-0 shadow-sm"
                >
                  {t("add")}
                </Button>
              </div>
            </div>

            {/* 表单 - 可滚动区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="max-w-2xl mx-auto">
                <Form layout="vertical" size="large" className="space-y-6">
                  {/* IP地址 */}
                  <Form.Item
                    label={
                      <span className="text-base font-medium text-gray-900">
                        {t("ip_address")}
                      </span>
                    }
                    required
                    rules={[{ required: true, message: t("input_ip") }]}
                  >
                    <Input
                      placeholder="192.168.1.100"
                      value={formData.ip}
                      onChange={(e) =>
                        setFormData({ ...formData, ip: e.target.value })
                      }
                      className="rounded-xl border-gray-200 h-12 text-base"
                    />
                  </Form.Item>

                  {/* 端口 */}
                  <Form.Item
                    label={
                      <span className="text-base font-medium text-gray-900">
                        {t("port")}
                      </span>
                    }
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
                      className="rounded-xl border-gray-200 h-12 text-base"
                    />
                  </Form.Item>

                  {/* 用户名 */}
                  <Form.Item
                    label={
                      <span className="text-base font-medium text-gray-900">
                        {t("username")}
                      </span>
                    }
                    required
                    rules={[{ required: true, message: t("input_username") }]}
                  >
                    <Input
                      placeholder="admin"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="rounded-xl border-gray-200 h-12 text-base"
                    />
                  </Form.Item>

                  {/* 密码 */}
                  <Form.Item
                    label={
                      <span className="text-base font-medium text-gray-900">
                        {t("password")}
                      </span>
                    }
                    required
                    rules={[{ required: true, message: t("input_password") }]}
                  >
                    <Input.Password
                      placeholder={t("input_password")}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="rounded-xl border-gray-200 h-12 text-base"
                    />
                  </Form.Item>

                  {/* 设备名称 */}
                  <Form.Item
                    label={
                      <span className="text-base font-medium text-gray-900">
                        {t("device_name")}
                      </span>
                    }
                  >
                    <Input
                      placeholder={t("device_name_placeholder")}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="rounded-xl border-gray-200 h-12 text-base"
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
