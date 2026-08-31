# itjun-loves · 我们的海边

结婚纪念日表白网站：Three.js 深夜蓝海边场景（月光海面、上浮气泡、星空、漂浮心形），实时结婚计时器，支持系统深浅色自动切换。

- 结婚日期：2020-01-13
- 线上地址：https://itjun.github.io/itjun-loves/

## 本地开发

```bash
npm install
npm run dev
```

构建与预览：

```bash
npm run build
npm run preview
```

## 自定义

所有可改内容集中在 [src/config.js](src/config.js)：

- `WEDDING_DATE`：结婚日期
- `LOVE_WORDS`：页面上那句情话
- `SINCE_TEXT`：日期标识文案

改完 push 到 `main`，GitHub Actions 会自动构建并部署到 Pages。

## 部署

仓库 push 到 `main` 分支后，[.github/workflows/deploy.yml](.github/workflows/deploy.yml) 自动执行构建并发布到 GitHub Pages（需在仓库 Settings → Pages 中将 Source 设为 GitHub Actions）。
