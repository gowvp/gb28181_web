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
import { AddRTMP, EditRTMP } from "~/service/api/rtmp/rtmp";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { SquarePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Radio } from "antd";
import { useTranslation } from "react-i18next";

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
      title={t("push_info")}
      description={t("push_info_desc")}
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
          {t("add_channel")}
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
        name="app"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*{t("app")}</FormLabel>
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
            <FormLabel>*{t("stream")}</FormLabel>
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
            <FormLabel>{t("push_auth")}</FormLabel>
            <FormDescription>{t("push_auth_tip")}</FormDescription>
            <FormControl>
              <div>
                <Radio.Group
                  value={field.value.toString()}
                  onChange={(e) => field.onChange(e.target.value == "true")}
                >
                  <Radio.Button value="false">{t("enable")}</Radio.Button>
                  <Radio.Button value="true">{t("disable")}</Radio.Button>
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
