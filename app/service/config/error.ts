import type { AxiosError } from "axios";
import { toastErrorMore } from "~/components/xui/toast";
import i18n from "~/i18n/config";

// 中文错误消息
export const codeMessageZh: { [key: number]: string } = {
  200: "服务器成功返回请求的数据。",
  201: "新建或修改数据成功。",
  202: "一个请求已经进入后台排队（异步任务）。",
  204: "删除数据成功。",
  400: "发出的请求有错误，服务器没有进行新建或修改数据的操作。",
  401: "用户没有权限（令牌、用户名、密码错误）。",
  403: "用户得到授权，但是访问是被禁止的。",
  404: "404 请求的资源不存在",
  406: "请求的格式不可得。",
  410: "请求的资源被永久删除，且不会再得到的。",
  422: "当创建一个对象时，发生一个验证错误。",
  500: "请检查能否连接服务器网络。",
  502: "网关错误。",
  503: "服务不可用，服务器暂时过载或维护。",
  504: "网关超时。",
  511: "没有权限 , 非法操作",
};

// 英文错误消息
export const codeMessageEn: { [key: number]: string } = {
  200: "The server successfully returned the requested data.",
  201: "Data created or modified successfully.",
  202: "A request has entered the background queue (asynchronous task).",
  204: "Data deleted successfully.",
  400: "The request has an error, the server did not create or modify data.",
  401: "User does not have permission (token, username, password error).",
  403: "User is authorized, but access is forbidden.",
  404: "404 The requested resource does not exist",
  406: "The requested format is not available.",
  410: "The requested resource has been permanently deleted and will not be available again.",
  422: "A validation error occurred when creating an object.",
  500: "Please check if you can connect to the server network.",
  502: "Gateway error.",
  503: "Service unavailable, server temporarily overloaded or under maintenance.",
  504: "Gateway timeout.",
  511: "No permission, illegal operation",
};

// 根据当前语言获取错误消息
export const codeMessage: { [key: number]: string } = codeMessageZh;

export type CommonError = {
  reason: string;
  msg: string;
  details: string[] | null;
};
// ErrorHandle 仅处理 400 错误，此错误为业务逻辑相关错误
export function ErrorHandle(error: any) {
  const err = error as AxiosError;
  if (!err.response || !err.response.data) {
    return;
  }
  const data = err.response.data as CommonError;
  console.log("🚀 ~ ErrorHandle ~ data:", data);

  // const key = Date.now().toString();
  if (err.response.status == 401) {
    window.location.href = "/";
  }

  if (err.response.status >= 400) {
    // 获取当前语言
    const isEnglish = i18n.language === "en";

    // 根据语言选择合适的消息
    const errorTitle = isEnglish ? "Error" : "发生错误";
    const errorMessage = isEnglish
      ? data.reason || codeMessageEn[err.response.status]
      : data.msg || codeMessageZh[err.response.status];

    toastErrorMore(errorTitle, data.details, {
      description: errorMessage,
    });
  }
}
