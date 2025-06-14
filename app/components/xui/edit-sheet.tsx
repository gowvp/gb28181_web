import React, { useEffect, useImperativeHandle, useState } from "react";
import { SquarePlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Form } from "~/components/ui/form";
import type { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ErrorHandle } from "~/service/config/error";

export interface PFormProps {
  onAddSuccess?: () => void; // 添加成功回调
  onEditSuccess?: (data: any) => void; // 编辑成功回调
  ref: React.RefObject<EditSheetImpl | null>; // 控制反转
}

interface EditSheetProps<T extends z.ZodType> {
  title: string; // 标题
  description?: string; // 描述
  schema: T; // 表单验证
  defaultValues: z.infer<T>; // 默认值
  children: React.ReactNode; // 表单内容
  trigger?: React.ReactNode; // 触发器按钮
  mutation: {
    // api 请求
    add: (values: any) => Promise<any>;
    edit: (id: string, values: any) => Promise<any>;
  };
  onSuccess?: {
    // 成功回调
    add?: () => void;
    edit?: (data: any) => void;
  };
  ref?: React.Ref<EditSheetImpl>;
  form: any;
}

export interface EditSheetImpl {
  edit: (values: any) => void; // 编辑时传入表单的值，打开弹窗
}

export function EditSheet<T extends z.ZodType>({
  title, // 标题
  description, // 描述
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  schema, // 表单验证
  defaultValues, // 默认值
  children, // 表单内容
  trigger, // 触发器按钮
  mutation, // api 请求
  onSuccess, // 成功回调
  ref, // 控制反转
  form, // 表单
}: EditSheetProps<T>) {
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    edit(values: any) {
      console.log("🚀 ~ edit ~ values:", values);
      form.reset(values);
      setOpen(true);
    },
  }));

  useEffect(() => {
    // 关闭且编辑的话，重置表单
    // 添加的时候有两种方式防止页面误关闭
    // 1. 允许关闭，下次打开保留数据(这里选择了这种方式)
    // 2. 弹窗提示，是否丢弃数据并关闭

    setTimeout(() => form.clearErrors(), 200);
    if (!open && form.getValues().id) {
      setTimeout(() => {
        form.reset(defaultValues);
      }, 200);
    }
  }, [open]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof schema> & { id?: string }) => {
      if (values.id) {
        return await mutation.edit(values.id, values);
      } else {
        return await mutation.add(values);
      }
    },
    onSuccess(data, variables) {
      // console.log("🚀 ~ onSuccess ~ data:", data);
      if (variables.id) {
        onSuccess?.edit?.(data.data);
      } else {
        onSuccess?.add?.();
      }
      setOpen(false);
      setTimeout(() => {
        form.reset(defaultValues);
      }, 200);
    },
    onError: ErrorHandle,
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
      }}
    >
      <SheetTrigger asChild>
        {trigger || (
          <Button>
            <SquarePlus className="mr-2 h-4 w-4" />
            添加
          </Button>
        )}
      </SheetTrigger>

      <SheetContent>
        <SheetHeader className="pb-6">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values: any) => mutateAsync(values))}
            className="space-y-4"
          >
            {children}
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
