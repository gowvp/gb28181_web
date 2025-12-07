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
import { Toaster } from "./components/ui/sonner";
import { ConfigProvider, App as AntdApp } from "antd";
import { DrawerCSSProvider } from "./components/xui/drawer";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n/config";

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
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>
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
        </I18nextProvider>
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
