# AGENTS.md —— 给 AI 助手的执行说明书

> 这份文件是写给 AI 读的。如果你是人类读者，请直接看 [README.md](README.md)。
>
> 用户会把「这个仓库 + 一个装着照片视频的文件夹」交给你，让你做出一个和演示站一样的旅行相册网站。
> 按下面的顺序执行，不要跳步，不要自己改顺序。

---

## 你需要先问用户拿到的四样东西

缺任何一样都会中途卡住，动手前先确认齐。

| 项 | 说明 | 去哪拿 |
|---|---|---|
| 1. 素材目录 | 照片和视频所在的本地绝对路径 | 用户直接给 |
| 2. 一趟旅行的基本信息 | 名称、时间、地点、分类名（如"盐湖""鸣沙山"） | 用户说，或从文件夹名猜完让他确认 |
| 3. Cloudinary 账号 | Cloud Name / API Key / API Secret | cloudinary.com 免费注册，不用绑卡 |
| 4. Cloudflare 账号 | 邮箱 + Global API Key + Account ID | dash.cloudflare.com → 我的个人资料 → API 令牌 |

如果用户的视频总量不大（单段都小于 25MB），Cloudinary 可以不用，跳过第 5 步和上传脚本。

---

## 执行顺序（严格按这个来）

### 第 0 步：准备环境

```bash
python -m pip install pillow
ffmpeg -version          # 必须能跑，没有就装
wrangler --version       # 没有就 npm i -g wrangler
```

Windows 上如果 `ffmpeg` 不在 PATH，去 `tools/site.config.json` 里把 `ffmpeg` 字段填成绝对路径。

**验收**：`ffmpeg -version` 和 `wrangler --version` 都返回版本号。

---

### 第 1 步：配置

复制 `tools/site.config.example.json` → `tools/site.config.json`，填：

- `source_dir`：素材目录的绝对路径，用正斜杠 `/`
- `ffmpeg`：ffmpeg 的绝对路径（在 PATH 里就写 `ffmpeg`）
- `trip_*`：行程信息
- `categories`：分类。`match` 填关键词，会去匹配文件名和所在文件夹名

**验收**：`tools/site.config.json` 是合法 JSON（用 `python -c "import json;json.load(open(...))"` 验一下）。

---

### 第 2 步：扫描

```bash
python tools/build_site.py scan
```

产出 `tools/out/inventory.json`，列出每张照片、每段视频的路径和解析出的日期。

**这一步不能跳过，也不能只看输出就往下走。**

**验收**：输出里没有「读不出日期」的警告。如果有，说明文件名里没有日期——让用户按 `20260413` 这种格式改名，或者接受它们全部归到 `default_category`。

---

### 第 3 步：分类（最容易翻车的一步）

打开 `tools/out/inventory.json`，按日期分组，**逐组看照片**再做分类。

绝对不要只靠文件夹名或拍摄时间自动归类。真实情况永远是：同一天里混着湖、公路、饭、合影。当时这个项目就是靠逐张看联系表才分对的。

看完把结果写进 `site.config.json` 的 `classify`：

```json
"classify": {
  "2026-04-13": { "1": "road", "2": "salt", "3": "salt", "4": "road" }
}
```

序号是该日期内按文件名排序后的第几张（照片和视频各自独立计数）。

**验收**：每个日期下的序号都被覆盖，没有遗漏。分类数量不超过 9 个（手机端一屏放不下那么多）。

> 小技巧：给每组照片做一个缩略图拼版（contact sheet）再判断，比逐张点开快得多，也更不容易看错。

---

### 第 4 步：压照片

```bash
python tools/build_site.py photos
```

输出到 `assets/`，命名 `p-YYYYMMDD-NNN.webp`，长边限到 1600，质量 82。

**验收**：`assets/` 里的数量和 `inventory.json` 里的照片数一致（或接近，允许少量失败）。随便打开两张确认不是黑图、不是糊的。

---

### 第 5 步：转视频

```bash
python tools/build_site.py videos
```

输出到 `media/`，命名 `v-YYYYMMDD-NNN.mp4`，1080p、H.264、CRF 26。

**验收**：
- 没有 `失败` 行
- 没有 `【码率偏低】` 警告（低于 1500 kbps 的画质用户会觉得糊）
- 记下所有 `【超过 60 MB】` 的文件，它们后面要走 Cloudinary

**如果出现码率偏低**：把 `videos.crf` 从 26 降到 23 再重跑。CRF 越小越清晰、体积越大。

---

### 第 6 步：抽封面帧

```bash
python tools/build_site.py posters
```

每段视频输出一张同名 `.webp`，取第 1 秒的帧。

**验收**：`media/` 里 `.webp` 数量和 `.mp4` 数量一致。抽帧失败的一般是时长不足 1 秒的短视频，脚本会自动退回第 0 秒。

---

### 第 7 步：上传大视频（有超过 25MB 的才做）

```bash
set CLOUDINARY_CLOUD_NAME=你的云名
set CLOUDINARY_API_KEY=你的Key
set CLOUDINARY_API_SECRET=你的Secret

python tools/upload_cloudinary.py --media media --max-mb 25
```

产出 `tools/out/cloudinary_map.json`，把本地文件名映射成 `/media/video/upload/xxx.mp4` 这种代理路径。

**验收**：映射文件里涵盖了所有超限视频，且没有任何一个直接写 `res.cloudinary.com`。

---

### 第 8 步：生成 data.js

```bash
python tools/build_site.py data
```

**验收**：输出里的照片数、视频数和你预期的对得上。`data.js` 必须是 **UTF-8 无 BOM**——脚本保证了，但如果你手改过就要重新确认：

```bash
python -c "print(open('data.js','rb').read(3) == b'\xef\xbb\xbf')"   # 必须打印 False
```

---

### 第 9 步：本地预览

```bash
python tools/serve.py
```

打开 `http://localhost:8000`。

**验收**：首页能进、分类能点开、照片能滑、视频能播（能拖动进度条才算真的能播）。

---

### 第 10 步：部署

先建 KV（点赞和留言要用，只需建一次）：

```bash
wrangler kv namespace create "ALBUM_KV"
```

把输出的 id 填进 `wrangler.toml` 的 `id`，同时把 `[vars]` 里的 `CLOUDINARY_CLOUD` 改成自己的云名。

然后：

```bash
set CLOUDFLARE_EMAIL=你的邮箱
set CLOUDFLARE_API_KEY=你的GlobalAPIKey
set CLOUDFLARE_ACCOUNT_ID=你的AccountID

wrangler pages deploy . --project-name 你的项目名
```

**验收**：
- 拿到一个 `xxx.pages.dev` 地址
- 手机能打开，照片显示、视频能播
- 底部点赞按钮点一下数字会变，留言板能发出一条

---

## 已知死路，不要尝试

这些是当时一条条撞出来的，别让用户再撞一次。

| 方案 | 结果 | 原因 |
|---|---|---|
| Cloudflare R2 存视频 | 不可行 | 必须绑银行卡 |
| data.js 里直接写 `res.cloudinary.com` 链接 | 国内打不开 | 被安全软件拦成"网页存在安全风险"的红页 |
| 用 `xxx.workers.dev` 独立域名 | 国内打不开 | 域名被阻断 |
| Functions 代理整个 `/media/` | 全站素材 404 | 把本地静态文件也转发走了 |
| 视频丢 Pages 直接传 | 传不上去 | 单文件硬限制 25 MB |
| 照片不压缩直接传 | 仓库爆炸、加载极慢 | 原图动辄几 MB 一张 |

---

## 最容易出错的五个点

1. **Functions 路径必须是 `functions/media/video/[[path]].js`**
   少一层目录，整站媒体都会走代理。

2. **data.js 带 BOM 会全站白屏**
   用脚本生成就没问题，手改之后务必检查。

3. **PowerShell 操作 `[[path]].js` 必须用 `-LiteralPath`**
   方括号会被当通配符，命令静默失败，看起来"什么都没发生"。

4. **CRF 别贪大**
   超过 30 明显糊，当时用 26 是清晰和体积的平衡点。用户对画质敏感，宁可文件大一点。

5. **分类不要自动**
   见第 3 步。这一条违反一次，用户就要重做一遍。

---

## 交付前自查清单

- [ ] `python tools/build_site.py verify` 通过，0 个缺失引用
- [ ] `data.js` 无 BOM
- [ ] `wrangler.toml` 里 KV id 和 Cloudinary 云名都是用户自己的
- [ ] 线上地址在手机 4G 下能正常打开（不要在 WiFi 下测完就交付）
- [ ] 点赞、留言两条功能各测一次
- [ ] 告诉用户：以后加素材只要重跑 `photos → videos → posters → data → deploy`
