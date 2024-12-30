import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import type { Stat } from "~/service/model/state";

const chartConfig = {
  use: {
    label: "use",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function CPUBox({ data }: { data: Stat[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>CPU</CardTitle>
        <CardDescription>显示过去 100 秒的负载情况</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: -20,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => value.substring(11, 11 + 8)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={2}
              tickCount={5}
              tickFormatter={(v, idx) => v + "%"}
              ticks={[0, 25, 50, 75, 100]}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

            <Area
              dataKey="use"
              type="natural"
              fill="var(--color-use)"
              fillOpacity={0.4}
              stroke="var(--color-use)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
