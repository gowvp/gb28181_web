import React from "react";

import { ChartContainer, type ChartConfig } from "~/components/ui/chart";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import {
  RadialBarChart,
  PolarGrid,
  RadialBar,
  PolarRadiusAxis,
  Label,
} from "recharts";
export default function CountBox() {
  return (
    <Card className="flex flex-col h-full">
      <div className="flex flex-1">
        <div className="flex-1 ">
          <Component
            rate={20}
            content={[
              { key: "设备总数", value: 7 },
              { key: "在线数量", value: 7 },
            ]}
          />
        </div>
        <div className="flex-1 ">
          <Component
            rate={30}
            content={[
              { key: "通道总数", value: 7 },
              { key: "在线数量", value: 7 },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-1">
        <div className="flex-1 ">
          <Component
            rate={70}
            content={[
              { key: "推流总数", value: 7 },
              { key: "在线数量", value: 7 },
            ]}
          />
        </div>
        <div className="flex-1 ">
          <Component
            rate={15}
            content={[
              { key: "拉流总数", value: 7 },
              { key: "在线数量", value: 7 },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  safari: {
    label: "Safari",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;
export function Component({
  rate,
  content,
}: {
  rate: number;
  content: { key: string; value: number }[];
}) {
  const chartData = [
    {
      browser: "safari",
      visitors: rate,
      fill: "var(--color-safari)",
    },
  ];
  return (
    <Card className="flex flex-col h-full rounded-none border-none shadow-none bg-transparent">
      <CardContent className="flex-1 p-0 m-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[120px]" // 减小高度
        >
          <RadialBarChart
            data={chartData}
            startAngle={(rate / 100) * 360}
            endAngle={0}
            innerRadius={40} // 减小内圆半径
            outerRadius={65} // 减小外圆半径
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[45, 35]} // 相应减小网格半径
            />
            <RadialBar dataKey="visitors" background cornerRadius={10} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-bold" // 减小字体大小
                        >
                          {chartData[0].visitors.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 16} // 减小间距
                          className="fill-muted-foreground text-xs" // 减小字体大小
                        >
                          Visitors
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm ">
        {content.map((item, index) => (
          <div key={index} className="leading-none text-muted-foreground">
            {item.key}:{item.value}
          </div>
        ))}
      </CardFooter>
    </Card>
  );
}
