import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import {
  FindMediaServers,
  findMediaServersKey,
} from "~/service/api/media/media";
import type { MediaServer } from "~/service/api/media/state";
import { ErrorHandle } from "~/service/error";
import { EditForm } from "./edit";
import type { PFormProps } from "~/components/xui/edit-sheet";

export default function MediaView() {
  const { data, isLoading } = useQuery({
    queryKey: [findMediaServersKey],
    queryFn: () => FindMediaServers(),
    throwOnError: (error) => {
      ErrorHandle(error);
      return true;
    },
  });

  const editRef = useRef<any>(null);
  const queryClient = useQueryClient();

  return (
    <div className="p-4">
      <div className="flex flex-col gap-2">
        {data?.data.items.map((item) => (
          <MediaServerCard
            onClick={() => {
              editRef.current?.edit(item);
            }}
            key={item.id}
            item={item}
          />
        ))}
      </div>

      <EditForm
        ref={editRef}
        onEditSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: [findMediaServersKey],
          });
        }}
      />
    </div>
  );
}
export function MediaServerCard({
  item,
  onClick,
}: {
  item: MediaServer | any;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="h-auto w-full max-w-[300px] max-h-[300px] relative"
    >
      <div className="border rounded-2xl overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="aspect-video  flex items-center justify-center ">
          <img
            src={"./assets/imgs/zlm.webp"}
            alt="直播预览"
            className="aspect-[4/3]  object-contain"
          />
        </div>
        <div className="px-4 py-2">
          <h4 className="font-medium text-base truncate">{item.id}</h4>
          <span className="text-sm text-slate-500">IP: {item.ip}</span>
        </div>
        <div className="absolute bottom-2 right-2">
          <Button variant="outline" size="sm" className="rounded-xl w-16">
            编辑
          </Button>
        </div>
      </div>
    </div>
  );
}

{
  /* 是否在播放 */
}
{
  /* <div className="absolute top-2 left-2 flex flex-row gap-2">
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
          </div> */
}

{
  /* 是否在线 */
}
