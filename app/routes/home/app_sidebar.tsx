"use client";

import * as React from "react";
import {
  AudioWaveform,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Cctv,
  Videotape,
  Waypoints,
  Tv,
  UserRoundCog,
  ChartNoAxesGantt,
  MonitorUp,
  Podcast,
} from "lucide-react";

import { NavMain } from "./nav_main";
import { NavProjects } from "./nav_projects";
import { NavUser } from "./nav_user";
import { TeamSwitcher } from "./team_switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "~/components/ui/sidebar";

// This is sample data.
const data = {
  user: {
    name: "gowvp",
    email: "gowvp.golang.space:15123",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "GoWVP",
      logo: GalleryVerticalEnd,
      plan: "GB/T28181 - 2022",
    },
    {
      name: "GB/T28181",
      logo: AudioWaveform,
      plan: "GB/T28181 - 2022",
    },
    {
      name: "Onvif",
      logo: Command,
      plan: "Onvif",
    },
  ],
  navMain: [
    {
      title: "分屏监控",
      url: "/home",
      icon: Tv,
    },
    {
      title: "国标",
      url: "#",
      icon: Cctv,
      isActive: true,
      items: [
        {
          title: "国标设备",
          url: "/devices",
        },
        {
          title: "国标级联",
          url: "#",
        },
        {
          title: "国标配置",
          url: "#",
        },
      ],
    },
    {
      title: "推流列表",
      url: "#",
      icon: MonitorUp,
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    {
      title: "拉流代理",
      url: "/home",
      icon: Waypoints,
      // isActive: true,
    },
    {
      title: "通道管理",
      url: "/home",
      icon: ChartNoAxesGantt,
      // isActive: true,
    },
    {
      title: "云存录像",
      url: "/home",
      icon: Videotape,
      // isActive: true,
    },
    {
      title: "节点管理",
      url: "/home",
      icon: Podcast,
      // isActive: true,
    },
    {
      title: "用户管理",
      url: "/home",
      icon: UserRoundCog,
      // isActive: true,
    },
    {
      title: "系统设置",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "控制台",
      url: "/home",
      icon: SquareTerminal,
    },
    {
      name: "分屏监控",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        {/* 菜单 */}
        <NavMain items={data.navMain} />
        {/* 快捷 */}
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        {/* 用户 */}
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
