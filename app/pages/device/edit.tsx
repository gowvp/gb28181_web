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
import { AddDevice, EditDevice } from "~/service/api/device/device";
import { Radio } from "antd";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  device_id: z.string().min(18).max(20),
  name: z.string(),
  password: z.string(),
  id: z.any(),
  stream_mode: z.number(),
});

const defaultValues = {
  device_id: "",
  name: "",
  password: "",
  id: null,
  stream_mode: 0,
};

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  return (
    <EditSheet
      form={form}
      ref={ref}
      title={t("device_edit")}
      description={t("device_edit_desc")}
      schema={formSchema}
      defaultValues={defaultValues}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddDevice,
        edit: EditDevice,
      }}
      trigger={
        <Button className="mx-3">
          <SquarePlus />
          {t("add_device")}
        </Button>
      }
    >
      <FormField
        control={form.control}
        name="id"
        disabled
        render={({ field }) => (
          <FormItem hidden={!field.value}>
            <FormLabel>*{t("id")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="device_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*{t("device_code")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("name")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("password")}</FormLabel>
            <FormControl>
              <Input placeholder="" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="stream_mode"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>{t("stream_receive_mode")}</FormLabel>
            <FormControl>
              <div>
                <Radio.Group
                  value={field.value.toString()}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  <Radio.Button value="0">{t("udp")}</Radio.Button>
                  <Radio.Button value="1">{t("tcp_passive")}</Radio.Button>
                  <Radio.Button value="2">{t("tcp_active")}</Radio.Button>
                </Radio.Group>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* <FormField
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
      /> */}
    </EditSheet>
  );
}
