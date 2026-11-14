/* ============================================================
   ORDIZ — Theme V2 Effects (تأثيرات عامة لكل الصفحات)
   ============================================================ */
(function () {
  if (window.__v2Init) return;
  window.__v2Init = true;

  function add(tag, cls, parent) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    (parent || document.body).appendChild(el);
    return el;
  }

  document.body.classList.add('v2');

  // الطبقات الخلفية
  add('div', 'v2-bg');
  var aur = add('div', 'v2-aurora');
  aur.innerHTML = '<span class="a1"></span><span class="a2"></span><span class="a3"></span>';
  var grid = add('canvas', 'v2-grid');
  var part = add('canvas', 'v2-particles');
  add('div', 'v2-spot');
  var prog = add('div', 'v2-progress');

  // شبكة
  var gc = grid.getContext('2d');
  function size() { grid.width = part.width = innerWidth; grid.height = part.height = innerHeight; }
  size(); addEventListener('resize', size);
  (function drawGrid() {
    gc.clearRect(0, 0, grid.width, grid.height);
    gc.strokeStyle = 'rgba(120,180,255,.06)'; gc.lineWidth = 1; var s = 46;
    for (var x = 0; x < grid.width; x += s) { gc.beginPath(); gc.moveTo(x, 0); gc.lineTo(x, grid.height); gc.stroke(); }
    for (var y = 0; y < grid.height; y += s) { gc.beginPath(); gc.moveTo(0, y); gc.lineTo(grid.width, y); gc.stroke(); }
  })();

  // جسيمات
  var pc = part.getContext('2d');
  var ps = [];
  for (var i = 0; i < 16; i++) ps.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.6 + .4, v: Math.random() * .35 + .08, o: Math.random() * .4 + .25 });
  var running = true;
  function anim() {
    if (!running) return;
    pc.clearRect(0, 0, part.width, part.height);
    ps.forEach(function (d) {
      d.y -= d.v; if (d.y < 0) { d.y = part.height; d.x = Math.random() * part.width; }
      pc.beginPath(); pc.arc(d.x, d.y, d.r, 0, 7);
      pc.fillStyle = 'rgba(120,200,255,' + d.o + ')'; pc.fill();
    });
    requestAnimationFrame(anim);
  }
  anim();
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(anim);
  });

  // بقعة الضوء + شريط التقدم
  addEventListener('mousemove', function (e) {
    var s = document.querySelector('.v2-spot');
    if (s) { s.style.setProperty('--mx', e.clientX + 'px'); s.style.setProperty('--my', e.clientY + 'px'); }
  });
  addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (scrollY / h * 100) + '%';
  });

  // ظهور تدريجي للأقسام
  function reveal() {
    document.querySelectorAll('section, .card, .feature-card, .pricing-card, .faq-item, .feature-landing, .step-landing, .report-card-landing').forEach(function (el) {
      if (el.classList.contains('v2-reveal') || el.classList.contains('v2-in')) return;
      el.classList.add('v2-reveal');
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('v2-in'); io.unobserve(x.target); } });
    }, { threshold: .1 });
    document.querySelectorAll('.v2-reveal').forEach(function (el) { io.observe(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal);
  else reveal();

  // عدادات
  function counters() {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        if (!x.isIntersecting) return;
        var el = x.target, n = +el.dataset.count, c = 0;
        var t = setInterval(function () {
          c += Math.ceil(n / 60); if (c >= n) { c = n; clearInterval(t); }
          el.textContent = c.toLocaleString('fr-DZ');
        }, 24);
        co.unobserve(el);
      });
    }, { threshold: .5 });
    document.querySelectorAll('[data-count]').forEach(function (el) { co.observe(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', counters);
  else counters();

  // إمالة ثلاثية الأبعاد للبطاقات
  function tilt() {
    if (/login|signup/.test(location.pathname)) return;  // صفحات الدخول/التسجيل بلا حركة
    document.querySelectorAll('.card, .feature-card, .pricing-card, .feature-landing, .step-landing').forEach(function (el) {
      el.classList.add('v2-tilt');
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = 'perspective(800px) rotateY(' + (x * 6) + 'deg) rotateX(' + (-y * 6) + 'deg) translateY(-4px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tilt);
  else tilt();
})();
