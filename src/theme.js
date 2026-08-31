// 深浅色主题：监听系统切换，场景颜色每帧向目标插值实现平滑过渡
// UI 侧的 CSS 变量同步也在这里完成

const DARK = {
  uiText: '#eaf6ff',
  uiTextSoft: 'rgba(234, 246, 255, 0.68)',
  uiGlow: 'rgba(160, 220, 255, 0.35)',
  bodyBg: '#0a1526',
};

const LIGHT = {
  uiText: '#10314f',
  uiTextSoft: 'rgba(16, 49, 79, 0.72)',
  uiGlow: 'rgba(255, 255, 255, 0.55)',
  bodyBg: '#cfe9f8',
};

const listeners = new Set();
let dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyUi(isDark) {
  const t = isDark ? DARK : LIGHT;
  const root = document.documentElement;
  root.style.setProperty('--ui-text', t.uiText);
  root.style.setProperty('--ui-text-soft', t.uiTextSoft);
  root.style.setProperty('--ui-glow', t.uiGlow);
  document.body.style.background = t.bodyBg;
}

applyUi(dark);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  dark = e.matches;
  applyUi(dark);
  listeners.forEach((fn) => fn(dark));
});

export function isDark() {
  return dark;
}

export function onThemeChange(fn) {
  listeners.add(fn);
}
