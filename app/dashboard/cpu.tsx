import { TrendingUp } from "lucide-react";
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

const chartData = [
  { month: "22:10", cpu: 18.6 },
  { month: "22:20", cpu: 30.5 },
  { month: "22:30", cpu: 23.7 },
  { month: "22:40", cpu: 18.6 },
  { month: "22:50", cpu: 23.7 },
  { month: "22:60", cpu: 21.4 },
  { month: "22:70", cpu: 7.3 },
  { month: "22:80", cpu: 7.3 },
  { month: "22:90", cpu: 7.3 },
  { month: "22:10", cpu: 7.3 },
  { month: "22:20", cpu: 7.3 },
  { month: "22:30", cpu: 7.3 },
  { month: "22:40", cpu: 7.3 },
  { month: "22:50", cpu: 7.3 },
  { month: "22:60", cpu: 7.3 },
  { month: "22:70", cpu: 7.3 },
  { month: "22:80", cpu: 7.3 },
  { month: "22:90", cpu: 7.3 },
  { month: "22:10", cpu: 7.3 },
  { month: "22:20", cpu: 20.9 },
  { month: "22:30", cpu: 21.4 },
  { month: "22:40", cpu: 21.4 },
];
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function CPUBox() {
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
            data={chartData}
            margin={{
              left: -20,
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
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={3}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

            <Area
              dataKey="cpu"
              type="natural"
              fill="var(--color-desktop)"
              fillOpacity={0.4}
              stroke="var(--color-desktop)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
