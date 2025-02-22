import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { z } from "zod";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { SquarePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Radio } from "antd";
import { AddProxy, EditProxy } from "~/service/api/rtsp/rtsp";

const formSchema = z.object({
  app: z.string().min(2).max(20),
  stream: z.string().min(2).max(20),
  id: z.any(),
  timeout_s: z.number().min(1).max(100),
  enabled: z.boolean(),
  transport: z.number().min(0).max(1),
  source_url: z.string().min(10),
});

const defaultValues = {
  id: null,
  app: "pull",
  stream: "",
  timeout_s: 10,
  enabled: true,
  transport: 0,
  source_url: "",
};

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  return (
    <EditSheet
      form={form}
      ref={ref}
      title="拉流信息"
      description="在此输入拉流信息，然后点击保存"
      schema={formSchema}
      defaultValues={defaultValues}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddProxy,
        edit: EditProxy,
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
            <FormLabel>*ID</FormLabel>
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
            <FormLabel>*应用名</FormLabel>
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
            <FormLabel>*流 ID</FormLabel>
            <FormControl>
              <Input placeholder="" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="source_url"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>*拉流地址</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="transport"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>*拉流方式</FormLabel>

            <FormControl>
              <div>
                <Radio.Group
                  value={field.value.toString()}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  <Radio.Button value="0">TCP</Radio.Button>
                  <Radio.Button value="1">UDP</Radio.Button>
                </Radio.Group>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="timeout_s"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*拉流超时(秒)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder=""
                {...field}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="enabled"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>是否启用</FormLabel>
            <FormControl>
              <div>
                <Radio.Group
                  value={field.value.toString()}
                  onChange={(e) => field.onChange(e.target.value == "true")}
                >
                  <Radio.Button value="true">开启</Radio.Button>
                  <Radio.Button value="false">禁用</Radio.Button>
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
