import { Modal } from "antd";
import {
  Cable,
  Cctv,
  HardDrive,
  House,
  Network,
  Play,
  Radio,
  ScanEye,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import "./features-modal.css";

// Keep this list limited to capabilities supported by the open-source project.
const FEATURES = [
  {
    title: "Home Assistant",
    description: "通过 ONVIF 虚拟设备，将平台通道接入你的智能家居。",
    icon: House,
  },
  {
    title: "GB28181",
    description: "国标设备注册、实时预览、云台控制与抓图。",
    icon: Network,
  },
  {
    title: "ONVIF",
    description: "接入 ONVIF 摄像机，也可向客户端提供虚拟设备服务。",
    icon: Cctv,
  },
  {
    title: "RTMP",
    description: "接收摄像机、OBS 等设备或软件的 RTMP 推流。",
    icon: Radio,
  },
  {
    title: "RTSP",
    description: "拉取 RTSP 视频流，统一接入平台管理。",
    icon: Cable,
  },
  {
    title: "多协议播放",
    description: "支持 WebRTC、FLV、HLS 等播放方式，按设备与浏览器选择。",
    icon: Play,
  },
  {
    title: "云端录像",
    description: "保存平台录像，按时间查看和回放。",
    icon: HardDrive,
  },
  {
    title: "AI 分析与告警",
    description: "对接算法服务，集中查看分析事件与告警。",
    icon: ScanEye,
  },
];

export default function FeaturesModal({
  open,
  onStart,
}: {
  open: boolean;
  onStart: () => void;
}) {
  return (
    <Modal
      open={open}
      centered
      width={800}
      className="init-features-modal"
      title={null}
      aria-labelledby="init-features-title"
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
      footer={null}
      destroyOnHidden
    >
      <section className="init-features" aria-labelledby="init-features-title">
        <header className="init-features-header">
          <h2 id="init-features-title">你的监控平台，已就绪。</h2>
          <p>连接设备，汇聚视频。先认识一下这里能做什么。</p>
        </header>
        <div className="init-features-content" tabIndex={0}>
          <ul className="init-feature-grid" aria-label="平台功能">
            {FEATURES.map(({ title, description, icon: Icon }) => (
              <li key={title} className="init-feature-card">
                <span className="init-feature-icon" aria-hidden="true">
                  <Icon size={21} strokeWidth={1.65} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </div>
        <footer className="init-features-footer">
          <span>使用刚设置的账号登录，开始连接设备。</span>
          <Button onClick={onStart}>开始使用</Button>
        </footer>
      </section>
    </Modal>
  );
}
