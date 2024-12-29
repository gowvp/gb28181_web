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
  { month: "22:10", memory: 18.6 },
  { month: "22:20", memory: 30.5 },
  { month: "22:30", memory: 23.7 },
  { month: "22:40", memory: 18.6 },
  { month: "22:50", memory: 23.7 },
  { month: "22:60", memory: 21.4 },
  { month: "22:70", memory: 7.3 },
  { month: "22:80", memory: 7.3 },
  { month: "22:90", memory: 7.3 },
  { month: "22:10", memory: 7.3 },
  { month: "22:20", memory: 7.3 },
  { month: "22:30", memory: 7.3 },
  { month: "22:40", memory: 7.3 },
  { month: "22:50", memory: 7.3 },
  { month: "22:60", memory: 7.3 },
  { month: "22:70", memory: 7.3 },
  { month: "22:80", memory: 7.3 },
  { month: "22:90", memory: 7.3 },
  { month: "22:10", memory: 7.3 },
  { month: "22:20", memory: 20.9 },
  { month: "22:30", memory: 21.4 },
  { month: "22:40", memory: 21.4 },
];
const chartConfig = {
  memory: {
    label: "memory",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function MemoryBox() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>内存</CardTitle>
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
              dataKey="memory"
              type="natural"
              fill="var(--color-memory)"
              fillOpacity={0.4}
              stroke="var(--color-memory)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
