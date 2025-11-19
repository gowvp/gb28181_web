import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,
  // 保持 /web/ 作为路由 basename，但资源使用相对路径
  basename: import.meta.env.MODE === "development" ? "/" : "/web/",
} satisfies Config;
