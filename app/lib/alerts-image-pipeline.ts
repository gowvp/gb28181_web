const WORKER_COUNT = 4;
const LRU_MAX = 48;

type Pending = {
  resolve: (value: { buffer: ArrayBuffer; mimeType: string }) => void;
  reject: (e: Error) => void;
};

let nextMessageId = 1;
const pending = new Map<number, Pending>();

function createWorkerPool() {
  const workers: Worker[] = [];
  for (let i = 0; i < WORKER_COUNT; i += 1) {
    workers.push(
      new Worker(new URL("../workers/image-compress.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
  }
  for (const w of workers) {
    w.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { id: number; ok: true; buffer: ArrayBuffer; mimeType: string }
        | { id: number; ok: false; error: string };
      const slot = pending.get(data.id);
      if (!slot) {
        return;
      }
      pending.delete(data.id);
      if (data.ok) {
        slot.resolve({ buffer: data.buffer, mimeType: data.mimeType });
      } else {
        slot.reject(new Error(data.error));
      }
    };
    w.onerror = (err) => {
      console.warn("[alerts-image] worker error", err);
    };
  }
  return workers;
}

const workerPool = createWorkerPool();

const perWorkerChain: Promise<unknown>[] = workerPool.map(() => Promise.resolve());

let rr = 0;

function enqueueOnWorker(
  workerIndex: number,
  task: () => Promise<{ buffer: ArrayBuffer; mimeType: string }>,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const chain = perWorkerChain[workerIndex]!;
  const next = chain.then(task, (e) => {
    throw e;
  });
  perWorkerChain[workerIndex] = next.catch(() => undefined);
  return next;
}

function postToWorker(workerIndex: number, url: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const id = nextMessageId;
    nextMessageId += 1;
    pending.set(id, { resolve, reject });
    workerPool[workerIndex]!.postMessage({ id, url });
  });
}

function runCompressInWorker(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const idx = rr % WORKER_COUNT;
  rr += 1;
  return enqueueOnWorker(idx, () => postToWorker(idx, url));
}

type QueuedJob = {
  url: string;
  resolve: (v: { buffer: ArrayBuffer; mimeType: string }) => void;
  reject: (e: Error) => void;
};

/** 视口优先：先处理 priority 0，避免每帧对整队列 sort */
const queueHigh: QueuedJob[] = [];
const queueLow: QueuedJob[] = [];
let inFlightFromQueue = 0;
const MAX_CONCURRENT = 4;

function pumpQueue() {
  while (inFlightFromQueue < MAX_CONCURRENT) {
    const job = queueHigh.shift() ?? queueLow.shift();
    if (!job) {
      break;
    }
    inFlightFromQueue += 1;
    runCompressInWorker(job.url)
      .then(job.resolve, job.reject)
      .finally(() => {
        inFlightFromQueue -= 1;
        pumpQueue();
      });
  }
}

/**
 * 对外入口：priority 0=当前屏优先，1=预加载；全局并发≤4。
 */
export function requestCompressedThumb(
  url: string,
  priority: number = 1,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const job = { url, resolve, reject };
    if (priority <= 0) {
      queueHigh.push(job);
    } else {
      queueLow.push(job);
    }
    pumpQueue();
  });
}

type LruEntry = { key: string; blob: Blob };

class LruBlobCache {
  private map = new Map<string, LruEntry>();

  get(key: string): Blob | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.blob;
  }

  set(key: string, blob: Blob) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, { key, blob });
    while (this.map.size > LRU_MAX) {
      const first = this.map.keys().next().value as string | undefined;
      if (first === undefined) {
        break;
      }
      this.map.delete(first);
    }
  }

  delete(key: string) {
    this.map.delete(key);
  }
}

const lru = new LruBlobCache();

export function getCachedThumbBlob(url: string): Blob | undefined {
  return lru.get(url);
}

export function setCachedThumbBlob(url: string, blob: Blob) {
  lru.set(url, blob);
}

export function deleteCachedThumb(url: string) {
  lru.delete(url);
}
