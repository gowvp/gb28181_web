import { useQuery } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

import type { ChannelItem } from "~/service/api/channel/state";
import {
  FindChannels,
  findChannelsKey,
  RefreshSnapshot,
} from "~/service/api/channel/channel";
import { Pagination } from "antd";

import ChannelDetailView from "./detail";
import { Filter, RefreshCw } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";

export default function ChannelsView() {
  const [filters, setFilters] = useState({
    page: 1,
    size: 20,
    is_online: "all",
  });
  // 查询数据
  const { data, isLoading } = useQuery({
    queryKey: [findChannelsKey, filters],
    queryFn: () => FindChannels(filters),
    refetchInterval: 10000,
  });

  const detailRef = useRef<any>(null);

  const [isShowFilter, setIsShowFilter] = useState(true);

  return (
    <div className="w-full bg-white p-4 rounded-lg">
      <div className="mb-4 flex flex-row gap-2">
        <Button onClick={() => setIsShowFilter(!isShowFilter)}>
          <Filter
            className={`transition-transform duration-300 ${
              isShowFilter ? "rotate-180" : "rotate-0"
            }`}
          />
          筛选
        </Button>

        <Link to="/gb/sip">
          <Button variant="outline">接入信息</Button>
        </Link>

        <Link to="/devices">
          <Button variant="outline">旧版界面</Button>
        </Link>
      </div>

      <div
        className={cn(
          "mb-4 flex justify-start transition-all duration-300 overflow-hidden",
          isShowFilter ? "max-h-[300px]" : "max-h-0"
        )}
      >
        <ToggleGroup
          type="single"
          value={filters.is_online}
          onValueChange={(value) => {
            setFilters({ ...filters, is_online: value });
          }}
        >
          <ToggleGroupItem
            value="all"
            className="text-[#555] data-[state=on]:text-[#555]"
          >
            全部状态
          </ToggleGroupItem>
          <ToggleGroupItem
            value="true"
            className="text-[#555] data-[state=on]:text-[#555]"
          >
            在线
          </ToggleGroupItem>
          <ToggleGroupItem
            value="false"
            className="text-[#555] data-[state=on]:text-[#555]"
          >
            离线
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          ...(data?.data.items ?? []),
          ...Array(Math.max(0, 6 - (data?.data.items.length ?? 0))).fill({
            id: "none",
          }),
        ].map((item, index) => {
          if (item.id === "none") {
            return <ChannelCardItem2 key={index} />;
          }
          return (
            <div
              onClick={() => {
                detailRef.current.open(item);
              }}
              key={item.id}
            >
              <ChannelCardItem item={item} />
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-2 right-10">
        <Pagination
          showSizeChanger
          pageSizeOptions={[20, 40, 60, 100]}
          current={filters.page}
          pageSize={filters.size}
          total={data?.data.total}
          onChange={(page, pageSize) => {
            setFilters({ ...filters, page, size: pageSize });
          }}
        />
      </div>

      <ChannelDetailView ref={detailRef} />
    </div>
  );
}

export function ChannelCardItem({ item }: { item: ChannelItem | any }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const { data: url, refetch } = useQuery({
    queryKey: ["snapshot", item.id],
    queryFn: () => RefreshSnapshot(item.id, item.url, 300),
    enabled: item.is_online,
    retry: 1,
  });

  // 更新 snapshotUrl
  React.useEffect(() => {
    if (url?.data?.link) {
      setSnapshotUrl(url.data.link);
    }
  }, [url]);

  // const handleRefresh = async () => {
  //   if (isLoading) return;
  //   setIsLoading(true);
  //   try {
  //     await RefreshSnapshot(item.id, "", 10);
  //     await refetch(); // 刷新后重新获取快照
  //   } catch (error) {
  //     console.error("刷新快照失败:", error);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <div className="h-auto w-full max-w-[300px] max-h-[300px]">
      <div className="border rounded-2xl overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div
          className="aspect-video bg-slate-100 flex items-center justify-center relative"
          // onMouseEnter={() => setIsHovered(true)}
          // onMouseLeave={() => setIsHovered(false)}
        >
          <img
            src={snapshotUrl || "./assets/imgs/bg.webp"}
            alt="直播预览"
            className="aspect-[4/3] object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "./assets/imgs/bg.webp";
            }}
          />
          {/* 是否在播放 */}
          <div className="absolute top-2 left-2 flex flex-row gap-2">
            <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
              <span
                className={`w-2 h-2 rounded-full mr-1 ${
                  item.is_online ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              <span className="text-xs">Live</span>
            </div>

            <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
              <span
                className={`w-2 h-2 rounded-full mr-1 ${
                  item.is_online ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              <span className="text-xs">
                {item.is_online ? "在线" : "离线"}
              </span>
            </div>
          </div>

          {/* 刷新按钮 */}
          {isHovered && item.is_online && (
            <div className="absolute top-2 right-2">
              <Button
                variant="secondary"
                size="icon"
                className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation();
                  // handleRefresh();
                }}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 text-white ${
                    isLoading ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
          )}
        </div>
        <div className="px-4 py-2">
          <h4 className="font-medium text-base truncate">{item.name}</h4>
          <span className="text-sm text-slate-500">ID: {item.id}</span>
        </div>
      </div>
    </div>
  );
}

export function ChannelCardItem2() {
  return (
    <div className="w-[300px] max-w-[300px] h-auto">
      <div className="border border-slate-100 rounded-2xl overflow-hidden duration-300 h-full w-full">
        <div className="aspect-video bg-slate-50 flex items-center justify-center relative">
          <div id="img" className="aspect-[4/3] bg-slate-50 h-56"></div>
        </div>
        <div className="px-4 py-2">
          <div className="h-5 bg-slate-50 rounded w-3/4 mb-1"></div>
          <div className="h-4 bg-slate-50 rounded w-3/4 mb-1"></div>
        </div>
      </div>
    </div>
  );
}
