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
import { EditMediaServer } from "~/service/api/media/media";

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
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  return (
    <EditSheet
      form={form}
      ref={ref}
      title="流媒体配置"
      description="在此输入流媒体配置，然后点击保存"
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
        //     添加通道
        //   </Button>
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
        name="ip"
        render={({ field }) => (
          <FormItem>
            <FormLabel>*IP</FormLabel>
            <FormDescription>ZLM 的地址，用于被 gowvp 访问</FormDescription>
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
            <FormLabel>*国标收流默认地址</FormLabel>
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
            <FormLabel>*Hook IP</FormLabel>
            <FormDescription>gowvp 的地址，用于接收 zlm 回调</FormDescription>
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
            <FormLabel>zlm api secret</FormLabel>
            <FormDescription>
              可以从 configs/config.ini 文件中查找，用于接口鉴权
            </FormDescription>
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
