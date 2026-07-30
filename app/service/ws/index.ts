import { GetToken } from "../config/http";
import { toastWarn } from "~/components/xui/toast";
import { toast } from "sonner";
import { createElement } from "react";
import { CircleAlert, CircleCheckBig } from "lucide-react";

const RECONNECT_INTERVAL = 3000;
const IGNORE_KEY = "ws_ignored_notifications";

type WsMessage = {
  type: string;
  data?: Record<string, unknown>;
  msg?: string;
};

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setInterval> | null = null;
let intentionalClose = false;

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
  return `${protocol}//${window.location.host}${base}/ws`;
}

function isIgnored(type: string, msg: string, deviceId: string): boolean {
  const raw = localStorage.getItem(IGNORE_KEY);
  if (!raw) return false;
  try {
    const ignored = JSON.parse(raw) as string[];
    return ignored.includes(`${type}:${deviceId}:${msg}`);
  } catch {
    return false;
  }
}

const MAX_IGNORE_ENTRIES = 10000;

function addIgnore(type: string, msg: string, deviceId: string) {
  const raw = localStorage.getItem(IGNORE_KEY);
  let ignored: string[] = [];
  try { ignored = raw ? JSON.parse(raw) : []; } catch { /* */ }
  const key = `${type}:${deviceId}:${msg}`;
  if (ignored.includes(key)) return;

  if (ignored.length >= MAX_IGNORE_ENTRIES) {
    // 随机删除 1 条旧记录腾出空间
    const idx = Math.floor(Math.random() * ignored.length);
    ignored.splice(idx, 1);
  }
  ignored.push(key);
  localStorage.setItem(IGNORE_KEY, JSON.stringify(ignored));
}

/** 清除所有已忽略的通知缓存 */
export function clearIgnoredNotifications() {
  localStorage.removeItem(IGNORE_KEY);
}

function handleMessage(event: MessageEvent) {
  let msg: WsMessage;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (msg.type) {
    case "auth":
      sendAuth();
      break;
    case "auth_ok":
      break;
    case "warn":
      toastWarn(msg.data?.msg as string ?? "未知告警", { duration: 3000 });
      break;
    case "ipc_warn":
      showIPCNotification("ipc_warn", msg.data?.msg as string ?? "", msg.data?.device_id as string ?? "", msg.data?.name as string ?? "");
      break;
    case "ipc_info":
      showIPCNotification("ipc_info", msg.data?.msg as string ?? "", msg.data?.device_id as string ?? "", msg.data?.name as string ?? "");
      break;
    case "error":
      break;
  }
}

function showIPCNotification(type: string, msg: string, deviceId: string, name: string) {
  if (isIgnored(type, msg, deviceId)) return;

  const desc = [name, deviceId].filter(Boolean).join(" | ");
  const icon = type === "ipc_warn"
    ? createElement(CircleAlert, { color: "#f97316", size: 20 })
    : createElement(CircleCheckBig, { color: "#22c55e", size: 20 });

  toast(msg, {
    position: "top-right",
    duration: 3000,
    icon,
    description: desc || undefined,
    descriptionClassName: "font-bold font-mono",
    action: {
      label: "忽略",
      onClick: () => addIgnore(type, msg, deviceId),
    },
  });
}

function sendAuth() {
  const token = GetToken();
  if (!token || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "auth", data: { token } }));
}

function connect() {
  const token = GetToken();
  if (!token) return;

  // 强制断开旧连接，确保全局只有一个 WebSocket 实例
  if (socket) {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
    socket = null;
  }

  intentionalClose = false;
  socket = new WebSocket(getWsUrl());

  socket.onmessage = handleMessage;

  socket.onclose = () => {
    socket = null;
    if (!intentionalClose) {
      ensureReconnectLoop();
    }
  };

  socket.onerror = () => {
    socket?.close();
  };
}

function ensureReconnectLoop() {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(() => {
    const token = GetToken();
    if (!token) {
      stopWs();
      return;
    }
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      connect();
    }
  }, RECONNECT_INTERVAL);
}

/** 启动 WebSocket 连接（登录成功后调用） */
export function startWs() {
  connect();
  ensureReconnectLoop();
}

/** 断开 WebSocket 连接（登出时调用） */
export function stopWs() {
  intentionalClose = true;
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}
