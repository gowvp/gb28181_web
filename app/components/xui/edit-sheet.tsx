import React, { useEffect, useImperativeHandle, useState } from "react";
import { SquarePlus } from "lucide-react";
import { Button as ShadcnButton } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Form, Button } from "antd";
import type { FormInstance } from "antd";
import { useMutation } from "@tanstack/react-query";
import { ErrorHandle } from "~/service/config/error";
import { useTranslation } from "react-i18next";

export interface PFormProps {
  onAddSuccess?: () => void; // 添加成功回调
  onEditSuccess?: (data: any) => void; // 编辑成功回调
  ref: React.RefObject<EditSheetImpl | null>; // 控制反转
}

interface EditSheetProps {
  title: string; // 标题
  description?: string; // 描述
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
  form: FormInstance; // Ant Design Form 实例
}

export interface EditSheetImpl {
  edit: (values: any) => void; // 编辑时传入表单的值，打开弹窗
}

export function EditSheet({
  title, // 标题
  description, // 描述
  children, // 表单内容
  trigger, // 触发器按钮
  mutation, // api 请求
  onSuccess, // 成功回调
  ref, // 控制反转
  form, // Ant Design Form 实例
}: EditSheetProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    edit(values: any) {
      console.log("🚀 ~ edit ~ values:", values);
      form.setFieldsValue(values);
      setOpen(true);
    },
  }));

  useEffect(() => {
    // 关闭时重置表单
    if (!open) {
      setTimeout(() => {
        const currentValues = form.getFieldsValue();
        if (currentValues.id) {
          form.resetFields();
        }
      }, 200);
    }
  }, [open, form]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (values: any) => {
      if (values.id) {
        return await mutation.edit(values.id, values);
      } else {
        return await mutation.add(values);
      }
    },
    onSuccess(data, variables) {
      if (variables.id) {
        onSuccess?.edit?.(data.data);
      } else {
        onSuccess?.add?.();
      }
      setOpen(false);
      setTimeout(() => {
        form.resetFields();
      }, 200);
    },
    onError: ErrorHandle,
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await mutateAsync(values);
    } catch (error) {
      console.log("表单验证失败:", error);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
      }}
    >
      <SheetTrigger asChild>
        {trigger || (
          <ShadcnButton>
            <SquarePlus className="mr-2 h-4 w-4" />
            {t("add")}
          </ShadcnButton>
        )}
      </SheetTrigger>

      <SheetContent>
        <SheetHeader className="pb-6">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <Form form={form} layout="vertical" size="large">
          {children}
          <div className="mt-6">
            <Button
              type="primary"
              loading={isPending}
              onClick={handleSubmit}
              block
            >
              {t("save")}
            </Button>
          </div>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
