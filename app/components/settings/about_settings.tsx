import { useQuery } from "@tanstack/react-query";
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

/**
 * 关于面板：
 * 顶部 OWL 品牌区（logo + 标题 + 版本号），中部链接图标，底部版权。
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
      <div className="flex flex-col items-center pt-2 pb-4">
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

      {/* 链接图标：仅图标，点击跳转 */}
      <div className="flex items-center justify-center gap-5 py-2">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          title="GitHub"
          className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <GithubBrandIcon className="w-6 h-6" />
        </a>
        <a
          href={GITEE_URL}
          target="_blank"
          rel="noreferrer"
          title="Gitee"
          className="hover:opacity-80 transition-opacity cursor-pointer"
        >
          <GiteeIcon className="w-6 h-6" />
        </a>
        <a
          href={BILIBILI_URL}
          target="_blank"
          rel="noreferrer"
          title="哔哩哔哩视频教程"
          className="hover:opacity-80 transition-opacity cursor-pointer"
        >
          <img
            src="./assets/imgs/bilibili.png"
            alt="bilibili"
            className="w-6 h-6 rounded-md"
          />
        </a>
      </div>

      <div className="pt-3 text-center text-[11px] text-slate-400">
        ©{" "}
        <a
          href={AUTHOR_URL}
          target="_blank"
          rel="noreferrer"
          className="hover:text-slate-600 transition-colors"
        >
          ixugo
        </a>{" "}
        2024~2026
      </div>
    </div>
  );
}
