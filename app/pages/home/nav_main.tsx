import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

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
          <SidebarMenuItem key={item.name} className="my-1">
            {/* <CollapsibleTrigger asChild> */}
            <Link to={item.url}>
              <SidebarMenuButton tooltip={item.name}>
                {item.icon && <item.icon className="w-6 h-6" />}
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
