import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export default function LoginView() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center h-screen ">
      {/* <Tabs defaultValue="account" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account">登录</TabsTrigger>
          <TabsTrigger value="password">忘记密码</TabsTrigger>
        </TabsList> */}
      {/* <TabsContent value="account"> */}
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>输入正确的账号密码登录</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="name">用户名</Label>
            <Input id="name" defaultValue="admin" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="username">密码</Label>
            <Input id="username" defaultValue="admin" />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => navigate("/home")}>登 录</Button>
        </CardFooter>
      </Card>
      {/* </TabsContent> */}
      {/* <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Change your password here. After saving, you'll be logged out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="current">Current password</Label>
                <Input id="current" type="password" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new">New password</Label>
                <Input id="new" type="password" />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save password</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs> */}
    </div>
  );
}
