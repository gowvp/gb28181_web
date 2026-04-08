/// <reference lib="webworker" />

export {};

const MAX_WIDTH = 400;
const WEBP_QUALITY = 0.6;
const JPEG_QUALITY = 0.72;

type Inbound = { id: number; url: string };

/**
 * 为什么在 Worker 里 fetch + OffscreenCanvas：
 * 主线程若直接设 img.src 会解码 1–2MB 位图并阻塞布局；在独立线程拉流、缩放、编码成小块 WebP，再只把 ArrayBuffer 回传，可显著降低列表滚动时的主线程压力。
 */
self.onmessage = async (event: MessageEvent<Inbound>) => {
  const { id, url } = event.data;
  try {
    const response = await fetch(url, { mode: "cors", credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = w > MAX_WIDTH ? MAX_WIDTH / w : 1;
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = new OffscreenCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("no_2d_context");
    }
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    bitmap.close();

    let out: Blob | null = null;
    try {
      out = await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
    } catch {
      out = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    }
    if (!out) {
      throw new Error("convert_failed");
    }
    const buffer = await out.arrayBuffer();
    const mimeType = out.type || "image/webp";
    self.postMessage({ id, ok: true as const, buffer, mimeType }, [buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ id, ok: false as const, error: message });
  }
};
