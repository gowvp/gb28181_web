import React, { useEffect, useImperativeHandle, useState } from "react";
import { SquarePlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AddRTMP, EditRTMP, findRTMPsKey } from "~/service/api/rtmp";
import { ErrorHandle } from "~/service/error";

const formSchema = z.object({
  app: z.string().min(2).max(20),
  stream: z.string().min(2).max(20),
  id: z.any(),
});

interface AddFormProps {
  onAddSuccess?: () => void; // 新增成功
  onEditSuccess?: (data: any) => void; // 修改成功
  ref: React.RefObject<any>;
}

export interface EditFromImpl {
  edit: (values: any) => void;
}

export function EditForm({ onAddSuccess, onEditSuccess, ref }: AddFormProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  useImperativeHandle(ref, () => ({
    edit(values: any) {
      form.reset({ ...values });
      setOpen(true);
    },
  }));

  const defaultValues = {
    app: "live",
    stream: "",
    id: null,
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  useEffect(() => {
    if (!open) {
      console.log("🚀 ~ useEffect ~ open:", open);
      setTimeout(() => {
        form.reset(defaultValues);
      }, 200);
    }
    return () => {};
  }, [open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (values.id) {
        return await EditRTMP(values.id, values);
      } else {
        return await AddRTMP(values);
      }
    },
    onSuccess(data, variables) {
      if (variables.id) {
        onEditSuccess?.(data.data);
      } else {
        onAddSuccess?.();
      }
      setOpen(false);
    },
    onError: ErrorHandle,
  });

  //   AddRTMP

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="mx-3">
          <SquarePlus />
          添加通道
        </Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader className="pb-6">
          <SheetTitle>推流信息</SheetTitle>
          <SheetDescription>在此输入推流信息，然后点击保存</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="id"
              disabled
              render={({ field }) => (
                <FormItem hidden={!field.value}>
                  <FormLabel>ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="app"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stream"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>流 ID</FormLabel>
                  <FormControl>
                    <Input placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter>
              <Button isLoading={isPending} className="w-32" type="submit">
                保 存
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
