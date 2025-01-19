import type { AxiosError } from "axios";
import { toast } from "~/hooks/use-toast";

export type CommonError = {
  reason: string;
  msg: string;
  details?: unknown;
};
// ErrorHandle 仅处理 400 错误，此错误为业务逻辑相关错误
export function ErrorHandle(error: AxiosError) {
  const err = error as AxiosError;
  if (!err.response || !err.response.data) {
    return;
  }
  const data = err.response.data as CommonError;

  // const key = Date.now().toString();
  if (err.response.status == 400) {
    toast({
      itemID: data.msg,
      title: "Error",
      description: data.msg,
      variant: "destructive",
      duration: 2000,
    });
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
