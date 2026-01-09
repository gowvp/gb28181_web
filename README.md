<p align="center">
    <img src="./docs/logo.avif" alt="GoWVP Logo" width="550"/>
</p>

<p align="center">
    <a href="https://github.com/gowvp/gb28181/releases"><img src="https://img.shields.io/github/v/release/ixugo/goweb?include_prereleases" alt="Version"/></a>
    <a href="https://github.com/ixugo/goweb/blob/master/LICENSE.txt"><img src="https://img.shields.io/dub/l/vibe-d.svg" alt="License"/></a>
</p>

# 开箱即用的 GB/T28181 协议视频平台

go wvp 是 Go 语言实现的开源 GB28181 解决方案，基于GB28181-2022标准实现的网络视频平台，支持 rtmp/rtsp，客户端支持网页版本和安卓 App。支持rtsp/rtmp等视频流转发到国标平台，支持rtsp/rtmp等推流转发到国标平台。

## Golang 服务端实现 [gb28181](github.com/gowvp/gb28181)

当前项目是由 React 实现的 web 管理平台

## 页面缩略图

![首页概览](./docs/home.webp)
![首页概览](./docs/play.webp)

## 在线演示平台
+ [在线演示平台 :)](http://gowvp.golang.space:15123/)



## 技术栈

前置要求:
node.js > 20.x

+ [React 19](https://react.dev/)
+ [TanStack Router](https://tanstack.com/router/latest)
+ [shadcn/ui](https://ui.shadcn.com/)
+ [Vite 7](https://cn.vitejs.dev/)
+ [Tailwind CSS 4](https://tailwindcss.com/) - 使用 @tailwindcss/vite 插件
+ [React Query](https://tanstack.com/query/latest/docs/framework/react/overview)
+ [TypeScript](https://www.typescriptlang.org/)
+ [Biome](https://biomejs.dev/) - 代码格式化和 lint

## 使用帮助

路由跳转

```tsx
import { useNavigate } from "@tanstack/react-router";

const navigate = useNavigate();

const handleClick = () => {
    navigate({ to: '/about' });
}

// 带搜索参数的导航
navigate({ to: '/zones', search: { cid: '123' } });
```

vite 配置代理
```ts
 server: {
    proxy: {
      "/api": {
        target: "http://localhost:18081",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
```


## 生产模式公共前缀

开发模式下，Vite 默认的开发服务器是以 / 为根路径运行的，而生产环境会以设置的 base 作为根路径。为了兼容开发模式和生产模式，可以按以下方式进行配置。
值为 `./` 会导致开发模式下出错


1.  更新 vite.config.ts
```ts
 base: mode === "development" ? "/" : "/web/",
```

2. 其它静态文件
```tsx
<img src={`${import.meta.env.BASE_URL}assets/logo.avif`} alt="Logo" />
```

## 开发与生成环境区分

`yarn dev` 加载 `.env.development` 环境变量

`yarn build` 加载 `.env.production` 环境变量

### 其它

**drawer 背景动画**
需要使用 DrawerCSSProvider 包裹父组件，动画才生效

**react-resizable-panels**
导入 shadcn-ui 的 resizable ，需要额外执行
`yarn add react-resizable-panels`

vite.config.ts 需要增加以下配置，否则模块加载会出问题

```ts
 ssr: {
      // 外部化会导致问题的依赖项
      noExternal: ["react-resizable-panels"],
    },
```

### 部署

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

This template includes three Dockerfiles optimized for different package managers:

- `Dockerfile` - for npm
- `Dockerfile.pnpm` - for pnpm
- `Dockerfile.bun` - for bun

To build and run using Docker:

```bash
# For npm
docker build -t my-app .

# For pnpm
docker build -f Dockerfile.pnpm -t my-app .

# For bun
docker build -f Dockerfile.bun -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker,
```
