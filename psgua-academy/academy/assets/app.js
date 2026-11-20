/* =========================================================
   Академія ГС «ВАГ» — Vanilla JS (без залежностей і збірки)
   - каталог курсів з data/courses.json + фільтр за напрямами
   - сторінка курсу (?id=...): акордеон модулів, прогрес у localStorage
   - валідація форм; відправка на endpoint або mailto (CONFIG.EMAIL)
   ========================================================= */
(function () {
  'use strict';

  var CONFIG = {
    DATA_URL: 'data/courses.json',
    EMAIL: 'info@uaguides.com', // адреса для заявок Академії ГС «ВАГ»
    // Залиште порожнім, щоб використовувати mailto.
    // Або вкажіть URL (напр. Google Apps Script / Formspree / власний PHP),
    // що приймає POST application/json і повертає 2xx.
    FORM_ENDPOINT: '',
    STORAGE_PREFIX: 'vag-academy:progress:'
  };

  var STATUS_LABELS = { open: 'Набір відкрито', waitlist: 'Прийом заявок', planned: 'Готується', closed: 'Набір закрито' };

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function hoursLabel(n) {
    if (n == null) return 'тривалість уточнюється';
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' година';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' години';
    return n + ' годин';
  }
  var storage = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove: function (k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
  };

  var dataPromise = null;
  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(CONFIG.DATA_URL, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }
    return dataPromise;
  }
  function categoryLabel(data, id) {
    var c = (data.categories || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.label : id;
  }
  function loadError(el) {
    el.innerHTML = '<div class="notice notice--error" role="alert">Не вдалося завантажити каталог курсів. ' +
      'Оновіть сторінку або напишіть нам: <a href="mailto:' + CONFIG.EMAIL + '">' + CONFIG.EMAIL + '</a>.</div>';
  }

  /* ---------- shell: nav + logo ---------- */
  function initShell() {
    var toggle = $('.nav-toggle'), nav = $('#site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
      });
    }
    $all('.brand__logo').forEach(function (img) {
      function fallback() { img.closest('.brand').classList.add('brand--nologo'); img.remove(); }
      if (img.complete && img.naturalWidth === 0) fallback();
      else img.addEventListener('error', fallback);
    });
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- catalog (index.html) ---------- */
  function courseCard(data, c) {
    var href = 'course.html?id=' + encodeURIComponent(c.id);
    return '<article class="card course-card" data-category="' + esc(c.category) + '">' +
      '<div class="meta"><span class="tag tag--gold">' + esc(categoryLabel(data, c.category)) + '</span>' +
      '<span class="status status--' + esc(c.status) + '">' + esc(STATUS_LABELS[c.status] || c.status) + '</span></div>' +
      '<h3><a href="' + href + '">' + esc(c.title) + '</a></h3>' +
      '<p class="course-card__summary">' + esc(c.summary) + '</p>' +
      '<div class="meta">' + (c.duration_hours ? '<span class="tag">⏱ ' + esc(hoursLabel(c.duration_hours)) + '</span>' : '') + '<span class="tag">' + esc(c.code || '') + '</span>' +
      '<span class="tag">' + esc(c.level) + '</span><span class="tag">' + esc(c.format) + '</span></div>' +
      '<div class="course-card__footer"><span class="legend">' + esc(c.modules.length) + ' модул' + (c.modules.length === 1 ? 'ь' : (c.modules.length < 5 ? 'і' : 'ів')) + '</span>' +
      '<a class="btn btn--navy btn--sm" href="' + href + '">Програма курсу →</a></div>' +
      '</article>';
  }

  function initCatalog() {
    var list = $('#course-list'), filters = $('#course-filters');
    if (!list) return;
    loadData().then(function (data) {
      var courses = data.courses || [];
      var used = {};
      courses.forEach(function (c) { used[c.category] = true; });
      var cats = (data.categories || []).filter(function (c) { return used[c.id]; });
      var params = new URLSearchParams(location.search);
      var active = params.get('cat') || 'all';
      if (active !== 'all' && !used[active]) active = 'all';

      filters.innerHTML = '<button type="button" class="chip" data-cat="all">Усі напрями</button>' +
        cats.map(function (c) { return '<button type="button" class="chip" data-cat="' + esc(c.id) + '">' + esc(c.label) + '</button>'; }).join('');

      function render() {
        $all('.chip', filters).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cat === active ? 'true' : 'false'); });
        var shown = courses.filter(function (c) { return active === 'all' || c.category === active; });
        list.innerHTML = shown.length ? shown.map(function (c) { return courseCard(data, c); }).join('')
          : '<div class="empty-state">За цим напрямом курсів поки немає.</div>';
        var counter = $('#course-count');
        if (counter) counter.textContent = 'Показано програм: ' + shown.length;
      }
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('.chip'); if (!b) return;
        active = b.dataset.cat;
        var url = new URL(location.href);
        if (active === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', active);
        history.replaceState(null, '', url.pathname + url.search + '#courses');
        render();
      });
      render();

      var stat = $('#stat-courses'); if (stat) stat.textContent = courses.length;
      var statM = $('#stat-modules');
      if (statM) statM.textContent = courses.reduce(function (s, c) { return s + (c.modules || []).length; }, 0);
    }).catch(function () { loadError(list); });
  }

  /* ---------- course page ---------- */
  function initCourse() {
    var root = $('#course-root');
    if (!root) return;
    var id = new URLSearchParams(location.search).get('id');
    loadData().then(function (data) {
      var course = (data.courses || []).filter(function (c) { return c.id === id || c.slug === id; })[0];
      if (!course) {
        $('#course-title').textContent = 'Курс не знайдено';
        $('#course-summary').textContent = 'Перевірте посилання або оберіть програму в каталозі.';
        root.innerHTML = '<div class="notice">Курсу з ідентифікатором «' + esc(id || '—') + '» немає. ' +
          '<a href="index.html#courses">Перейти до каталогу →</a></div>';
        var m = document.querySelector('meta[name="robots"]'); if (m) m.setAttribute('content', 'noindex');
        return;
      }
      renderCourse(data, course);
    }).catch(function () { loadError(root); });
  }

  function renderCourse(data, c) {
    var pageUrl = 'https://academy.psgua.com/course.html?id=' + encodeURIComponent(c.id);
    document.title = c.title + ' | Академія ГС «ВАГ»';
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', c.summary);
    var canon = document.querySelector('link[rel="canonical"]'); if (canon) canon.setAttribute('href', pageUrl);
    var ogT = document.querySelector('meta[property="og:title"]'); if (ogT) ogT.setAttribute('content', c.title + ' | Академія ГС «ВАГ»');
    var ogD = document.querySelector('meta[property="og:description"]'); if (ogD) ogD.setAttribute('content', c.summary);
    var ogU = document.querySelector('meta[property="og:url"]'); if (ogU) ogU.setAttribute('content', pageUrl);

    $('#course-title').textContent = c.title;
    $('#course-summary').textContent = c.summary;
    $('#crumb-current').textContent = c.title;

    var modulesHtml = c.modules.map(function (m, i) {
      var pid = 'mod-panel-' + i, bid = 'mod-btn-' + i;
      return '<div class="acc-item">' +
        '<h3 style="margin:0"><button type="button" class="acc-item__btn" id="' + bid + '" aria-expanded="' + (i === 0) + '" aria-controls="' + pid + '">' +
        '<span><span class="acc-item__num">' + String(i + 1).padStart(2, '0') + '</span>' + esc(m.title) + '</span>' +
        '<span><span class="acc-item__hours">' + (m.hours ? esc(hoursLabel(m.hours)) : '') + '</span> <span class="acc-item__chev" aria-hidden="true">▾</span></span>' +
        '</button></h3>' +
        '<div class="acc-item__panel" id="' + pid + '" role="region" aria-labelledby="' + bid + '"' + (i === 0 ? '' : ' hidden') + '>' +
        (m.summary ? '<p style="margin:14px 0 0">' + esc(m.summary) + '</p>' : '') + '<h4>Теми</h4><ul>' + (m.topics || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        ((m.materials && m.materials.length) ? '<h4>Матеріали</h4><ul>' + m.materials.map(function (x) {
          return '<li>' + (x.url ? '<a href="' + esc(x.url) + '">' + esc(x.title) + '</a>' : esc(x.title)) + ' <span class="tag">' + esc(x.type) + '</span></li>';
        }).join('') + '</ul><p class="legend" style="margin-top:10px">Матеріали надаються зарахованим слухачам.</p>' : '') +
        '</div></div>';
    }).join('');

    var outcomesHtml = '<ul class="checklist">' + c.outcomes.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>';

    var progressHtml = '<ul class="progress-list">' + c.modules.map(function (m, i) {
      return '<li><label><input type="checkbox" data-module="' + i + '"> <span>' + esc(m.title) + '</span></label></li>';
    }).join('') + '</ul>';

    $('#course-root').innerHTML =
      '<section aria-labelledby="h-program"><h2 id="h-program">Програма курсу</h2>' +
      '<p class="legend">Відповідність: ' + esc(c.standard_ref) + '</p>' +
      '<div class="accordion" id="accordion">' + modulesHtml + '</div></section>' +
      '<section aria-labelledby="h-outcomes" style="margin-top:48px"><h2 id="h-outcomes">Результати навчання</h2>' + outcomesHtml + '</section>' +
      '<section aria-labelledby="h-who" style="margin-top:48px"><h2 id="h-who">Для кого і як оцінюється</h2><ul class="facts">' +
        '<li><span>Для кого</span><span>' + esc(c.audience || '—') + '</span></li>' +
        '<li><span>Вхідні вимоги</span><span>' + esc(c.prerequisites || '—') + '</span></li>' +
        '<li><span>Оцінювання</span><span>' + esc(c.assessment || '—') + '</span></li></ul></section>' +
      '<section aria-labelledby="h-cert" style="margin-top:48px"><h2 id="h-cert">Документ про навчання</h2>' +
      '<div class="card card--flat"><p>' + esc(c.certificate_info) + '</p><a href="certificates.html">Як працює сертифікація →</a></div></section>';

    $('#course-facts').innerHTML =
      '<li><span>Напрям</span><span>' + esc(categoryLabel(data, c.category)) + '</span></li>' +
      '<li><span>Рівень</span><span>' + esc(c.level) + '</span></li>' +
      '<li><span>Обсяг</span><span>' + esc(hoursLabel(c.duration_hours)) + '</span></li>' +
      '<li><span>Формат</span><span>' + esc(c.format) + '</span></li>' +
      '<li><span>Код курсу</span><span>' + esc(c.code || '—') + '</span></li>' +
      '<li><span>Статус</span><span><span class="status status--' + esc(c.status) + '">' + esc(STATUS_LABELS[c.status] || c.status) + '</span></span></li>';

    $('#progress-box').innerHTML = '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Прогрес слухача"><div class="progress__bar" id="progress-bar"></div></div>' +
      '<p class="legend" id="progress-text" style="margin:8px 0 0"></p>' + progressHtml +
      '<button type="button" class="btn btn--outline btn--sm" id="progress-reset" style="margin-top:14px">Скинути прогрес</button>' +
      '<p class="legend" style="margin-top:10px">Прогрес зберігається лише у вашому браузері (localStorage) і не передається на сервер.</p>';

    initAccordion($('#accordion'));
    initProgress(c);

    var sel = $('#enroll-course');
    if (sel) {
      sel.innerHTML = (data.courses || []).map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.title) + '</option>';
      }).join('');
    }
    var cta = $('#enroll-cta');
    var note = $('#enroll-note');
    if (cta && c.status === 'planned') {
      cta.textContent = 'Повідомити про старт курсу';
      if (note) note.textContent = 'Курс ще готується — залиште заявку, і ми повідомимо, коли він стартує.';
    } else if (cta && c.status === 'waitlist') {
      cta.textContent = 'Залишити заявку';
      if (note) note.textContent = 'Онлайн-платформа курсів зараз переїжджає. Залиште заявку — ми надішлемо доступ, щойно навчання відкриється.';
    }
  }

  function initAccordion(acc) {
    if (!acc) return;
    acc.addEventListener('click', function (e) {
      var btn = e.target.closest('.acc-item__btn'); if (!btn) return;
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      document.getElementById(btn.getAttribute('aria-controls')).hidden = open;
    });
  }

  function initProgress(c) {
    var key = CONFIG.STORAGE_PREFIX + c.id;
    var saved = storage.get(key) || [];
    var boxes = $all('#progress-box input[type="checkbox"]');
    boxes.forEach(function (b) { b.checked = saved.indexOf(Number(b.dataset.module)) !== -1; });
    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).map(function (b) { return Number(b.dataset.module); });
      var pct = boxes.length ? Math.round(done.length / boxes.length * 100) : 0;
      $('#progress-bar').style.width = pct + '%';
      $('#progress-bar').parentNode.setAttribute('aria-valuenow', pct);
      $('#progress-text').textContent = 'Опрацьовано модулів: ' + done.length + ' з ' + boxes.length + ' (' + pct + '%)';
      if (!storage.set(key, done)) $('#progress-text').textContent += ' — збереження недоступне у цьому браузері';
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
    $('#progress-reset').addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; });
      storage.remove(key); update();
    });
    update();
  }

  /* ---------- forms ---------- */
  var VALIDATORS = {
    required: function (v) { return v.trim() ? '' : 'Заповніть це поле.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Вкажіть коректний email.'; },
    phone: function (v) { return !v.trim() || /^\+?[\d\s()-]{10,18}$/.test(v.trim()) ? '' : 'Формат: +380 XX XXX XX XX'; },
    checked: function (v, el) { return el.checked ? '' : 'Потрібна ваша згода.'; }
  };

  function validateField(el) {
    var rules = (el.dataset.validate || '').split(' ').filter(Boolean);
    var msg = '';
    for (var i = 0; i < rules.length && !msg; i++) msg = VALIDATORS[rules[i]](el.value || '', el);
    var wrap = el.closest('.field') || el.closest('.check');
    var err = wrap && wrap.querySelector('.field__error');
    if (wrap) wrap.classList.toggle('field--invalid', !!msg);
    if (err) err.textContent = msg;
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  function showStatus(form, ok, html) {
    var s = $('.form__status', form);
    s.className = 'form__status is-visible ' + (ok ? 'form__status--ok' : 'form__status--err');
    s.innerHTML = html;
    s.focus();
  }

  function buildMailto(subject, lines) {
    return 'mailto:' + CONFIG.EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function initForms() {
    $all('form[data-form]').forEach(function (form) {
      $all('[data-validate]', form).forEach(function (el) {
        el.addEventListener('blur', function () { validateField(el); });
        el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') validateField(el); });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (form.querySelector('.hp input') && form.querySelector('.hp input').value) return; // бот
        var fields = $all('[data-validate]', form);
        var ok = fields.map(validateField).every(Boolean);
        if (!ok) {
          var first = fields.filter(function (f) { return f.getAttribute('aria-invalid') === 'true'; })[0];
          if (first) first.focus();
          showStatus(form, false, 'Перевірте, будь ласка, виділені поля.');
          return;
        }
        var fd = new FormData(form), payload = { form: form.dataset.form, sent_at: new Date().toISOString(), page: location.href };
        fd.forEach(function (v, k) { if (k !== 'website') payload[k] = String(v); });
        if (form.dataset.form === 'enroll') {
          var sel = $('#enroll-course', form);
          if (sel && sel.selectedIndex >= 0) payload.course_title = sel.options[sel.selectedIndex].text;
        }
        submitPayload(form, payload);
      });
    });
  }

  function submitPayload(form, p) {
    var isEnroll = p.form === 'enroll';
    var subject = isEnroll ? 'Заявка на навчання: ' + (p.course_title || p.course || '') : 'Запит на перевірку документа № ' + (p.cert_number || '');
    var lines = isEnroll ? [
      'Курс: ' + (p.course_title || p.course), 'ПІБ: ' + p.name, 'Email: ' + p.email, 'Телефон: ' + (p.phone || '—'),
      'Член ВАГ: ' + (p.member || '—'), 'Коментар: ' + (p.comment || '—'), '', 'Надіслано з academy.psgua.com'
    ] : [
      'Номер документа: ' + p.cert_number, 'ПІБ власника: ' + p.holder, 'Дата видачі: ' + (p.issued || '—'),
      'Хто запитує: ' + p.requester, 'Email для відповіді: ' + p.email, '', 'Надіслано з academy.psgua.com/certificates.html'
    ];

    if (!CONFIG.FORM_ENDPOINT) {
      var href = buildMailto(subject, lines);
      window.location.href = href;
      showStatus(form, true, 'Відкриваємо ваш поштовий застосунок з готовим листом на <b>' + CONFIG.EMAIL + '</b>. ' +
        'Якщо нічого не відкрилося — <a href="' + esc(href) + '">натисніть тут</a> або надішліть лист вручну.');
      return;
    }
    var btn = $('button[type="submit"]', form); if (btn) btn.disabled = true;
    fetch(CONFIG.FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        form.reset();
        showStatus(form, true, 'Дякуємо! Заявку отримано. Ми відповімо на вказаний email.');
      })
      .catch(function () {
        showStatus(form, false, 'Не вдалося надіслати заявку. <a href="' + esc(buildMailto(subject, lines)) + '">Надіслати листом на ' + CONFIG.EMAIL + '</a>.');
      })
      .then(function () { if (btn) btn.disabled = false; });
  }

  /* ---------- enroll select on non-course pages ---------- */
  function initEnrollSelect() {
    var sel = $('#enroll-course');
    if (!sel || $('#course-root')) return;
    loadData().then(function (data) {
      sel.innerHTML = '<option value="">— оберіть програму —</option>' + (data.courses || []).map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x.title) + '</option>';
      }).join('');
    }).catch(function () { /* залишаємо статичний варіант */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initShell();
    initCatalog();
    initCourse();
    initEnrollSelect();
    initForms();
  });
})();
