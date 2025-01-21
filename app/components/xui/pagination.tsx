import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationNext,
} from "../ui/pagination";

type PaginationBoxProps = {
  page: number;
  size: number;
  total: number;
  setPagination: (page: number, size: number) => void;
};

export default function PaginationBox({
  page,
  size,
  total,
  setPagination,
}: PaginationBoxProps) {
  const setData = (page: number, size: number) => {
    setTimeout(() => {
      setPagination(page, size);
    }, 50);
  };

  return (
    <div className="flex items-center justify-end space-x-2 py-4">
      <div className="flex">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => {
                  if (page > 1) {
                    setData(page - 1, size);
                  }
                }}
              />
            </PaginationItem>
            {getPaginationArray(page, size, total).map((v) => {
              return (
                <PaginationItem key={v}>
                  <PaginationLink
                    isActive={v == page}
                    onClick={() => {
                      if (page <= 0) page = 1;
                      if (page != v) {
                        setData(v, size);
                      }
                    }}
                  >
                    {v}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            {/* <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem> */}
            <PaginationItem>
              <PaginationNext
                onClick={() => {
                  if (page <= 0) page = 1;
                  if (page < Math.ceil(total / size)) {
                    setData(page + 1, size);
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        <Select
          defaultValue={size.toString()}
          onValueChange={(v) => setData(1, Number(v))}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[3rem]">
            <SelectItem value="12">12 / 页</SelectItem>
            <SelectItem value="24">24 / 页</SelectItem>
            <SelectItem value="36">36 / 页</SelectItem>
            <SelectItem value="50">50 / 页</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
function getPaginationArray(page: number, size: number, total: number) {
  const totalPages = Math.ceil(total / size);
  const paginationArray = [];

  if (totalPages <= 4) {
    for (let i = 1; i <= totalPages; i++) {
      paginationArray.push(i);
    }
    return paginationArray;
  }

  if (page <= 2) {
    for (let i = 1; i <= 4; i++) {
      paginationArray.push(i);
    }
  } else if (page >= totalPages - 1) {
    for (let i = totalPages - 3; i <= totalPages; i++) {
      paginationArray.push(i);
    }
  } else {
    paginationArray.push(page - 1);
    paginationArray.push(page);
    paginationArray.push(page + 1);
    paginationArray.push(page + 2);
  }

  return paginationArray;
}
