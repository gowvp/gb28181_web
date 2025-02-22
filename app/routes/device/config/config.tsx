import React from "react";
import { Button } from "~/components/ui/button";
import XHeader from "~/components/xui/header";
import { z } from "zod";
import {
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  GetConfigInfo,
  getConfigInfoKey,
  SetConfigSIP,
} from "~/service/api/config/config";
import { Input } from "~/components/ui/input";
import { ErrorHandle } from "~/service/error";
import { toastSuccess } from "~/components/xui/toast";
const formSchema = z.object({
  domain: z.string(),
  id: z.string().min(18).max(20),
  password: z.any(),
  port: z.number().min(1).max(65535),
});

export default function config() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      domain: "",
      id: "",
      password: "",
      port: 0,
    },
  });

  const { data } = useQuery({
    queryKey: [getConfigInfoKey],
    queryFn: () => GetConfigInfo(),
  });

  React.useEffect(() => {
    if (data?.data.sip) {
      form.reset(data.data.sip);
    }
  }, [data]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (values: any) => SetConfigSIP(values),
    onError: ErrorHandle,
    onSuccess: () => {
      toastSuccess("保存成功");
    },
  });

  return (
    <>
      <XHeader
        items={[
          { title: "国标设备", url: "/devices" },
          { title: "国标配置", url: "/gb/sip" },
        ]}
      />

      <div className="p-10 w-[500px]">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values: any) => mutateAsync(values))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>*国标 ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>*国标域</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="port"
              disabled
              render={({ field }) => (
                <FormItem>
                  <FormLabel>*端口号(UDP/TCP)</FormLabel>
                  <FormDescription>
                    端口号需要在配置文件修改并重启程序
                  </FormDescription>
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
                <FormItem hidden={!field.value}>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button isLoading={isPending} className="w-48 mt-10" type="submit">
              保存配置
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
