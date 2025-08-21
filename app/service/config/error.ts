import type { AxiosError } from "axios";
import { toastErrorMore } from "~/components/xui/toast";

export const codeMessage: { [key: number]: string } = {
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
    toastErrorMore("发生错误", data.details, {
      description: data.msg ?? codeMessage[err.response.status],
    });
    // {
    //   itemID: data.msg,
    //   title: "Error",
    //   description: data.msg,
    //   variant: "destructive",
    //   duration: 2000,
    // }
    // message.error({
    //   content: `${data.msg} ${data.details?.length > 0 ? "😦" : ""}`,
    //   duration: 2,
    //   key: key,
    //   onClick(e) {
    //     message.destroy(key);
    //     data.details?.map((v: string) => {
    //       if (v) {
    //         message.error({
    //           content: v,
    //           duration: 3,
    //         });
    //       }
    //     });
    //   },
    // });
  }
}
