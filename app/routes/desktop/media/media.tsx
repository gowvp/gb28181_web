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
import { Settings } from "lucide-react";

export function MediaServerCard() {
  const { data, isLoading } = useQuery({
    queryKey: [findMediaServersKey],
    queryFn: () => FindMediaServers(),
    throwOnError: (error) => {
      ErrorHandle(error);
      return true;
    },
  });

  const item = data?.data.items[0];
  const editRef = useRef<any>(null);
  const queryClient = useQueryClient();
  return (
    <div>
      <div className="h-auto w-full max-w-[150px] max-h-[150px] relative">
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-300 bg-white">
          <div className="absolute left-[-45px] top-[5px]">
            <div className="bg-black/50 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-lg flex items-center">
              <span className="text-xs font-medium">{item?.ports?.rtmp}</span>
            </div>
          </div>

          <div className="absolute left-[-45px] top-[55px]">
            <div className="bg-black/50 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-lg flex items-center">
              <span className="text-xs font-medium">{item?.ports?.rtsp}</span>
            </div>
          </div>

          <div className="absolute left-[-45px] top-[105px]">
            <div className="bg-black/50 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-lg flex items-center">
              <span className="text-xs font-medium">
                {item?.sdp_ip} <br />({item?.rtpport_range})
              </span>
            </div>
          </div>

          <div className="absolute bottom-[-30px] left-1/2 transform -translate-x-1/2">
            <div className="bg-black/50 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-lg flex items-center">
              <span className="text-xs font-medium">
                {item?.ip}:{item?.ports?.http}
              </span>
            </div>
          </div>

          <div className="absolute bottom-1 right-1">
            <div className="relative">
              <div
                className={`absolute w-2 h-2 rounded-full ${
                  item?.status ? "bg-green-500" : "bg-red-500"
                } animate-ping`}
              ></div>
              <div
                className={`w-2 h-2 rounded-full ${
                  item?.status ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
            </div>
          </div>
          <div className="absolute top-1 right-1">
            <button
              onClick={() => {
                editRef.current?.edit(item);
              }}
              className="bg-black/50 backdrop-blur-sm text-white p-0.5 rounded-full hover:bg-black/70 transition-colors"
            >
              <Settings className="w-3 h-3" />
            </button>
          </div>
          <img
            src={"./assets/imgs/zlm.webp"}
            alt="直播预览"
            className=" object-contain "
          />
          <div className="px-2 py-5">
            {/* <span className="text-xs text-slate-500">IP: {item?.ip}</span> */}
          </div>
        </div>
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
