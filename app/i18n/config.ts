import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import channelEn from "./locales/en/channel.json";
import commonEn from "./locales/en/common.json";
import dashboardEn from "./locales/en/dashboard.json";
import desktopEn from "./locales/en/desktop.json";
import deviceEn from "./locales/en/device.json";
import loginEn from "./locales/en/login.json";
import streamEn from "./locales/en/stream.json";
import channelZh from "./locales/zh/channel.json";
// 导入翻译资源
import commonZh from "./locales/zh/common.json";
import dashboardZh from "./locales/zh/dashboard.json";
import desktopZh from "./locales/zh/desktop.json";
import deviceZh from "./locales/zh/device.json";
import loginZh from "./locales/zh/login.json";
import streamZh from "./locales/zh/stream.json";

// 配置翻译资源
const resources = {
  zh: {
    common: commonZh,
    dashboard: dashboardZh,
    device: deviceZh,
    channel: channelZh,
    stream: streamZh,
    desktop: desktopZh,
    login: loginZh,
  },
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    device: deviceEn,
    channel: channelEn,
    stream: streamEn,
    desktop: desktopEn,
    login: loginEn,
  },
};

// 初始化 i18next
i18n
  .use(LanguageDetector) // 自动检测用户语言
  .use(initReactI18next) // 绑定 React
  .init({
    resources,
    fallbackLng: "en", // 备用语言
    defaultNS: "common", // 默认命名空间
    lng: undefined, // 让 LanguageDetector 自动检测
    interpolation: {
      escapeValue: false, // React 已经防止 XSS
    },
    detection: {
      // 语言检测选项
      order: ["localStorage", "navigator"], // 优先从localStorage读取，其次是浏览器语言
      caches: ["localStorage"], // 缓存用户选择的语言
      lookupLocalStorage: "i18nextLng", // localStorage的key
    },
    react: {
      useSuspense: false, // 禁用 Suspense，避免 SSR 问题
    },
  });

export default i18n;
