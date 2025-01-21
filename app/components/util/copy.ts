import copy from "copy-to-clipboard";
import { toastSuccess } from "../xui/toast";

// copy2Clipboard 拷贝到粘贴板
export function copy2Clipboard(
  s: string,
  toast?: { title?: string; description?: string }
) {
  copy(s);
  if (toast?.title) {
    toastSuccess(toast.title, { description: toast.description });
  }
}
