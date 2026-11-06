import { Modal } from "antd";
import { type CSSProperties, useEffect } from "react";
import "./completion-animation.css";

export default function CompletionAnimation({
  onComplete,
}: {
  onComplete: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2000);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <Modal
      open
      centered
      width={340}
      className="init-completion-modal"
      title={null}
      footer={null}
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
      aria-label="设置已完成"
    >
      <div className="init-completion" role="status" aria-live="polite">
        <div className="init-completion-visual" aria-hidden="true">
          <div className="init-completion-orbit">
            {Array.from({ length: 8 }, (_, index) => (
              <span
                key={index}
                style={{ "--angle": `${index * 45}deg` } as CSSProperties}
              />
            ))}
          </div>
          <div className="init-completion-disc">
            <svg viewBox="0 0 48 48" fill="none">
              <title>完成</title>
              <path d="m13 24 8 8 15-17" />
            </svg>
          </div>
        </div>
        <h2>一切就绪</h2>
        <p>正在为你准备功能介绍</p>
      </div>
    </Modal>
  );
}
