import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import type { NetStat } from "~/service/model/stat";

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
export function NetworkBox({ data }: { data: NetStat[] }) {
  // const chartData = [
  //   { month: "22:10", up: 186, down: 80 },
  //   { month: "22:11", up: 305, down: 200 },
  //   { month: "22:12", up: 237, down: 120 },
  //   { month: "22:13", up: 73, down: 190 },
  //   { month: "22:14", up: 209, down: 130 },
  //   { month: "22:15", up: 214, down: 140 },
  // ];

  const processedData = data.map((item) => ({
    ...item,
    up: item.up / 1000 / 1000, // 对 up 值进行预处理
    down: item.down / 1000 / 1000,
  }));
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
            data={processedData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => value.slice(11, 11 + 8)}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={5}
              tickFormatter={(v, idx) => v + "MB"}
              ticks={[0, 8, 16, 24, 32]}
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
