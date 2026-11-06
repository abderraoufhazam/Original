/* ══════════════════════════════════════════════════════════
   ORDIZ — مؤثرات الصفحة الرئيسية (جزيئات · إمالة · عدّاد)
   لا يلمس أي وظيفة موجودة
   ══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* ── 1 · جزيئات مترابطة داخل الهيرو ── */
  function initParticles() {
    var hero = document.querySelector(".landing-hero");
    if (!hero || reduce) return;

    var cv = document.createElement("canvas");
    cv.className = "fx-particles";
    cv.setAttribute("aria-hidden", "true");
    hero.insertBefore(cv, hero.firstChild);

    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [], raf = null;

    function count() { return window.innerWidth < 700 ? 24 : 54; }

    function size() {
      var r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      pts = [];
      var n = count();
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.5 + 0.7
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      var i, j, p;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      var LINK = 125;
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = "rgba(0,96,192," + (0.14 * (1 - d / LINK)).toFixed(3) + ")";
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        ctx.fillStyle = "rgba(0,96,192,.35)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) frame(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    size(); seed(); start();

    window.addEventListener("resize", function () {
      size(); seed();
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    if ("IntersectionObserver" in window) {
      try {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
        }, { threshold: 0 }).observe(hero);
      } catch (e) {}
    }
  }

  /* ── 2 · إمالة 3D ── */
  function initTilt() {
    if (reduce) return;
    var hoverable = true;
    try { hoverable = window.matchMedia("(hover: hover)").matches; } catch (e) {}
    if (!hoverable) return;

    var els = document.querySelectorAll(".feature-landing, .step-landing, .report-card-landing");
    Array.prototype.forEach.call(els, function (el) {
      el.classList.add("fx-tilt");
      var raf2 = null;

      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--fx-mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--fx-my", (py * 100).toFixed(1) + "%");
        if (raf2) return;
        raf2 = requestAnimationFrame(function () {
          var rx = (0.5 - py) * 6;
          var ry = (px - 0.5) * 6;
          el.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) +
            "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
          raf2 = null;
        });
      }, { passive: true });

      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ── 3 · أزرار تتبع المؤشر بلطف ── */
  function initButtons() {
    if (reduce) return;
    var btns = document.querySelectorAll(".site-btn");
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = ((e.clientX - r.left) / r.width - 0.5) * 4;
        var dy = ((e.clientY - r.top) / r.height - 0.5) * 3;
        b.style.transform = "translate(" + dx.toFixed(1) + "px," + (dy - 2).toFixed(1) + "px)";
      }, { passive: true });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  /* ── 4 · عدّاد الأرقام (1M+ · 100+ · 99.9% · 24/7) ── */
  function initCounters() {
    var nums = document.querySelectorAll(".stat-num");
    if (!nums.length) return;

    Array.prototype.forEach.call(nums, function (el) {
      if (el.dataset.fxDone) return;
      var raw = (el.textContent || "").trim();
      var m = raw.match(/^([\d.]+)(.*)$/);
      if (!m) return;                 // مثل 24/7 → لا نلمسها

      var target = parseFloat(m[1]);
      var suffix = m[2] || "";
      var decimals = (m[1].split(".")[1] || "").length;

      function run() {
        if (el.dataset.fxDone) return;
        el.dataset.fxDone = "1";
        if (reduce) return;           // يبقى الرقم النهائي كما هو

        var t0 = performance.now(), dur = 1200;
        function step(t) {
          var p = Math.min(1, (t - t0) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          var v = target * eased;
          el.textContent = (decimals ? v.toFixed(decimals) : Math.round(v)) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = raw;  // القيمة الأصلية بالضبط
        }
        el.textContent = "0" + suffix;
        requestAnimationFrame(step);
      }

      if ("IntersectionObserver" in window) {
        try {
          var io = new IntersectionObserver(function (es) {
            es.forEach(function (e) { if (e.isIntersecting) { run(); io.disconnect(); } });
          }, { threshold: 0.6 });
          io.observe(el);
        } catch (e) { run(); }
      } else { run(); }
    });
  }

  function boot() {
    initParticles();
    initTilt();
    initButtons();
    initCounters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
