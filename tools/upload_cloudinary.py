# -*- coding: utf-8 -*-
"""
把超过 Pages 25MB 限制的视频上传到 Cloudinary，并生成代理路径映射。

用法：
    set CLOUDINARY_CLOUD_NAME 你的云名
    set CLOUDINARY_API_KEY 你的Key
    set CLOUDINARY_API_SECRET 你的Secret

    python tools/upload_cloudinary.py --media media --max-mb 25

输出：
    tools/out/cloudinary_map.json   {"v-20260413-016.mp4": "/media/video/upload/v-20260413-016.mp4"}

之后 build_site.py data 会读这个映射，把这些视频的 src 写成代理路径而不是本地路径。

为什么不能直接把 Cloudinary 链接写进 data.js：
    国内网络会拦 res.cloudinary.com，用户打开就是"网页存在安全风险"的红色警告页。
    必须走 /media/video/ 代理，用你自己的 pages.dev 域名去访问。
"""

import argparse
import hashlib
import json
import mimetypes
import os
import sys
import time
import uuid
import urllib.request
import urllib.error


def multipart(fields, file_path):
    """手工拼 multipart/form-data，避免依赖第三方库。"""
    boundary = "----album" + uuid.uuid4().hex
    body = []

    for key, val in fields.items():
        body.append(("--%s\r\n" % boundary).encode("utf-8"))
        body.append(('Content-Disposition: form-data; name="%s"\r\n\r\n' % key).encode("utf-8"))
        body.append(str(val).encode("utf-8"))
        body.append(b"\r\n")

    name = os.path.basename(file_path)
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    body.append(("--%s\r\n" % boundary).encode("utf-8"))
    body.append(('Content-Disposition: form-data; name="file"; filename="%s"\r\n' % name).encode("utf-8"))
    body.append(("Content-Type: %s\r\n\r\n" % ctype).encode("utf-8"))

    with open(file_path, "rb") as f:
        body.append(f.read())
    body.append(b"\r\n")
    body.append(("--%s--\r\n" % boundary).encode("utf-8"))

    return b"".join(body), "multipart/form-data; boundary=%s" % boundary


def upload(cloud, key, secret, file_path, folder="album"):
    ts = str(int(time.time()))
    sign_src = "folder=%s&timestamp=%s%s" % (folder, ts, secret)
    signature = hashlib.sha1(sign_src.encode("utf-8")).hexdigest()

    # public_id 用文件名（不带扩展名），这样代理路径能对上
    public_id = os.path.splitext(os.path.basename(file_path))[0]

    fields = {
        "api_key": key,
        "timestamp": ts,
        "signature": signature,
        "folder": folder,
        "public_id": public_id,
    }

    body, ctype = multipart(fields, file_path)
    url = "https://api.cloudinary.com/v1_1/%s/video/upload" % cloud

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", ctype)
    req.add_header("Content-Length", str(len(body)))

    with urllib.request.urlopen(req, timeout=600) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", default="media", help="本地视频目录")
    ap.add_argument("--max-mb", type=float, default=25, help="超过这个体积才上传")
    ap.add_argument("--folder", default="album", help="Cloudinary 目录名")
    args = ap.parse_args()

    cloud = os.environ.get("CLOUDINARY_CLOUD_NAME")
    key = os.environ.get("CLOUDINARY_API_KEY")
    secret = os.environ.get("CLOUDINARY_API_SECRET")

    if not (cloud and key and secret):
        sys.exit("缺环境变量：CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET")

    map_path = os.path.join("tools", "out", "cloudinary_map.json")
    os.makedirs(os.path.dirname(map_path), exist_ok=True)

    existing = {}
    if os.path.exists(map_path):
        with open(map_path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    targets = []
    for fn in sorted(os.listdir(args.media)):
        if not fn.lower().endswith(".mp4"):
            continue
        p = os.path.join(args.media, fn)
        if os.path.getsize(p) / 1024 / 1024 > args.max_mb:
            targets.append(p)

    print("需要上传的视频：%d 段（超过 %.0f MB）" % (len(targets), args.max_mb))

    ok, fail = 0, []
    for p in targets:
        fn = os.path.basename(p)
        if fn in existing:
            print("  跳过（已上传过）：%s" % fn)
            continue
        size_mb = os.path.getsize(p) / 1024 / 1024
        print("  上传 %s (%.1f MB) ..." % (fn, size_mb), flush=True)
        try:
            res = upload(cloud, key, secret, p, args.folder)
            public_id = res.get("public_id", "")
            # public_id 可能带 folder 前缀，代理路径只取最后的名字
            name = public_id.split("/")[-1]
            existing[fn] = "/media/video/upload/%s.mp4" % name
            ok += 1
            with open(map_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False, indent=1)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            fail.append((fn, "HTTP %d %s" % (e.code, detail)))
        except Exception as e:
            fail.append((fn, str(e)))

    print("上传完成：成功 %d，失败 %d" % (ok, len(fail)))
    for fn, err in fail:
        print("  失败：%s -> %s" % (fn, err))
    print("映射已写入 %s" % map_path)
    print("下一步：python tools/build_site.py data，代理路径会自动写进 data.js")


if __name__ == "__main__":
    main()
