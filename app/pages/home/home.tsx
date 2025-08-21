import React from "react";
import { Outlet } from "react-router";
import { AppSidebar } from "./app_sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { useSidebarState } from "~/hooks/use-sidebar-state";
import type { Route } from "./+types/home";

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty-pattern
function meta({}: Route.MetaArgs) {
  return [
    { title: "GoWVP 开箱即用的国标平台" },
    { name: "description", content: "GOWVP" },
  ];
}
export default function Page() {
  const { isOpen, onStateChange } = useSidebarState();

  return (
    <SidebarProvider
      open={isOpen}
      onOpenChange={onStateChange}
      style={
        {
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div
            className="min-w-0 h-full"
            style={{
              background:
                "linear-gradient(to bottom right, white 30%, #FCFEFF 70%)",
            }}
          >
            <Outlet />
          </div>
        </div>

        {/* <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
          </div>
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
        </div> */}
      </SidebarInset>
    </SidebarProvider>
  );
}
