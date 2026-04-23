# PTZ 云台控制功能实现说明

## 概述

已成功为 GB28181 Web 前端项目添加了完整的 PTZ(云台)控制功能,支持 GB28181 协议的摄像头设备。

## 实现内容

### 1. API 接口层

**文件**: `app/service/api/channel/channel.ts`

添加了以下类型和函数:

```typescript
// PTZ 动作类型
type PTZAction = "continuous" | "stop" | "absolute" | "relative" | "preset";

// PTZ 方向
type PTZDirection = 
  | "up" | "down" | "left" | "right"
  | "upleft" | "upright" | "downleft" | "downright"
  | "zoomin" | "zoomout";

// PTZ 控制输入
interface PTZControlInput {
  action: PTZAction;
  direction?: PTZDirection;
  speed?: number;        // 0-1, 默认 0.5
  x?: number;            // -1 到 1 (绝对/相对移动)
  y?: number;            // -1 到 1 (绝对/相对移动)
  zoom?: number;         // 0 到 1 (绝对/相对移动)
  preset_id?: string;    // 预置位 ID
  preset_op?: PresetOp;  // 预置位操作
}

// PTZ 控制函数
async function PTZControl(channelId: string, data: PTZControlInput)
```

### 2. UI 组件

#### PTZ 控制面板

**文件**: `app/components/ptz-control/ptz-panel.tsx`

功能特性:
- ✅ 方向控制按钮(上、下、左、右)
- ✅ 对角线方向按钮(左上、右上、左下、右下)
- ✅ 变焦控制(放大、缩小)
- ✅ 停止按钮
- ✅ 速度调节滑块(10% - 100%)
- ✅ 按住移动,松开停止的交互方式
- ✅ 触摸设备支持
- ✅ 协议类型显示(GB28181)
- ✅ 不支持设备的友好提示

UI 设计:
- 采用十字方向键布局
- 直观的图标和文字提示
- 响应式设计,适配不同屏幕
- 加载状态显示
- 错误提示

#### Slider 组件

**文件**: `app/components/ui/slider.tsx`

基于 Radix UI 的 Slider 组件,用于速度控制。

### 3. 集成位置

**文件**: `app/pages/channels/device.tsx`

PTZ 控制面板已集成到设备详情视图的设备信息标签页中,当用户打开播放抽屉并查看设备详情时即可看到云台控制界面。

## 使用方法

### 基本操作

1. **打开播放抽屉**: 点击任意通道卡片
2. **查看设备详情**: 右侧会显示设备详细信息
3. **使用云台控制**: 在设备信息标签页底部找到 PTZ 控制面板

### 控制方式

#### 方向控制
- **点击并按住**方向按钮开始移动
- **松开按钮**自动停止
- 支持 8 个方向:上、下、左、右、左上、右上、左下、右下

#### 变焦控制
- **点击并按住**"放大"或"缩小"按钮
- **松开按钮**停止变焦

#### 速度调节
- 拖动滑块调整移动速度
- 范围:10% - 100%
- 默认值:50%

#### 紧急停止
- 点击红色停止按钮立即停止所有动作

### 请求流程

```
用户操作
  ↓
PTZPanel 组件
  ↓
PTZControl API 调用
  ↓
POST /channels/{id}/ptz/control
  ↓
后端 IPC Core
  ↓
协议适配器(GB28181/ONVIF)
  ↓
摄像头设备
```

### GB28181 实现

- 使用 SIP MESSAGE 方法发送控制命令
- XML 格式: `<Control><CmdType>DeviceControl</CmdType>...</Control>`
- 控制码格式: 8字节十六进制字符串
- 仅支持 continuous 和 stop 动作

### ONVIF 实现

- 使用 ONVIF PTZ 服务
- 支持 AbsoluteMove, RelativeMove, ContinuousMove
- 支持预设位管理(GotoPreset, SetPreset, RemovePreset)
- 完整的 PTZ 功能支持

## 注意事项

1. **设备必须在线**: 离线设备无法进行云台控制
2. **设备必须支持 PTZ**: 不是所有摄像头都支持云台功能
3. **GB28181 限制**: 仅支持连续移动和停止,不支持精确定位
4. **网络延迟**: 云台控制可能有轻微延迟,属正常现象
5. **权限要求**: 需要有效的认证 Token

## 故障排除

### 常见问题

**Q: 点击按钮没有反应?**
A: 检查以下几点:
- 设备是否在线
- 设备类型是否为 GB28181 或 ONVIF
- 浏览器控制台是否有错误信息
- 网络连接是否正常

**Q: 移动速度太快/太慢?**
A: 调整速度滑块,建议从 50% 开始尝试

**Q: 控制后不停止?**
A: 点击红色的停止按钮,或松开当前按住的按钮

**Q: 提示"云台控制失败"?**
A: 可能的原因:
- 设备不支持 PTZ 功能
- 设备配置问题
- 后端服务异常
- 查看浏览器控制台和网络请求获取详细错误

## 后续扩展

可以考虑添加的功能:

1. **预置位管理**: 保存和调用常用位置
2. **巡航路径**: 自动巡视多个位置
3. **键盘快捷键**: 使用方向键控制
4. **鼠标拖拽**: 在视频上直接拖拽控制
5. **手势控制**: 移动端滑动手势
6. **控制历史记录**: 查看最近的控制操作
7. **批量控制**: 同时控制多个摄像头

## 文件清单

新增文件:
- `app/service/api/channel/channel.ts` (修改,添加 PTZ API)
- `app/components/ptz-control/ptz-panel.tsx` (新增)
- `app/components/ui/slider.tsx` (新增)
- `app/pages/channels/device.tsx` (修改,集成 PTZ 面板)
- `package.json` (修改,添加 @radix-ui/react-slider 依赖)

## 测试建议

1. **功能测试**:
   - 测试所有方向的移动
   - 测试变焦功能
   - 测试速度调节
   - 测试停止功能

2. **兼容性测试**:
   - Chrome/Edge/Firefox/Safari
   - 桌面端和移动端
   - 鼠标和触摸操作

3. **性能测试**:
   - 快速连续点击
   - 长时间按住
   - 多设备同时控制

4. **边界测试**:
   - 离线设备
   - 不支持 PTZ 的设备
   - 网络异常情况

## 总结

PTZ 云台控制功能已完整实现并集成到前端项目中,用户可以通过直观的界面控制支持 GB28181 协议的摄像头设备。界面简洁易用,支持多种控制方式,提供了良好的用户体验。
