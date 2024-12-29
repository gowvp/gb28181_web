# GoWVP GB/T28181 Pro Web

开箱即用的 GB/T28181 协议解决方案

## 页面缩略图

![首页概览](./docs/home.webp)

## 技术栈

前置要求:
node.js > 20.x

[React 19](https://react.dev/)
[React Router v7](https://reactrouter.com/)
[shadcn/ui](https://ui.shadcn.com/)
[vite](https://cn.vitejs.dev/)
[Tailwind CSS](https://tailwindcss.com/)
[React Query](https://tanstack.com/query/latest/docs/framework/react/overview)
[TypeScript](https://www.typescriptlang.org/)

## 使用帮助

路由跳转

```tsx
const navigate = useNavigate();

const handleClick = () => {
		navigate('/about');
}
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
