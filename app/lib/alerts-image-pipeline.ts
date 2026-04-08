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
  priority: number;
  resolve: (v: { buffer: ArrayBuffer; mimeType: string }) => void;
  reject: (e: Error) => void;
};

const waitQueue: QueuedJob[] = [];
let inFlightFromQueue = 0;
const MAX_CONCURRENT = 4;

/**
 * 为什么再套一层「视口优先」队列：
 * p-limit 只保证并发数，不保证顺序；滚动时若先压入屏幕下方任务，会拖慢当前屏缩略图。数字越小越优先（0=视口内，1=预加载带）。
 */
function pumpQueue() {
  while (inFlightFromQueue < MAX_CONCURRENT && waitQueue.length > 0) {
    waitQueue.sort((a, b) => a.priority - b.priority);
    const job = waitQueue.shift()!;
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
 * 对外统一入口：并发≤4，且视口任务优先于仅预加载任务。
 */
export function requestCompressedThumb(
  url: string,
  priority: number = 1,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  return new Promise((resolve, reject) => {
    waitQueue.push({ url, priority, resolve, reject });
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
