/* ==========================================================================
   螳螂的旅行 · 单个旅行相册页
   数据：window.TRIPS.trips 里按 ?trip=<id> 选一本（categories + entries）
   媒体：window.MEDIA_BASE（本地空，部署填桶域名）；local/ 前缀走本地文件
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.TRIPS || { trips: [] };
  var LIST = DATA.trips || [];
  var want = (location.search.match(/[?&]trip=([^&]+)/) || [])[1] || "";
  var S = null;
  for (var qi = 0; qi < LIST.length; qi++) { if (LIST[qi].id === decodeURIComponent(want)) S = LIST[qi]; }
  if (!S) S = LIST[0] || { trip: {}, total: {}, categories: [], entries: [] };

  var BASE = window.MEDIA_BASE || "";
  var CLOUD = window.CLOUDINARY_CLOUD || "";
  /* 本地打开时走本地文件（相册素材本地也有一份） */
  if (location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") CLOUD = "";
  /* 交付域名：国内网络对 res.cloudinary.com 有阻断，分片域名可用；
     下面按顺序自动降级（媒体加载失败时换下一个重试）。 */
  var CDN_HOSTS = window.CLOUDINARY_HOSTS || ["res-3.cloudinary.com", "res-2.cloudinary.com", "res.cloudinary.com"];
  var CDN_HOST = CDN_HOSTS[0];
  var vw = function () { return window.innerWidth || document.documentElement.clientWidth || 1200; };
  var narrow = function () { return vw() <= 680; };
  // 卡片/封面用的宽度档：手机上别去拉 2560px 原图
  var W_THUMB = function () { return narrow() ? 900 : 1300; };
  var W_BIG = function () { return narrow() ? 1600 : 0; };  // 0 = 不裁，用自动优化后的原图

  var m = function (src, w) {
    if (!src) return src;
    if (src.indexOf("local/") === 0) return BASE + src.slice(6);   // 未上云的新素材
    if (!CLOUD) return BASE + src;   // 本地预览：相对路径
    var dot = src.lastIndexOf(".");
    var ext = dot > 0 ? src.slice(dot + 1).toLowerCase() : "";
    var id = dot > 0 ? src.slice(0, dot) : src;
    var base = "https://" + CDN_HOST + "/" + CLOUD + "/";
    // 图片：f_auto/q_auto 自动优化（用户要求）；视频：源交付不转码；mp3 等：raw 原样
    if (ext === "webp" || ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif") {
      var t = "f_auto,q_auto" + (w ? ",w_" + w + ",c_limit" : "");
      return base + "image/upload/" + t + "/" + id + "." + ext;
    }
    if (ext === "mp4" || ext === "mov" || ext === "webm") return base + "video/upload/" + id + "." + ext;
    return base + "raw/upload/" + src;
  };
  // 放大视图（首屏 / 详情头图 / 灯箱）走 assets/hd/ 高清版；视频封面、音乐等不映射
  var hi = function (src) {
    if (!src) return src;
    var w = W_BIG();
    if (src.indexOf("assets/p-") === 0 && /\.webp$/i.test(src)) {
      return m("assets/hd/" + src.slice("assets/".length), w);
    }
    return m(src, w);
  };
  /* CDN 域名自动降级：任何媒体加载失败就换下一个域名重试（最多 2 次） */
  function swapHost(u, i) {
    var h = CDN_HOSTS[Math.min(i, CDN_HOSTS.length - 1)];
    return u.replace(/^https:\/\/[^/]+\//, "https://" + h + "/");
  }
  document.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName;
    if (tag !== "IMG" && tag !== "VIDEO" && tag !== "AUDIO" && tag !== "SOURCE") return;
    var cur = el.currentSrc || el.src || el.getAttribute("src") || "";
    if (!CLOUD || cur.indexOf("/" + CLOUD + "/") === -1) return;
    var tried = parseInt(el.getAttribute("data-cdn") || "0", 10);
    if (tried >= CDN_HOSTS.length - 1) return;
    var nu = swapHost(cur, tried + 1);
    el.setAttribute("data-cdn", tried + 1);
    CDN_HOST = CDN_HOSTS[tried + 1];   // 生效后，后续渲染直接用可用域名
    if (tag === "VIDEO" || tag === "AUDIO") { el.src = nu; try { el.load(); } catch (x) {} }
    else el.src = nu;
  }, true);

  var cats = S.categories || [];
  var entries = (S.entries || []).slice().sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
  var catName = {};
  cats.forEach(function (c) { catName[c.id] = c.name; });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var pad2 = function (n) { return ("0" + n).slice(-2); };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ==========================================================================
     1. 首屏 + 作品网格 + 分类筛选
     ========================================================================== */
  var heroImg = $("#heroImg");
  if (heroImg && (S.cover || S.hero)) heroImg.src = hi(S.cover || S.hero);
  if (heroImg && S.heroAlt) heroImg.alt = S.heroAlt;

  /* 页面文案按当前旅行填：标题 / 首屏 / 章节头 / 收尾 */
  (function paintTripCopy() {
    var t = (S.name || "螳螂的旅行");
    document.title = (DATA.meta && DATA.meta.title ? DATA.meta.title + " · " : "") + t;
    if ($("#heroTitle")) $("#heroTitle").textContent = t;
    if ($("#heroSub")) $("#heroSub").textContent = (S.place ? S.place + " · " : "") + (S.subtitle || "");
    if ($("#heroEyebrow")) $("#heroEyebrow").textContent = "SELECTED WORKS / " + (S.period || "");
    if ($("#heroSide")) $("#heroSide").textContent = "PHOTO ARCHIVE · " + (S.period || "") + " · " + (S.place || "");
    if ($("#worksTitle") && S.worksTitle) $("#worksTitle").innerHTML = S.worksTitle;
    if ($("#worksLead") && S.worksLead) $("#worksLead").textContent = S.worksLead;
    if ($("#aboutLead") && S.blurb) $("#aboutLead").textContent = S.blurb;
    if ($("#coName")) $("#coName").textContent = (DATA.meta && DATA.meta.title) || "螳螂的旅行";
    if ($("#coLine")) $("#coLine").textContent = (S.period || "") + " · " + (S.place || "");
  })();

  /* 页脚前加一条"其他旅行"，把多旅行总站的关系带进相册页 */
  (function renderOthers() {
    var host = $("#about");
    if (!host) return;
    var others = LIST.filter(function (t) { return t.id !== S.id; });
    if (!others.length) return;
    var box = document.createElement("div");
    box.className = "others";
    box.innerHTML = '<p class="others-label">ALSO IN THIS ARCHIVE / 其他旅行</p><div class="others-row">' +
      others.map(function (t) {
        return '<a class="other-card" href="album.html?trip=' + t.id + '">' +
          '<img loading="lazy" src="' + m(t.cover || t.hero, 700) + '" alt="' + (t.name || "") + '" />' +
          '<span class="oc-body"><b>' + (t.name || "") + "</b><i>" + (t.period || "") + "</i></span></a>";
      }).join("") + "</div>";
    var footer = host.querySelector(".colophon");
    if (footer) host.insertBefore(box, footer); else host.appendChild(box);
  })();

  var filtersEl = $("#filters");
  var grid = $("#grid");
  var activeCat = "all";

  function mediaCount(e) {
    return (e.galleryImages ? e.galleryImages.length : 0) + (e.videos ? e.videos.length : 0);
  }

  /* 不等宽编排：每行凑满 12 栅格，循环套用，筛选后依然对齐 */
  var ROW_PATTERN = [[7, 5], [4, 4, 4], [6, 6], [5, 7]];
  function assignSpans(n) {
    var out = [], ri = 0;
    while (out.length < n) {
      var row = ROW_PATTERN[ri % ROW_PATTERN.length];
      for (var j = 0; j < row.length && out.length < n; j++) out.push(row[j]);
      ri++;
    }
    return out;
  }

  function card(e, span, idx) {
    var a = document.createElement("a");
    a.className = "card reveal";
    a.dataset.span = String(span);
    a.href = "#entry-" + e.id;
    a.setAttribute("role", "button");
    var n = (e.galleryImages ? e.galleryImages.length : 0);
    var v = (e.videos ? e.videos.length : 0);
    var loc = (e.meta && e.meta.location) || e.label;
    var no = pad2(e.sortOrder || idx + 1);
    a.innerHTML =
      '<div class="card-media"><img loading="lazy" src="' + m(e.coverImage, W_THUMB()) + '" alt="' + (e.title || e.label) + '" width="1600" height="1067" />' +
      '<span class="card-view">VIEW ↗</span></div>' +
      '<div class="card-meta">' +
      '<div class="r1"><span class="no">' + no + " / " + pad2(entries.length) + '</span>' +
      '<span class="t">' + (e.title || e.label) + '</span><span class="ar">↗</span></div>' +
      '<div class="r2"><span class="loc">' + loc + '</span>' +
      '<span class="cnt">' + (n ? n + " FRAMES · " : "") + v + " CLIPS · " + e.label + '</span></div>' +
      "</div>";
    a.addEventListener("click", function (ev) { ev.preventDefault(); openDetail(e.id, a.querySelector(".card-media img")); });
    return a;
  }

  function renderGrid() {
    grid.innerHTML = "";
    var list = activeCat === "all" ? entries : entries.filter(function (e) { return e.categoryId === activeCat; });
    var spans = assignSpans(list.length);
    list.forEach(function (e, i) { var c = card(e, spans[i], i); grid.appendChild(c); if (!reduced) bindCardTilt(c); });
    $$(".card.reveal", grid).forEach(function (c, i) { c.style.transitionDelay = (i % 3) * 0.07 + "s"; });
    var gc = $("#gridCount");
    if (gc) gc.textContent = pad2(list.length) + " ENTRIES / " + (activeCat === "all" ? "ALL" : (catName[activeCat] || ""));
    observeReveals();
  }

  // 文字索引式筛选（带计数）
  function renderFilters() {
    filtersEl.innerHTML = "";
    var label = document.createElement("span");
    label.className = "fl-label";
    label.textContent = "INDEX /";
    filtersEl.appendChild(label);

    function mk(name, count, cid) {
      var b = document.createElement("button");
      b.innerHTML = name + "<i>" + pad2(count) + "</i>";
      b.setAttribute("role", "tab");
      b.dataset.cat = cid;
      b.addEventListener("click", function () { setCat(cid); });
      filtersEl.appendChild(b);
      return b;
    }
    var allBtn = mk("全部", entries.length, "all");
    allBtn.classList.add("on");
    cats.forEach(function (c) {
      var count = entries.filter(function (e) { return e.categoryId === c.id; }).length;
      if (count) mk(c.name, count, c.id);
    });
  }
  function setCat(id) {
    activeCat = id;
    $$("#filters button").forEach(function (b) { b.classList.toggle("on", b.dataset.cat === id); });
    renderGrid();
  }

  // 首屏底部四栏元信息
  (function renderHeroFacts() {
    var t = S.total || {};
    var el = $("#heroFacts");
    if (!el) return;
    var data = [
      [pad2(entries.length), "段行程 / STOPS"],
      [t.photos || 0, "张照片 / FRAMES"],
      [t.videos || 0, "段视频 / CLIPS"],
      [S.year || "", (S.season || "") + " / SEASON"]
    ];
    el.innerHTML = data.map(function (d) {
      return '<div class="hf"><b>' + d[0] + "</b><span>" + d[1] + "</span></div>";
    }).join("");
  })();

  /* ==========================================================================
     2. 滚动揭示 + 数字
     ========================================================================== */
  var revealObserved = [];
  function observeReveals() {
    $$(".reveal:not(.in)", grid).forEach(function (el) { revealObserved.push(el); });
    revealObserved = revealObserved.filter(function (el) { return document.contains(el); });
  }
  function onReveal() {
    var vh = window.innerHeight || 800;
    revealObserved.forEach(function (el) {
      if (!el.classList.contains("in") && el.getBoundingClientRect().top < vh * 0.94) el.classList.add("in");
    });
    var st = $("#stats");
    if (st && st.getBoundingClientRect().top < vh * 0.9) countUp();
  }
  window.addEventListener("scroll", onReveal, { passive: true });
  window.addEventListener("resize", onReveal, { passive: true });

  var counted = false;
  function countUp() {
    if (counted) return;
    counted = true;
    $$("#stats .stat b").forEach(function (b) {
      var target = parseInt(b.getAttribute("data-count"), 10) || 0;
      if (reduced) { b.textContent = target; return; }
      var t0 = performance.now(), DUR = 1100;
      (function step(now) {
        var p = clamp((now - t0) / DUR, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(target * e);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  // 数字区
  (function renderStats() {
    var t = S.total || {};
    var data = [
      [t.files || ((t.photos || 0) + (t.videos || 0)), "个文件"],
      [t.photos || 0, "张照片"],
      [t.videos || 0, "段视频"],
      [entries.length, "天"]
    ];
    $("#stats").innerHTML = data.map(function (d) {
      return '<div class="stat"><b data-count="' + d[0] + '">0</b><i>' + d[1] + "</i></div>";
    }).join("");
  })();

  // 导航滚动态
  var nav = $("#nav");
  var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 24); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ==========================================================================
     3. 详情
     ========================================================================== */
  var detail = $("#detail");
  var detailBody = $("#detailBody");
  var detailTitle = $("#detailTitle");
  var detailOpen = false;
  var currentEntry = null;

  var GALLERY_STEP = 9;

  function openDetail(id, thumbImg) {
    var e = null;
    entries.forEach(function (x) { if (x.id === id) e = x; });
    if (!e) return;
    currentEntry = e;
    detailTitle.textContent = (e.title || e.label) + " / " + e.label;
    detailBody.innerHTML = "";
    detail.scrollTop = 0;

    var n = (e.galleryImages || []).length;
    var v = (e.videos || []).length;

    function row(k, val) { return '<div class="row"><dt>' + k + "</dt><dd>" + val + "</dd></div>"; }
    var info =
      row("DATE", e.date + (e.weekday ? " · " + e.weekday : "")) +
      row("PLACE", (e.meta && e.meta.location) || "—") +
      row("CHAPTER", (catName[e.categoryId] || "—") + ' <span style="color:var(--ink3)">/ ' + pad2(e.sortOrder || 1) + " of " + pad2(entries.length) + "</span>") +
      row("CONTENT", n + " 张照片 · " + v + " 段视频") +
      ((e.meta && e.meta.gear) ? row("GEAR", e.meta.gear) : "");

    var html =
      '<div class="detail-hero"><img src="' + hi(e.coverImage) + '" alt="' + (e.title || e.label) + '" /></div>' +
      '<div class="detail-head">' +
      '<div><p class="dh-no">ENTRY ' + pad2(e.sortOrder || 1) + " / " + pad2(entries.length) + '</p>' +
      '<h3>' + (e.title || e.label) + "</h3>" +
      '<p class="dh-sub">' + ((e.meta && e.meta.location) || e.label) + "</p>" +
      ((e.tags && e.tags.length) ? '<div class="tags">' + e.tags.map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("") + "</div>" : "") +
      "</div>" +
      '<dl class="dl">' + info + "</dl>" +
      "</div>";

    // 更多照片（折叠懒加载）
    if (n) {
      html += '<div class="more-head"><h4>更多照片</h4><span class="n">共 ' + n + " 张</span></div>" +
        '<div class="gallery" id="gallery"></div>' +
        (n > GALLERY_STEP ? '<button class="more-btn" id="moreBtn" type="button">查看更多（' + (n - GALLERY_STEP) + '）</button>' : "");
    } else if (!v) {
      html += '<div class="detail-empty">这一天没有照片。</div>';
    }

    // 视频（详情内，poster + 点击加载）
    if (v) {
      html += '<div class="more-head"><h4>视频</h4><span class="n">' + v + ' 段</span></div>' +
        '<div class="videos">' + e.videos.map(function (c, k) {
          return '<div class="v" data-k="' + k + '"><img loading="lazy" src="' + m(c.poster, W_THUMB()) + '" alt="" /><span class="play"></span>' +
            (c.dur ? '<span class="dur">' + Math.round(c.dur) + "s</span>" : "") + "</div>";
        }).join("") + "</div>";
    }

    detailBody.innerHTML = html;

    // 照片灯箱
    var gEl = $("#gallery");
    if (gEl) {
      var shown = 0;
      var galleryList = (e.galleryImages || []).map(function (s, k) { return { src: s, cap: e.label + " · " + pad2(k + 1) }; });
      function renderBatch(count) {
        for (var i = shown; i < Math.min(count, galleryList.length); i++) {
          var g = document.createElement("div");
          g.className = "g";
          g.setAttribute("data-i", i);
          g.innerHTML = '<img loading="lazy" src="' + m(galleryList[i].src, W_THUMB()) + '" alt="" />';
          g.addEventListener("click", function () {
            openLb(galleryList.map(function (x) { return x.src; }), galleryList.map(function (x) { return x.cap; }), parseInt(this.getAttribute("data-i"), 10), this.querySelector("img"));
          });
          gEl.appendChild(g);
        }
        shown = Math.min(count, galleryList.length);
      }
      renderBatch(GALLERY_STEP);
      var mb = $("#moreBtn");
      if (mb) { if (!reduced) setupMagnetic(mb); mb.addEventListener("click", function () {
        renderBatch(shown + GALLERY_STEP);
        if (shown >= galleryList.length) mb.remove();
        else mb.textContent = "查看更多（" + (galleryList.length - shown) + "）";
      }); }
    }

    // 视频点击加载（默认静音）
    $$(".detail-body .v").forEach(function (vel) {
      vel.addEventListener("click", function () {
        var k = parseInt(vel.getAttribute("data-k"), 10);
        var c = e.videos[k];
        if (c) openLbVideo(e.videos.map(function (v) { return v.src; }), k, vel.querySelector("img"), e.label);
      });
    });

    detail.classList.add("open");
    detail.setAttribute("aria-hidden", "false");
    detailOpen = true;
    if (thumbImg) { var hImg = detailBody.querySelector(".detail-hero img"); if (hImg) flipFly(thumbImg, hImg, false, null); }
    document.body.style.overflow = "hidden";
    if (history.replaceState) history.replaceState(null, "", "#entry-" + e.id);
  }

  function closeDetail() {
    detail.classList.remove("open");
    detail.setAttribute("aria-hidden", "true");
    detailOpen = false;
    document.body.style.overflow = "";
    currentEntry = null;
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  }

  $("#detailBack").addEventListener("click", closeDetail);
  $("#detailX").addEventListener("click", closeDetail);
  // 关灯箱后 350ms 内忽略详情页空白点击，防止误关整个详情
  detail.addEventListener("click", function (ev) {
    if (ev.target === detail && Date.now() - lbClosedAt > 350) closeDetail();
  });

  /* ==========================================================================
     4. 灯箱
     ========================================================================== */
  var lb = $("#lb"), lbImg = $("#lbImg"), lbVideo = $("#lbVideo");
  var lbCap = $("#lbCap"), lbCount = $("#lbCount");
  var lbList = [], lbCaps = [], lbIdx = 0, lbOpen = false, lbVideoMode = false;

  // 图片 / 视频模式严格互斥：inline display 双保险，避免 hidden 被 CSS 覆盖
  function hideVideo() {
    try { lbVideo.pause(); } catch (e) {}
    lbVideo.removeAttribute("src");
    try { lbVideo.load(); } catch (e) {}   // 清空当前帧与原生控件
    lbVideo.hidden = true; lbVideo.style.display = "none";
  }
  function showImageMode() {
    hideVideo();
    lbImg.hidden = false; lbImg.style.display = "";
  }
  function showVideoMode() {
    lbImg.hidden = true; lbImg.style.display = "none";
    lbVideo.hidden = false; lbVideo.style.display = "block";
  }

  function openLb(list, caps, idx, thumbImg) {
    lbList = list || []; lbCaps = caps || []; lbIdx = idx || 0; lbVideoMode = false;
    showImageMode();
    renderLb();
    lb.classList.add("show"); lbOpen = true; lb.setAttribute("aria-hidden", "false");
    if (thumbImg && lbImg) flipFly(thumbImg, lbImg, false, null);
  }
  // HEVC 播放能力检测（H.265 视频在部分安卓 Chrome 上不支持）
  var hevcOK = null;
  function supportsHevc() {
    if (hevcOK !== null) return hevcOK;
    var v = document.createElement("video");
    hevcOK = !!(v.canPlayType && (v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') || v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')));
    return hevcOK;
  }

  function openLbVideo(list, idx, thumbImg, label) {
    lbList = (list && list.length) ? list : [];   // 视频模式下 lbList 存当天全部视频 src
    lbIdx = idx || 0;
    lbVideoMode = true;
    lbCaps = lbList.map(function (_, i) { return (label || "") + " · 视频 " + pad2(i + 1); });
    showVideoMode();
    playLbVideoAt(lbIdx, thumbImg);
  }
  function playLbVideoAt(i, thumbImg) {
    lbVideo.src = m(lbList[i]);
    lbVideo.muted = false; lbVideo.volume = 0.9;
    lbCap.textContent = (lbCaps[i] || "") + (supportsHevc() ? "" : "　·　当前浏览器可能不支持 H.265，建议用 Safari / 微信打开");
    lbCount.textContent = lbList.length > 1 ? pad2(i + 1) + " / " + pad2(lbList.length) : "VIDEO";
    $("#lbPrev").style.display = lbList.length > 1 ? "" : "none";
    $("#lbNext").style.display = lbList.length > 1 ? "" : "none";
    lb.classList.add("show"); lbOpen = true; lb.setAttribute("aria-hidden", "false");
    if (thumbImg) flipFly(thumbImg, lbVideo, false, null);
    var pr = lbVideo.play();
    if (pr && pr.catch) pr.catch(function () {
      lbVideo.muted = true;          // 浏览器拦截有声自动播放时降级为静音
      lbVideo.play().catch(function () {});
    });
  }
  function renderLb() {
    if (!lbList.length) return;
    lbImg.src = hi(lbList[lbIdx]);
    lbCap.textContent = lbCaps[lbIdx] || "";
    lbCount.textContent = pad2(lbIdx + 1) + " / " + pad2(lbList.length);
    $("#lbPrev").style.display = lbList.length > 1 ? "" : "none";
    $("#lbNext").style.display = lbList.length > 1 ? "" : "none";
  }
  function lbStep(dir) {
    if (lbList.length < 2) return;
    lbIdx = (lbIdx + dir + lbList.length) % lbList.length;
    if (lbVideoMode) {
      showVideoMode();          // 切换前先停掉旧视频、清帧
      playLbVideoAt(lbIdx);
    } else {
      showImageMode();
      renderLb();
    }
  }
  var lbClosedAt = 0;
  function closeLb() {
    lb.classList.remove("show"); lbOpen = false; lb.setAttribute("aria-hidden", "true");
    hideVideo();
    lbClosedAt = Date.now();
  }
  $("#lbX").addEventListener("click", function (e) { e.stopPropagation(); closeLb(); });
  $("#lbPrev").addEventListener("click", function (e) { e.stopPropagation(); lbStep(-1); });
  $("#lbNext").addEventListener("click", function (e) { e.stopPropagation(); lbStep(1); });
  lb.addEventListener("click", function (e) { e.stopPropagation(); if (e.target === lb) closeLb(); });

  window.addEventListener("keydown", function (e) {
    if (lbOpen) {
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowRight") lbStep(1);
      else if (e.key === "ArrowLeft") lbStep(-1);
      return;
    }
    if (detailOpen && e.key === "Escape") closeDetail();
  });

  /* ==========================================================================
     5. 背景音乐：进站自动播放
     浏览器禁止「无用户手势的有声自动播放」，所以走三步：
       ① muted 起播 —— 允许，页面一进来音乐就在走了（只是暂时没声音）
       ② 出现「轻触开启背景音乐」轻提示
       ③ 用户第一次触摸/点击/按键 → 取消静音并淡入音量
     用户主动点音乐按钮关掉后，尊重选择、不再自动恢复。
     ========================================================================== */
  var musicBtn = $("#music");
  var audio = new Audio();
  audio.loop = true; audio.preload = "auto"; audio.volume = 0;
  audio.src = m("assets/music.mp3");
  var TARGET_VOL = 0.5;
  var playing = false;   // 是否正在走
  var audible = false;   // 是否已能出声
  var userMuted = false; // 用户主动关掉

  function fadeVol(to, ms) {
    var from = audio.volume, t0 = performance.now();
    (function f(now) {
      var p = clamp((now - t0) / ms, 0, 1);
      try { audio.volume = from + (to - from) * p; } catch (e) {}
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* 轻提示 */
  var bgmHint = document.createElement("button");
  bgmHint.type = "button";
  bgmHint.className = "bgm-hint";
  bgmHint.setAttribute("aria-label", "开启背景音乐");
  bgmHint.innerHTML = '<span class="bgm-ic"><i></i><i></i><i></i></span><span class="bgm-tx">轻触开启背景音乐</span>';
  bgmHint.hidden = true;
  document.body.appendChild(bgmHint);
  function showHint() {
    if (userMuted) return;
    bgmHint.hidden = false;
    musicBtn.classList.add("attn");        // 未出声：按钮呼吸提示可点
  }
  function hideHint() {
    bgmHint.hidden = true;
    musicBtn.classList.remove("attn");
  }

  /* ① 静音起播 */
  function startSilent() {
    audio.muted = true;
    var pr = audio.play();
    if (pr && pr.then) {
      pr.then(function () { playing = true; showHint(); })
        .catch(function () { playing = false; showHint(); });  // 静音也被拦：等手势直接带声起播
    } else {
      playing = true; showHint();
    }
  }

  /* ② 手势解锁 */
  var unlockedAt = 0;
  function unlock() {
    if (userMuted || audible) return;
    hideHint();
    audio.muted = false;
    audible = true;
    unlockedAt = Date.now();
    musicBtn.classList.add("on");
    musicBtn.setAttribute("aria-pressed", "true");
    if (!playing) {
      var pr = audio.play();
      if (pr && pr.then) {
        pr.then(function () { playing = true; })   // 只有真播起来才置位，失败后重试不会被跳过
          .catch(function () {
            audible = false; playing = false;
            musicBtn.classList.remove("on");
            musicBtn.setAttribute("aria-pressed", "false");
          });
      } else {
        playing = true;
      }
    }
    try { audio.volume = 0; } catch (e) {}
    fadeVol(TARGET_VOL, 1100);
  }

  ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { passive: true, once: true });
  });
  bgmHint.addEventListener("click", function (e) { e.stopPropagation(); unlock(); });

  musicBtn.addEventListener("click", function () {
    // 首次触碰解锁刚把音乐打开的那次 click 不当作「关闭」，避免点了反而静音
    if (audible && unlockedAt && Date.now() - unlockedAt < 600) return;
    if (audible) {
      audible = false; userMuted = true; playing = false;
      musicBtn.classList.remove("on");
      musicBtn.setAttribute("aria-pressed", "false");
      hideHint();
      fadeVol(0, 400);
      window.setTimeout(function () { if (!audible) { try { audio.pause(); } catch (e) {} } }, 430);
    } else {
      userMuted = false;
      unlock();
    }
  });

  startSilent();

  /* ==========================================================================
     6. 初始化 + 深链
     ========================================================================== */
  renderFilters();
  renderGrid();

  // 深链 #entry-day-N 直达详情
  function handleHash() {
    var h = location.hash || "";
    if (h.indexOf("#entry-") === 0 && !detailOpen) openDetail(h.slice("#entry-".length));
  }
  window.addEventListener("hashchange", handleHash);
  handleHash();

  /* ---- 交互增强：FLIP / 视差 / 光标 / 进度 / 导航高亮 / 磁性 / tilt ---- */
  function flipFly(thumb, target, reverse, done) {
    if (reduced || !thumb || !target || !thumb.getBoundingClientRect) { if (done) done(); return; }
    var a = thumb.getBoundingClientRect();
    var b = target.getBoundingClientRect();
    if (a.width < 4 || b.width < 4) { if (done) done(); return; }
    var clone = document.createElement("img");
    clone.src = thumb.currentSrc || thumb.src;
    clone.className = "flip-clone";
    var sx = a.width / b.width, sy = a.height / b.height;
    clone.style.left = b.left + "px"; clone.style.top = b.top + "px";
    clone.style.width = b.width + "px"; clone.style.height = b.height + "px";
    clone.style.transformOrigin = "top left";
    clone.style.transform = "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + sx + "," + sy + ")";
    document.body.appendChild(clone);
    target.style.visibility = "hidden";
    void clone.offsetWidth;
    requestAnimationFrame(function () {
      clone.style.transform = reverse
        ? "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + sx + "," + sy + ")"
        : "none";
    });
    var ended = false;
    function finish() { if (ended) return; ended = true; clone.remove(); target.style.visibility = ""; if (done) done(); }
    clone.addEventListener("transitionend", finish);
    setTimeout(finish, 720);
  }

  function setupMagnetic(el) {
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      var mx = (e.clientX - r.left) - r.width / 2, my = (e.clientY - r.top) - r.height / 2;
      el.style.transform = "translate(" + (mx * 0.22) + "px," + (my * 0.32) + "px)";
    });
    el.addEventListener("mouseleave", function () { el.style.transform = ""; });
  }
  function bindCardTilt(card) {
    var media = card.querySelector(".card-media");
    if (!media) return;
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      media.style.transform = "perspective(800px) rotateY(" + (px * 4) + "deg) rotateX(" + (-py * 4) + "deg) scale(1.03)";
    });
    card.addEventListener("mouseleave", function () { media.style.transform = ""; });
  }

  var progEl = $("#progress"), heroCopy = $(".hero-copy"), heroFoot = $(".hero-foot");

  var ticking = false;
  function onScrollEnh() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset || window.scrollY;
      var h = window.innerHeight, docH = document.documentElement.scrollHeight - h;
      if (progEl) progEl.style.transform = "scaleX(" + (docH > 0 ? clamp(y / docH, 0, 1) : 0) + ")";
      if (!reduced && heroImg && y < h) {
        var p = y / h;
        heroImg.style.transform = "scale(" + (1.12 - p * 0.06) + ") translateY(" + (y * 0.15) + "px)";
        if (heroCopy) { heroCopy.style.transform = "translateY(" + (y * -0.22) + "px)"; heroCopy.style.opacity = clamp(1 - p * 1.7, 0, 1); }
        if (heroFoot) heroFoot.style.opacity = clamp(1 - p * 2.2, 0, 1);
      }
      var secWorks = $("#works"), secAbout = $("#about");
      var top = secWorks ? secWorks.offsetTop : 0, aboutTop = secAbout ? secAbout.offsetTop : 1e9;
      var id = y >= aboutTop - h * 0.4 ? "about" : (y >= top - h * 0.4 ? "works" : "");
      $$(".nav-links a[href^='#']").forEach(function (a) { a.classList.toggle("active", id ? a.getAttribute("href") === "#" + id : false); });
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScrollEnh, { passive: true });
  window.addEventListener("resize", onScrollEnh, { passive: true });
  onScrollEnh();

  if (!reduced) { $$(".nav-music, .to-top").forEach(setupMagnetic); }
})();
