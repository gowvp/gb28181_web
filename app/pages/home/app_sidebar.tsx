import * as React from "react";
import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  SquareTerminal,
  Cctv,
  MonitorUp,
  Waypoints,
  Github,
  Home,
} from "lucide-react";

import { NavMain } from "./nav_main";
import { NavUser } from "./nav_user";
import { TeamSwitcher } from "./team_switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "~/components/ui/sidebar";
import { NavSecondary } from "./nav_secondary";

// This is sample data.
const data = {
  user: {
    name: "gowvp",
    email: "GB/T28181",
    // TODO: add avatar
    avatar: "/assets/imgs/bg.webp",
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
      name: "Onvif - 待开发",
      logo: Command,
      plan: "待开发",
    },
  ],
  // navMain: [
  //   {
  //     title: "国标",
  //     url: "#",
  //     icon: Cctv,
  //     isActive: true,
  //     items: [
  //       {
  //         title: "国标设备",
  //         url: "devices",
  //       },
  //       // {
  //       //   title: "国标级联",
  //       //   url: "#",
  //       // },
  //       {
  //         title: "国标配置",
  //         url: "gb/sip",
  //       },
  //     ],
  //   },

  //   {
  //     title: "通道管理",
  //     url: "/home",
  //     icon: ChartNoAxesGantt,
  //     // isActive: true,
  //   },
  //   {
  //     title: "云存录像",
  //     url: "/home",
  //     icon: Videotape,
  //     // isActive: true,
  //   },
  //   {
  //     title: "节点管理",
  //     url: "/home",
  //     icon: Podcast,
  //     // isActive: true,
  //   },
  //   {
  //     title: "用户管理",
  //     url: "/home",
  //     icon: UserRoundCog,
  //     // isActive: true,
  //   },
  //   {
  //     title: "系统设置",
  //     url: "#",
  //     icon: Settings2,
  //     items: [
  //       {
  //         title: "General",
  //         url: "#",
  //       },
  //       {
  //         title: "Team",
  //         url: "#",
  //       },
  //       {
  //         title: "Billing",
  //         url: "#",
  //       },
  //       {
  //         title: "Limits",
  //         url: "#",
  //       },
  //     ],
  //   },
  // ],
  projects: [
    // {
    //   name: "分屏监控",
    //   url: "#",
    //   icon: PieChart,

    // },

    {
      name: "快捷桌面",
      url: "desktop",
      icon: Home,
    },

    {
      name: "国标通道",
      url: "nchannels",
      icon: Cctv,
    },
    {
      name: "推流列表",
      url: "rtmps",
      icon: MonitorUp,
    },
    {
      name: "拉流代理",
      url: "rtsps",
      icon: Waypoints,
    },

    {
      name: "监控指标",
      url: "home",
      icon: SquareTerminal,
    },

    // {
    //   name: "Travel",
    //   url: "#",
    //   icon: Map,
    // },
  ],
  navSecondary: [
    {
      title: "Github",
      url: "https://github.com/gowvp/gb28181",
      icon: Github,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-white">
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent className="bg-white">
        {/* 菜单 */}
        <NavMain items={data.projects} />
        {/* 快捷 */}
        {/* <NavProjects projects={data.projects} /> */}
        {/* 开源项目，请保留仓库信息 */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="bg-white">
        {/* 用户 */}
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
