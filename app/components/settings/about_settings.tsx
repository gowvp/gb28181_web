import { useQuery } from "@tanstack/react-query";
import { SquareArrowOutUpRight } from "lucide-react";
import { checkVersion, checkVersionKey } from "~/service/api/version/version";

/** 项目相关链接常量 */
const GITHUB_URL = "https://github.com/gowvp/gb28181_web";
const GITEE_URL = "https://gitee.com/gowvp/gb28181";
const BILIBILI_URL = "https://www.bilibili.com/video/BV1QLQeYHEXb";
const AUTHOR_URL = "https://github.com/ixugo";

/** Gitee 品牌图标：取自官方 logo 的红色圆形 G 部分 */
function GiteeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} aria-label="Gitee">
      <circle fill="#C71D23" cx="44.85" cy="44.85" r="44.85" />
      <path
        d="M67.56 39.87 L42.09 39.87 C40.86 39.87 39.87 40.86 39.87 42.09 L39.87 47.62 C39.87 48.85 40.86 49.84 42.08 49.84 L57.59 49.84 C58.81 49.84 59.81 50.83 59.81 52.05 L59.81 53.16 C59.81 56.83 56.83 59.81 53.16 59.81 L32.12 59.81 C30.89 59.81 29.90 58.81 29.90 57.59 L29.90 36.55 C29.90 32.88 32.88 29.90 36.55 29.90 L67.55 29.90 C68.78 29.90 69.77 28.91 69.77 27.69 L69.77 22.15 C69.77 20.93 68.78 19.94 67.56 19.94 L36.55 19.94 C27.37 19.94 19.94 27.37 19.94 36.55 L19.94 67.56 C19.94 68.78 20.93 69.77 22.15 69.77 L54.82 69.77 C63.08 69.77 69.77 63.08 69.77 54.82 L69.77 42.09 C69.77 40.86 68.78 39.87 67.56 39.87 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** GitHub 品牌图标：官方 Octocat 轮廓 */
function GithubBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-label="GitHub">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

interface AboutLinkItemProps {
  icon: React.ReactNode;
  label: string;
  url: string;
}

/** 关于面板的单个链接卡片：整卡可点击跳转外链 */
function AboutLinkItem({ icon, label, url }: AboutLinkItemProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
    >
      <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 transition-all shrink-0 overflow-hidden">
        {icon}
      </span>
      <div className="text-xs font-semibold text-slate-800">{label}</div>
      <SquareArrowOutUpRight className="w-3.5 h-3.5 ml-auto text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
    </a>
  );
}

/**
 * 关于面板：
 * 顶部 OWL 品牌区（logo + 标题 + 版本号），下方为项目链接与版权信息。
 */
export default function AboutSettings() {
  const { data: versionInfo } = useQuery({
    queryKey: [checkVersionKey],
    queryFn: checkVersion,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="max-w-lg">
      {/* OWL 品牌区 */}
      <div className="flex flex-col items-center pt-2 pb-5">
        <img
          src="./assets/imgs/logo.avif"
          alt="OWL"
          className="w-20 h-20 rounded-2xl shadow-sm"
        />
        <div className="mt-3 text-base font-bold text-slate-800 tracking-wide">
          OWL
        </div>
        <div className="mt-1 text-[11px] text-slate-400 font-mono">
          {versionInfo?.current_version || "未知版本"}
        </div>
      </div>

      <div className="space-y-1">
        <AboutLinkItem
          icon={<GithubBrandIcon className="w-4 h-4" />}
          label="GitHub"
          url={GITHUB_URL}
        />
        <AboutLinkItem
          icon={<GiteeIcon className="w-4 h-4" />}
          label="Gitee"
          url={GITEE_URL}
        />
        <AboutLinkItem
          icon={
            <img
              src="./assets/imgs/bilibili.png"
              alt="bilibili"
              className="w-full h-full object-cover"
            />
          }
          label="哔哩哔哩视频教程"
          url={BILIBILI_URL}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 text-center">
        <div className="text-[11px] text-slate-400">
          ©{" "}
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:underline"
          >
            ixugo
          </a>{" "}
          2024~2026
        </div>
      </div>
    </div>
  );
}
