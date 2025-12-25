# 国际化 (i18n) 使用指南

## 概述

本项目使用 `react-i18next` 实现多语言支持，目前支持中文(zh)和英文(en)。

## 技术栈

- **react-i18next**: React 国际化库
- **i18next**: 核心国际化框架
- **i18next-browser-languagedetector**: 自动检测浏览器语言

## 目录结构

```
app/i18n/
  ├── config.ts                 # i18n配置文件
  ├── locales/                  # 翻译资源目录
  │   ├── zh/                   # 中文翻译
  │   │   ├── common.json       # 通用翻译
  │   │   ├── dashboard.json    # 仪表盘翻译
  │   │   ├── device.json       # 设备管理翻译
  │   │   ├── channel.json      # 通道管理翻译
  │   │   └── stream.json       # 流管理翻译
  │   └── en/                   # 英文翻译
  │       ├── common.json
  │       ├── dashboard.json
  │       ├── device.json
  │       ├── channel.json
  │       └── stream.json
  └── README.md                 # 本文档
```

## 基本使用

### 1. 在组件中使用翻译

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  // 使用common命名空间（默认）
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('app_name')}</h1>
      <p>{t('welcome')}</p>
    </div>
  );
}
```

### 2. 使用多个命名空间

```tsx
import { useTranslation } from 'react-i18next';

function DevicePage() {
  // 使用device命名空间
  const { t } = useTranslation('device');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('device_name')}</p>
    </div>
  );
}
```

### 3. 使用多个命名空间的翻译

```tsx
import { useTranslation } from 'react-i18next';

function ComplexPage() {
  const { t } = useTranslation(['common', 'device']);

  return (
    <div>
      {/* 从common命名空间获取 */}
      <button>{t('common:save')}</button>

      {/* 从device命名空间获取 */}
      <h2>{t('device:title')}</h2>
    </div>
  );
}
```

### 4. 语言切换

项目已提供 `<LanguageSwitcher />` 组件，集成在顶部导航栏中。

```tsx
import { LanguageSwitcher } from '~/components/language-switcher';

// 已集成在 TopNavigation 组件中
```

## 添加新的翻译

### 1. 添加到现有命名空间

编辑对应的JSON文件，例如 `app/i18n/locales/zh/common.json`：

```json
{
  "existing_key": "现有翻译",
  "new_key": "新的翻译"  // 添加新的键值对
}
```

同时更新英文版本 `app/i18n/locales/en/common.json`：

```json
{
  "existing_key": "Existing Translation",
  "new_key": "New Translation"
}
```

### 2. 创建新的命名空间

1. 创建新的翻译文件：
   - `app/i18n/locales/zh/mynewspace.json`
   - `app/i18n/locales/en/mynewspace.json`

2. 在 `app/i18n/config.ts` 中导入：

```typescript
import mynewspaceZh from './locales/zh/mynewspace.json';
import mynewspaceEn from './locales/en/mynewspace.json';

const resources = {
  zh: {
    common: commonZh,
    mynewspace: mynewspaceZh, // 添加新命名空间
  },
  en: {
    common: commonEn,
    mynewspace: mynewspaceEn, // 添加新命名空间
  },
};
```

## 默认语言行为

系统会按以下顺序确定语言：

1. **用户之前选择的语言**（存储在localStorage中）
2. **浏览器语言**（如果浏览器语言是中文则使用zh，否则使用en）
3. **备用语言**（默认为en）

## 命名空间说明

- **common**: 通用文本（按钮、标签、状态等）
- **dashboard**: 仪表盘相关
- **device**: 设备管理相关
- **channel**: 通道管理相关
- **stream**: 流管理相关（RTMP/RTSP）

## 注意事项

1. **保持键值一致**：中英文JSON文件的键名必须保持一致
2. **使用有意义的键名**：使用描述性的键名，如 `device_name` 而不是 `text1`
3. **避免重复**：检查是否已存在类似的翻译键
4. **及时更新**：添加新功能时同时更新翻译文件
5. **测试两种语言**：确保中英文都能正常显示

## 未来扩展

如需添加更多语言：

1. 创建新的语言目录，如 `app/i18n/locales/ja/`（日语）
2. 复制所有JSON文件并翻译
3. 在 `config.ts` 中添加新语言的资源
4. 在 `LanguageSwitcher` 组件中添加切换选项

## 示例页面迁移

以下是将现有页面迁移到使用i18n的步骤：

### 迁移前
```tsx
function MyPage() {
  return <h1>设备管理</h1>;
}
```

### 迁移后
```tsx
import { useTranslation } from 'react-i18next';

function MyPage() {
  const { t } = useTranslation('device');
  return <h1>{t('title')}</h1>;
}
```

## 性能优化

- 翻译文件在应用启动时一次性加载
- 切换语言不会重新加载页面
- localStorage缓存用户语言选择
