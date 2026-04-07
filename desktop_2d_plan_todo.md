# `/web/desktop` 2D 平面图 — 开发计划与现状（替代旧版计划文档）

> 本文档替代仓库内此前的 2D 开发/说明类文档，作为**唯一**跟进源。实现以当前代码为准（`FloorPlanState` v3、世界坐标 + 网格吸附、墙线/房间/Konva 等）。

## 1. 产品目标

在 `/desktop` 提供**数据流拓扑**与 **2D 平面视图**两种模式，2D 用于：

- 快速理解摄像头覆盖区域（扇区）与墙线/房间示意
- 绑定真实通道、悬停查看最近 AI 事件
- 从平面图**跳转录像回放**（与产品决策一致）
- 本地持久化布局（`localStorage`，第一版不接后端平面图存储）

## 2. 当前实现概要（与旧 MVP 文档的差异）

| 原 MVP 设想 | 当前实现 |
|-------------|----------|
| 纯四边形网格 row/col | 世界坐标 `(x,y)` + 网格吸附，并支持墙线、矩形房间、预设轮廓 |
| 简单编辑 | 多选、框选、编组、撤销栈、复制粘贴、对齐辅助线等 |
| hover 按需拉事件 | 已实现；事件缓存见 `floor_plan.events.ts` |

## 3. 数据模型（摘录）

见 `app/pages/desktop/floor_plan.types.ts`：`FloorPlanState`（含 `walls`、`cameras`、`view`）、`CameraMarker`（含 `channelId`、`latestEvent*` 等）。

## 4. 迭代计划（按优先级）

### 阶段 A — 闭环与首屏体验（进行中 / P0）

- [x] 数据流 ↔ 2D **视图模式** `localStorage` 记忆（`desktop-view-mode.ts`，键 `desktop-view-mode`）
- [x] **浏览 / 编辑** 模式：浏览下禁止改墙/摄像头、禁止绘制；编辑下保持现有能力（`floor_plan.storage`：`desktop-floor-plan-interaction-mode`）
- [x] 绑定通道的摄像头：**跳转录像页** `/playback/detail?cid=…&date=…`（与 `recordings.tsx` 一致，见 `floor_plan.playback.ts`）
- [x] 悬浮卡片：视口内**防裁切**、「打开录像」按钮；缩略图 `onError` 打日志
- [x] 浏览模式：单击用于选中（看侧栏），**不**自动整页跳转；跳转统一走「打开录像」

### 阶段 B — 信息效率（P1）

- [x] 单选摄像头时侧栏展示**最近一次 AI 事件**（与 hover 共用 `getLatestCameraEvent`）
- [x] 通道名称**搜索**：未匹配摄像头在画布上淡化（`opacity`）

### 阶段 C — 增强（P2+）

- [x] 通道在线/离线：由 `FindPlannerChannelOptions` 拉平的 `isOnline` 映射到已绑定 `channelId`（画布描边绿/红；侧栏与悬停卡片展示文案）
- [x] 触控/缩放：画布容器 **滚轮** 以指针为锚缩放；**双指 pinch** 以两指中点为锚缩放（与工具栏缩放共用 0.35–3.2 范围）
- [ ] 若需首页批量「最近事件」：再评估 owl 批量接口或受控轮询

## 5. 关键文件

| 文件 | 职责 |
|------|------|
| `app/pages/desktop/desktop.tsx` | 数据流 / 2D 切换、视图模式持久化 |
| `app/pages/desktop/floor_plan.tsx` | 2D 主编辑器 |
| `app/pages/desktop/floor_plan.storage.ts` | 平面图与浏览/编辑模式本地存储 |
| `app/pages/desktop/desktop-view-mode.ts` | 数据流 / 2D 视图记忆 |
| `app/pages/desktop/floor_plan.playback.ts` | 录像详情 URL 与列表页对齐 |
| `app/pages/desktop/floor_plan.events.ts` | 最近 AI 事件查询与缓存 |
| `app/components/desktop/camera-hover-card.tsx` | 悬停卡片 |
| `app/components/desktop/camera-binding-panel.tsx` | 绑定与参数、侧栏最近事件展示 |

## 6. 后端参考

事件、通道等与 [gowvp/owl](https://github.com/gowvp/owl) 对齐；前端通过现有 `FindEvents` / `FindPlannerChannelOptions` 等调用。

## 7. 验收清单（2D）

- [x] 刷新后仍保持上次「数据流 / 2D」选择
- [x] 浏览模式下无法误改平面图；编辑模式可完整编辑
- [x] 已绑定通道的摄像头可从平面图进入录像详情（当日日期）
- [x] 悬停卡片在边缘不被裁切；侧栏可看到与 hover 一致的最近事件信息（有通道时）
- [x] 滚轮 / 双指缩放可用；已绑定通道显示在线状态（列表能解析时）

---

*文档版本：与仓库 `desktop_2d_plan_todo.md` 同步更新。*
