# itjun-loves · 我们的爱

结婚纪念日网站：暖色花瓣飘落、相爱天数计时、时光印记与情书。

- 结婚日期：2020-01-13
- 线上地址：https://itjun.github.io/itjun-loves/

## 本地开发

```bash
npm install
npm run dev
```

## 自定义

编辑 [src/config.js](src/config.js)：

- `WEDDING_DATE`：结婚日期
- `LOVE_WORDS`：顶部情话
- `NAME_TEXT`：情书落款前的名字
- `LETTER`：情书正文与签名
- `TIMELINE`：时光印记时间线
- `LOVE_NOTES`：想对你说的短句

改完后 push 到 `main`，GitHub Actions 会自动部署。
