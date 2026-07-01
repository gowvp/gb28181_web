import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    experimental: {
      // bundledDev 有 bug：JS 内部引用路径用的是 build 产物文件名，dev 模式下 404
      // 等 https://github.com/vitejs/vite/issues/22749 修复后再启用
      // bundledDev: true,
    },
    plugins: [
      react(),
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
      // chunk import map：防止哈希级联，改一个 chunk 不会导致引用它的 chunk 哈希全变
      // 好处：浏览器缓存命中率大幅提升，用户更新后只需下载变更的 chunk
      chunkImportMap: true,
      rolldownOptions: {
        output: {
          // Vite 8 使用 Rolldown 的 codeSplitting 替代 manualChunks
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                priority: 100,
              },
              {
                name: "vendor-antd",
                test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
                priority: 90,
              },
              {
                name: "vendor-router",
                test: /[\\/]node_modules[\\/](react-router|@tanstack[\\/]react-query)[\\/]/,
                priority: 80,
              },
              {
                name: "vendor-charts",
                test: /[\\/]node_modules[\\/]recharts[\\/]/,
                priority: 70,
              },
              {
                name: "vendor-flow",
                test: /[\\/]node_modules[\\/]@xyflow[\\/]/,
                priority: 70,
              },
              {
                name: "vendor-canvas",
                test: /[\\/]node_modules[\\/](konva|react-konva)[\\/]/,
                priority: 70,
              },
              {
                name: "vendor-i18n",
                test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
                priority: 70,
              },
            ],
          },
        },
      },
    },
    server: {
      // 绑定 0.0.0.0，手机/同网段设备可通过本机局域网 IP 访问；仅 localhost 时 yarn dev 无法从其他机器打开
      host: true,
      proxy: {
        // 所有 API 请求统一使用 /api 前缀
        // 前端调用 /api/xxx，代理到后端的 /xxx
        "/api": {
          target: "http://127.0.0.1:15123",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/local": {
          target: "http://127.0.0.1:15123",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/local/, ""),
        },
        // // 录像 m3u8 播放列表（不走 /api 前缀，直接代理）
        // "/recordings/channels": {
        //   target: "http://127.0.0.1:15123",
        //   changeOrigin: true,
        // },
      },
    },
  };
});
