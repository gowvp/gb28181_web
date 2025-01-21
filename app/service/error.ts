import type { AxiosError } from "axios";
import { toastErrorMore } from "~/components/xui/toast";

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
  if (err.response.status == 400) {
    toastErrorMore("发生错误", data.details, {
      description: data.msg,
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
