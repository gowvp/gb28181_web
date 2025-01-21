/// <reference types="vite/client" />

// vite 环境变量 ts 语法提示
interface ImportMetaEnv {
  // 页面访问前缀
  readonly VITE_BASENAME: string;
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
