import React from "react";
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
import { AddRTMP } from "~/service/api/rtmp/rtmp";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EditMediaServer } from "~/service/api/media/media";
import { useTranslation } from "react-i18next";

// export type Request = {
//   /**
//    * gowvp 联系 zlm 的内网地址
//    */
//   ip: string;
//   /**
//    * zlm 的相关端口
//    */
//   ports: Ports;
//   /**
//    * 国标收流默认地址
//    */
//   sdp_ip: string;
//   /**
//    * zlm 的 api 秘钥
//    */
//   secret: string;
//   [property: string]: any;
// }

// /**
// * zlm 的相关端口
// */
// export type Ports = {
//   flv: number;
//   http: number;
//   rtmp: number;
//   rtsp: number;
//   [property: string]: any;
// }

const formSchema = z.object({
  id: z.any(),
  ip: z.string().min(2).max(20),
  sdp_ip: z.string().min(2).max(20),
  secret: z.string().min(2).max(50),
  hook_ip: z.string().min(2).max(20),
  // ports: z.object({
  //   flv: z.number(),
  //   http: z.number(),
  //   rtmp: z.number(),
  //   rtsp: z.number(),
  // }),
});

const defaultValues = {
  id: null,
  ip: "",
  sdp_ip: "",
  hook_ip: "",
  secret: "",
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
      title={t("media_config")}
      description={t("media_config_desc")}
      schema={formSchema}
      defaultValues={defaultValues}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddRTMP,
        edit: EditMediaServer,
      }}
      trigger={
        <></>
        //   <Button className="mx-3">
        //     <SquarePlus />
        //     {t("add_channel")}
        //   </Button>
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
        name="ip"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*{t("ip")}</FormLabel>
            <FormDescription>{t("ip_desc")}</FormDescription>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="sdp_ip"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*{t("gb_receive_address")}</FormLabel>
            <FormControl>
              <Input placeholder="" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="hook_ip"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*{t("hook_ip")}</FormLabel>
            <FormDescription>{t("hook_ip_desc")}</FormDescription>
            <FormControl>
              <Input placeholder="" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="secret"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>{t("zlm_secret")}</FormLabel>
            <FormDescription>{t("zlm_secret_desc")}</FormDescription>
            <FormControl>
              <Input placeholder="" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </EditSheet>
  );
}
