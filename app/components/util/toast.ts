import { toast, type Toast } from "~/hooks/use-toast";

export function toastError({ ...props }: Toast) {
  toast({
    ...props,
    variant: "destructive",
    duration: 2000,
  });
}
