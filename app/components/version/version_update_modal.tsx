import { Modal } from "antd";
import { Button } from "~/components/ui/button";
import type { CheckVersionResponse } from "~/service/api/version/state";

const IGNORED_VERSIONS_KEY = "GOWVP_IGNORED_VERSIONS";
const MAX_IGNORED_VERSIONS = 3;

interface VersionUpdateModalProps {
  versionInfo: CheckVersionResponse | null;
  onClose: () => void;
}

// 获取已忽略的版本列表
function getIgnoredVersions(): string[] {
  try {
    const stored = localStorage.getItem(IGNORED_VERSIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return [];
}

// 添加忽略的版本
function addIgnoredVersion(version: string): void {
  const versions = getIgnoredVersions();
  if (!versions.includes(version)) {
    versions.push(version);
    // 保持最多 3 个
    while (versions.length > MAX_IGNORED_VERSIONS) {
      versions.shift();
    }
    localStorage.setItem(IGNORED_VERSIONS_KEY, JSON.stringify(versions));
  }
}

// 检查版本是否被忽略
export function isVersionIgnored(version: string): boolean {
  return getIgnoredVersions().includes(version);
}

// 简单的 Markdown 渲染（支持基本格式）
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 处理标题
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-semibold mt-3 mb-1">
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-bold mt-3 mb-1">
          {line.slice(2)}
        </h1>
      );
      continue;
    }

    // 处理分隔线
    if (line.match(/^-{3,}$/)) {
      elements.push(<hr key={i} className="my-3 border-gray-200" />);
      continue;
    }

    // 处理列表项
    if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-gray-400">•</span>
          <span>{renderInlineMarkdown(content)}</span>
        </div>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-gray-400">•</span>
          <span>{renderInlineMarkdown(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // 空行
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // 普通段落
    elements.push(
      <p key={i} className="py-0.5">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  return <div className="text-sm text-gray-600">{elements}</div>;
}

// 处理行内 Markdown（粗体、斜体、代码）
function renderInlineMarkdown(text: string): React.ReactNode {
  // 简单处理：粗体 **text** 和代码 `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 处理粗体
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // 处理代码
    const codeMatch = remaining.match(/`(.+?)`/);

    if (boldMatch && (!codeMatch || boldMatch.index! <= codeMatch.index!)) {
      if (boldMatch.index! > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
    } else if (codeMatch) {
      if (codeMatch.index! > 0) {
        parts.push(remaining.slice(0, codeMatch.index));
      }
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index! + codeMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default function VersionUpdateModal({
  versionInfo,
  onClose,
}: VersionUpdateModalProps) {
  if (!versionInfo) return null;

  const handleIgnore = () => {
    addIgnoredVersion(versionInfo.new_version);
    onClose();
  };

  const handleConfirm = (): void => {
    // 直接关闭弹窗，不触发任何请求
    onClose();
  };

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      title={
        <div className="flex items-center gap-2">
          <span className="text-lg">🎉 发现新版本</span>
        </div>
      }
      width={520}
    >
      <div className="py-4">
        {/* 版本信息 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">当前版本:</span>
            <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">
              {versionInfo.current_version}
            </span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">新版本:</span>
            <span className="font-mono text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded">
              {versionInfo.new_version}
            </span>
          </div>
        </div>

        {/* 更新说明 */}
        <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-4 bg-gray-50/50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">更新说明</h4>
          {renderMarkdown(versionInfo.description)}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={handleIgnore}>
            此版本不再提示
          </Button>
          <Button onClick={handleConfirm}>我会更新 Docker 镜像</Button>
        </div>
      </div>
    </Modal>
  );
}
