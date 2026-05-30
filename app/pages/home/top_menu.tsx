import { Link, useNavigate, useLocation } from "react-router";
import {
  ChevronsUpDown,
  Github,
  LogOut,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import SettingsModal from "~/components/settings/settings_modal";
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

// 导航项类型：支持 activePaths 扩展匹配，解决子路由激活回显
export interface TopMenuNavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  /** 除 url 本身外，也应触发激活高亮的路径前缀列表 */
  activePaths?: string[];
}

export function TopMenu({
  items,
  user,
}: {
  items: TopMenuNavItem[];
  user?: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const location = useLocation();

  // 判断某个导航项是否处于激活状态：
  // 精确匹配 url，或当前路径以 activePaths 中任意前缀开头
  function isActive(item: TopMenuNavItem): boolean {
    const p = location.pathname;
    if (p === item.url || p === `/${item.url}`.replace("//", "/")) return true;
    if (item.activePaths) {
      return item.activePaths.some((ap) => p.startsWith(ap));
    }
    return false;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center" style={{ padding: "10px 32px 4px" }}>
        {/* 毛玻璃胶囊容器 — 直接对应 mockup .nav-pill 数值 */}
        <nav
          className="flex items-center rounded-full"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.65)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            borderRadius: 9999,
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
            // 固定 line-height 消除亚像素舍入差异（normal 在不同工具下可能有 0.3px 浮动）
            lineHeight: "18.5px",
            WebkitFontSmoothing: "antialiased" as const,
          }}
        >
          {/* 主导航项 */}
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.url}
                to={item.url}
                className="select-none"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  borderRadius: 9999,
                  fontSize: 13,
                  lineHeight: "18.5px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "#1d1d1f" : "#6e6e73",
                  background: active ? "rgba(0,0,0,0.08)" : "transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                  border: "none",
                  boxShadow: active ? "inset 0 0.5px 0 rgba(0,0,0,0.04)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "rgba(0,0,0,0.04)";
                    el.style.color = "#1d1d1f";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "transparent";
                    el.style.color = "#6e6e73";
                  }
                }}
              >
                <item.icon style={{ width: 16, height: 16, flexShrink: 0, display: "block" }} />
                <span className="hidden sm:inline">{item.name}</span>
              </Link>
            );
          })}

          {/* 分隔线 */}
          <div
            className="mx-1 flex-shrink-0"
            style={{
              width: 1,
              height: 20,
              background: "rgba(0,0,0,0.1)",
            }}
          />

          {/* 语言切换 */}
          <LanguageSwitcher />

          {/* 用户下拉菜单 */}
          {user && <TopMenuUser user={user} />}
        </nav>
      </div>
    </div>
  );
}

// 用户下拉菜单（样式与原版一致，功能不变）
function TopMenuUser({
  user,
}: {
  user: { name: string; email: string; avatar: string };
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <>
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
            <div className="hidden sm:flex flex-col items-start text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-lg" align="end" sideOffset={4}>
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
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              设置
            </DropdownMenuItem>
          </DropdownMenuGroup>
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
                navigate("/");
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
