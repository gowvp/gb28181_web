import React from "react";
import { Button } from "~/components/ui/button";
import { z } from "zod";
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
import { ErrorHandle } from "~/service/config/error";
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
      {/* <XHeader
        items={[
          { title: "监控列表", url: "/nchannels" },
          { title: "国标配置", url: "/gb/sip" },
        ]}
      /> */}

      <div className="w-[380px] px-6 pt-6 m-auto">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values: any) => mutateAsync(values))}
            className="space-y-4 w-full"
          >
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>*国标 ID</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} className="pr-12" />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                        {String(field.value || "").length}
                      </span>
                    </div>
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
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              isLoading={isPending}
              className="w-full sm:w-48 mt-10 rounded-2xl min-h-9"
              type="submit"
              isFull
            >
              保存配置
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
