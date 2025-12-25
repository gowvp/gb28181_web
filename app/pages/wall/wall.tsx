import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";

// 定义类型
type Direction = "horizontal" | "vertical";

interface NestedPanel {
  direction: Direction;
  panels: (number | NestedPanel)[];
}

type LayoutConfig = {
  [key: number]: NestedPanel;
};

// 定义布局配置
// 每个布局配置包含方向和面板数组
// 面板数组中的每个元素可以是简单的数字（表示一个面板）或嵌套数组（表示嵌套布局）
const layouts: LayoutConfig = {
  // 布局1：单个面板
  1: {
    direction: "horizontal",
    panels: [1],
  },
  // 布局2：左右两个面板
  2: {
    direction: "horizontal",
    panels: [1, 1],
  },
  // 布局3：左边一个面板，右边上下两个面板
  3: {
    direction: "horizontal",
    panels: [1, { direction: "vertical", panels: [1, 1] }],
  },
  // 布局4：上下左右四个面板
  4: {
    direction: "vertical",
    panels: [
      { direction: "horizontal", panels: [1, 1] },
      { direction: "horizontal", panels: [1, 1] },
    ],
  },
  // 布局5-8：与布局9相同（3x3布局）
  5: {
    direction: "vertical",
    panels: [
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
    ],
  },
  6: {
    direction: "vertical",
    panels: [
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
    ],
  },
  7: {
    direction: "vertical",
    panels: [
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
    ],
  },
  8: {
    direction: "vertical",
    panels: [
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
    ],
  },
  // 布局9：3x3布局
  9: {
    direction: "vertical",
    panels: [
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
      { direction: "horizontal", panels: [1, 1, 1] },
    ],
  },
};

// 递归渲染面板组件
function renderPanel(
  panel: number | NestedPanel,
  panelIndex: string | number,
): React.ReactNode {
  // 如果是对象，表示嵌套布局
  if (typeof panel === "object") {
    return (
      <ResizablePanelGroup
        key={`panel-group-${panelIndex}`}
        direction={panel.direction}
        className="h-full w-full"
      >
        {panel.panels.map((subPanel, subPanelIndex) => (
          <React.Fragment key={`panel-fragment-${panelIndex}-${subPanelIndex}`}>
            {subPanelIndex > 0 && <ResizableHandle />}
            <ResizablePanel
              minSize={10}
              defaultSize={100 / panel.panels.length}
            >
              {renderPanel(subPanel, `${panelIndex}-${subPanelIndex}`)}
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    );
  }

  // 否则是简单面板
  return (
    <div className="flex h-full items-center justify-center p-6">
      <span className="font-semibold">面板 {panelIndex}</span>
    </div>
  );
}

export default function WallView() {
  // 使用布局3
  const currentLayout = layouts[3];

  return (
    <div className="h-screen w-full overflow-hidden">
      <SidebarProvider>
        <div className="flex h-full">
          <Sidebar>
            <SidebarHeader />
            <SidebarContent>
              <SidebarGroup />
              <SidebarGroup />
            </SidebarContent>
            <SidebarFooter />
          </Sidebar>
          <main className="flex-1 flex m-2 flex-col overflow-hidden">
            <SidebarTrigger />
            <div className="flex-1 p-4 overflow-hidden">
              <ResizablePanelGroup
                direction={currentLayout.direction}
                className="h-full w-full rounded-lg border"
                autoSaveId="persistence"
              >
                {currentLayout.panels.map((panel, index) => (
                  <React.Fragment key={`root-panel-${index}`}>
                    {index > 0 && <ResizableHandle />}
                    <ResizablePanel
                      minSize={10}
                      defaultSize={100 / currentLayout.panels.length}
                    >
                      {renderPanel(panel, index)}
                    </ResizablePanel>
                  </React.Fragment>
                ))}
              </ResizablePanelGroup>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
