import { CircleCheckBig, OctagonAlert } from "lucide-react";
import { type ExternalToast, toast } from "sonner";

// toastErrorMore 用于 api 统一错误处理
export function toastErrorMore(
  message: string,
  details: string[] | null,
  props?: ExternalToast,
) {
  toast.error(message, {
    ...props,
    position: "top-right",
    style: {
      pointerEvents: "auto",
    },
    duration: 2000,
    icon: <OctagonAlert color="red" size={22} />,
    action: (details ?? []).length > 0 && {
      label: <div className="z-100">😲</div>,
      actionButtonStyle: {
        zIndex: 100,
      },
      onClick: (e) => {
        e.stopPropagation();
        if (!details) return;
        for (let i = 0; i < details.length; i++) {
          toastError(details[i], {
            duration: 1000,
          });
        }
      },
    },
  });
}

// toastError 错误提示
export function toastError(message: string, props?: ExternalToast) {
  toast.error(message, {
    position: "top-right",
    icon: <OctagonAlert color="red" size={22} />,
    duration: 2000,
    ...props,
  });
}

// toastSuccess 操作成功提示
export function toastSuccess(message: string, props?: ExternalToast) {
  toast.success(message, {
    position: "top-right",
    icon: <CircleCheckBig color="green" size={22} />,
    duration: 2000,
    ...props,
  });
}

// toastWarn 警告提示
export function toastWarn(message: string, props?: ExternalToast) {
  toast.warning(message, {
    position: "top-right",
    // icon: <CircleExclamation color="yellow" size={22} />,
    duration: 2000,
    ...props,
  });
}
