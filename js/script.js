/**
 * Райтибор — скрипты сайта.
 * Нативный JS без зависимостей. Структура:
 *   1. Настройки и утилиты         9. Модальные окна (общий менеджер)
 *   2. Тема (тёмная / светлая)     10. Формы: валидация и отправка
 *   3. Мобильное меню              11. Окно «Связаться» и окно заявки
 *   4. Прокрутка: шапка, прогресс  12. Каталог: карточки, фильтры
 *   5. Появление при прокрутке     13. Страница товара
 *   6. Счётчики                    14. Витрина-«видоискатель» на главной
 *   7. Изображения, textarea       15. Эффекты под курсором
 *   8. Копирование, тосты, «Поделиться»
 */
(function () {
  'use strict';

  /* =========================================================
     1. Настройки и утилиты
     ========================================================= */

  /* Контакты компании — единый источник для всех страниц и окон */
  var SITE = {
    phone: '+7 495 221-66-22',
    phoneHref: 'tel:+74952216622',
    email: 'info@raitibor.ru',
    address: 'г. Москва, пр-кт Волгоградский, д. 42, к. 24',
    hours: 'Пн–Пт, 09:00–18:00'
  };

  var root = document.documentElement;
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasCatalog = typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS);
  var hasIO = 'IntersectionObserver' in window;

  function reducedMotion() { return motionQuery.matches; }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Откуда пришло последнее действие: клавиатура или мышь/касание.
     Фокус кнопке мы переносим программно (после закрытия окна, очистки истории,
     отправки формы) только когда человек работает с клавиатурой — ему он нужен.
     Мышью это не нужно, а Safari при программном фокусе рисует вокруг кнопки
     синий ободок, которого пользователь не ждёт. */
  var usingKeyboard = false;
  document.addEventListener('keydown', function (e) {
    var k = e.key || '';
    if (k === 'Tab' || k === 'Enter' || k === ' ' || k === 'Escape' || k.indexOf('Arrow') === 0) usingKeyboard = true;
  }, true);
  ['pointerdown', 'mousedown', 'touchstart'].forEach(function (type) {
    document.addEventListener(type, function () { usingKeyboard = false; }, true);
  });
  function focusForKeyboard(el) {
    if (usingKeyboard && el && el.focus) el.focus({ preventScroll: true });
  }

  /* localStorage может быть недоступен (приватный режим, запрет cookie) */
  var store = {
    get: function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set: function (key, value) { try { localStorage.setItem(key, value); } catch (e) { /* не критично */ } },
    getJson: function (key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
    }
  };

  function findProduct(id) {
    if (!hasCatalog) return null;
    var num = Number(id);
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === num) return PRODUCTS[i];
    return null;
  }
  function categoryOf(id) {
    if (typeof PRODUCT_CATEGORIES === 'undefined') return null;
    for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) if (PRODUCT_CATEGORIES[i].id === id) return PRODUCT_CATEGORIES[i];
    return null;
  }
  function productUrl(id) { return 'product.html?id=' + encodeURIComponent(id); }
  function absoluteUrl(path) { return new URL(path, window.location.href).href; }

  /* Один rAF на кадр для частых событий (scroll, pointermove) */
  /* Масштаб страницы (zoom на <html> для больших экранов, см. раздел 19
     в style.css). Координаты мыши и getBoundingClientRect — в пикселях
     экрана, а размеры внутри страницы — в «масштабированных» пикселях,
     поэтому там, где из координат строятся px-значения, делим на масштаб. */
  function pageZoom() { return parseFloat(window.getComputedStyle(root).zoom) || 1; }

  function rafThrottle(fn) {
    var scheduled = false, lastArgs;
    return function () {
      lastArgs = arguments;
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () { scheduled = false; fn.apply(null, lastArgs); });
    };
  }

  var ICONS = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V6a1.5 1.5 0 0 1 1.5-1.5H15"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg class="success-check" viewBox="0 0 52 52" aria-hidden="true"><circle class="success-check-circle" cx="26" cy="26" r="23" fill="none"/><path class="success-check-mark" fill="none" d="M14 27l7 7 16-16"/></svg>'
  };

  /* Пока меняется ширина окна (складной телефон раскладывают или
     складывают, поворот экрана, изменение окна на компьютере), CSS-переходы
     выключены: раскладка перестраивается мгновенно, без «плавающих»
     элементов. Реагируем только на ширину — на телефонах высота меняется
     при каждом скрытии адресной строки. */
  (function initResizeGuard() {
    var lastW = window.innerWidth;
    var timer = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      root.classList.add('is-resizing');
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { root.classList.remove('is-resizing'); }, 250);
    }, { passive: true });
  })();

  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* =========================================================
     2. Тема (тёмная / светлая)
     Класс light-theme ставится на <html> ещё до отрисовки (inline-скрипт
     в <head>), здесь — только переключение с анимацией.
     ========================================================= */
  (function initTheme() {
    var toggle = $('#themeToggle');
    var metaColor = $('meta[name="theme-color"]');
    var colors = { dark: '#10151a', light: '#f2f4f6' };
    var supportsMask = window.CSS && CSS.supports &&
      (CSS.supports('mask-image', 'radial-gradient(#000, transparent)') ||
       CSS.supports('-webkit-mask-image', 'radial-gradient(#000, transparent)'));
    var fadeTimer = null;
    var busy = false;

    function isLight() { return root.classList.contains('light-theme'); }

    function syncUi() {
      var light = isLight();
      if (metaColor) metaColor.setAttribute('content', light ? colors.light : colors.dark);
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(light));
        toggle.setAttribute('aria-label', light ? 'Включить тёмную тему' : 'Включить светлую тему');
      }
    }

    function apply(light, persist) {
      root.classList.toggle('light-theme', light);
      if (persist) store.set('theme', light ? 'light' : 'dark');
      syncUi();
    }

    /* Точка, из которой «разливается» новая тема (центр кнопки) */
    function originOf(el) {
      if (!el) return { x: window.innerWidth / 2, y: 0 };
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function switchTheme(light, persist, originEl) {
      if (light === isLight() || busy) return;

      if (reducedMotion()) { apply(light, persist); return; }

      /* Браузеры без View Transitions (Firefox): кратковременно включаем
         мягкий переход цветов у ВСЕХ элементов, затем выключаем — постоянные
         transition на каждом элементе тормозили бы прокрутку и hover. */
      if (typeof document.startViewTransition !== 'function') {
        root.classList.add('theme-fade');
        apply(light, persist);
        window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(function () { root.classList.remove('theme-fade'); }, 800);
        return;
      }

      var o = originOf(originEl);
      var endRadius = Math.hypot(Math.max(o.x, window.innerWidth - o.x), Math.max(o.y, window.innerHeight - o.y));
      var z = pageZoom();
      o = { x: o.x / z, y: o.y / z };
      endRadius /= z;

      /* На время снимка отключаем CSS-переходы: новая тема должна отрисоваться
         сразу «набело», иначе внутри круга видно двойное перетекание цветов. */
      busy = true;
      root.classList.add('theme-vt');
      var transition = document.startViewTransition(function () { apply(light, persist); });

      transition.ready.then(function () {
        var timing = {
          duration: 900,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          fill: 'both',
          pseudoElement: '::view-transition-new(root)'
        };
        if (supportsMask) {
          /* Круг с мягкой растушёванной кромкой: радиальная маска растёт от
             кнопки. Позиция и размер интерполируются синхронно, поэтому центр
             круга всё время остаётся точно на кнопке. */
          var solid = 0.7; // доля радиуса без растушёвки
          var size = (endRadius * 2) / solid;
          var grad = 'radial-gradient(circle closest-side, #000 ' + (solid * 100) + '%, transparent 100%)';
          var from = { maskImage: grad, webkitMaskImage: grad, maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat',
                       maskSize: '0px 0px', webkitMaskSize: '0px 0px',
                       maskPosition: o.x + 'px ' + o.y + 'px', webkitMaskPosition: o.x + 'px ' + o.y + 'px' };
          var to = { maskImage: grad, webkitMaskImage: grad, maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat',
                     maskSize: size + 'px ' + size + 'px', webkitMaskSize: size + 'px ' + size + 'px',
                     maskPosition: (o.x - size / 2) + 'px ' + (o.y - size / 2) + 'px',
                     webkitMaskPosition: (o.x - size / 2) + 'px ' + (o.y - size / 2) + 'px' };
          root.animate([from, to], timing);
        } else {
          root.animate({ clipPath: [
            'circle(0px at ' + o.x + 'px ' + o.y + 'px)',
            'circle(' + endRadius + 'px at ' + o.x + 'px ' + o.y + 'px)'
          ] }, timing);
        }
        /* Лёгкое «затухание» старой темы под кругом — переход читается мягче */
        root.animate({ opacity: [1, 0.85] }, {
          duration: 900, easing: 'ease-out', fill: 'both', pseudoElement: '::view-transition-old(root)'
        });
      }).catch(function () { /* тема уже применена — просто без анимации */ });

      transition.finished.finally(function () {
        root.classList.remove('theme-vt');
        busy = false;
      });
    }

    syncUi();

    /* Страница восстановлена из кэша браузера (кнопка «Назад»): тему уже
       подтянул inline-скрипт в <head>, здесь — обновить кнопку и цвет
       адресной строки. Смена темы в другой вкладке применяется сразу. */
    document.addEventListener('themesync', syncUi);
    window.addEventListener('storage', function (e) {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        root.classList.toggle('light-theme', e.newValue === 'light');
        syncUi();
      }
    });

    if (toggle) {
      toggle.addEventListener('click', function () { switchTheme(!isLight(), true, toggle); });
    }

    /* Пока пользователь сам не выбрал тему — следуем за системной */
    var systemQuery = window.matchMedia('(prefers-color-scheme: light)');
    var onSystemChange = function (e) { if (store.get('theme') === null) switchTheme(e.matches, false, null); };
    if (systemQuery.addEventListener) systemQuery.addEventListener('change', onSystemChange);
  })();

  /* =========================================================
     3. Мобильное меню
     ========================================================= */
  (function initMobileMenu() {
    var burger = $('#burger');
    var menu = $('#mobile-menu');
    if (!burger || !menu) return;
    var closeTimer = null;

    function isOpen() { return burger.getAttribute('aria-expanded') === 'true'; }
    function open() {
      window.clearTimeout(closeTimer);
      menu.classList.remove('is-closing');
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Закрыть меню');
    }
    function close() {
      if (!isOpen()) return;
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
      if (reducedMotion()) { menu.hidden = true; return; }
      menu.classList.add('is-closing');
      closeTimer = window.setTimeout(function () { menu.hidden = true; menu.classList.remove('is-closing'); }, 220);
    }

    burger.addEventListener('click', function () { if (isOpen()) close(); else open(); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('click', function (e) {
      if (isOpen() && !menu.contains(e.target) && !burger.contains(e.target)) close();
    });
    window.matchMedia('(min-width: 860px)').addEventListener('change', function (e) { if (e.matches) close(); });
  })();

  /* =========================================================
     4. Прокрутка: тень шапки, прогресс, кнопка «наверх», параллакс hero
     ========================================================= */
  (function initScroll() {
    var header = $('#site-header');
    var bar = $('#scroll-progress');
    var toTop = $('#to-top');
    var hero = $('#top');
    var heroBg = hero ? $('.hero-bg', hero) : null;

    function update() {
      var y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 4);
      if (bar) {
        var max = root.scrollHeight - root.clientHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0).toFixed(4) + ')';
      }
      if (toTop) {
        var show = y > 560;
        if (show) toTop.hidden = false;
        toTop.classList.toggle('is-visible', show);
      }
      if (heroBg && !reducedMotion() && y < hero.offsetHeight + hero.offsetTop) {
        heroBg.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)';
      }
    }
    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    update();

    if (toTop) {
      toTop.addEventListener('transitionend', function () {
        if (!toTop.classList.contains('is-visible')) toTop.hidden = true;
      });
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
    }
  })();

  /* =========================================================
     5. Появление элементов при прокрутке (в т.ч. для контента,
        добавленного скриптом позже — карточек, окон и т.д.)
     ========================================================= */
  var revealObserver = hasIO ? new IntersectionObserver(function (entries) {
    var batch = 0;
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      /* Элементы без собственной задержки (--stagger), появившиеся
         одновременно, показываем лёгким каскадом */
      if (!el.style.getPropertyValue('--stagger') && batch > 0) {
        el.style.transitionDelay = Math.min(batch, 5) * 90 + 'ms';
        window.setTimeout(function () { el.style.transitionDelay = ''; }, 1600);
      }
      batch++;
      el.classList.add('is-visible');
      revealObserver.unobserve(el);
    });
  }, { threshold: 0.01, rootMargin: '0px 0px -24px 0px' }) : null;

  /* Страница открыта через плавный переход: то, что уже на экране,
     показываем сразу — переход сам по себе и есть анимация появления */
  var arrivedViaTransition = root.classList.contains('vt-arrived');
  window.setTimeout(function () { arrivedViaTransition = false; }, 1200);

  function observeReveals(scope) {
    var vh = window.innerHeight;
    $$('[data-reveal]:not(.is-observed)', scope).forEach(function (el) {
      el.classList.add('is-observed');
      if (!revealObserver || reducedMotion()) { el.classList.add('is-visible'); return; }
      if (arrivedViaTransition && el.getBoundingClientRect().top < vh) {
        el.style.transition = 'none';
        el.classList.add('is-visible');
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { el.style.transition = ''; });
        });
        return;
      }
      revealObserver.observe(el);
    });
  }
  observeReveals(document);

  /* Мгновенно показать элементы, уже находящиеся на экране (без анимации) */
  function revealInViewNow() {
    var vh = window.innerHeight;
    $$('[data-reveal]:not(.is-visible)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top >= vh || r.bottom <= 0) return;
      if (revealObserver) revealObserver.unobserve(el);
      el.style.transition = 'none';
      el.classList.add('is-observed', 'is-visible');
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { el.style.transition = ''; });
      });
    });
  }

  /* =========================================================
     6. Анимированные счётчики (значение в HTML — итоговое,
        поэтому без JS и для поисковиков цифры корректны)
     ========================================================= */
  (function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length || reducedMotion() || !hasIO || root.classList.contains('vt-arrived')) return;

    function format(el, value) {
      var plain = el.hasAttribute('data-plain');
      var n = Math.round(value);
      return (plain ? String(n) : n.toLocaleString('ru-RU')) + (el.getAttribute('data-suffix') || '');
    }
    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var from = parseFloat(el.getAttribute('data-from') || '0');
      var duration = 1100;
      var start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 4);
        el.textContent = format(el, from + (target - from) * eased);
        if (p < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) {
      el.textContent = format(el, parseFloat(el.getAttribute('data-from') || '0'));
      io.observe(el);
    });
  })();

  /* =========================================================
     7. Плавное появление фото и авто-высота textarea
     ========================================================= */
  function fadeInImages(scope) {
    $$('img[data-fade]:not(.is-loaded)', scope).forEach(function (img) {
      function done() { img.classList.add('is-loaded'); }
      if (img.complete && img.naturalWidth > 0) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  }
  fadeInImages(document);

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
  document.addEventListener('input', function (e) {
    if (e.target.matches && e.target.matches('.field textarea')) autoGrow(e.target);
  });

  /* =========================================================
     8. Копирование, уведомления, «Поделиться»
     ========================================================= */
  var toastTimer = null;
  /* Уведомление. На iPhone оно появляется сверху и «вырастает» из пилюли
     по центру — в духе Dynamic Island (см. раздел 21 в style.css). */
  function showToast(message, isError) {
    var toast = $('#site-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'site-toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.innerHTML = '<span class="toast-dot" aria-hidden="true"></span><span class="toast-text"></span>';
      document.body.appendChild(toast);
    }
    var visible = toast.classList.contains('is-visible');
    toast.classList.toggle('is-error', !!isError);
    $('.toast-text', toast).textContent = message;
    if (!visible) window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
  }

  /* Копирование: современный Clipboard API, а если браузер его не даёт
     (старый браузер, http, запрет разрешения) — запасной способ */
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var tmp = document.createElement('textarea');
      tmp.value = text;
      tmp.setAttribute('readonly', '');
      tmp.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px';
      document.body.appendChild(tmp);
      tmp.select();
      tmp.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(tmp);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      copyText(copyBtn.getAttribute('data-copy'))
        .then(function () { showToast(copyBtn.getAttribute('data-copy-msg') || 'Скопировано'); })
        .catch(function () { showToast('Не удалось скопировать', true); });
      return;
    }
    var shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
      e.stopPropagation();
      var url = shareBtn.getAttribute('data-url') || window.location.href;
      var title = shareBtn.getAttribute('data-title') || document.title;
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      copyText(url).then(function () { showToast('Ссылка скопирована'); })
        .catch(function () { showToast('Не удалось скопировать ссылку', true); });
    }
  });

  /* =========================================================
     9. Модальные окна — один менеджер для всех окон сайта:
        блокировка прокрутки без «прыжка» страницы, focus-trap,
        закрытие по Esc / фону / крестику, анимация закрытия.
     ========================================================= */
  var Modal = (function () {
    var current = null;
    var lastFocus = null;

    function focusable(el) {
      return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])', el)
        .filter(function (n) { return n.offsetParent !== null; });
    }
    function lockScroll() {
      root.style.setProperty('--sbw', ((window.innerWidth - root.clientWidth) / pageZoom()) + 'px');
      root.classList.add('is-modal-open');
    }
    function unlockScroll() {
      root.classList.remove('is-modal-open');
      root.style.removeProperty('--sbw');
    }

    function open(overlay) {
      if (!overlay || current === overlay) return;
      if (current) close(true);
      lastFocus = document.activeElement;
      overlay.classList.remove('is-hiding');
      overlay.hidden = false;
      lockScroll();
      current = overlay;
      window.requestAnimationFrame(function () {
        var target = $('[data-autofocus]', overlay) || focusable(overlay)[0];
        if (target) target.focus({ preventScroll: true });
      });
    }

    function close(immediate) {
      if (!current) return;
      var overlay = current;
      current = null;
      function done() {
        overlay.hidden = true;
        overlay.classList.remove('is-hiding');
        unlockScroll();
        focusForKeyboard(lastFocus);
      }
      if (immediate === true || reducedMotion()) { done(); return; }
      overlay.classList.add('is-hiding');
      window.setTimeout(done, 240);
    }

    document.addEventListener('keydown', function (e) {
      if (!current) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var items = focusable(current);
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!current) return;
      if (e.target === current || e.target.closest('[data-modal-close]')) close();
    });

    return { open: open, close: close };
  })();

  /* =========================================================
     10. Формы: единые правила проверки для всех форм сайта.
         Поле подключается атрибутом data-validate="name|phone|email|message|consent".
     ========================================================= */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var VALIDATORS = {
    name: function (v, input) {
      if (!v) return input.required ? 'Введите имя' : '';
      return v.length < 2 ? 'Слишком короткое имя' : '';
    },
    phone: function (v, input) {
      var digits = phoneDigits(v);
      if (!digits) return input.required ? 'Введите номер телефона' : '';
      return digits.length === 10 ? '' : 'Введите номер полностью: +7 (XXX) XXX-XX-XX';
    },
    email: function (v, input) {
      if (!v) return input.required ? 'Введите email' : '';
      return EMAIL_RE.test(v) ? '' : 'Проверьте формат email';
    },
    message: function (v, input) {
      if (!v) return input.required ? 'Опишите, пожалуйста, ваш вопрос' : '';
      return v.length < 10 ? 'Опишите вопрос чуть подробнее' : '';
    },
    consent: function (v, input) {
      return input.checked ? '' : 'Необходимо согласие на обработку персональных данных';
    }
  };

  /* ---------- Телефон: «+7» подставляется сам, номер форматируется при вводе ---------- */
  /* 10 цифр номера без кода страны. Если в поле уже стоит «+7», берём
     цифры после него. Лишняя ведущая 8/7 (набрали «8 916…» целиком,
     вставили или подставил автозаполнитель) отбрасывается только когда
     цифр больше 10 — так коды городов вроде 812 вводятся корректно. */
  function phoneDigits(value) {
    var v = String(value || '').trim();
    var d = (v.indexOf('+7') === 0 ? v.slice(2) : v).replace(/\D/g, '');
    if (d.length > 10 && (d.charAt(0) === '8' || d.charAt(0) === '7')) d = d.slice(1);
    return d.slice(0, 10);
  }
  function formatPhone(d) {
    var out = '+7';
    if (!d.length) return out + ' ';
    out += ' (' + d.slice(0, 3);
    if (d.length >= 3) out += ')';
    if (d.length > 3) out += ' ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }
  function caretToEnd(input) {
    var n = input.value.length;
    try { input.setSelectionRange(n, n); } catch (e) { /* type=tel поддерживает, но на всякий случай */ }
  }
  document.addEventListener('focusin', function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('[data-validate="phone"]')) return;
    if (!input.value) input.value = '+7 ';
    input.setAttribute('data-prev', input.value);
    window.requestAnimationFrame(function () { caretToEnd(input); });
  });
  document.addEventListener('focusout', function (e) {
    var input = e.target;
    if (input.matches && input.matches('[data-validate="phone"]') && !phoneDigits(input.value)) input.value = '';
  }, true);
  document.addEventListener('input', function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('[data-validate="phone"]')) return;
    var digits = phoneDigits(input.value);
    var prevDigits = phoneDigits(input.getAttribute('data-prev') || '');
    /* Стёрли скобку/пробел/дефис — стираем и предыдущую цифру,
       иначе форматирование сразу вернуло бы удалённый символ */
    if (e.inputType && e.inputType.indexOf('delete') === 0 && digits === prevDigits && digits.length) {
      digits = digits.slice(0, -1);
    }
    input.value = formatPhone(digits);
    input.setAttribute('data-prev', input.value);
    caretToEnd(input);
  });

  function validateInput(input) {
    var rule = VALIDATORS[input.getAttribute('data-validate')];
    if (!rule) return true;
    var message = rule(input.value.trim(), input);
    var field = input.closest('.field');
    var errorEl = field ? $('.field-error', field) : null;
    if (errorEl) errorEl.textContent = message;
    if (field) field.classList.toggle('has-error', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    return !message;
  }

  function resetForm(form) {
    form.reset();
    form.classList.remove('is-sent', 'is-sending');
    $$('.field.has-error', form).forEach(function (f) { f.classList.remove('has-error'); });
    $$('.field-error', form).forEach(function (el) { el.textContent = ''; });
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    $$('textarea', form).forEach(autoGrow);
    var status = $('.form-status', form);
    if (status) { status.textContent = ''; status.className = 'form-status'; }
  }

  /**
   * Отправка заявки. Сейчас сайт статический — отправка имитируется.
   * Для подключения сервера достаточно заменить тело функции на
   *   return fetch('api/applications.php', { method: 'POST', body: data })
   *     .then(function (r) { if (!r.ok) throw new Error(r.status); });
   */
  function submitRequest(data) {
    return new Promise(function (resolve) { window.setTimeout(resolve, 800); });
  }

  /* Проверка при уходе из поля и «живая» переоценка уже ошибочного поля */
  document.addEventListener('focusout', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-validate') && e.target.value) validateInput(e.target);
  });
  document.addEventListener('input', function (e) {
    var input = e.target;
    if (!input.hasAttribute || !input.hasAttribute('data-validate')) return;
    var field = input.closest('.field');
    if (field && field.classList.contains('has-error')) validateInput(input);
  });
  document.addEventListener('change', function (e) {
    if (e.target.type === 'checkbox' && e.target.hasAttribute('data-validate')) validateInput(e.target);
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.classList.contains('is-sending')) return;

    var inputs = $$('[data-validate]', form);
    var firstInvalid = null;
    inputs.forEach(function (input) {
      if (!validateInput(input) && !firstInvalid) firstInvalid = input;
    });
    var status = $('.form-status', form);
    if (firstInvalid) {
      if (status) { status.textContent = 'Проверьте, пожалуйста, отмеченные поля.'; status.className = 'form-status is-error'; }
      firstInvalid.focus();
      return;
    }
    form.classList.add('is-sending');
    if (status) { status.textContent = ''; status.className = 'form-status'; }
    submitRequest(new FormData(form)).then(function () {
      form.classList.remove('is-sending');
      form.classList.add('is-sent');
      var successBtn = $('.form-success .btn', form);
      focusForKeyboard(successBtn);
    }).catch(function () {
      form.classList.remove('is-sending');
      if (status) { status.textContent = 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.'; status.className = 'form-status is-error'; }
    });
  });

  /* =========================================================
     11. Окно «Связаться» и окно «Оставить заявку»
         Разметка создаётся здесь один раз и доступна на любой странице.
     ========================================================= */
  function fieldsHtml(p, opts) {
    return (
      '<div class="form-fields">' +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label for="' + p + '-name">Имя *</label>' +
            '<input type="text" id="' + p + '-name" name="name" autocomplete="name" required data-validate="name" data-autofocus placeholder="Иван Иванов">' +
            '<span class="field-error" aria-live="polite"></span>' +
          '</div>' +
          '<div class="field">' +
            '<label for="' + p + '-phone">Телефон *</label>' +
            '<input type="tel" id="' + p + '-phone" name="phone" autocomplete="tel" inputmode="tel" required data-validate="phone" placeholder="+7 (___) ___-__-__">' +
            '<span class="field-error" aria-live="polite"></span>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="' + p + '-email">Email *</label>' +
          '<input type="email" id="' + p + '-email" name="email" autocomplete="email" required data-validate="email" placeholder="example@mail.ru">' +
          '<span class="field-error" aria-live="polite"></span>' +
        '</div>' +
        '<div class="field">' +
          '<label for="' + p + '-message">' + (opts.messageRequired ? 'Сообщение *' : 'Комментарий') + '</label>' +
          '<textarea id="' + p + '-message" name="message" rows="3" data-validate="message"' + (opts.messageRequired ? ' required' : '') +
            ' placeholder="' + escapeHtml(opts.messagePlaceholder) + '"></textarea>' +
          '<span class="field-error" aria-live="polite"></span>' +
        '</div>' +
        '<div class="field field-checkbox">' +
          '<label class="checkbox-label">' +
            '<input type="checkbox" name="consent" required data-validate="consent">' +
            '<span>Даю <a href="consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> на условиях <a href="privacy.html" target="_blank" rel="noopener">Политики</a></span>' +
          '</label>' +
          '<span class="field-error" aria-live="polite"></span>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-submit"><span class="btn-label">' + opts.submitLabel + '</span><span class="btn-spinner" aria-hidden="true"></span></button>' +
        '<p class="form-status" role="status" aria-live="polite"></p>' +
      '</div>' +
      '<div class="form-success" role="status" aria-live="polite">' +
        ICONS.check +
        '<h4>' + opts.successTitle + '</h4>' +
        '<p>Мы свяжемся с вами в течение рабочего дня.</p>' +
        '<button type="button" class="btn btn-ghost" data-modal-close>Закрыть</button>' +
      '</div>'
    );
  }

  function buildContactModal() {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal-overlay" id="contactModal" hidden>' +
        '<div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">' +
          '<button type="button" class="modal-close" data-modal-close aria-label="Закрыть">' + ICONS.close + '</button>' +
          '<div class="modal-grid">' +
            '<aside class="modal-aside">' +
              '<p class="eyebrow"><span class="rec" aria-hidden="true"></span>на связи ' + escapeHtml(SITE.hours) + '</p>' +
              '<h3 id="contactModalTitle">Свяжитесь с нами</h3>' +
              '<p class="modal-lead">Расскажите о задаче — подберём устройства и программное обеспечение под ваш проект.</p>' +
              '<dl class="modal-contacts">' +
                '<div><dt>Телефон</dt><dd><a href="' + SITE.phoneHref + '">' + escapeHtml(SITE.phone).replace(/ /g, '&nbsp;').replace(/-/g, '&#8209;') + '</a>' +
                  '<button type="button" class="icon-btn" data-copy="' + escapeHtml(SITE.phone) + '" data-copy-msg="Номер скопирован" aria-label="Скопировать номер">' + ICONS.copy + '</button></dd></div>' +
                '<div><dt>Почта</dt><dd><a href="mailto:' + escapeHtml(SITE.email) + '">' + escapeHtml(SITE.email) + '</a>' +
                  '<button type="button" class="icon-btn" data-copy="' + escapeHtml(SITE.email) + '" data-copy-msg="Email скопирован" aria-label="Скопировать email">' + ICONS.copy + '</button></dd></div>' +
                '<div><dt>Адрес</dt><dd>' + escapeHtml(SITE.address) + '</dd></div>' +
              '</dl>' +
            '</aside>' +
            '<form class="modal-form" data-form="contact" novalidate>' +
              '<input type="hidden" name="source" value="contact">' +
              fieldsHtml('cm', {
                messageRequired: true,
                messagePlaceholder: 'Например: нужна партия планшетов для выездных сотрудников',
                submitLabel: 'Отправить сообщение',
                successTitle: 'Сообщение отправлено'
              }) +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap.firstChild);
    return $('#contactModal');
  }

  function buildRequestModal() {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal-overlay" id="requestModal" hidden>' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="requestModalTitle">' +
          '<button type="button" class="modal-close" data-modal-close aria-label="Закрыть">' + ICONS.close + '</button>' +
          '<div class="modal-product" id="requestModalProduct"></div>' +
          '<h3 id="requestModalTitle">Оставить заявку</h3>' +
          '<form class="modal-form" data-form="request" novalidate>' +
            '<input type="hidden" name="source" value="request">' +
            '<input type="hidden" name="product_id" value="">' +
            fieldsHtml('rm', {
              messageRequired: false,
              messagePlaceholder: 'Количество, сроки, пожелания',
              submitLabel: 'Отправить заявку',
              successTitle: 'Заявка отправлена'
            }) +
          '</form>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap.firstChild);
    return $('#requestModal');
  }

  var contactModal = null;
  var requestModal = null;

  function openContactModal() {
    contactModal = contactModal || buildContactModal();
    resetForm($('form', contactModal));
    Modal.open(contactModal);
  }

  function openRequestModal(id) {
    var product = findProduct(id);
    if (!product) { if (id) window.location.href = productUrl(id); return; }
    requestModal = requestModal || buildRequestModal();
    var form = $('form', requestModal);
    resetForm(form);
    form.elements.product_id.value = product.id;
    $('#requestModalProduct').innerHTML =
      '<img src="' + escapeHtml(product.image) + '" alt="" width="64" height="64">' +
      '<div><span class="modal-product-cat">' + escapeHtml(product.categoryLabel) + '</span>' +
      '<span class="modal-product-name">' + escapeHtml(product.name) + '</span></div>';
    Modal.open(requestModal);
  }

  document.addEventListener('click', function (e) {
    var contactLink = e.target.closest('[data-contact-open]');
    if (contactLink) {
      /* Ctrl/Cmd+клик — пусть открывается ссылка в новой вкладке */
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      openContactModal();
      return;
    }
    var requestBtn = e.target.closest('[data-request]');
    if (requestBtn) {
      e.preventDefault();
      e.stopPropagation();
      openRequestModal(requestBtn.getAttribute('data-request'));
    }
  });

  /* =========================================================
     11а. «Контакты» в меню: плавная прокрутка к блоку контактов
          главной. С других страниц — переход на главную, а прокрутка
          выполняется уже там (без резкого «прыжка» по якорю).
     ========================================================= */
  var contactsNav = (function initContactsNav() {
    var KEY = 'scrollToContacts';
    var section = $('#contacts');

    function highlight() {
      var panel = section && $('.cta-panel', section);
      if (!panel) return;
      panel.classList.remove('is-highlight');
      void panel.offsetWidth;
      panel.classList.add('is-highlight');
    }
    function scrollToContacts(smooth) {
      section.scrollIntoView({ behavior: smooth && !reducedMotion() ? 'smooth' : 'auto', block: 'start' });
      if (window.location.hash !== '#contacts') window.history.replaceState(null, '', '#contacts');
      window.setTimeout(highlight, smooth ? 550 : 0);
    }

    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-scroll-contacts]');
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      if (section) { scrollToContacts(true); return; }
      try { sessionStorage.setItem(KEY, '1'); } catch (err) { /* не критично */ }
      window.location.href = 'index.html';
    });

    if (!section) return { consumePending: function () {} };

    /* Пришли с другой страницы по «Контакты»: страница открывается сразу
       на блоке контактов — прокрутка выполняется ДО первой отрисовки
       (скрипт блокирует отрисовку), поэтому плавный переход показывает
       сразу нужное место, без рывка и «перезагрузки» после него.
       Вызывается в самом конце скрипта, когда вся страница уже собрана. */
    function consumePending() {
      var pending = false;
      try { pending = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch (err) { /* нет */ }
      if (!pending) {
        if (window.location.hash === '#contacts') window.setTimeout(highlight, 300);
        return;
      }
      root.style.scrollBehavior = 'auto';
      section.scrollIntoView({ block: 'start', behavior: 'auto' });
      root.style.scrollBehavior = '';
      window.history.replaceState(null, '', '#contacts');
      revealInViewNow();
      window.setTimeout(highlight, root.classList.contains('vt-arrived') ? 750 : 250);
    }

    /* Подсветка пункта меню, пока блок контактов на экране */
    if (hasIO) {
      var navHome = $$('.nav-links a[href="index.html"]');
      var navContacts = $$('.nav-links [data-scroll-contacts]');
      new IntersectionObserver(function (entries) {
        var on = entries[0].isIntersecting;
        navContacts.forEach(function (a) { a.classList.toggle('is-active', on); });
        navHome.forEach(function (a) { a.classList.toggle('is-active', !on); });
      }, { rootMargin: '-35% 0px -35% 0px' }).observe(section);
    }
    return { consumePending: consumePending };
  })();

  /* =========================================================
     12. Каталог: карточки, превью на главной, фильтры, «недавно смотрели»
     ========================================================= */
  function productCardHtml(p, index, instant) {
    var name = escapeHtml(p.name);
    var visible = instant ? ' is-observed is-visible' : '';
    return (
      '<div class="product-card' + visible + '" data-id="' + p.id + '" data-reveal style="--stagger:' + (index % 6) + '" ' +
        'role="link" tabindex="0" aria-label="' + name + ' — подробнее о товаре">' +
        '<div class="card-image"><img src="' + escapeHtml(p.image) + '" alt="' + name + '" loading="lazy" decoding="async" width="256" height="256" data-fade' + (instant ? ' class="is-loaded"' : '') + '></div>' +
        '<div class="card-body">' +
          '<span class="card-category">' + escapeHtml(p.categoryLabel || p.category) + '</span>' +
          '<h3>' + name + '</h3>' +
          '<p>' + escapeHtml(p.shortDesc) + '</p>' +
          '<div class="card-actions">' +
            '<button type="button" class="btn-request" data-request="' + p.id + '">Оставить заявку</button>' +
            '<button type="button" class="share-btn" data-url="' + escapeHtml(absoluteUrl(productUrl(p.id))) + '" data-title="' + name + '" aria-label="Поделиться товаром «' + name + '»">' + ICONS.share + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderCards(container, items, instant) {
    container.innerHTML = items.length
      ? items.map(function (p, i) { return productCardHtml(p, i, instant); }).join('')
      : '<p class="empty-note">Нет продуктов в этой категории.</p>';
    observeReveals(container);
    fadeInImages(container);
  }

  /* Переход по карточке: клик в любое место, кроме кнопок; Enter/Space с клавиатуры */
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.product-card');
    if (!card || e.target.closest('button, a')) return;
    window.location.href = productUrl(card.getAttribute('data-id'));
  });
  document.addEventListener('keydown', function (e) {
    var card = e.target;
    if (!card.classList || !card.classList.contains('product-card')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = productUrl(card.getAttribute('data-id'));
    }
  });

  function productsByIds(ids) {
    return (ids || []).map(findProduct).filter(Boolean);
  }

  /* Превью каталога на главной */
  var featuredGrid = $('#featured-grid');
  if (hasCatalog && featuredGrid) {
    renderCards(featuredGrid, productsByIds(typeof FEATURED_PRODUCT_IDS !== 'undefined' ? FEATURED_PRODUCT_IDS : [1, 2, 3]));
  }

  /* Полный каталог с фильтрами */
  (function initCatalog() {
    var grid = $('#product-grid');
    var filterBar = $('#filter-bar');
    if (!hasCatalog || !grid || !filterBar) return;

    var param = new URLSearchParams(window.location.search).get('category');
    var current = categoryOf(param) ? param : 'all';

    filterBar.innerHTML = PRODUCT_CATEGORIES.map(function (c) {
      var active = c.id === current;
      var count = c.id === 'all' ? PRODUCTS.length : PRODUCTS.filter(function (p) { return p.category === c.id; }).length;
      return '<button type="button" class="filter-btn' + (active ? ' active' : '') + '" data-filter="' + escapeHtml(c.id) + '" aria-pressed="' + active + '">' +
        escapeHtml(c.label) + '<span class="filter-count">' + count + '</span></button>';
    }).join('');

    function itemsFor(filter) {
      return filter === 'all' ? PRODUCTS : PRODUCTS.filter(function (p) { return p.category === filter; });
    }

    /* Имена для View Transitions ставим только на время перехода: иначе
       карточки «выпадали» бы из кругового перехода темы */
    function nameCards(on) {
      $$('.product-card', grid).forEach(function (card) {
        card.style.viewTransitionName = on ? 'card-' + card.getAttribute('data-id') : '';
      });
    }

    function applyFilter(filter) {
      if (filter === current) return;
      current = filter;
      $$('.filter-btn', filterBar).forEach(function (b) {
        var on = b.getAttribute('data-filter') === filter;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      var url = new URL(window.location.href);
      if (filter === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', filter);
      window.history.replaceState(null, '', url);

      if (reducedMotion() || typeof document.startViewTransition !== 'function') {
        renderCards(grid, itemsFor(filter), true);
        return;
      }
      nameCards(true);
      root.classList.add('vt-filter');
      var t = document.startViewTransition(function () {
        renderCards(grid, itemsFor(filter), true);
        nameCards(true);
      });
      t.finished.finally(function () { nameCards(false); root.classList.remove('vt-filter'); });
    }

    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (btn) applyFilter(btn.getAttribute('data-filter'));
    });

    renderCards(grid, itemsFor(current));
  })();

  /* «Вы недавно смотрели» (страница каталога) */
  (function renderRecentlyViewed() {
    var box = $('#recently-viewed');
    if (!box || !hasCatalog) return;
    var items = productsByIds(store.getJson('recentlyViewed', []));
    if (!items.length) return;
    box.innerHTML =
      '<div class="recent-head"><h3>Вы недавно смотрели</h3>' +
        '<button type="button" class="recent-clear" aria-label="Очистить список недавно просмотренных товаров">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '<span>Очистить</span></button>' +
      '</div>' +
      '<div class="recent-strip">' +
        items.map(function (p, i) {
          return '<a class="recent-card" href="' + productUrl(p.id) + '" style="--i:' + i + '">' +
            '<span class="recent-card-image"><img src="' + escapeHtml(p.image) + '" alt="" loading="lazy" decoding="async" width="96" height="96"></span>' +
            '<span class="recent-card-name">' + escapeHtml(p.name) + '</span>' +
          '</a>';
        }).join('') +
      '</div>';

    /* Очистка в два шага: карточки по очереди растворяются, затем блок
       мягко сворачивается по высоте — содержимое ниже поднимается плавно */
    $('.recent-clear', box).addEventListener('click', function () {
      try { localStorage.removeItem('recentlyViewed'); } catch (e) { /* не критично */ }
      showToast('История просмотров очищена');
      var focusTarget = $('.filter-btn.active') || $('.filter-btn');
      focusForKeyboard(focusTarget);
      function done() {
        box.innerHTML = '';
        box.classList.remove('is-clearing', 'is-collapsing');
        box.style.height = '';
      }
      if (reducedMotion()) { done(); return; }
      var cards = $$('.recent-card', box).length;
      box.classList.add('is-clearing');
      window.setTimeout(function () {
        box.style.height = box.offsetHeight + 'px';
        void box.offsetHeight;
        box.classList.add('is-collapsing');
        box.style.height = '0px';
        window.setTimeout(done, 520);
      }, 300 + cards * 45);
    });
  })();

  /* =========================================================
     13. Страница товара
     ========================================================= */
  (function initProductPage() {
    var box = $('#product-content');
    if (!hasCatalog || !box) return;
    var product = findProduct(new URLSearchParams(window.location.search).get('id'));

    if (!product) {
      box.innerHTML =
        '<div class="empty-note">' +
          '<h2>Товар не найден</h2>' +
          '<p>Возможно, вы перешли по неверной ссылке.</p>' +
          '<a href="products.html" class="detail-back">← Вернуться к каталогу</a>' +
        '</div>';
      return;
    }

    var recent = store.getJson('recentlyViewed', []).filter(function (id) { return id !== product.id; });
    recent.unshift(product.id);
    store.set('recentlyViewed', JSON.stringify(recent.slice(0, 6)));

    var name = escapeHtml(product.name);
    var category = escapeHtml(product.categoryLabel || product.category);
    var pageUrl = absoluteUrl(productUrl(product.id));

    document.title = product.name + ' — Райтибор';
    [['#canonical-link', 'href', pageUrl], ['#meta-description', 'content', product.shortDesc],
     ['#og-title', 'content', product.name + ' — Райтибор'], ['#og-description', 'content', product.shortDesc],
     ['#og-url', 'content', pageUrl]].forEach(function (m) {
      var el = $(m[0]);
      if (el) el.setAttribute(m[1], m[2]);
    });

    /* Структурированные данные schema.org/Product для расширенных сниппетов */
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.shortDesc,
      category: product.categoryLabel || product.category,
      image: absoluteUrl(product.image),
      brand: { '@type': 'Brand', name: 'Райтибор' },
      url: pageUrl
    });
    document.head.appendChild(ld);

    var specs = Array.isArray(product.specs) ? product.specs : [];
    /* Галерея — список путей к фото; поддерживается и формат { src } */
    var gallery = (Array.isArray(product.gallery) ? product.gallery : []).map(function (g) { return typeof g === 'string' ? g : g.src; }).filter(Boolean);
    var features = Array.isArray(product.features) ? product.features : [];

    /* Похожие товары: сначала та же категория, затем остальные */
    var related = PRODUCTS.filter(function (p) { return p.id !== product.id && p.category === product.category; })
      .concat(PRODUCTS.filter(function (p) { return p.id !== product.id && p.category !== product.category; }))
      .slice(0, 3);

    box.innerHTML =
      '<div class="detail-top">' +
      '<a href="products.html" class="back-link" data-back>' +
        '<span class="back-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg></span>' +
        '<span>Назад</span>' +
      '</a>' +
      '<nav class="breadcrumbs" aria-label="Хлебные крошки">' +
        '<a href="index.html">Главная</a><span class="crumb-sep" aria-hidden="true">/</span>' +
        '<a href="products.html">Продукты</a><span class="crumb-sep" aria-hidden="true">/</span>' +
        '<a href="products.html?category=' + encodeURIComponent(product.category) + '">' + category + '</a><span class="crumb-sep" aria-hidden="true">/</span>' +
        '<span class="crumb-current" aria-current="page">' + name + '</span>' +
      '</nav>' +
      '</div>' +
      '<div class="detail-container">' +
        '<div class="detail-media" data-reveal>' +
          '<div class="detail-image"><img id="detail-main-img" src="' + escapeHtml(product.image) + '" alt="' + name + '" decoding="async" data-fade></div>' +
          (gallery.length > 1
            ? '<div class="detail-thumbs" role="group" aria-label="Фотографии товара">' + gallery.map(function (src, i) {
                return '<button type="button" class="detail-thumb' + (i === 0 ? ' is-active' : '') + '" data-src="' + escapeHtml(src) + '" aria-pressed="' + (i === 0) + '" aria-label="Фото ' + (i + 1) + ' из ' + gallery.length + '">' +
                  '<img src="' + escapeHtml(src) + '" alt="" loading="lazy" decoding="async"></button>';
              }).join('') + '</div>'
            : '') +
        '</div>' +
        '<div class="detail-info" data-reveal style="--stagger:1">' +
          '<span class="detail-category">' + category + '</span>' +
          '<h1>' + name + '</h1>' +
          '<p class="detail-desc">' + escapeHtml(product.fullDesc) + '</p>' +
          '<div class="detail-actions">' +
            '<button type="button" class="btn btn-primary" data-request="' + product.id + '">Оставить заявку</button>' +
            '<button type="button" class="share-btn share-btn--labeled" data-url="' + escapeHtml(pageUrl) + '" data-title="' + name + '">' + ICONS.share + '<span>Поделиться</span></button>' +
            (product.datasheet
              ? '<a class="share-btn share-btn--labeled" href="' + escapeHtml(product.datasheet) + '" download>' + ICONS.download + '<span>Описание, PDF</span></a>'
              : '') +
          '</div>' +
          (specs.length
            ? '<h2 class="detail-subhead">Характеристики</h2><dl class="detail-specs">' + specs.map(function (s) {
                return '<div class="spec-row"><dt>' + escapeHtml(s.label) + '</dt><dd>' + escapeHtml(s.value) + '</dd></div>';
              }).join('') + '</dl>'
            : '') +
          (features.length
            ? '<h2 class="detail-subhead">Особенности</h2><ul class="detail-features">' + features.map(function (f) {
                return '<li>' + escapeHtml(f) + '</li>';
              }).join('') + '</ul>'
            : '') +
        '</div>' +
      '</div>' +
      (related.length
        ? '<section class="related" aria-labelledby="related-title"><div class="section-head"><h2 id="related-title">Похожие товары</h2>' +
            '<a href="products.html" class="link-more">Весь каталог →</a></div><div class="product-grid" id="related-grid"></div></section>'
        : '');

    /* Галерея ракурсов: плавная смена главного фото, стрелки на клавиатуре */
    var thumbs = $$('.detail-thumb', box);
    var mainImg = $('#detail-main-img');
    if (thumbs.length && mainImg) {
      thumbs.forEach(function (t) { var im = new Image(); im.src = t.getAttribute('data-src'); }); // заранее в кэш
      var select = function (btn) {
        if (btn.classList.contains('is-active')) return;
        thumbs.forEach(function (t) {
          var on = t === btn;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-pressed', String(on));
        });
        var src = btn.getAttribute('data-src');
        if (reducedMotion()) { mainImg.src = src; return; }
        mainImg.classList.add('is-swapping');
        window.setTimeout(function () {
          mainImg.src = src;
          var show = function () { mainImg.classList.remove('is-swapping'); };
          if (mainImg.decode) mainImg.decode().then(show, show); else show();
        }, 180);
      };
      $('.detail-thumbs', box).addEventListener('click', function (e) {
        var btn = e.target.closest('.detail-thumb');
        if (btn) select(btn);
      });
      $('.detail-thumbs', box).addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var i = thumbs.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        var next = thumbs[(i + (e.key === 'ArrowRight' ? 1 : -1) + thumbs.length) % thumbs.length];
        next.focus();
        select(next);
      });
    }

    var relatedGrid = $('#related-grid');
    if (relatedGrid) renderCards(relatedGrid, related);
    observeReveals(box);
    fadeInImages(box);
  })();

  document.addEventListener('click', function (e) {
    var back = e.target.closest('[data-back]');
    if (!back || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var fromSite = false;
    try { fromSite = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch (err) { /* нет */ }
    if (fromSite && window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  });

  /* =========================================================
     14. Витрина-«видоискатель» на главной: камера по очереди
         «распознаёт» устройства компании
     ========================================================= */
  (function initHeroVisual() {
    var visual = $('#hero-visual');
    if (!visual || !hasCatalog) return;
    var panel = $('.hv-panel', visual);
    var stage = $('#hv-stage');
    var caption = $('#hv-caption');
    var dots = $('#hv-dots');
    var camEl = $('#hv-cam');
    var items = productsByIds(typeof HERO_SHOWCASE_IDS !== 'undefined' ? HERO_SHOWCASE_IDS : [1, 3, 6]);
    if (!items.length) return;

    /* Длительность показа — из CSS (--hv-interval), чтобы смена слайда,
       полоса прогресса и сканирующая линия шли строго в одном такте */
    var INTERVAL = (parseFloat(getComputedStyle(visual).getPropertyValue('--hv-interval')) || 3.8) * 1000;
    var index = 0;
    var timer = null;
    var inView = true;
    var hovered = false;

    function confidence(p) { return 94 + (p.id * 7) % 6; } // стабильное «правдоподобное» значение

    /* Режим «камеры» для подписи в углу — из характеристик устройства:
       разрешение (4K / 2K / 1080p), мегапиксели матрицы или тип связи */
    function camMode(p) {
      var specs = Array.isArray(p.specs) ? p.specs : [];
      var text = specs.map(function (sp) { return sp.value; }).join(' | ');
      var res = text.match(/(\d{3,4})\s*[×x]\s*(\d{3,4})/);
      if (res) {
        var h = Math.min(+res[1], +res[2]);
        return h >= 2160 ? '4K' : h >= 1296 ? '2K' : h >= 1080 ? '1080p' : h + 'p';
      }
      var mp = text.match(/(\d+)\s*Мп/);
      if (mp) return mp[1] + ' Мп';
      if (/LTE/.test(text)) return 'LTE';
      return 'HD';
    }
    stage.innerHTML = items.map(function (p, i) {
      var cat = categoryOf(p.category);
      return '<a class="hv-slide' + (i === 0 ? ' is-active' : '') + '" href="' + productUrl(p.id) + '" tabindex="' + (i === 0 ? '0' : '-1') + '" aria-label="' + escapeHtml(p.name) + ' — подробнее">' +
        '<span class="hv-obj">' +
          '<img src="' + escapeHtml(p.image) + '" alt="" decoding="async"' + (i === 0 ? '' : ' loading="lazy"') + '>' +
          '<span class="hv-box" aria-hidden="true"><span class="hv-tag">' + escapeHtml(cat && cat.tag ? cat.tag : p.categoryLabel) + ' · ' + confidence(p) + '%</span></span>' +
        '</span>' +
      '</a>';
    }).join('');
    dots.innerHTML = items.map(function (p, i) {
      return '<button type="button" class="hv-dot' + (i === 0 ? ' is-active' : '') + '" aria-pressed="' + (i === 0) + '" aria-label="Показать: ' + escapeHtml(p.name) + '"><span></span></button>';
    }).join('');
    var slides = $$('.hv-slide', stage);
    var dotEls = $$('.hv-dot', dots);

    function show(i) {
      index = (i + items.length) % items.length;
      var p = items[index];
      slides.forEach(function (s, n) {
        var on = n === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('tabindex', on ? '0' : '-1');
      });
      dotEls.forEach(function (d, n) {
        d.classList.toggle('is-active', n === index);
        d.setAttribute('aria-pressed', String(n === index));
      });
      caption.classList.remove('is-swapping');
      void caption.offsetWidth; // перезапуск анимации подписи
      caption.innerHTML = '<span class="hv-caption-cat">' + escapeHtml(p.categoryLabel) + '</span>' +
        '<span class="hv-caption-name">' + escapeHtml(p.name) + '</span>';
      caption.classList.add('is-swapping');
      if (camEl) {
        camEl.textContent = 'CAM-' + (index + 1 < 10 ? '0' : '') + (index + 1) + ' · ' + camMode(p);
        camEl.classList.remove('is-swapping');
        void camEl.offsetWidth;
        camEl.classList.add('is-swapping');
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      visual.classList.remove('is-playing');
      if (reducedMotion() || !inView || hovered || document.hidden) return;
      void visual.offsetWidth;
      visual.classList.add('is-playing'); // полоска прогресса у активной точки
      timer = window.setTimeout(function () { show(index + 1); schedule(); }, INTERVAL);
    }

    dots.addEventListener('click', function (e) {
      var d = e.target.closest('.hv-dot');
      if (!d) return;
      show(dotEls.indexOf(d));
      schedule();
    });
    visual.addEventListener('pointerenter', function () { hovered = true; schedule(); });
    visual.addEventListener('pointerleave', function () { hovered = false; schedule(); });
    visual.addEventListener('focusin', function () { hovered = true; schedule(); });
    visual.addEventListener('focusout', function () { hovered = false; schedule(); });
    document.addEventListener('visibilitychange', schedule);

    /* Стрелки влево/вправо на переключателях */
    dots.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      show(index + (e.key === 'ArrowRight' ? 1 : -1));
      dotEls[index].focus();
      schedule();
    });

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        visual.classList.toggle('is-paused', !inView);
        schedule();
      }, { threshold: 0.15 }).observe(visual);
    } else {
      schedule();
    }

    /* Объёмный наклон панели под курсором + параллакс фото и блик.
       3D-трансформация есть только пока курсор над панелью; после ухода
       панель плавно возвращается и трансформация снимается полностью —
       в покое текст растеризуется без «мыла». */
    if (finePointer && !reducedMotion()) {
      /* Наклон/параллакс (--tx/--ty) и положение блика (--gx/--gy) — разные
         переменные: при уходе курсора наклон плавно возвращается к нулю,
         а блик гаснет там же, где был, не «прыгая» в центр (раньше из-за
         этого при резком уходе курсора панель мигала). */
      var hovering = false;
      var apply = rafThrottle(function (x, y) {
        if (!hovering) return; // запоздалый кадр после ухода курсора не применяем
        panel.style.setProperty('--tx', x.toFixed(3));
        panel.style.setProperty('--ty', y.toFixed(3));
        panel.style.setProperty('--gx', x.toFixed(3));
        panel.style.setProperty('--gy', y.toFixed(3));
      });
      function pointerPos(e) {
        var r = panel.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
      }
      visual.addEventListener('pointerenter', function (e) {
        hovering = true;
        /* блик сразу ставим под курсор, до того как он проявится */
        var p = pointerPos(e);
        panel.style.setProperty('--gx', p[0].toFixed(3));
        panel.style.setProperty('--gy', p[1].toFixed(3));
        panel.classList.add('is-tilting');
      });
      visual.addEventListener('pointermove', function (e) {
        var p = pointerPos(e);
        apply(p[0], p[1]);
      });
      visual.addEventListener('pointerleave', function () {
        hovering = false;
        panel.classList.remove('is-tilting');
        panel.style.setProperty('--tx', '0');
        panel.style.setProperty('--ty', '0');
      });
    }
  })();

  /* =========================================================
     15. Эффекты под курсором (только устройства с мышью)
     ========================================================= */

  /* «Прожектор» в фоне hero следует за курсором */
  (function initHeroSpotlight() {
    var hero = $('#top');
    if (!hero || !finePointer || reducedMotion()) return;
    var move = rafThrottle(function (x, y) {
      var r = hero.getBoundingClientRect();
      if (!r.height) return;
      hero.style.setProperty('--mx', Math.max(-10, Math.min(110, (x - r.left) / r.width * 100)) + '%');
      hero.style.setProperty('--my', Math.max(-10, Math.min(110, (y - r.top) / r.height * 100)) + '%');
    });
    hero.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
  })();

  /* «Магнитные» основные кнопки — делегировано, работает и для кнопок в окнах */
  (function initMagnetic() {
    if (!finePointer || reducedMotion()) return;
    var PULL = 8;
    document.addEventListener('pointermove', rafThrottle(function (e) {
      var btn = e.target.closest && e.target.closest('.btn-primary');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      btn.style.setProperty('--bx', (((e.clientX - r.left) / r.width - 0.5) * PULL).toFixed(1) + 'px');
      btn.style.setProperty('--by', (((e.clientY - r.top) / r.height - 0.5) * PULL).toFixed(1) + 'px');
    }), { passive: true });
    document.addEventListener('pointerout', function (e) {
      var btn = e.target.closest && e.target.closest('.btn-primary');
      if (btn && !btn.contains(e.relatedTarget)) {
        btn.style.removeProperty('--bx');
        btn.style.removeProperty('--by');
      }
    });
  })();

  /* «Волна» от точки клика на кнопках */
  (function initRipple() {
    if (reducedMotion()) return;
    document.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.btn, .filter-btn, .btn-request');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      var z = pageZoom();
      var size = Math.max(r.width, r.height) * 2 / z;
      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + ((e.clientX - r.left) / z - size / 2) + 'px;top:' + ((e.clientY - r.top) / z - size / 2) + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', function () { ripple.remove(); });
    });
  })();

  /* Лёгкий 3D-наклон карточек товаров */
  (function initCardTilt() {
    if (!finePointer || reducedMotion()) return;
    var MAX = 3.5; // максимальный угол наклона карточки, градусы
    var active = null;
    function reset(card) {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    }
    document.addEventListener('pointermove', rafThrottle(function (e) {
      var card = e.target.closest && e.target.closest('.product-card');
      if (active && active !== card) { reset(active); active = null; }
      if (!card) return;
      active = card;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * MAX * 2).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * MAX * 2).toFixed(2) + 'deg');
    }), { passive: true });
    document.addEventListener('pointerleave', function () { if (active) { reset(active); active = null; } });
  })();

  /* Последний шаг: страница собрана — можно прокрутить к контактам */
  contactsNav.consumePending();

})();
