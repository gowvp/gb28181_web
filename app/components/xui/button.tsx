import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Trash } from "lucide-react";
import { PopoverClose } from "@radix-ui/react-popover";

export function XButtonDelete() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <Trash className="h-4 w-4" />
          删除
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">删除</h4>
            <p className="text-sm text-muted-foreground">确认继续吗?</p>
          </div>

          <div className="grid gap-2">
            <div className="grid grid-cols-2 items-center gap-4">
              <PopoverClose>
                <Button size={"sm"} className="w-full" variant="outline">
                  取消
                </Button>
              </PopoverClose>
              <Button size={"sm"}>确认</Button>
            </div>
            {/*    <Label htmlFor="width">Width</Label>
              <Input
                id="width"
                defaultValue="100%"
                className="col-span-2 h-8"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="maxWidth">Max. width</Label>
              <Input
                id="maxWidth"
                defaultValue="300px"
                className="col-span-2 h-8"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                defaultValue="25px"
                className="col-span-2 h-8"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="maxHeight">Max. height</Label>
              <Input
                id="maxHeight"
                defaultValue="none"
                className="col-span-2 h-8"
              />
            </div>*/}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
