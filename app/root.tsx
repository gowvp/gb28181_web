import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import React from "react";
import { z } from "zod";
import { Toaster } from "./components/ui/sonner";
import { ConfigProvider, App as AntdApp } from "antd";
import { DrawerCSSProvider } from "./components/xui/drawer";
// import { Toaster } from "./components/ui/toaster";

// 全局设置自定义的错误信息
z.setErrorMap((issue, ctx) => {
  let message;
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined") {
        message = "必填项";
      } else {
        message = ctx.defaultError;
      }
      break;
    case z.ZodIssueCode.invalid_literal:
      message = `值无效，预期的值是 ${JSON.stringify(issue.expected)}。`;
      break;
    case z.ZodIssueCode.custom:
      message = `自定义错误：${issue.message || "未提供详细信息"}`;
      break;
    case z.ZodIssueCode.invalid_union:
      message = `输入不匹配任何允许的类型。`;
      break;
    case z.ZodIssueCode.invalid_union_discriminator:
      message = `无效的区分符，预期的值是：${Object.keys(issue.options).join(
        ", "
      )}。`;
      break;
    case z.ZodIssueCode.invalid_enum_value:
      message = `无效的枚举值，预期的值是 ${JSON.stringify(
        issue.options
      )}，但接收到的是 ${JSON.stringify(issue.received)}。`;
      break;
    case z.ZodIssueCode.unrecognized_keys:
      message = `对象中存在未识别的键：${issue.keys.join(", ")}。`;
      break;
    case z.ZodIssueCode.invalid_arguments:
      message = `函数参数无效`;
      break;
    case z.ZodIssueCode.invalid_return_type:
      message = `函数返回值无效`;
      break;
    case z.ZodIssueCode.invalid_date:
      message = `日期无效，请提供有效的日期格式。`;
      break;
    case z.ZodIssueCode.too_small:
      message = `字符串至少存在 ${issue.minimum} 个字符`;
      // message = ctx.defaultError;
      break;
    case z.ZodIssueCode.too_big:
      message = `字符串最多存在 ${issue.maximum} 个字符`;
      break;
    case z.ZodIssueCode.not_multiple_of:
      message = `数值必须是 ${issue.multipleOf} 的倍数`;
      break;
    case z.ZodIssueCode.not_finite:
      message = `数值必须是有限的`;
      break;
    default:
      message = ctx.defaultError;
  }
  return { message };
});

// eslint-disable-next-line react-refresh/only-export-components
export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      gcTime: 5 * 60 * 1000,
    },
  },
});

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-cn">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {/* antd 主题 */}
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#000",
              },
            }}
          >
            <AntdApp>
              <DrawerCSSProvider>{children}</DrawerCSSProvider>
            </AntdApp>
          </ConfigProvider>

          <ScrollRestoration />
          <Scripts />
        </QueryClientProvider>
        <Toaster />
        <script
          src={`${import.meta.env.VITE_BASENAME}assets/js/jessibuca.js`}
        ></script>

        {/* <script
          src={`${import.meta.env.VITE_BASENAME}assets/js/decoder.js`}
        ></script> */}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
