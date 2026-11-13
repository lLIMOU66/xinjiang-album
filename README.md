# 旅行相册网站模板

把一个文件夹的照片和视频，变成一个能在手机上看、有拼贴布局、能点赞留言的旅行相册网站。

纯静态站（HTML + CSS + 原生 JS），部署在 Cloudflare Pages，视频走 Cloudinary + 自建反向代理。**不需要服务器、不需要数据库、不需要绑银行卡。**

在线演示：https://xinjiang-album.pages.dev

---

## 它长什么样

- 首页：行程目录、地图、时间轴、关于
- 相册页：按分类分段，照片和视频混排
- 手机端拼贴：大中小三种尺寸错落分布，不是规整的网格
- 视频：1080p，点开就能播，能拖进度条
- 底部：给作者点个赞、留给作者的话

照片和视频的规格都是为"手机上看得舒服"调的：照片长边 1600 的 WebP，视频 1080p / CRF 26。

---

## 动手之前：先备好这两样

| 要准备 | 什么时候需要 | 去哪拿 |
|---|---|---|
| 素材文件夹（文件名带日期） | 一开始就要 | 你自己的相册 |
| Cloudflare 账号（邮箱 + **Global API Key** + Account ID） | 最后部署时 | dash.cloudflare.com → 个人资料页**底部** |
| Cloudinary 账号（Cloud name / API Key / Secret） | 只有视频单段超 25MB 才需要 | cloudinary.com，免费、不绑卡 |

两个账号都免费、都不用绑银行卡，但**必须你本人注册**。
每一步在哪点、凭证长什么样、拿错会报什么错，全写在 [`docs/交接清单.md`](docs/交接清单.md)。

---

## 三步跑起来

### 1. 装依赖

```bash
pip install pillow
npm i -g wrangler
```

还需要 `ffmpeg`（Windows 建议装完确认 `ffmpeg -version` 能跑）。

### 2. 配置 + 生成

```bash
cp tools/site.config.example.json tools/site.config.json
# 编辑 site.config.json：填素材目录、ffmpeg 路径、行程信息、分类

python tools/build_site.py scan     # 先扫描，看清素材有哪些
python tools/build_site.py all      # 压图、转码、抽封面、生成 data.js
```

### 3. 本地看效果

```bash
python tools/serve.py
# 打开 http://localhost:8000
```

---

## 部署到 Cloudflare Pages

```bash
# 建 KV（点赞和留言要存数据，只需一次）
wrangler kv namespace create "ALBUM_KV"
# 把返回的 id 填进 wrangler.toml

# 部署
set CLOUDFLARE_EMAIL=你的邮箱
set CLOUDFLARE_API_KEY=你的GlobalAPIKey
set CLOUDFLARE_ACCOUNT_ID=你的AccountID
wrangler pages deploy . --project-name 你的项目名
```

部署完会给你一个 `xxx.pages.dev` 的地址。

---

## 目录结构

```
.
├── index.html / album.html     首页 + 相册页
├── style.css / theme.css       样式（含手机端拼贴布局）
├── album.js / home.js          前端逻辑
├── config.js                   CDN 地址配置（一般不用改）
├── data.js                     所有行程数据（由脚本生成）
├── functions/
│   ├── media/video/[[path]].js Cloudinary 视频代理（国内能看的关键）
│   └── api/like.js             点赞接口
│   └── api/messages.js         留言接口
├── tools/
│   ├── build_site.py           构建流水线（scan/photos/videos/posters/data/verify）
│   ├── upload_cloudinary.py    大视频上传
│   ├── serve.py                本地预览（支持视频拖动进度条）
│   └── site.config.example.json
├── docs/                       搭建指南（踩过的坑都在里面）
├── AGENTS.md                   给 AI 看的执行说明书
└── wrangler.toml               部署配置（KV id 和 Cloudinary 云名要自己填）
```

---

## 为什么视频要这么绕

三个方案都试过，都走不通：

| 方案 | 结果 |
|---|---|
| Cloudflare R2 | 要绑银行卡，不行 |
| data.js 直接写 `res.cloudinary.com` | 国内被拦，打开是红色风险页 |
| `xxx.workers.dev` 独立域名 | 国内打不开 |

最后能用的：视频传 Cloudinary，但用自己 `pages.dev` 域名的 Functions 代理出去。国内用户看到的是你的域名，不会被拦。

---

## 用 AI 来做

仓库里有一份 [`AGENTS.md`](AGENTS.md)，是专门写给 AI 看的：输入要求、十步执行顺序、每步的验收标准、五条已知死路。

用法：把这个仓库链接丢给豆包/Claude/Cursor，再说一句"素材在 D:\我的照片，帮我做成这个网站"，它会照着执行。

---

## 常见问题

**全站白屏？**
`data.js` 带 BOM 了。检查：`python -c "print(open('data.js','rb').read(3)==b'\xef\xbb\xbf')"`，必须打印 `False`。

**所有素材都 404？**
Functions 放错层级了，必须是 `functions/media/video/[[path]].js`。少一层目录，整个 `/media/` 都被代理走，本地文件也 404。

**视频糊？**
CRF 调太大。把 `videos.crf` 从 26 降到 23 或 20 重跑。

**视频一直转圈？**
不是网站的问题，是本地预览的服务器不支持 Range 请求。用 `tools/serve.py` 而不是 `python -m http.server`。

**PowerShell 操作 `[[path]].js` 没反应？**
方括号被当通配符了，所有路径参数加 `-LiteralPath`。

**点了赞没反应？**
`wrangler.toml` 里的 KV id 还没填，或者没跑 `wrangler kv namespace create`。

更多细节在 [`docs/旅行相册网站搭建指南.md`](docs/旅行相册网站搭建指南.md)。

---

## 说明

- `data.js` 里现在是演示数据，**3 张示例图以内联 base64 直接放在文件里**：不依赖任何线上站点，克隆下来断网打开也能看到完整效果。换成自己的素材后会被整份重写。
- `media/` 和 `assets/` 在 `.gitignore` 里：素材体积大，而且不该公开。仓库只放代码和这 3 张示例图。
- 点赞和留言的数据存在 Cloudflare KV，一个浏览器只能点一次赞，留言最多保留 200 条。

## License

MIT
