import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { z } from "zod";
import { AddRTMP, EditRTMP } from "~/service/api/rtmp";
import { EditSheet, type RTMPFormProps } from "~/components/xui/edit-sheet";
import { SquarePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "~/lib/utils";

import { Button as AntdButton, Radio } from "antd";
import { Form } from "react-router";

const formSchema = z.object({
  app: z.string().min(2).max(20),
  stream: z.string().min(2).max(20),
  id: z.any(),
  is_auth_disabled: z.boolean(),
});

const defaultValues = {
  id: null,
  app: "live",
  stream: "",
  is_auth_disabled: false,
};

export function EditForm({ onAddSuccess, onEditSuccess, ref }: RTMPFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  return (
    <EditSheet
      form={form}
      ref={ref}
      title="推流信息"
      description="在此输入推流信息，然后点击保存"
      schema={formSchema}
      defaultValues={defaultValues}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddRTMP,
        edit: EditRTMP,
      }}
      trigger={
        <Button className="mx-3">
          <SquarePlus />
          添加通道
        </Button>
      }
    >
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

      <FormField
        control={form.control}
        name="is_auth_disabled"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>推流鉴权</FormLabel>
            <FormDescription>建议开启，禁用推流鉴权是不安全的</FormDescription>
            <FormControl>
              <div>
                <Radio.Group
                  value={field.value.toString()}
                  onChange={(e) => field.onChange(e.target.value == "true")}
                >
                  <Radio.Button value="false">开启</Radio.Button>
                  <Radio.Button value="true">禁用</Radio.Button>
                </Radio.Group>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </EditSheet>
  );
}
