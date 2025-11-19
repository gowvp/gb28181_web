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
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  domain: z.string(),
  id: z.string().min(18).max(20),
  password: z.any(),
  port: z.number().min(1).max(65535),
});

export default function config() {
  const { t } = useTranslation("common");

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
      toastSuccess(t("save_success"));
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
                  <FormLabel>*{t("gb_id")}</FormLabel>
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
                  <FormLabel>*{t("gb_domain")}</FormLabel>
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
                  <FormLabel>*{t("port_udp_tcp")}</FormLabel>
                  <FormDescription>{t("port_config_tip")}</FormDescription>
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
              {t("save_config")}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
