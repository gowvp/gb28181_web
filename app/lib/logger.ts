import IndexedDBService from "./db";

export const Debug = "RUSTC_DEBUG"; //是否开启debug
/**
 * '是否开启debug   debug 模式， 会默认开启info，并开启播放器debug  如果开启返回true
 */
export function IsDebug() {
  const isDebug: string = getLocalStorage<string>(Debug) || "NONE";
  return isDebug.toString().toUpperCase() === "DEBUG";
}

export const getLocalStorage = <T>(key: string): T | null => {
  // 检测是否在浏览器环境
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }

  let data = localStorage.getItem(key);
  try {
    data = JSON.parse(data ?? "");
  } catch {
    data = localStorage.getItem(key);
  }

  return data as T;
};

//是否开启debug   info 模式
export function isInfoDebug() {
  const isDebug: string = getLocalStorage<string>(Debug) || "NONE";
  return isDebug.toString().toUpperCase() === "INFO";
}

export const LOGGER_DB = [
  { label: "type", unique: false },
  { label: "message", unique: false },
  { label: "day", unique: false },
  { label: "create_at", unique: false },
];

class Logger {
  info: (name: string, ...args: any[]) => void;
  warn: (name: string, ...args: any[]) => void;
  error: (name: string, ...args: any[]) => void;
  indexedDBService: IndexedDBService | null;
  private isBrowser: boolean;

  constructor() {
    const isDev = process.env.NODE_ENV === "development";
    // 检测是否在浏览器环境
    this.isBrowser =
      typeof window !== "undefined" && typeof indexedDB !== "undefined";

    // 只在浏览器环境中初始化 IndexedDB
    if (this.isBrowser) {
      this.indexedDBService = new IndexedDBService("logger", 1, LOGGER_DB);
      this.indexedDBService
        .openDatabase()
        .then(() => {
          console.log("开启logger成功!!!");
          this._delLogger();
        })
        .catch((err) => {
          console.log("开启logger失败!", err);
        });
    } else {
      this.indexedDBService = null;
    }

    this.info = (...args) => {
      if (isDev || isInfoDebug() || IsDebug()) {
        console.log(
          `%cINFO`,
          "color: #ffffff; background-color: #007bff; padding:3px  6px; border-radius: 6px; text-align: center;",
          ...args
        );
      }
    };

    this.warn = (...args) => {
      this._addLogger(...args); //交付方便测试，后续删除，不记录 warn
      console.log(
        `%cWARN`,
        "color: #ffffff; background-color: #ffc107; padding:3px 6px; border-radius: 6px; text-align: center;",
        ...args
      );
    };

    this.error = (...args) => {
      this._addLogger(...args);
      console.error(
        `%cERROR`,
        "color: #ffffff; background-color: #dc3545; padding:3px 6px; border-radius: 6px; text-align: center;",
        ...args
      );
    };
  }

  _addLogger(...args: any[]) {
    // 只在浏览器环境中记录到 IndexedDB
    if (!this.isBrowser || !this.indexedDBService) {
      return;
    }

    const data = JSON.stringify(args);
    const currentTime = this._getCurrentTime();
    this.indexedDBService.addData<any>({
      type: "err",
      message: data,
      day: currentTime,
      create_at: Date.now(),
    });
  }

  _delLogger() {
    // 只在浏览器环境中清理日志
    if (!this.isBrowser || !this.indexedDBService) {
      return;
    }

    this.indexedDBService
      .deleteExpiredData()
      .then(() => {
        console.log("清理老旧日志成功");
      })
      .catch((err) => {
        console.log("清理老旧日志失败", err);
      });
  }

  _padZero(num: number) {
    return num < 10 ? "0" + num : num;
  }

  _getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = this._padZero(now.getMonth() + 1); // 月份从 0 开始，需要加 1
    const day = this._padZero(now.getDate());
    const hours = this._padZero(now.getHours());
    const minutes = this._padZero(now.getMinutes());
    const seconds = this._padZero(now.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
export default new Logger();
