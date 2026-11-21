# -*- coding: utf-8 -*-
"""
旅行相册站点构建流水线（通用版）

把一个素材文件夹变成可部署的相册站点：扫描 -> 分类 -> 压照片 -> 转视频 -> 抽封面 -> 生成 data.js

用法：
    python tools/build_site.py scan      # 扫描素材，输出清单（必须先人工/AI 看一遍）
    python tools/build_site.py photos    # 照片压缩成 webp
    python tools/build_site.py videos    # 视频转码到 1080p
    python tools/build_site.py posters   # 从视频抽封面帧
    python tools/build_site.py data      # 生成 data.js
    python tools/build_site.py verify    # 校验所有引用文件存在、码率达标
    python tools/build_site.py all       # 依次跑 photos/videos/posters/data/verify

配置文件：tools/site.config.json（从 site.config.example.json 复制后改）
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

# ----------------------------------------------------------------------------
# 基础工具
# ----------------------------------------------------------------------------

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv"}

DATE_RE = re.compile(r"(20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|1[0-9]|2[0-9]|3[01])")


def load_config(path):
    if not os.path.exists(path):
        sys.exit("找不到配置文件：%s\n请先复制 tools/site.config.example.json 为 tools/site.config.json 再修改。" % path)
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    required = ["source_dir", "site_dir", "categories"]
    for k in required:
        if k not in cfg:
            sys.exit("配置缺少字段：%s" % k)

    cfg.setdefault("ffmpeg", "ffmpeg")
    cfg.setdefault("work_dir", os.path.join("tools", "out"))

    cfg.setdefault("photos", {})
    cfg["photos"].setdefault("max_width", 1600)
    cfg["photos"].setdefault("quality", 82)

    cfg.setdefault("videos", {})
    cfg["videos"].setdefault("height", 1080)
    cfg["videos"].setdefault("crf", 26)
    cfg["videos"].setdefault("preset", "medium")
    # Cloudflare Pages 单文件硬上限 25 MiB，留 1 MiB 余量：超过就必须走 Cloudinary。
    # 不要把它设成 60/100——那是 Cloudinary 的上限，不是 Pages 的。
    cfg["videos"].setdefault("max_mb", 24)

    cfg.setdefault("poster", {})
    cfg["poster"].setdefault("width", 960)
    cfg["poster"].setdefault("quality", 80)
    cfg["poster"].setdefault("at_second", 1)

    return cfg


def ensure_dir(p):
    if not os.path.isdir(p):
        os.makedirs(p)


def date_of(name):
    m = DATE_RE.search(name)
    if not m:
        return None
    return "%s-%s-%s" % (m.group(1), m.group(2), m.group(3))


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def probe_duration(ffmpeg, path):
    """用 ffmpeg -i 读时长；没有 ffprobe 时这是最可靠的办法。"""
    r = run([ffmpeg, "-hide_banner", "-i", path])
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr or "")
    if not m:
        return 0.0
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


# ----------------------------------------------------------------------------
# scan：扫描素材 + 出联系表
# ----------------------------------------------------------------------------

def stage_scan(cfg):
    src = cfg["source_dir"]
    if not os.path.isdir(src):
        sys.exit("素材目录不存在：%s" % src)

    files = []
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames.sort()
        for fn in sorted(filenames):
            ext = os.path.splitext(fn)[1].lower()
            if ext in PHOTO_EXT:
                files.append({"path": os.path.join(dirpath, fn), "kind": "photo", "date": date_of(fn)})
            elif ext in VIDEO_EXT:
                files.append({"path": os.path.join(dirpath, fn), "kind": "video", "date": date_of(fn)})

    missing_date = [f for f in files if not f["date"]]
    photos = [f for f in files if f["kind"] == "photo"]
    videos = [f for f in files if f["kind"] == "video"]

    out_dir = cfg["work_dir"]
    ensure_dir(out_dir)
    inv_path = os.path.join(out_dir, "inventory.json")
    with open(inv_path, "w", encoding="utf-8") as f:
        json.dump({"files": files}, f, ensure_ascii=False, indent=1)

    print("扫描完成：照片 %d 张，视频 %d 段，共 %d 个文件" % (len(photos), len(videos), len(files)))
    print("清单已写入 %s" % inv_path)
    if missing_date:
        print("")
        print("【警告】%d 个文件名里读不出日期，它们会被归到 default_category：" % len(missing_date))
        for f in missing_date[:10]:
            print("  " + os.path.basename(f["path"]))
    print("")
    print("下一步：打开清单，确认分类归属，把结果写进 tools/site.config.json 的 classify 字段。")
    print("不要跳过这一步——按文件名或拍摄时间自动分类一定会错，必须看一遍图。")


# ----------------------------------------------------------------------------
# 分类
# ----------------------------------------------------------------------------

def classify(cfg):
    """返回 {(date, seq): category_id}。

    优先读 cfg['classify']（人工确认过的映射），
    其次按 cfg['categories'][*]['match'] 里的关键词匹配文件所在目录名，
    最后落到 cfg['default_category']。
    """
    mapping = {}

    for date, nums in (cfg.get("classify") or {}).items():
        for num, cat in nums.items():
            mapping[(date, int(num))] = cat

    keyword_rules = []
    for cat in cfg["categories"]:
        for kw in cat.get("match", []):
            keyword_rules.append((kw, cat["id"]))

    default_cat = cfg.get("default_category") or cfg["categories"][0]["id"]
    return mapping, keyword_rules, default_cat


def resolve_category(cfg, date, seq, folder_name, mapping, keyword_rules, default_cat):
    if date and (date, seq) in mapping:
        return mapping[(date, seq)]
    for kw, cat in keyword_rules:
        if kw in folder_name:
            return cat
    return default_cat


# ----------------------------------------------------------------------------
# 照片：压缩成 webp
# ----------------------------------------------------------------------------

def stage_photos(cfg):
    try:
        from PIL import Image
    except ImportError:
        sys.exit("需要 Pillow：pip install pillow")

    from PIL import ImageOps

    inv = load_inventory(cfg)
    assets_dir = os.path.join(cfg["site_dir"], "assets")
    ensure_dir(assets_dir)

    max_w = cfg["photos"]["max_width"]
    quality = cfg["photos"]["quality"]
    counters = {}
    done, skipped, failed = 0, 0, []

    for item in inv["files"]:
        if item["kind"] != "photo":
            continue
        date = item["date"] or "unknown"
        counters[date] = counters.get(date, 0) + 1
        out_name = "p-%s-%03d.webp" % (date.replace("-", ""), counters[date])
        out_path = os.path.join(assets_dir, out_name)

        if os.path.exists(out_path) and os.path.getsize(out_path) > 5000:
            skipped += 1
            continue

        try:
            im = Image.open(item["path"])
            im = ImageOps.exif_transpose(im).convert("RGB")
            w, h = im.size
            if w > max_w:
                im = im.resize((max_w, int(round(h * max_w / w))), Image.LANCZOS)
            im.save(out_path, "WEBP", quality=quality, method=6)
            done += 1
            if done % 20 == 0:
                print("  已压缩 %d 张..." % done, flush=True)
        except Exception as e:
            failed.append((item["path"], str(e)))

    print("照片：新压缩 %d 张，跳过 %d 张，失败 %d 张" % (done, skipped, len(failed)))
    for p, err in failed[:10]:
        print("  失败：%s -> %s" % (os.path.basename(p), err))


# ----------------------------------------------------------------------------
# 视频：转码到 1080p
# ----------------------------------------------------------------------------

def stage_videos(cfg):
    inv = load_inventory(cfg)
    media_dir = os.path.join(cfg["site_dir"], "media")
    ensure_dir(media_dir)

    ff = cfg["ffmpeg"]
    height = cfg["videos"]["height"]
    crf = cfg["videos"]["crf"]
    preset = cfg["videos"]["preset"]
    max_mb = cfg["videos"]["max_mb"]

    counters = {}
    done, skipped, failed, oversize, toobig = 0, 0, [], [], []

    for item in inv["files"]:
        if item["kind"] != "video":
            continue
        date = item["date"] or "unknown"
        counters[date] = counters.get(date, 0) + 1
        out_name = "v-%s-%03d.mp4" % (date.replace("-", ""), counters[date])
        out_path = os.path.join(media_dir, out_name)

        if os.path.exists(out_path) and os.path.getsize(out_path) > 100000:
            skipped += 1
            continue

        # 长边限制到 height，另一边按比例算（-2 保证是偶数，H.264 要求）
        vf = "scale='if(gt(a,1),%d,-2)':'if(gt(a,1),-2,%d)'" % (height, height)

        cmd = [ff, "-y", "-i", item["path"],
               "-vf", vf,
               "-c:v", "libx264", "-crf", str(crf), "-preset", preset,
               "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "128k",
               "-movflags", "+faststart",
               "-loglevel", "error",
               out_path]

        r = run(cmd)
        # 判定成功看 ffmpeg 返回码 + 文件非空。不要用固定体积阈值——
        # 短片段、低码率、静态画面的视频可能只有几 KB，用体积阈值会误报成"失败"。
        if r.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            size_mb = os.path.getsize(out_path) / 1024 / 1024
            dur = probe_duration(ff, out_path)
            kbps = os.path.getsize(out_path) * 8 / 1000 / max(dur, 0.1)
            done += 1
            # 静态风景、夜景这类低动态画面，码率天然就低，800 kbps 以下才需要人工复核
            if kbps < 800:
                print("  【码率偏低】%s %.0f kbps，建议看一遍成片确认不糊" % (out_name, kbps), flush=True)
            if size_mb > max_mb:
                oversize.append((out_name, size_mb))
            # Cloudinary 免费版单视频上限 100 MB：超过这条线两边都放不下，只能切段
            if size_mb > 100:
                toobig.append((out_name, size_mb))
        else:
            failed.append((item["path"], ("rc=%s " % r.returncode) + (r.stderr or "")[-300:]))

    print("视频：新转码 %d 段，跳过 %d 段，失败 %d 段" % (done, skipped, len(failed)))
    for p, err in failed[:10]:
        print("  失败：%s -> %s" % (os.path.basename(p), err))
    if oversize:
        print("")
        print("【超过 %d MB 的视频】Cloudflare Pages 单文件上限 25 MiB，这些放不进 Pages，" % max_mb)
        print("必须走 Cloudinary 上传（免费版单视频上限 100 MB）：")
        for name, mb in oversize:
            print("  %s  %.1f MB" % (name, mb))
    if toobig:
        print("")
        print("【超过 100 MB 的视频】Cloudinary 免费版也放不下，必须处理后再上传：")
        for name, mb in toobig:
            print("  %s  %.1f MB" % (name, mb))
        print("处理办法：按镜头切段，或把 height 降到 720、crf 提到 30 重压。")


# ----------------------------------------------------------------------------
# 封面帧
# ----------------------------------------------------------------------------

def stage_posters(cfg):
    try:
        from PIL import Image
    except ImportError:
        sys.exit("需要 Pillow：pip install pillow")

    import glob

    media_dir = os.path.join(cfg["site_dir"], "media")
    ff = cfg["ffmpeg"]
    width = cfg["poster"]["width"]
    quality = cfg["poster"]["quality"]
    at_sec = cfg["poster"]["at_second"]

    n = 0
    for mp4 in sorted(glob.glob(os.path.join(media_dir, "*.mp4"))):
        base = mp4[:-4]
        poster = base + ".webp"
        if os.path.exists(poster) and os.path.getsize(poster) > 3000:
            continue

        jpg = base + ".tmp.jpg"
        run([ff, "-y", "-ss", str(at_sec), "-i", mp4, "-frames:v", "1", "-q:v", "3", "-loglevel", "error", jpg])
        if not os.path.exists(jpg):
            # 视频比 at_second 还短：退回第 0 秒
            run([ff, "-y", "-ss", "0", "-i", mp4, "-frames:v", "1", "-q:v", "3", "-loglevel", "error", jpg])
        if not os.path.exists(jpg):
            print("  抽帧失败：%s" % os.path.basename(mp4))
            continue

        im = Image.open(jpg).convert("RGB")
        w, h = im.size
        if w > width:
            im = im.resize((width, int(round(h * width / w))), Image.LANCZOS)
        im.save(poster, "WEBP", quality=quality, method=6)
        os.remove(jpg)
        n += 1

    print("封面帧：新生成 %d 张" % n)


# ----------------------------------------------------------------------------
# 生成 data.js
# ----------------------------------------------------------------------------

def load_inventory(cfg):
    p = os.path.join(cfg["work_dir"], "inventory.json")
    if not os.path.exists(p):
        sys.exit("先跑 scan：找不到 %s" % p)
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def stage_data(cfg):
    inv = load_inventory(cfg)
    mapping, keyword_rules, default_cat = classify(cfg)

    # 大视频走了 Cloudinary 的话，这里能查到映射：本地文件名 -> 代理路径
    cloud_map = {}
    cm_path = os.path.join(cfg["work_dir"], "cloudinary_map.json")
    if os.path.exists(cm_path):
        with open(cm_path, "r", encoding="utf-8") as f:
            cloud_map = json.load(f)

    ff = cfg["ffmpeg"]
    media_dir = os.path.join(cfg["site_dir"], "media")
    assets_dir = os.path.join(cfg["site_dir"], "assets")

    cats = {c["id"]: c for c in cfg["categories"]}
    cat_entries = {c["id"]: {"photos": [], "videos": []} for c in cfg["categories"]}

    counters = {"photo": {}, "video": {}}
    for item in inv["files"]:
        date = item["date"] or "unknown"
        folder = os.path.basename(os.path.dirname(item["path"]))
        kind = item["kind"]
        counters[kind][date] = counters[kind].get(date, 0) + 1
        seq = counters[kind][date]

        cat = resolve_category(cfg, item["date"], seq, folder, mapping, keyword_rules, default_cat)

        if kind == "photo":
            name = "assets/p-%s-%03d.webp" % (date.replace("-", ""), seq)
            if os.path.exists(os.path.join(assets_dir, os.path.basename(name))):
                cat_entries[cat]["photos"].append(name)
        else:
            base = "v-%s-%03d" % (date.replace("-", ""), seq)
            local = os.path.join(media_dir, base + ".mp4")
            if not os.path.exists(local):
                continue
            src_path = cloud_map.get(base + ".mp4", "media/%s.mp4" % base)
            dur = round(probe_duration(ff, local), 1)
            cat_entries[cat]["videos"].append({
                "poster": "media/%s.webp" % base,
                "src": src_path,
                "dur": dur,
            })

    trips = [{
        "id": cfg.get("trip_id", "trip-1"),
        "name": cfg.get("trip_name", "我的旅行"),
        "subtitle": cfg.get("trip_subtitle", ""),
        "place": cfg.get("trip_place", ""),
        "period": cfg.get("trip_period", ""),
        "year": cfg.get("trip_year", ""),
        "season": cfg.get("trip_season", ""),
        "blurb": cfg.get("trip_blurb", ""),
        "orientation": cfg.get("orientation", "landscape"),
        "worksTitle": cfg.get("works_title", "我的旅行"),
        "worksLead": cfg.get("works_lead", "按目的地编排。"),
        "hero": cfg.get("hero", ""),
        "heroAlt": cfg.get("hero_alt", ""),
        "cover": cfg.get("cover", ""),
        "photoCount": sum(len(v["photos"]) for v in cat_entries.values()),
        "videoCount": sum(len(v["videos"]) for v in cat_entries.values()),
        "geo": cfg.get("geo", []),
        "total": {"files": 0, "photos": 0, "videos": 0, "size": ""},
        "categories": [{"id": c["id"], "name": c["name"], "cover": c.get("cover", "")} for c in cfg["categories"]],
        "entries": [],
    }]

    for order, c in enumerate(cfg["categories"], start=1):
        data = cat_entries[c["id"]]
        trips[0]["entries"].append({
            "id": "cat-" + c["id"],
            "date": cfg.get("trip_period", ""),
            "label": c["name"],
            "weekday": "",
            "title": c["name"],
            "categoryId": c["id"],
            "tags": c.get("tags", ["自然山海"]),
            "coverImage": c.get("cover", ""),
            "galleryImages": data["photos"],
            "videos": data["videos"],
            "meta": {"location": c.get("location", ""), "gear": ""},
            "sortOrder": order,
        })

    meta = {
        "title": cfg.get("site_title", "我的旅行"),
        "sub": cfg.get("site_sub", ""),
        "intro": cfg.get("site_intro", ""),
        "owner": cfg.get("owner", ""),
        "ownerEn": cfg.get("owner_en", ""),
        "updated": cfg.get("updated", ""),
        "music": cfg.get("music", ""),
    }

    out = os.path.join(cfg["site_dir"], "data.js")
    payload = "window.TRIPS = " + json.dumps({"meta": meta, "trips": trips}, ensure_ascii=False, separators=(",", ":")) + ";\n"

    # 必须 UTF-8 无 BOM，否则中文乱码 / 解析失败
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(payload)

    total_p = trips[0]["photoCount"]
    total_v = trips[0]["videoCount"]
    print("data.js 已生成：%d 张照片、%d 段视频、%d 个分类" % (total_p, total_v, len(cfg["categories"])))
    print("路径：%s" % out)


# ----------------------------------------------------------------------------
# 校验
# ----------------------------------------------------------------------------

def stage_verify(cfg):
    data_path = os.path.join(cfg["site_dir"], "data.js")
    if not os.path.exists(data_path):
        sys.exit("找不到 data.js，先跑 data")

    with open(data_path, "r", encoding="utf-8") as f:
        raw = f.read()

    if raw.encode("utf-8")[:3] == b"\xef\xbb\xbf":
        print("【严重】data.js 带 BOM，会让全站白屏，必须去掉")

    payload = raw.split("=", 1)[1].strip().rstrip(";")
    data = json.loads(payload)

    missing, checked = [], 0
    for trip in data["trips"]:
        for entry in trip["entries"]:
            for p in entry["galleryImages"]:
                checked += 1
                if not os.path.exists(os.path.join(cfg["site_dir"], p)):
                    missing.append(p)
            for v in entry["videos"]:
                checked += 2
                if not os.path.exists(os.path.join(cfg["site_dir"], v["poster"])):
                    missing.append(v["poster"])
                if v["src"].startswith("/media/video/"):
                    continue  # 走代理的检查不到本地
                if not os.path.exists(os.path.join(cfg["site_dir"], v["src"])):
                    missing.append(v["src"])

    if missing:
        print("【缺失 %d 个文件】前 20 个：" % len(missing))
        for m in missing[:20]:
            print("  " + m)
    else:
        print("校验通过：%d 个引用全部存在" % checked)


# ----------------------------------------------------------------------------
# 入口
# ----------------------------------------------------------------------------

STAGES = {
    "scan": stage_scan,
    "photos": stage_photos,
    "videos": stage_videos,
    "posters": stage_posters,
    "data": stage_data,
    "verify": stage_verify,
}

ORDER = ["scan", "photos", "videos", "posters", "data", "verify"]


def main():
    ap = argparse.ArgumentParser(description="旅行相册站点构建流水线")
    ap.add_argument("stage", choices=list(STAGES.keys()) + ["all"], help="要执行的阶段")
    ap.add_argument("--config", default=os.path.join("tools", "site.config.json"), help="配置文件路径")
    args = ap.parse_args()

    cfg = load_config(args.config)

    if args.stage == "all":
        for s in ["photos", "videos", "posters", "data", "verify"]:
            print("")
            print("===== %s =====" % s)
            STAGES[s](cfg)
    else:
        STAGES[args.stage](cfg)


if __name__ == "__main__":
    main()
