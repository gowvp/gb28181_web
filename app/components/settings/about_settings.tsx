import { useQuery } from "@tanstack/react-query";
import { GithubIcon, Info, PlayCircle, Server } from "lucide-react";
import { checkVersion, checkVersionKey } from "~/service/api/version/version";

/** 项目相关链接常量 */
const GITHUB_URL = "https://github.com/gowvp/gb28181_web";
const GITEE_URL = "https://gitee.com/gowvp/gb28181";
const BILIBILI_URL = "https://www.bilibili.com/video/BV1QLQeYHEXb";
const AUTHOR_URL = "https://github.com/ixugo";

interface AboutLinkItemProps {
  icon: React.ReactNode;
  label: string;
  url: string;
  desc?: string;
}

/** 关于面板的单个链接行：图标 + 名称 + 外链地址 */
function AboutLinkItem({ icon, label, url, desc }: AboutLinkItemProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
    >
      <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-all shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800">{label}</div>
        {desc && <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>}
        <div className="text-[11px] text-blue-500 truncate font-mono mt-0.5">
          {url}
        </div>
      </div>
    </a>
  );
}

/**
 * 关于面板：
 * 展示项目仓库链接、视频教程、版权信息与当前软件版本号。
 */
export default function AboutSettings() {
  const { data: versionInfo } = useQuery({
    queryKey: [checkVersionKey],
    queryFn: checkVersion,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="max-w-lg">
      <div className="space-y-1">
        <AboutLinkItem
          icon={<GithubIcon className="w-4 h-4" />}
          label="GitHub"
          url={GITHUB_URL}
          desc="开源仓库地址"
        />
        <AboutLinkItem
          icon={<Server className="w-4 h-4" />}
          label="Gitee"
          url={GITEE_URL}
          desc="镜像仓库地址"
        />
        <AboutLinkItem
          icon={<PlayCircle className="w-4 h-4" />}
          label="哔哩哔哩视频教程"
          url={BILIBILI_URL}
          desc="视频教程合集"
        />
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Info className="w-3 h-3" />
          <span>
            当前版本：
            <span className="font-mono text-slate-600">
              {versionInfo?.current_version || "未知"}
            </span>
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Copyright ©{" "}
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
