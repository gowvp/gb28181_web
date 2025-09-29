import React from "react";
import {
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
  Breadcrumb,
} from "../ui/breadcrumb";
import { Link } from "react-router";

export default function XHeader({
  items = [],
}: {
  items: { title: string; url?: string }[];
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        {/* <SidebarTrigger className="-ml-1" /> */}
        {/* <Separator orientation="vertical" className="mr-2 h-4" /> */}
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem className="hidden md:block">
                  {(item.url?.length ?? 0) == 0 ? (
                    <BreadcrumbPage>{item.title}</BreadcrumbPage>
                  ) : (
                    <Link to={item.url ?? ""}>{item.title}</Link>
                    // <BreadcrumbLink href={item.url}>

                    // </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < items.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
