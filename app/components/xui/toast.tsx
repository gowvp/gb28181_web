import React from "react";
import { CircleCheckBig, OctagonAlert } from "lucide-react";
import { toast, type ExternalToast } from "sonner";

export function toastErrorMore(
  message: string,
  details: string[] | null,
  props?: ExternalToast
) {
  toast.error(message, {
    ...props,
    position: "top-right",
    style: {
      pointerEvents: "auto",
    },
    duration: 2000,
    icon: <OctagonAlert color="red" size={22} />,
    action: details && {
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

export function toastError(message: string, props?: ExternalToast) {
  toast.error(message, {
    position: "top-right",
    icon: <OctagonAlert color="red" size={22} />,
    duration: 2000,
    ...props,
  });
}

export function toastSuccess(message: string, props?: ExternalToast) {
  toast.success(message, {
    position: "top-right",
    icon: <CircleCheckBig color="green" size={22} />,
    duration: 2000,
    ...props,
  });
}
