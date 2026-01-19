import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tsconfigPaths(),
      tailwindcss(),
      // 生成包分析报告（运行 yarn build 后查看 stats.html）
      mode === "production" &&
        visualizer({
          filename: "stats.html",
          open: false,
          gzipSize: true,
        }),
    ].filter(Boolean),
    // 使用绝对路径 /web/，确保页面刷新时静态资源能正确加载
    // 如需部署到其他路径，请同步修改后端的 staticPrefix
    base: "/web/",
    resolve: {
      alias: {
        "~": fileURLToPath(new URL("./app", import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // 手动分割代码块，优化加载性能
          manualChunks: {
            // React 核心
            "vendor-react": ["react", "react-dom"],
            // 路由和数据获取
            "vendor-router": [
              "@tanstack/react-router",
              "@tanstack/react-query",
            ],
            // Ant Design（最大的包，单独分割）
            "vendor-antd": ["antd", "@ant-design/icons"],
            // 图表库
            "vendor-charts": ["recharts"],
            // 流程图
            "vendor-flow": ["@xyflow/react"],
            // Canvas 绑画
            "vendor-canvas": ["konva", "react-konva"],
            // 国际化
            "vendor-i18n": ["i18next", "react-i18next"],
          },
        },
      },
    },
    server: {
      proxy: {
        // 所有 API 请求统一使用 /api 前缀
        // 前端调用 /api/xxx，代理到后端的 /xxx
        "/api": {
          target: "http://127.0.0.1:15123",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        // 录像 m3u8 播放列表（不走 /api 前缀，直接代理）
        "/recordings/channels": {
          target: "http://127.0.0.1:15123",
          changeOrigin: true,
        },
        // 录像静态文件
        "/static/recordings": {
          target: "http://127.0.0.1:15123",
          changeOrigin: true,
        },
      },
    },
  };
});
