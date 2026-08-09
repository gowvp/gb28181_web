import axios, { type GenericAbortSignal } from "axios";
import { toastErrorMore } from "~/components/xui/toast";
import { codeMessage } from "./error";

// 忽略错误处理的url
const neglectUrl = ["/configs/info/web", "/stats"];

// 动态读取 BASEURL
// export function getDynamicBaseURL() {
//   const path = window.location.pathname;
//   const segments = path.split("/").filter(Boolean);
//   const prefix =
//     segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "";
//   return `${prefix}${process.env.BASEURL}`;
// }

const headers = {
  "Content-Type": "application/json",
};

let isRedirectingForAuth = false;

export const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 60000,
  headers: headers,
  responseType: "json",
});

service.interceptors.response.use(
  (resp) => {
    isRedirectingForAuth = false;
    return resp;
  },
  (error) => {
    if (!error) {
      //   message.error("网络异常");
      return Promise.reject(error);
    }

    const resp = error.response;
    const errTips = resp?.data.msg;

    let errorText = "";

    if (resp?.status) {
      errorText = codeMessage[resp?.status] || resp.statusText;
    }

    switch (resp?.status) {
      case 401:
      case 403:
        CleanLoginStoreage();
        if (!isRedirectingForAuth) {
          isRedirectingForAuth = true;
          window.location.assign(import.meta.env.BASE_URL);
        }
        break;
      case 404:
        // message.error(errorText ?? "请求的资源不存在");
        // history.push(`/404`);
        break;
      case 500:
      case 501:
      case 502:
      case 503:
      case 504:
        toastErrorMore("发生错误", [], {
          description: errorText ?? errTips ?? "网络异常",
        });
        // message.error();
        break;
      default:
        if (neglectUrl.includes(error.config.url)) {
          return Promise.reject(error);
        }
        console.log(
          "🚀 ~ file: http.ts ~ line 50 ~ service.interceptors.response.use",
          errorText,
          resp?.status,
        );
        break;
    }

    return Promise.reject(error);
  },
);

service.interceptors.request.use((config) => {
  const token: string = GetToken();
  if (!token) return config;
  config.headers.authorization = `Bearer ${token}`;
  return config;
});

async function request<T>(
  url: string,
  method: string,
  data?: object,
  _signal?: GenericAbortSignal,
  timeOut?: number,
  responseType?: "json" | "blob" | "arraybuffer",
  headers?: { [key: string]: string },
) {
  return await service.request<T>({
    url,
    method,
    data: method === "GET" ? {} : data,
    params: method === "GET" ? data : {},
    // signal: signal,
    timeout: timeOut,
    responseType: responseType || "json",
    headers: headers,
  });
}
// 查询
export async function GET<T>(
  url: string,
  params?: object,
  signal?: GenericAbortSignal,
  timeOut?: number,
  responseType?: "json" | "blob" | "arraybuffer",
  headers?: { [key: string]: string },
) {
  return request<T>(url, "GET", params, signal, timeOut, responseType, headers);
}

// 添加
export async function POST<T>(
  url: string,
  params?: object,
  signal?: GenericAbortSignal,
  timeOut?: number,
  responseType?: "json" | "blob" | "arraybuffer",
  headers?: { [key: string]: string },
) {
  return request<T>(
    url,
    "POST",
    params,
    signal,
    timeOut,
    responseType,
    headers,
  );
}

// 更新
export async function PUT<T>(url: string, params?: object) {
  return request<T>(url, "PUT", params);
}

// 删除
export async function DELETE<T>(url: string, params?: object) {
  return request<T>(url, "DELETE", params);
}

//fetch 请求
interface IFetch {
  method: "GET" | "POST" | "DELETE" | "PUT";
  data?: object;
  headers?: { [key: string]: string };
  keepalive?: boolean;
}

export async function Fetch(url: string, options: IFetch) {
  const requestOptions = {
    method: options.method || "GET",
    headers: { ...headers, ...options.headers },
    body: options.data ? JSON.stringify(options.data) : null,
    keepalive: options.keepalive || false,
  };

  const baseUrl = process.env.BASEURL + url;

  const response = await fetch(baseUrl, requestOptions);
  if (!response.ok) {
    return response;
  }
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  } else {
    return await response.text();
  }
}

export const TokenStr = "GOWVP_TOKEN";
export function GetToken() {
  return localStorage.getItem(TokenStr) as string;
}

export function CleanLoginStoreage() {
  localStorage.removeItem(TokenStr);
}
