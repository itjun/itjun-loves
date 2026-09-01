# itjun-loves · 我们的爱

结婚纪念日网站，传统中国风卷轴版式：宣纸底色、朱红鎏金、全屏卷页滚动。

- 结婚日期：2020-01-13（庚子年）
- 线上地址：https://itjun.github.io/itjun-loves/

## 本地开发

```bash
npm install
npm run dev
```

## 自定义

编辑 [src/config.js](src/config.js)：

- `WEDDING_DATE`：结婚日期
- `LOVE_WORDS`：卷首情话
- `NAME_TEXT`：情书印章文字
- `LETTER`：情书正文与署名
- `TIMELINE`：时光印记
- `LOVE_NOTES`：情话短句

改完后 push 到 `main`，GitHub Actions 会自动部署。
