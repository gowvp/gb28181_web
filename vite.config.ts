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
    // 使用相对路径，支持部署到任意子目录（如 /web, /www 等）
    base: "./",
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
        "/api": {
          target: "http://127.0.0.1:15123",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
