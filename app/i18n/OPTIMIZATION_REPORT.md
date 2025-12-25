# 国际化配置优化报告

## 优化目标
- 消除所有翻译文件中的重复项
- 将通用翻译键统一放到 `common.json`
- 确保每个翻译键只出现一次

## 已完成的优化

### 1. 修复 `common.json` 内部重复项

**删除的重复项：**
- ❌ `channel_list` (第57行) - 与第97行重复 → **保留一个**
- ❌ `password` (第16行) - 与第94行重复 → **保留一个**
- ❌ `app_name` (第2行) - 与第80行重复 → **保留一个**

**优化后：**
- ✅ 从 100 行减少到 96 行
- ✅ 所有键现在都是唯一的

### 2. 移除其他文件中与 `common.json` 重复的键

#### `channel.json`
**删除的重复项：**
- ❌ `play` - 已存在于 `common.json`
- ❌ `channel_list` - 已存在于 `common.json`
- ❌ `stream_url` - 已移至 `common.json`

**保留的专属键：**
- ✅ `title` (通道管理)
- ✅ `channel_name`, `channel_id`, `parent_id`
- ✅ `live`, `stop`, `record`, `snapshot`
- ✅ `ptz_control`, `channel_detail`, `video_stream`
- ✅ `codec`, `resolution`, `frame_rate`, `bitrate`

#### `device.json`
**删除的重复项：**
- ❌ `channel_list` - 已存在于 `common.json`

**保留的专属键：**
- ✅ `title` (设备管理)
- ✅ `device_list`, `device_name`, `device_id`, `device_type`
- ✅ `model`, `firmware_version`, `ip_address`, `port`
- ✅ `add_device`, `edit_device`, `delete_device`
- ✅ `device_config`, `channel_sync`, `device_info`

#### `stream.json`
**删除的重复项：**
- ❌ `stream_url` - 已移至 `common.json`

**保留的专属键：**
- ✅ `rtmp_title`, `rtsp_title`, `stream_list`
- ✅ `stream_name`, `stream_id`, `app`, `stream`, `vhost`
- ✅ `push_url`, `pull_url`, `source_url`, `target_url`
- ✅ `start_time`, `duration`
- ✅ `add_stream`, `edit_stream`, `delete_stream`
- ✅ `start_proxy`, `stop_proxy`

#### `dashboard.json`
**删除的重复项：**
- ❌ `channel_count` - 已存在于 `common.json`

**保留的专属键：**
- ✅ `title` (仪表盘)
- ✅ `system_overview`, `cpu_usage`, `memory_usage`, `disk_usage`
- ✅ `network_traffic`, `device_count`
- ✅ `online_devices`, `offline_devices`
- ✅ `total_bandwidth`, `load_average`

### 3. 新增国际化页面

✅ **配置页面** (`app/pages/device/config/config.tsx`)
- 国标 ID、国标域、端口号、密码、保存配置等

## 翻译键组织原则

### `common.json` - 通用翻译键
包含：
- 🔹 基础操作：搜索、添加、编辑、删除、保存、取消等
- 🔹 通用状态：在线、离线、成功、失败、加载中等
- 🔹 系统导航：快捷桌面、国标通道、推流列表、拉流代理
- 🔹 通用字段：名称、状态、操作、设备ID、流ID等
- 🔹 全局使用的业务术语：播放、通道列表、流地址等

### 专属 JSON 文件 - 特定功能翻译键
- `channel.json` - 通道特有：云台控制、编码格式、分辨率、帧率等
- `device.json` - 设备特有：设备列表、固件版本、IP地址、通道同步等
- `stream.json` - 流特有：推流地址、拉流地址、源地址、虚拟主机等
- `dashboard.json` - 仪表盘特有：CPU使用率、内存使用率、系统负载等
- `desktop.json` - 桌面特有：RTMP推流、RTSP拉流、国标信令等
- `login.json` - 登录特有：忘记密码提示、确认等

## 使用建议

### 1. 添加新翻译时的判断标准

**放入 `common.json` 的情况：**
- ✅ 多个页面/组件都会用到
- ✅ 通用的操作按钮（如：播放、编辑、删除）
- ✅ 通用的状态描述（如：在线、离线、成功）
- ✅ 通用的业务术语（如：设备、通道、流）

**放入专属文件的情况：**
- ✅ 仅在特定功能模块使用
- ✅ 具有特定领域含义的专业术语
- ✅ 某个页面特有的标题或描述

### 2. 引用方式

```typescript
// 引用 common.json
const { t } = useTranslation('common');
t('play')  // 播放

// 引用专属文件
const { t } = useTranslation('channel');
t('ptz_control')  // 云台控制

// 同时引用多个命名空间
const { t } = useTranslation(['common', 'channel']);
t('common:play')     // 播放
t('channel:codec')   // 编码格式
```

## 优化效果

### 减少重复
- ✅ `common.json`: 从 100 行 → 96 行（删除 4 个重复项）
- ✅ `channel.json`: 从 20 行 → 17 行（删除 3 个重复项）
- ✅ `device.json`: 从 21 行 → 20 行（删除 1 个重复项）
- ✅ `stream.json`: 从 22 行 → 21 行（删除 1 个重复项）
- ✅ `dashboard.json`: 从 14 行 → 13 行（删除 1 个重复项）

### 总体优化
- 📊 **总翻译键数量减少**: 10 个重复项被消除
- 🎯 **配置更清晰**: 每个键只出现一次，避免维护时遗漏
- 🚀 **易于扩展**: 新增翻译时有明确的归类标准

## 下一步建议

1. ✅ **已完成国际化的页面**：
   - 配置页面（国标配置）
   - 设备管理页面
   - 通道列表页面
   - RTMP推流页面
   - RTSP拉流页面
   - 桌面页面
   - 导航栏和登录页面

2. 🔄 **未来可优化的方向**：
   - 考虑将所有 `title` 键统一到 `common.json`（如果多个页面都有 title）
   - 监控新增的翻译键，及时发现并合并重复项
   - 定期审查翻译文件，确保组织结构清晰

## 维护规范

### 添加新翻译时的检查清单
- [ ] 检查 `common.json` 中是否已存在相同或相似的键
- [ ] 确认是通用键还是专属键
- [ ] 如果是通用键，放入 `common.json`
- [ ] 如果是专属键，放入对应的功能文件
- [ ] 同时更新中文和英文两个版本
- [ ] 确保键名语义明确，避免歧义

---

**优化完成时间**: 2025-11-19
**优化工具**: AI 辅助分析和自动化重构
**影响范围**: 全部国际化配置文件
