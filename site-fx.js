/* ══════════════════════════════════════════════════════════
   ORDIZ — مؤثرات الصفحات الداخلية (جزيئات · إمالة · أزرار)
   مؤثرات فقط — لا تلمس أي وظيفة
   ══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* جزيئات داخل الهيرو */
  function initParticles() {
    var hero = document.querySelector(".page-hero");
    if (!hero || reduce) return;

    var cv = document.createElement("canvas");
    cv.className = "sfx-particles";
    cv.setAttribute("aria-hidden", "true");
    hero.insertBefore(cv, hero.firstChild);

    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [], raf = null;
    var COUNT = window.innerWidth < 700 ? 20 : 42;

    function size() {
      var r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      pts = [];
      for (var i = 0; i < COUNT; i++) {
        pts.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
          r: Math.random() * 1.4 + 0.6
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
      var LINK = 120;
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = "rgba(0,96,192," + (0.13 * (1 - d / LINK)).toFixed(3) + ")";
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
        ctx.fillStyle = "rgba(0,96,192,.32)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) frame(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    size(); seed(); start();
    window.addEventListener("resize", function () { size(); seed(); }, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }

  /* إمالة 3D */
  function initTilt() {
    if (reduce) return;
    var hoverable = true;
    try { hoverable = window.matchMedia("(hover: hover)").matches; } catch (e) {}
    if (!hoverable) return;

    var els = document.querySelectorAll(".card, .feature-landing, .pricing-card, .content-card");
    Array.prototype.forEach.call(els, function (el) {
      el.classList.add("sfx-tilt");
      var raf2 = null;

      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--sfx-mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--sfx-my", (py * 100).toFixed(1) + "%");
        if (raf2) return;
        raf2 = requestAnimationFrame(function () {
          var rx = (0.5 - py) * 5;
          var ry = (px - 0.5) * 5;
          el.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) +
            "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-2px)";
          raf2 = null;
        });
      }, { passive: true });

      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* أزرار تتبع المؤشر */
  function initButtons() {
    if (reduce) return;
    var btns = document.querySelectorAll(".site-btn");
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = ((e.clientX - r.left) / r.width - 0.5) * 3;
        var dy = ((e.clientY - r.top) / r.height - 0.5) * 2.5;
        b.style.transform = "translate(" + dx.toFixed(1) + "px," + (dy - 1.5).toFixed(1) + "px)";
      }, { passive: true });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }


  /* ملصقان على جانبي عنوان الصفحة */
  function initHeroLabels() {
    var hero = document.querySelector(".page-hero");
    if (!hero || hero.querySelector(".sfx-hero-label")) return;
    if (window.innerWidth < 821) return;

    var r = document.createElement("img");
    r.className = "sfx-hero-label sfx-hero-label--r";
    r.src = "/label-hologram-hd.webp";
    r.alt = "";
    r.setAttribute("aria-hidden", "true");
    r.decoding = "async";
    r.loading = "lazy";

    var l = document.createElement("img");
    l.className = "sfx-hero-label sfx-hero-label--l";
    l.src = "/label-hologram-open-hd.webp";
    l.alt = "";
    l.setAttribute("aria-hidden", "true");
    l.decoding = "async";
    l.loading = "lazy";

    hero.appendChild(r);
    hero.appendChild(l);
  }
  function boot() { initParticles(); initTilt(); initButtons(); initHeroLabels(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
