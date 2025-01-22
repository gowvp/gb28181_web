import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { CircleAlert, Trash } from "lucide-react";
import { PopoverClose } from "@radix-ui/react-popover";

export function XButtonDelete({
  onConfirm,
  isLoading,
}: {
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          isLoading={isLoading ?? false}
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <Trash className="h-4 w-4" />
          删除
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36">
        <div className="grid gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground flex items-center">
              <CircleAlert
                className="inline-block pr-2"
                fill="orange"
                color="white"
                size={28}
              />
              确认删除吗?
            </p>
          </div>

          <div className="grid gap-2">
            <div className="grid grid-cols-2 items-center gap-4">
              <PopoverClose>
                <Button size={"sm"} className="w-full" variant="outline">
                  取消
                </Button>
              </PopoverClose>
              <PopoverClose>
                <Button onClick={onConfirm} size={"sm"}>
                  确认
                </Button>
              </PopoverClose>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
