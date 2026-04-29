import { useEffect } from "react";
import { getContrastColor } from "../utils";
import { AppSettings } from "../types";

/**
 * 테마 설정이 변경될 때마다 CSS 변수와 root 스타일을 동기화하는 훅.
 * AppContext의 관심사를 분리하기 위해 별도 훅으로 추출되었다.
 *
 * @param theme - AppSettings.theme 객체
 */
export const useThemeApplier = (theme: AppSettings["theme"]) => {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--point-color", theme.pointColor);
    root.style.setProperty("--point-foreground", getContrastColor(theme.pointColor));

    if (theme.isDarkMode) {
      root.classList.add("dark");
      root.style.backgroundColor = "#000000";
      root.style.color = "#ffffff";
      root.style.setProperty("--bg-deep", "#000000");
      root.style.setProperty("--bg-base", "#09090b");
      root.style.setProperty("--bg-surface", "#18181b");
      root.style.setProperty("--border-main", "#27272a");
      root.style.setProperty("--border-hover", "#3f3f46");
      root.style.setProperty("--text-strong", "#ffffff");
      root.style.setProperty("--text-main", "#d4d4d8");
      root.style.setProperty("--text-dim", "#a1a1aa");
      root.style.setProperty("--text-muted", "#71717a");
      root.style.setProperty("--text-sub", "#52525b");
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#fafafa";
      root.style.color = "#09090b";
      root.style.setProperty("--bg-deep", "#e4e4e7");
      root.style.setProperty("--bg-base", "#fafafa");
      root.style.setProperty("--bg-surface", "#ffffff");
      root.style.setProperty("--border-main", "#d4d4d8");
      root.style.setProperty("--border-hover", "#a1a1aa");
      root.style.setProperty("--text-strong", "#09090b");
      root.style.setProperty("--text-main", "#18181b");
      root.style.setProperty("--text-dim", "#3f3f46");
      root.style.setProperty("--text-muted", "#52525b");
      root.style.setProperty("--text-sub", "#71717a");
    }

    const baseScale = theme.uiScale || 1.0;
    root.style.fontSize = `${16 * baseScale}px`;
    const textScale = theme.textScale || 1.0;

    let styleTag = document.getElementById("dynamic-text-scaler");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "dynamic-text-scaler";
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      .text-xs { font-size: calc(0.75rem * ${textScale}) !important; line-height: calc(1rem * ${textScale}) !important; }
      .text-sm { font-size: calc(0.875rem * ${textScale}) !important; line-height: calc(1.25rem * ${textScale}) !important; }
      .text-base { font-size: calc(1rem * ${textScale}) !important; line-height: calc(1.5rem * ${textScale}) !important; }
      .text-lg { font-size: calc(1.125rem * ${textScale}) !important; line-height: calc(1.75rem * ${textScale}) !important; }
      .text-xl { font-size: calc(1.25rem * ${textScale}) !important; line-height: calc(1.75rem * ${textScale}) !important; }
      .text-[10px] { font-size: calc(10px * ${textScale}) !important; }
    `;
  }, [theme]);
};
