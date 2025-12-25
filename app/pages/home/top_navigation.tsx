import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  Github,
  LogOut,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "~/components/language-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";

// 顶部导航菜单项类型定义
interface TopNavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  description?: string;
  children?: {
    name: string;
    url: string;
    description?: string;
  }[];
}

export function TopNavigation({
  items,
  user,
}: {
  items: TopNavItem[];
  user?: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center px-4 sm:px-8 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-8 bg-white/80 backdrop-blur-sm rounded-full px-4 sm:px-8 py-2 shadow-lg border border-gray-200/50">
          {/* 主导航菜单 */}
          <NavigationMenu>
            <NavigationMenuList className="flex-nowrap">
              {items.map((item) => (
                <NavigationMenuItem key={item.name}>
                  {/* 如果有子菜单，显示下拉菜单 */}
                  {item.children && item.children.length > 0 ? (
                    <>
                      <NavigationMenuTrigger>
                        <div className="flex items-center gap-1 sm:gap-2">
                          {item.icon && (
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span className="hidden sm:inline text-sm">
                            {item.name}
                          </span>
                        </div>
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[300px] gap-3 p-4 sm:w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                          {item.children.map((child) => (
                            <ListItem
                              key={child.name}
                              name={child.name}
                              url={child.url}
                            >
                              {child.description || ""}
                            </ListItem>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    /* 普通菜单项，直接跳转 */
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link
                        to={item.url}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4"
                        style={{ color: "#111827" }}
                      >
                        {item.icon && (
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span className="hidden sm:inline text-sm">
                          {item.name}
                        </span>
                      </Link>
                    </NavigationMenuLink>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* 分隔线 */}
          {user && (
            <div className="h-4 sm:h-6 w-px bg-gray-300 flex-shrink-0" />
          )}

          {/* 语言切换按钮 */}
          <LanguageSwitcher />

          {/* 用户菜单 */}
          {user && <TopNavUser user={user} />}
        </div>
      </div>
    </div>
  );
}

// 顶部导航用户菜单组件
function TopNavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 sm:px-3 py-2 h-auto data-[state=open]:bg-accent select-none"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
          </Avatar>
          {/* 用户信息 - 小屏幕隐藏 */}
          <div className="hidden sm:flex flex-col items-start text-sm leading-tight">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-lg"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => window.open("https://github.com/gowvp/gb28181")}
          >
            <Github className="mr-2 h-4 w-4" />
            Github
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => window.open("https://gitee.com/gowvp/gb28181")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Gitee
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            setIsLoggingOut(true);
            setTimeout(() => {
              localStorage.removeItem("token");
              navigate({ to: "/" });
              setIsLoggingOut(false);
            }, 400);
          }}
        >
          <LogOut
            className={`mr-2 h-4 w-4 transition-transform duration-400 ${
              isLoggingOut ? "animate-spin" : ""
            }`}
          />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 列表项组件
function ListItem({
  name,
  children,
  url,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & {
  name: string;
  url: string;
}) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link
          to={url}
          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          style={{ color: "#111827" }}
        >
          <div className="text-sm font-medium leading-none">{name}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}
