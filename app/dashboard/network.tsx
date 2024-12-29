import React from "react";

import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";

const chartData = [
  { month: "22:10", up: 186, down: 80 },
  { month: "22:11", up: 305, down: 200 },
  { month: "22:12", up: 237, down: 120 },
  { month: "22:13", up: 73, down: 190 },
  { month: "22:14", up: 209, down: 130 },
  { month: "22:15", up: 214, down: 140 },
];
const chartConfig = {
  up: {
    label: "up",
    color: "hsl(var(--chart-1))",
  },
  down: {
    label: "down",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;
export function NetworkBox() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>网络读写</CardTitle>
        <CardDescription>2024-12-28 23:39:18</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 5)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="up"
              type="monotone"
              stroke="var(--color-up)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="down"
              type="monotone"
              stroke="var(--color-down)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
