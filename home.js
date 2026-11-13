/* ==========================================================================
   螳螂的旅行 · 总站首页
   数据：window.TRIPS = { meta, trips: [ { ...categories, entries } ] }
   首屏 / 旅行目录 / 地图 / 时间轴 / 关于 —— 五个模块，一套数据驱动
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.TRIPS || { trips: [] };
  var META = DATA.meta || {};
  var TRIPS = (DATA.trips || []).slice();

  var BASE = window.MEDIA_BASE || "";
  var CLOUD = window.CLOUDINARY_CLOUD || "";
  /* 本地打开（file:// 或 localhost）走本地文件，不依赖 CDN */
  var IS_LOCAL = location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (IS_LOCAL) CLOUD = "";
  var CDN_HOSTS = window.CLOUDINARY_HOSTS || ["res-3.cloudinary.com", "res-2.cloudinary.com", "res.cloudinary.com"];
  var CDN_HOST = CDN_HOSTS[0];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var pad2 = function (n) { return ("0" + n).slice(-2); };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var m = function (src, w) {
    if (!src) return src;
    if (src.indexOf("local/") === 0) return BASE + src.slice(6);
    if (!CLOUD) return BASE + src;
    var dot = src.lastIndexOf(".");
    var ext = dot > 0 ? src.slice(dot + 1).toLowerCase() : "";
    var id = dot > 0 ? src.slice(0, dot) : src;
    var base = "https://" + CDN_HOST + "/" + CLOUD + "/";
    if (ext === "webp" || ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif") {
      var t = "f_auto,q_auto" + (w ? ",w_" + w + ",c_limit" : "");
      return base + "image/upload/" + t + "/" + id + "." + ext;
    }
    if (ext === "mp4" || ext === "mov" || ext === "webm") return base + "video/upload/" + id + "." + ext;
    return base + "raw/upload/" + src;
  };
  var hi = function (src) {
    if (!src) return src;
    if (src.indexOf("local/") === 0) return m(src);
    if (src.indexOf("assets/p-") === 0 && /\.webp$/i.test(src)) return m("assets/hd/" + src.slice("assets/".length));
    return m(src);
  };
  document.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || !el.tagName || (el.tagName !== "IMG" && el.tagName !== "VIDEO")) return;
    var cur = el.currentSrc || el.src || "";
    if (!CLOUD || cur.indexOf("/" + CLOUD + "/") === -1) return;
    var tried = parseInt(el.getAttribute("data-cdn") || "0", 10);
    if (tried >= CDN_HOSTS.length - 1) return;
    CDN_HOST = CDN_HOSTS[tried + 1];
    el.setAttribute("data-cdn", tried + 1);
    el.src = cur.replace(/^https:\/\/[^/]+\//, "https://" + CDN_HOST + "/");
  }, true);

  if (META.title) document.title = META.title + " · 旅行档案";

  function countsOf(t) {
    var entries = t.entries || [];
    var photos = 0, videos = 0;
    entries.forEach(function (e) {
      photos += (e.galleryImages || []).length;
      videos += (e.videos || []).length;
    });
    if (t.total && t.total.photos) photos = Math.max(photos, t.total.photos);
    if (t.total && t.total.videos) videos = Math.max(videos, t.total.videos);
    return { entries: entries.length, photos: photos, videos: videos };
  }
  var ALL = { entries: 0, photos: 0, videos: 0 };
  TRIPS.forEach(function (t) {
    t._c = countsOf(t);
    ALL.entries += t._c.entries;
    ALL.photos += t._c.photos;
    ALL.videos += t._c.videos;
  });
  var PLACES = {};
  TRIPS.forEach(function (t) { (t.geo || []).forEach(function (g) { PLACES[g.n] = 1; }); });
  var placeCount = Object.keys(PLACES).length;

  /* ---------------- 首屏 ---------------- */
  var first = TRIPS[0] || {};
  var heroImg = $("#hheroImg");
  var heroVideo = $("#hheroVideo");

  /* 首屏用高清静态图 */
  if (heroVideo) heroVideo.style.display = "none";
  if (heroImg) {
    heroImg.src = hi(first.hero || first.cover);
    heroImg.alt = first.heroAlt || first.name || "";
    heroImg.style.animation = "none";
    heroImg.style.opacity = "1";
  }
  if ($("#hTitle")) $("#hTitle").textContent = META.title || "螳螂的旅行";
  if ($("#hSub")) $("#hSub").textContent = META.sub || "";
  if ($("#hheroSide")) $("#hheroSide").textContent = "TRAVEL ARCHIVE · " + (META.ownerEn || "TANG LANG");
  if ($("#aboutIntro")) $("#aboutIntro").textContent = META.intro || "";

  (function renderFacts() {
    var el = $("#hFacts");
    if (!el) return;
    var data = [
      [pad2(TRIPS.length), "次旅行 / TRIPS"],
      [placeCount, "个地点 / PLACES"],
      [ALL.photos, "张照片 / FRAMES"],
      [ALL.videos, "段视频 / CLIPS"]
    ];
    el.innerHTML = data.map(function (d) {
      return '<div class="hf"><b>' + d[0] + "</b><span>" + d[1] + "</span></div>";
    }).join("");
  })();

  /* ---------------- 旅行目录 ---------------- */
  var SPANS = [7, 5, 5, 7, 6, 6];
  function bindTilt(card) {
    var media = card.querySelector(".tc-media");
    if (!media) return;
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      media.style.transform = "perspective(900px) rotateY(" + (px * 3.4) + "deg) rotateX(" + (-py * 3.4) + "deg) scale(1.02)";
    });
    card.addEventListener("mouseleave", function () { media.style.transform = ""; });
  }
  function tripCard(t, i) {
    var a = document.createElement("a");
    a.className = "trip-card reveal" + (t.orientation === "portrait" ? " portrait" : "");
    a.dataset.span = String(SPANS[i % SPANS.length]);
    a.href = "album.html?trip=" + t.id;
    var c = t._c;
    var mediaHtml = t.coverVideo
      ? '<video class="tc-video" src="' + t.coverVideo + '" poster="' + m(t.cover || t.hero, 1300) + '" autoplay muted loop playsinline webkit-playsinline></video>'
      : '<img loading="lazy" src="' + m(t.cover || t.hero, 1300) + '" alt="' + (t.name || "") + '" />';
    a.innerHTML =
      '<div class="tc-media">' +
      mediaHtml +
      '<span class="tc-badge">' + pad2(i + 1) + "</span>" +
      '<span class="tc-go">进入相册 ↗</span>' +
      "</div>" +
      '<div class="tc-body">' +
      '<div class="tc-top"><span class="tc-no">NO. ' + pad2(i + 1) + " / " + pad2(TRIPS.length) + "</span>" +
      '<span class="tc-period">' + (t.period || "") + "</span></div>" +
      '<h3 class="tc-name">' + (t.name || "") + "</h3>" +
      '<p class="tc-sub">' + (t.subtitle || "") + "</p>" +
      (t.blurb ? '<p class="tc-blurb">' + t.blurb + "</p>" : "") +
      '<div class="tc-foot"><span class="tc-place">' + (t.place || "") + "</span>" +
      '<span class="tc-counts"><b>' + pad2(c.entries) + "</b> 段 · <b>" + c.photos + "</b> 张 · <b>" + c.videos + "</b> 段视频</span></div>" +
      "</div>";
    if (!reduced) bindTilt(a);
    return a;
  }

  var tripGrid = $("#tripGrid");
  if (tripGrid) {
    TRIPS.forEach(function (t, i) { tripGrid.appendChild(tripCard(t, i)); });
    if ($("#tripCount")) $("#tripCount").textContent = pad2(TRIPS.length) + " TRIPS / " + ALL.photos + " FRAMES";
  }

  /* ---------------- 地图（等距圆柱投影的示意图） ---------------- */
  var LON0 = 76, LON1 = 118, LAT0 = 17, LAT1 = 51, MAPW = 1000, MAPH = 620;
  var px = function (lon) { return ((lon - LON0) / (LON1 - LON0)) * MAPW; };
  var py = function (lat) { return ((LAT1 - lat) / (LAT1 - LAT0)) * MAPH; };
  var COLORS = ["#8fb3d9", "#c8a882", "#a8c8a2", "#d79aa8"];
  /* 点位标签的落位：[dx, dy, anchor]，密集处手动错开 */
  var LBL = {
    "乌鲁木齐": [-13, 20, "end"],
    "乌伦古湖": [11, 27, "start"],
    "禾木": [15, 9, "start"],
    "喀纳斯": [-14, -5, "end"],
    "赛里木湖": [15, -2, "start"],
    "天门山": [-13, 4, "end"],
    "北海": [14, 4, "start"]
  };

  (function renderMap() {
    var svg = $("#mapSvg");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    function add(tag, attrs, text) {
      var el = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      if (text != null) el.textContent = text;
      svg.appendChild(el);
      return el;
    }
    var defs = add("defs", {}, null);
    defs.innerHTML = '<linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#152140" stop-opacity=".9"/>' +
      '<stop offset="1" stop-color="#0b1226" stop-opacity=".9"/></linearGradient>';
    add("rect", { x: 0, y: 0, width: MAPW, height: MAPH, fill: "url(#mapFade)" });

    for (var lon = 80; lon <= 115; lon += 5) {
      add("line", { x1: px(lon), y1: 0, x2: px(lon), y2: MAPH, stroke: "rgba(255,255,255,.07)", "stroke-width": 1 });
      add("text", { x: px(lon) + 6, y: MAPH - 10, fill: "rgba(255,255,255,.30)", "font-size": 11, "font-family": "monospace" }, lon + "°E");
    }
    for (var lat = 20; lat <= 50; lat += 5) {
      add("line", { x1: 0, y1: py(lat), x2: MAPW, y2: py(lat), stroke: "rgba(255,255,255,.07)", "stroke-width": 1 });
      add("text", { x: 12, y: py(lat) - 7, fill: "rgba(255,255,255,.30)", "font-size": 11, "font-family": "monospace" }, lat + "°N");
    }

    TRIPS.forEach(function (t, ti) {
      var geo = t.geo || [];
      var color = COLORS[ti % COLORS.length];
      if (geo.length > 1) {
        var d = geo.map(function (g, i) {
          return (i ? "L" : "M") + px(g.lon).toFixed(1) + " " + py(g.lat).toFixed(1);
        }).join(" ");
        add("path", { d: d, fill: "none", stroke: color, "stroke-width": 1.6, "stroke-opacity": ".65", "stroke-dasharray": "5 7" });
      }
      geo.forEach(function (g, gi) {
        var x = px(g.lon), y = py(g.lat);
        add("circle", { cx: x, cy: y, r: 13, fill: color, "fill-opacity": ".13" });
        add("circle", { cx: x, cy: y, r: 4.2, fill: color });
        var spot = LBL[g.n];
        var anchor = spot ? spot[2] : (x > MAPW - 140 ? "end" : "start");
        var dx = spot ? spot[0] : (anchor === "end" ? -13 : 13);
        var dy = spot ? spot[1] : 4;
        add("text", { x: x + dx, y: y + dy, fill: "rgba(244,246,252,.92)", "font-size": 14, "font-family": "system-ui, sans-serif", "text-anchor": anchor }, g.n);
        add("text", { x: x + dx, y: y + dy + 16, fill: "rgba(255,255,255,.42)", "font-size": 10.5, "font-family": "monospace", "text-anchor": anchor }, pad2(ti + 1) + "." + pad2(gi + 1));
      });
    });
  })();

  (function renderMapList() {
    var el = $("#mapList");
    if (!el) return;
    el.innerHTML = TRIPS.map(function (t, ti) {
      var color = COLORS[ti % COLORS.length];
      var stops = (t.geo || []).map(function (g) { return g.n; }).join(" → ") || "—";
      return '<div class="ml-item"><span class="ml-dot" style="background:' + color + '"></span>' +
        '<div class="ml-body"><div class="ml-top"><b>' + (t.name || "") + "</b><span>" + (t.period || "") + "</span></div>" +
        '<p class="ml-route">' + stops + "</p></div></div>";
    }).join("");
  })();

  /* ---------------- 时间轴 ---------------- */
  (function renderTimeline() {
    var el = $("#tl");
    if (!el) return;
    var list = TRIPS.slice().sort(function (a, b) {
      var ya = parseInt((a.period || a.year || "0").replace(/[^\d]/g, "").slice(0, 4), 10) || 0;
      var yb = parseInt((b.period || b.year || "0").replace(/[^\d]/g, "").slice(0, 4), 10) || 0;
      return yb - ya;
    });
    list.forEach(function (t) {
      var c = t._c;
      var li = document.createElement("li");
      li.className = "tl-item reveal";
      li.innerHTML =
        '<span class="tl-year">' + (t.year || "") + "</span>" +
        '<span class="tl-dot" aria-hidden="true"></span>' +
        '<div class="tl-body">' +
        '<div class="tl-head"><h3>' + (t.name || "") + '</h3><span class="tl-place">' + (t.place || "") + "</span></div>" +
        '<p class="tl-note">' + (t.subtitle || "") + " · " + (t.period || "") + "</p>" +
        '<div class="tl-meta"><span><b>' + pad2(c.entries) + "</b> 段行程</span><span><b>" + c.photos + "</b> 张照片</span><span><b>" + c.videos + "</b> 段视频</span></div>" +
        '<a class="tl-link" href="album.html?trip=' + t.id + '">看这本册子 <i>↗</i></a>' +
        "</div>";
      el.appendChild(li);
    });
  })();

  /* ---------------- 关于：数字 ---------------- */
  (function renderStats() {
    var el = $("#hStats");
    if (!el) return;
    var data = [
      [TRIPS.length, "次旅行"],
      [placeCount, "个地点"],
      [ALL.photos, "张照片"],
      [ALL.videos, "段视频"]
    ];
    el.innerHTML = data.map(function (d) {
      return '<div class="stat"><b data-count="' + d[0] + '">0</b><i>' + d[1] + "</i></div>";
    }).join("");
  })();

  var counted = false;
  function countUp() {
    if (counted) return;
    counted = true;
    $$("#hStats .stat b").forEach(function (b) {
      var target = parseInt(b.getAttribute("data-count"), 10) || 0;
      if (reduced) { b.textContent = target; return; }
      var t0 = performance.now(), DUR = 1100;
      (function step(now) {
        var p = clamp((now - t0) / DUR, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        b.textContent = p >= 1 ? target : Math.round(target * e);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ---------------- 滚动：进度条 / 揭幕 / 视差 / 导航高亮 ---------------- */
  var nav = $("#nav");
  var progEl = $("#progress");
  var observed = $$(".reveal");
  function reveal() {
    var vh = window.innerHeight || 800;
    observed.forEach(function (el) {
      if (el.classList.contains("in")) return;
      if (el.getBoundingClientRect().top < vh * 0.9) el.classList.add("in");
    });
    var st = $("#hStats");
    if (st && st.getBoundingClientRect().top < vh * 0.92) countUp();
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset || window.scrollY;
      var vh = window.innerHeight, docH = document.documentElement.scrollHeight - vh;
      if (progEl) progEl.style.transform = "scaleX(" + (docH > 0 ? clamp(y / docH, 0, 1) : 0) + ")";
      if (nav) nav.classList.toggle("scrolled", y > 24);
      if (!reduced && y < vh) {
        var bgEl = heroVideo && heroVideo.style.display !== "none" && heroVideo.style.opacity === "1" ? heroVideo : heroImg;
        if (bgEl) {
          bgEl.style.transform = "scale(" + (1.06 - (y / vh) * 0.04) + ") translateY(" + y * 0.12 + "px)";
        }
        var copy = $(".hhero-copy");
        if (copy) {
          copy.style.transform = "translate(-50%, calc(-50% + " + y * -0.2 + "px))";
          copy.style.opacity = clamp(1 - (y / vh) * 1.6, 0, 1);
        }
      }
      reveal();
      var ids = ["trips", "map", "timeline", "about"], cur = "";
      ids.forEach(function (id) {
        var sec = $("#" + id);
        if (sec && sec.getBoundingClientRect().top <= vh * 0.4) cur = id;
      });
      $$(".nav-links a[href^='#']").forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + cur);
      });
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  /* ---------------- 背景音乐 ---------------- */
  var musicBtn = $("#music");
  if (musicBtn) {
    var audio = new Audio();
    audio.loop = true; audio.preload = "auto"; audio.volume = 0;
    audio.src = m(META.music || "assets/music.mp3");
    var TARGET = 0.5, playing = false, audible = false, userMuted = false, unlockedAt = 0;

    function fadeVol(to, ms) {
      var from = audio.volume, t0 = performance.now();
      (function f(now) {
        var p = clamp((now - t0) / ms, 0, 1);
        try { audio.volume = from + (to - from) * p; } catch (e) {}
        if (p < 1) requestAnimationFrame(f);
      })(t0);
    }
    var hint = document.createElement("button");
    hint.type = "button";
    hint.className = "bgm-hint";
    hint.setAttribute("aria-label", "开启背景音乐");
    hint.innerHTML = '<span class="bgm-ic"><i></i><i></i><i></i></span><span class="bgm-tx">轻触开启背景音乐</span>';
    hint.hidden = true;
    document.body.appendChild(hint);

    var showHint = function () { if (userMuted) return; hint.hidden = false; musicBtn.classList.add("attn"); };
    var hideHint = function () { hint.hidden = true; musicBtn.classList.remove("attn"); };

    function unlock() {
      if (userMuted || audible) return;
      hideHint();
      audio.muted = false;
      audible = true;
      unlockedAt = Date.now();
      musicBtn.classList.add("on");
      musicBtn.setAttribute("aria-pressed", "true");
      if (!playing) {
        var p2 = audio.play();
        if (p2 && p2.then) {
          p2.then(function () { playing = true; }).catch(function () {
            audible = false; playing = false;
            musicBtn.classList.remove("on");
            musicBtn.setAttribute("aria-pressed", "false");
          });
        } else playing = true;
      }
      try { audio.volume = 0; } catch (e) {}
      fadeVol(TARGET, 1100);
    }
    ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { passive: true, once: true });
    });
    hint.addEventListener("click", function (e) { e.stopPropagation(); unlock(); });
    musicBtn.addEventListener("click", function () {
      if (audible && unlockedAt && Date.now() - unlockedAt < 600) return;
      if (audible) {
        audible = false; userMuted = true; playing = false;
        musicBtn.classList.remove("on");
        musicBtn.setAttribute("aria-pressed", "false");
        hideHint();
        fadeVol(0, 400);
        window.setTimeout(function () { if (!audible) { try { audio.pause(); } catch (e) {} } }, 430);
      } else { userMuted = false; unlock(); }
    });

    audio.muted = true;
    var pr0 = audio.play();
    if (pr0 && pr0.then) pr0.then(function () { playing = true; showHint(); }).catch(function () { playing = false; showHint(); });
    else { playing = true; showHint(); }
  }
})();

/* ==========================================================================
   点赞 + 留言板
   ========================================================================== */
(function () {
  "use strict";

  var likeBtn = document.getElementById("likeBtn");
  var likeCount = document.getElementById("likeCount");
  var msgForm = document.getElementById("msgForm");
  var msgName = document.getElementById("msgName");
  var msgText = document.getElementById("msgText");
  var msgSubmit = document.getElementById("msgSubmit");
  var msgList = document.getElementById("msgList");

  if (!likeBtn) return;

  // ---- 点赞 ----
  var LIKED_KEY = "album_liked_v1";

  function loadLikes() {
    fetch("/api/like")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        likeCount.textContent = d.count + " 人觉得不错";
      })
      .catch(function () {
        likeCount.textContent = "—";
      });
  }

  if (localStorage.getItem(LIKED_KEY) === "1") {
    likeBtn.classList.add("liked");
    likeBtn.setAttribute("aria-pressed", "true");
  }

  likeBtn.addEventListener("click", function () {
    if (localStorage.getItem(LIKED_KEY) === "1") {
      // 已点过，不重复加
      likeBtn.classList.add("liked");
      return;
    }
    fetch("/api/like", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        likeCount.textContent = d.count + " 人觉得不错";
        likeBtn.classList.add("liked");
        likeBtn.setAttribute("aria-pressed", "true");
        localStorage.setItem(LIKED_KEY, "1");
      })
      .catch(function () {
        alert("点赞失败，请稍后再试");
      });
  });

  // ---- 留言板 ----
  function fmtTime(ts) {
    var d = new Date(ts);
    var m = (d.getMonth() + 1).toString().padStart(2, "0");
    var day = d.getDate().toString().padStart(2, "0");
    var h = d.getHours().toString().padStart(2, "0");
    var min = d.getMinutes().toString().padStart(2, "0");
    return m + "-" + day + " " + h + ":" + min;
  }

  function loadMessages() {
    fetch("/api/messages")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        renderMessages(d.messages || []);
      })
      .catch(function () {
        msgList.innerHTML = '<li class="msg-empty">留言加载失败</li>';
      });
  }

  function renderMessages(list) {
    if (!list.length) {
      msgList.innerHTML = '<li class="msg-empty">还没有留言，来写第一条吧</li>';
      return;
    }
    msgList.innerHTML = list.map(function (m) {
      return '<li class="msg-item">' +
        '<div class="msg-item-head">' +
          '<span class="msg-item-name">' + escapeHtml(m.name) + '</span>' +
          '<span class="msg-item-time">' + fmtTime(m.ts) + '</span>' +
        '</div>' +
        '<p class="msg-item-text">' + escapeHtml(m.text) + '</p>' +
      '</li>';
    }).join("");
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  msgForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = msgName.value.trim();
    var text = msgText.value.trim();
    if (!name || !text) return;

    msgSubmit.disabled = true;
    msgSubmit.textContent = "发送中…";

    fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name, text: text })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) {
          alert(d.error);
        } else {
          msgText.value = "";
          loadMessages();
        }
      })
      .catch(function () {
        alert("发送失败，请稍后再试");
      })
      .finally(function () {
        msgSubmit.disabled = false;
        msgSubmit.textContent = "发送";
      });
  });

  // 初始化
  loadLikes();
  loadMessages();
})();
