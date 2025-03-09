import React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { Link } from "react-router";

export function NavMain({
  items,
}: {
  items: {
    name: string;
    url: string;
    icon: LucideIcon;
    // isActive?: boolean;
    // items?: {
    //   title: string;
    //   url: string;
    // }[];
  }[];
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>导航</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          // <Collapsible
          //   key={item.title}
          //   asChild
          //   defaultOpen={item.isActive}
          //   className="group/collapsible"
          // >
          <SidebarMenuItem key={item.name}>
            {/* <CollapsibleTrigger asChild> */}
            <Link to={item.url}>
              <SidebarMenuButton tooltip={item.name}>
                {item.icon && <item.icon />}
                <span>{item.name}</span>
              </SidebarMenuButton>
            </Link>
            {/* </CollapsibleTrigger> */}
            {/* <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild>
                        <Link to={subItem.url}>
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent> */}
          </SidebarMenuItem>
          // </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
