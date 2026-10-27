(function () {
  'use strict';
  var APP_VERSION = '4.2';
  var P = window.PLAN, COURSES = window.COURSES;
  var DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var DOWF = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var CATS = [['eng', 'Английский'], ['rus', 'Русский'], ['code', 'Код'], ['ai', 'ИИ'], ['poem', 'Стихи'], ['read', 'Чтение'], ['music', 'Музыка'], ['book', 'Книга'], ['plan', 'Итоги недели']];
  var MODES = [['free', 'Свободный'], ['shift', 'Смена'], ['light', 'Лёгкий']];
  var XP_LEVEL = 500;
  var CLAUDE_URL = 'https://claude.ai/new';

  var I = {
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 4.5-9 4.5-9-4.5z"/><path d="M6.5 10.5V15c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  // ---------- утилиты ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) { var a = s.split('-'); return new Date(+a[0], a[1] - 1, +a[2]); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var START = parse(P.start), N = P.weeks.length * 7;
  function dateOf(i) { var d = new Date(START); d.setDate(d.getDate() + i); return d; }
  function keyOf(i) { return isoOf(dateOf(i)); }
  function rawToday() { var t = new Date(); return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - START) / 864e5); }
  function clamp(i) { return Math.max(0, Math.min(N - 1, i)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? b : c; }
  function fmt(min) { var h = Math.floor(min / 60), m = min % 60; if (!h) return m + ' мин'; return h + ' ч' + (m ? ' ' + m + ' мин' : ''); }
  function fmtShort(min) { var h = Math.floor(min / 60), m = min % 60; if (!h) return m + ' мин'; return h + ' ч' + (m ? ' ' + m : ''); }
  function num(v) { v = parseInt(v, 10); return isNaN(v) || v < 0 ? 0 : v; }
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:«»"']/g, ' ').replace(/\s+/g, ' ').trim(); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function course(id) { for (var i = 0; i < COURSES.length; i++) if (COURSES[i].id === id) return COURSES[i]; return null; }

  // ---------- хранение ----------
  var KEY = 'dnevnik-state', BACKUP_KEY = 'dnevnik-state-backup';
  var storageProblem = '', storageReadOnly = false, recoveryNotice = '';
  var st = {};
  function fixState() {
    ['modes', 'checks', 'lessons', 'exams', 'counters', 'books', 'reflect', 'extraTasks', 'practice'].forEach(function (k) { if (!st[k] || typeof st[k] !== 'object' || Array.isArray(st[k])) st[k] = {}; });
    ['booksAdded', 'tracks'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
  }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function safeTree(o,depth) {
    if(depth>40)return false;
    return !o || typeof o!=='object' || Object.keys(o).every(function(k){return ['__proto__','prototype','constructor'].indexOf(k)<0 && k.indexOf('\u001f')<0 && safeTree(o[k],depth+1);});
  }
  function validCount(n) { return Number.isInteger(n) && n >= 0; }
  function validAttempt(a) {return plain(a) && typeof a.d==='string' && validCount(a.n) && a.n>0 && validCount(a.ok) && a.ok<=a.n && (a.at==null || Number.isFinite(a.at));}
  function validExam(e) {
    return plain(e) && validCount(e.n) && e.n>0 && validCount(e.best) && e.best<=e.n && (e.last==null || validCount(e.last) && e.last<=e.n) &&
      (e.passed==null || typeof e.passed==='boolean') && Array.isArray(e.wrong) && e.wrong.every(function(w) {return plain(w) && ['q','your','right','s'].every(function(k){return typeof w[k]==='string';});}) &&
      (e.attempts==null || Array.isArray(e.attempts) && e.attempts.every(validAttempt)) &&
      (e.weak==null || Array.isArray(e.weak) && e.weak.every(function(w){return typeof w==='string';})) &&
      (e.by==null || plain(e.by) && Object.keys(e.by).every(function(k){var b=e.by[k];return Array.isArray(b) && b.length===2 && validCount(b[0]) && validCount(b[1]) && b[1]>0 && b[0]<=b[1];}));
  }
  function validState(o) {
    if (!plain(o) || !plain(o.checks) || !safeTree(o,0)) return false;
    return ['modes','lessons','exams','counters','books','reflect','extraTasks','practice'].every(function (k) { return o[k] == null || plain(o[k]); }) &&
      ['booksAdded','tracks'].every(function (k) { return o[k] == null || Array.isArray(o[k]); }) &&
      (o.tracks || []).every(function(t) {return plain(t) && typeof t.name === 'string' && Number.isInteger(t.stage) && t.stage >= 0 && t.stage <= 5;}) &&
      (o.booksAdded || []).every(function(b) {return plain(b) && typeof b.id === 'string' && typeof b.t === 'string';}) &&
      Object.keys(o.reflect || {}).every(function(k) {return plain(o.reflect[k]) && Object.keys(o.reflect[k]).every(function(f) {return typeof o.reflect[k][f] === 'string';});}) &&
      Object.keys(o.counters || {}).every(function(k) {return plain(o.counters[k]);}) &&
      Object.keys(o.books || {}).every(function(k) {return plain(o.books[k]);}) &&
      Object.keys(o.lessons || {}).every(function(k) {return typeof o.lessons[k] === 'string';}) &&
      Object.keys(o.practice || {}).every(function(k) {var p=o.practice[k];return plain(p) && validCount(p.n) && p.n>0 && validCount(p.last) && p.last<=p.n && Array.isArray(p.wrong) && p.wrong.every(function(i){return validCount(i) && i<p.n;}) && (p.attempts==null || Array.isArray(p.attempts) && p.attempts.every(validAttempt));}) &&
      Object.keys(o.checks).every(function (k) { return plain(o.checks[k]); }) &&
      Object.keys(o.exams || {}).every(function (k) { return validExam(o.exams[k]); }) &&
      Object.keys(o.extraTasks || {}).every(function (k) { return Array.isArray(o.extraTasks[k]) && o.extraTasks[k].every(function(t) {return plain(t) && typeof t.id==='string' && typeof t.t==='string' && Number.isFinite(t.min) && t.min>=0;}); }) &&
      (o.backupAt==null || typeof o.backupAt==='string');
  }
  function readState(raw) { try { var o = JSON.parse(raw); return validState(o) ? o : null; } catch (e) { return null; } }
  function load() {
    try {
      var raw = localStorage.getItem(KEY), old = raw ? readState(raw) : null;
      if (old) st = old;
      else {
        var backup = readState(localStorage.getItem(BACKUP_KEY));
        if (backup) { st = backup; recoveryNotice = 'Прогресс восстановлен из резервного снимка.'; localStorage.setItem(KEY, JSON.stringify(st)); }
        else if (raw) { storageReadOnly = true; storageProblem = 'Файл прогресса повреждён. Оригинал сохранён. Восстанови свою копию в разделе «Мой рост».'; }
      }
    } catch (e) { storageProblem = 'Хранилище недоступно. Изменения не сохранены: сохрани копию в файл.'; }
    fixState();
  }
  function persist() {
    if (storageReadOnly) return false;
    try {
      var before = localStorage.getItem(KEY), next = JSON.stringify(st);
      if (before && before !== next && readState(before)) localStorage.setItem(BACKUP_KEY, before);
      localStorage.setItem(KEY, next); storageProblem = ''; return true;
    } catch (e) { storageProblem = 'Изменения не сохранены. Память браузера недоступна или заполнена. Сохрани прогресс в файл.'; return false; }
  }
  function save() { if (!persist()) toast('Не получилось сохранить'); schedSync(); }

  // ---------- курсы ----------
  function hasProgress() { return Object.keys(st.lessons).length > 0 || Object.keys(st.exams).length > 0 || Object.keys(st.checks).some(function (k) { return Object.keys(st.checks[k] || {}).length > 0; }); }
  function backupDays() { if (!st.backupAt) return null; var t = new Date(); return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - parse(st.backupAt)) / 864e5); }
  function lessonNo(c, idx) { var n = 0; for (var i = 0; i <= idx; i++) if (!c.steps[i].exam) n++; return n; }
  function stepDone(s) { return s.exam ? !!(st.exams[s.id] && st.exams[s.id].passed) : !!st.lessons[s.id]; }
  function stepState(c, idx) {
    var s = c.steps[idx];
    for (var i = 0; i < idx; i++) if (c.steps[i].exam && !stepDone(c.steps[i])) return stepDone(s) ? 'done' : 'locked';
    if (stepDone(s)) return 'done';
    if (s.exam) { for (var k = 0; k < s.covers.length; k++) if (!st.lessons[s.covers[k]]) return 'wait'; }
    return 'open';
  }
  function nextIdx(c) {
    var i; for (i = 0; i < c.steps.length; i++) if (stepState(c, i) === 'open') return i;
    for (i = 0; i < c.steps.length; i++) if (stepState(c, i) === 'wait') return i;
    return -1;
  }
  function stepLabel(c, idx) { var s = c.steps[idx]; return s.exam ? s.t : (c.unit === 'правило' ? 'Правило ' : 'Урок ') + lessonNo(c, idx) + ': ' + s.t; }
  function nextLabel(id) { var c = course(id); if (!c) return ''; var i = nextIdx(c); return i < 0 ? 'Повторение пройденного' : stepLabel(c, i); }
  function pathStats(c) {
    var les = 0, lesDone = 0, ex = 0, exDone = 0;
    c.steps.forEach(function (s) { if (s.exam) { ex++; if (stepDone(s)) exDone++; } else { les++; if (stepDone(s)) lesDone++; } });
    return { les: les, lesDone: lesDone, ex: ex, exDone: exDone, pct: (lesDone + exDone) / (les + ex) };
  }
  function learnedWords() {
    var c = course('eng'), w = [];
    c.steps.forEach(function (s) { if (!s.exam && st.lessons[s.id] && s.words) w = w.concat(s.words); });
    return w;
  }
  function openExams() {
    var out = [];
    COURSES.forEach(function (c) { if (c.type !== 'path') return; c.steps.forEach(function (s, i) { if (s.exam && s.q.length && stepState(c, i) === 'open') out.push({ c: c, i: i }); }); });
    return out;
  }
  function counter(id) { var c = course(id), v = st.counters[id] || {}; return { v: num(v.v), target: v.target != null ? num(v.target) : (c.target || 0) }; }
  function allBooks() {
    var c = course('read');
    return c.books.concat(st.booksAdded).map(function (b) { var s = st.books[b.id] || {}; return { id: b.id, t: b.t, added: !c.books.some(function (x) { return x.id === b.id; }), page: num(s.page), pages: num(s.pages) }; });
  }
  function bookDone(b) { return b.pages > 0 && b.page >= b.pages; }

  // ---------- план дня ----------
  function modeOf(i) { return st.modes[keyOf(i)] || (i % 7 === 6 ? 'light' : 'free'); }
  function fill(text, w) {
    return String(text || '').replace(/\{(\w+)\}/g, function (m, k) {
      if (k.indexOf('next_') === 0) return nextLabel(k.slice(5));
      return w[k] || '';
    });
  }
  function tasksFor(i) {
    var w = P.weeks[Math.floor(i / 7)] || {}, k = keyOf(i);
    var list = (P.templates[modeOf(i)] || []).map(function (t) { return { id: t.id, cat: t.cat, t: t.t, min: t.min, n: fill(t.n, w) }; });
    return list.concat(P.extra[k] || [], st.extraTasks[k] || []);
  }
  function isDone(i, id) { var c = st.checks[keyOf(i)]; return !!(c && c[id]); }
  function stat(i) {
    var t = tasksFor(i), d = 0, dm = 0, tm = 0;
    t.forEach(function (x) { tm += x.min; if (isDone(i, x.id)) { d++; dm += x.min; } });
    return { tasks: t, done: d, n: t.length, doneMin: dm, totalMin: tm };
  }
  function counted(i) { var s = stat(i); return s.n > 0 && s.done * 2 >= s.n; }
  function streak() {
    var rt = rawToday(); if (rt < 0) return 0;
    var t = clamp(rt), i = counted(t) ? t : t - 1, s = 0;
    while (i >= 0 && counted(i)) { s++; i--; }
    return s;
  }
  function bestStreak() { var b = 0, cur = 0, last = Math.min(N - 1, rawToday()); for (var i = 0; i <= last; i++) { if (counted(i)) { cur++; if (cur > b) b = cur; } else cur = 0; } return b; }

  // ---------- очки, уровни, награды ----------
  function totals() {
    var min = 0, tasks = 0, byCat = {};
    for (var i = 0; i < N; i++) tasksFor(i).forEach(function (x) { if (isDone(i, x.id)) { min += x.min; tasks++; byCat[x.cat] = (byCat[x.cat] || 0) + x.min; } });
    var lessons = Object.keys(st.lessons).length, exXp = 0, passed = 0, perfect = false;
    Object.keys(st.exams).forEach(function (id) { var e = st.exams[id]; if (e.passed) { passed++; exXp += e.best * 10; if (e.best === e.n) perfect = true; } });
    var xp = min + lessons * 20 + exXp;
    return { min: min, tasks: tasks, byCat: byCat, lessons: lessons, passed: passed, perfect: perfect, xp: xp, level: Math.floor(xp / XP_LEVEL) + 1 };
  }
  function awards(t) {
    var bs = bestStreak(), books = allBooks().filter(bookDone).length, released = st.tracks.some(function (x) { return x.stage >= 5; });
    return [
      { c: '7', t: 'Неделя без пропуска', ok: bs >= 7, col: 'var(--accent)' },
      { c: '30', t: '30 дней подряд', ok: bs >= 30, col: 'var(--accent)' },
      { c: '10 ч', t: '10 часов занятий', ok: t.min >= 600, col: 'var(--c-code)' },
      { c: '50 ч', t: '50 часов занятий', ok: t.min >= 3000, col: 'var(--c-code)' },
      { c: 'ЭКЗ', t: 'Первый экзамен сдан', ok: t.passed >= 1, col: 'var(--c-eng)' },
      { c: '100%', t: 'Экзамен без ошибок', ok: t.perfect, col: 'var(--c-eng)' },
      { c: '50', t: 'Первые 50 слов', ok: learnedWords().length >= 50, col: 'var(--c-eng)' },
      { c: '25', t: '25 строф', ok: counter('poem').v >= 25, col: 'var(--c-poem)' },
      { c: 'КН', t: 'Первая книга до конца', ok: books >= 1, col: 'var(--c-read)' },
      { c: 'РЕЛ', t: 'Первый релиз', ok: released, col: 'var(--c-music)' },
      { c: 'УР5', t: 'Уровень 5', ok: t.level >= 5, col: 'var(--accent)' }
    ];
  }

  // ---------- экран ----------
  var today = rawToday(), sel = clamp(today);
  var V = { tab: 'today', page: null, course: null, step: null, week: Math.floor(clamp(today) / 7) };
  var EX = null, LS = null, CARDS = null, pendingDel = null;
  try { var h0 = location.hash.slice(1); if (h0 === 'learn' || h0 === 'growth' || h0 === 'plan') V.tab = h0; } catch (e) {}
  // Тема: пусто = как в системе, 'light' или 'dark' — выбор пользователя (ключ rostok-theme).
  var THEME_KEY = 'rostok-theme', theme = '';
  try { theme = localStorage.getItem(THEME_KEY) || ''; } catch (e) {}
  function applyTheme() { if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();
  var app = document.getElementById('app');

  function ring(done, n) {
    var C = 2 * Math.PI * 34, p = n ? done / n : 0;
    return '<svg class="ring" width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="Сделано ' + done + ' из ' + n + '">' +
      '<circle cx="38" cy="38" r="34" fill="none" stroke="var(--soft)" stroke-width="7"/>' +
      (p > 0 ? '<circle cx="38" cy="38" r="34" fill="none" stroke="var(--done)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * p).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 38 38)"/>' : '') +
      '<text x="38" y="45" text-anchor="middle" font-family="Oswald, Arial Narrow, sans-serif" font-size="21" font-weight="600" fill="var(--ink)">' + done + '/' + n + '</text></svg>';
  }
  function bar(pct, col) { return '<div class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%;background:' + col + '"></i></div>'; }
  function claudeLink(text, label, cls) {
    return '<a class="btn ' + (cls || 'primary') + '" href="' + CLAUDE_URL + '" target="_blank" rel="noopener" data-copy="' + esc(text) + '">' + label + '</a>';
  }

  // ---------- оформление 4.2: иконки, рисунок шапки, графики ----------
  var SVG0 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var CI = {
    eng: SVG0 + '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    rus: SVG0 + '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10.5h5"/></svg>',
    code: SVG0 + '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    ai: SVG0 + '<path d="M9 3a3 3 0 0 0-3 3v1.5A3 3 0 0 0 4.5 10a3 3 0 0 0 1 5.5V17a3 3 0 0 0 3 3h0.5a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M15 3a3 3 0 0 1 3 3v1.5a3 3 0 0 1 1.5 2.5 3 3 0 0 1-1 5.5V17a3 3 0 0 1-3 3h-0.5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/></svg>',
    poem: SVG0 + '<path d="M20 4c-6 0-11 4-13 10l-3 6 6-3c6-2 10-7 10-13z"/><path d="M7 14l4-4"/></svg>',
    read: SVG0 + '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/></svg>',
    music: SVG0 + '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
    book: SVG0 + '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M12 8h4M12 11.5h4"/></svg>',
    plan: SVG0 + '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>'
  };
  I.search = SVG0 + '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
  I.leaf = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 3C10 3 4 8 4 15c0 1.6.4 3 1 4 .9-4.3 3.6-7.6 8-9.5-3.2 2.6-5 5.4-5.9 9.1C8.4 19.8 9.7 20 11 20c7 0 9-7 9-17z"/></svg>';
  I.x = SVG0 + '<path d="M6 6l12 12M18 6L6 18"/></svg>';
  var DESC = { eng: 'Слова, фразы и грамматика с нуля до A1', rus: 'Правила, запятые, грамотное письмо', code: 'HTML, CSS, JavaScript и свой сайт', ai: 'Как работает Claude, запросы, агенты', poem: 'Поэма «Гонец из будущего»: счёт строф', poemlib: 'Разбор классики и собственный стиль', read: 'Книги: страницы и прогресс', music: 'Трек от идеи до релиза', book: 'Книга по сведению: разделы' };
  var QUOTES = ['Рост начинается там, где заканчивается зона комфорта', 'Дисциплина сегодня — свобода завтра', 'Маленькие шаги каждый день приводят к большим результатам', 'Обрастать мясом — по чуть-чуть, но каждый день'];
  function quote(i) { return QUOTES[((i % QUOTES.length) + QUOTES.length) % QUOTES.length]; }
  function heroArt() {
    var pines = '', xs = [880, 930, 975, 1025, 1070, 1120, 1165];
    xs.forEach(function (x, k) { var hgt = 90 + (k % 3) * 35, w = 22 + (k % 2) * 8, b = 372 - (k % 2) * 6; pines += '<path d="M' + x + ' ' + b + ' l' + w + ' 0 l-' + (w * .25) + ' -' + (hgt * .35) + ' l' + (w * .12) + ' 0 l-' + (w * .2) + ' -' + (hgt * .3) + ' l' + (w * .08) + ' 0 l-' + (w * .2) + ' -' + (hgt * .35) + ' l-' + (w * .2) + ' ' + (hgt * .35) + ' l' + (w * .08) + ' 0 l-' + (w * .2) + ' ' + (hgt * .3) + ' l' + (w * .12) + ' 0 l-' + (w * .25) + ' ' + (hgt * .35) + 'z"/>'; });
    return '<svg class="hero-art" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
      '<linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08201A"/><stop offset=".5" stop-color="#1A5236"/><stop offset="1" stop-color="#D9B46E"/></linearGradient>' +
      '<radialGradient id="hsun" cx=".7" cy=".48" r=".42"><stop offset="0" stop-color="#FFF1BF" stop-opacity=".95"/><stop offset=".3" stop-color="#F6CB73" stop-opacity=".5"/><stop offset="1" stop-color="#F6CB73" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="hfade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06160F" stop-opacity=".92"/><stop offset=".55" stop-color="#06160F" stop-opacity=".35"/><stop offset="1" stop-color="#06160F" stop-opacity=".1"/></linearGradient></defs>' +
      '<rect width="1200" height="420" fill="url(#hsky)"/><rect width="1200" height="420" fill="url(#hsun)"/>' +
      '<path d="M0 262L130 182 250 238 390 156 520 226 650 170 770 236 900 150 1040 214 1200 166V420H0z" fill="#1A4A31" opacity=".85"/>' +
      '<path d="M0 300L110 246 220 284 350 214 470 272 600 234 720 292 850 224 980 282 1100 244 1200 272V420H0z" fill="#113524"/>' +
      '<g fill="#0A2418">' + pines + '</g>' +
      '<path d="M0 352C240 326 420 342 600 352S960 336 1200 350V420H0z" fill="#07190F"/>' +
      '<g transform="translate(840 350) scale(.9)"><path d="M0 0C-2-22 0-46 2-70" stroke="#5FBF7A" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M2-70C-32-76-58-58-60-32-30-30-4-44 2-70z" fill="#43C06E"/><path d="M2-70C36-78 62-60 64-34 34-32 8-46 2-70z" fill="#79E39B"/><path d="M0-38C-20-40-33-31-34-16-17-16-4-24 0-38z" fill="#3AAA60"/></g>' +
      '<rect width="1200" height="420" fill="url(#hfade)"/></svg>';
  }
  function weekChart(wk, big) {
    var rt = rawToday(), maxN = 1, cols = [], W = 322, H = big ? 150 : 128, top = H - 22;
    for (var k = 0; k < 7; k++) { var cs = stat(wk * 7 + k); cols.push(cs); if (cs.totalMin > maxN) maxN = cs.totalMin; }
    var svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Минуты по дням недели ' + (wk + 1) + ': ' + cols.map(function (c, k) { return DOW[k] + ' ' + c.doneMin + ' из ' + c.totalMin; }).join(', ') + '">';
    cols.forEach(function (c, k) {
      var x = 9 + k * 46, hn = (top - 8) * c.totalMin / maxN, hd = (top - 8) * c.doneMin / maxN, isT = wk * 7 + k === rt;
      svg += '<rect x="' + x + '" y="' + (top - hn).toFixed(1) + '" width="30" height="' + hn.toFixed(1) + '" rx="6" fill="var(--chart-soft)"/>';
      if (hd > 0) svg += '<rect x="' + x + '" y="' + (top - hd).toFixed(1) + '" width="30" height="' + hd.toFixed(1) + '" rx="6" fill="' + (isT ? 'var(--accent)' : 'var(--chart-bar)') + '"/>';
      svg += '<text x="' + (x + 15) + '" y="' + (H - 6) + '" text-anchor="middle" font-family="Onest, system-ui, sans-serif" font-size="11" font-weight="' + (isT ? 600 : 400) + '" fill="' + (isT ? 'var(--accent)' : 'var(--mute)') + '">' + DOW[k] + '</text>';
    });
    return svg + '</svg>';
  }
  function weekDelta(wk) {
    if (wk <= 0) return '';
    var a = weekStats(wk).min, b = weekStats(wk - 1).min;
    if (!b) return '';
    var d = Math.round((a - b) / b * 100);
    return '<span class="delta' + (d < 0 ? ' down' : '') + '">' + (d > 0 ? '+' : '') + d + '%</span>';
  }
  function donut(pct, size) {
    size = size || 132; var r = size / 2 - 9, C = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct)) / 100, c = size / 2;
    return '<svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Общий прогресс ' + pct + '%"><circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--chart-soft)" stroke-width="12"/>' +
      (p > 0 ? '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (C * p).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>' : '') +
      '<text x="' + c + '" y="' + (c + 9) + '" text-anchor="middle" font-family="Onest, system-ui, sans-serif" font-size="' + Math.round(size / 4.4) + '" font-weight="600" fill="var(--ink)">' + pct + '%</text></svg>';
  }
  function overall() {
    var list = COURSES.filter(function (c) { return c.type === 'path'; }).map(function (c) { return { c: c, pct: Math.round(pathStats(c).pct * 100) }; });
    var sum = 0; list.forEach(function (x) { sum += x.pct; });
    return { pct: list.length ? Math.round(sum / list.length) : 0, list: list };
  }
  function monthChart() {
    var rt = rawToday(), days = 30, maxN = 1, vals = [], W = 420, H = 140, top = H - 22, bw = W / days;
    for (var k = days - 1; k >= 0; k--) { var i = rt - k, v = i >= 0 && i < N ? stat(i).doneMin : 0, d = dateOf(i); vals.push({ i: i, v: v, d: d }); if (v > maxN) maxN = v; }
    var svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Минуты занятий за последние 30 дней">';
    vals.forEach(function (x, k) {
      var hgt = x.v ? Math.max(4, (top - 10) * x.v / maxN) : 3, xx = k * bw + 2, isT = x.i === rt;
      svg += '<rect x="' + xx.toFixed(1) + '" y="' + (top - hgt).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="3" fill="' + (x.v ? (isT ? 'var(--accent)' : 'var(--chart-bar)') : 'var(--chart-soft)') + '"/>';
      if (k % 7 === 1) svg += '<text x="' + (xx + (bw - 4) / 2).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" font-family="Onest, system-ui, sans-serif" font-size="10" fill="var(--mute)">' + x.d.getDate() + ' ' + MONS[x.d.getMonth()] + '</text>';
    });
    return svg + '</svg>';
  }
  function topbar(title, sub) {
    return '<header class="topbar"><div class="brand"><span class="brand-mark">' + I.leaf + '</span><b>ROSTOK</b></div>' +
      (title ? '<div class="topbar-title"><h1 class="h1">' + title + '</h1>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div>' : '<span class="topbar-spacer"></span>') +
      '<div class="search" id="search"><input id="search-input" type="search" placeholder="Поиск уроков…" autocomplete="off" aria-label="Поиск уроков"><button class="icon-btn" data-act="search" aria-label="Поиск">' + I.search + '</button><div class="search-results" id="search-results" hidden></div></div></header>';
  }
  function searchLessons(q) {
    q = norm(q); if (q.length < 2) return [];
    var out = [];
    COURSES.forEach(function (c) { if (c.type !== 'path') return; c.steps.forEach(function (s, i) { if (out.length < 12 && norm(s.t).indexOf(q) >= 0) out.push({ c: c, i: i, s: s }); }); });
    return out;
  }
  function renderSearch(q) {
    var box = document.getElementById('search-results'); if (!box) return;
    var r = searchLessons(q);
    if (!r.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = r.map(function (x) { return '<button class="search-item" data-find="' + x.c.id + ':' + x.i + '"><i class="dot" style="background:var(--c-' + x.c.cat + ')"></i><span><small>' + esc(x.c.name) + '</small>' + esc(x.s.t) + '</span>' + (stepDone(x.s) ? '<em>пройдено</em>' : '') + '</button>'; }).join('');
    box.hidden = false;
  }
  function weekStrip() {
    var wk = Math.floor(sel / 7), rt = rawToday(), h = '<div class="week-strip"><button class="nav" data-act="prevweek" aria-label="Предыдущая неделя"' + (wk === 0 ? ' disabled' : '') + '>' + I.left + '</button><div class="days">';
    for (var k = 0; k < 7; k++) { var i = wk * 7 + k, d = dateOf(i), s = stat(i); h += '<button class="wday' + (i === sel ? ' sel' : '') + (i === rt ? ' today' : '') + (s.n && s.done === s.n ? ' full' : s.done ? ' part' : '') + '" data-sel="' + i + '" aria-pressed="' + (i === sel) + '" aria-label="' + DOWF[k] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + '"><span>' + DOW[k] + '</span><b>' + d.getDate() + '</b></button>'; }
    return h + '</div><button class="nav" data-act="nextweek" aria-label="Следующая неделя"' + (wk >= P.weeks.length - 1 ? ' disabled' : '') + '>' + I.right + '</button></div>';
  }
  function courseCard(c, compact) {
    var col = 'var(--c-' + c.cat + ')', pct = 0, foot = '', ni;
    if (c.type === 'path') { var ps = pathStats(c); ni = nextIdx(c); pct = Math.round(ps.pct * 100); foot = (c.unit === 'правило' ? 'Правил ' : 'Уроков ') + ps.lesDone + ' из ' + ps.les + (c.id === 'eng' ? ' · ' + learnedWords().length + ' слов' : '') + (ni < 0 ? ' · всё пройдено' : ''); }
    else if (c.type === 'counter') { var k = counter(c.id); pct = k.target ? Math.round(k.v / k.target * 100) : 0; foot = k.v + ' ' + c.unit + (k.target ? ' из ' + k.target : ''); }
    else if (c.type === 'books') { var bs = allBooks(), done = bs.filter(bookDone).length, cur = bs.filter(function (b) { return !bookDone(b); })[0]; pct = cur && cur.pages ? Math.round(cur.page / cur.pages * 100) : 0; foot = cur ? cur.t : 'прочитано ' + done + ' из ' + bs.length; }
    else if (c.type === 'stages') { var tr = st.tracks.filter(function (x) { return x.stage < 5; })[0] || st.tracks[st.tracks.length - 1]; pct = tr ? Math.round(tr.stage / 5 * 100) : 0; foot = tr ? tr.name + ' · ' + (tr.stage >= 5 ? 'выпущен' : c.stages[tr.stage].toLowerCase()) : 'Добавь первый трек'; }
    if (compact) return '<button class="dcard" data-course="' + c.id + '" style="--cc:' + col + '"><span class="dcard-ic">' + (CI[c.cat] || CI.plan) + '</span><b>' + esc(c.name) + '</b><span class="small">' + esc(DESC[c.id] || '') + '</span><span class="dcard-arrow">' + I.right + '</span></button>';
    return '<button class="ccard" data-course="' + c.id + '" style="--cc:' + col + '"><div class="ccard-art"><span class="ccard-ic">' + (CI[c.cat] || CI.plan) + '</span><span class="ccard-pct">' + pct + '%</span></div>' +
      '<div class="ccard-body"><b class="nm">' + esc(c.name) + '</b><p class="small">' + esc(DESC[c.id] || c.title || '') + '</p>' + bar(pct / 100, col) + '<div class="ccard-foot"><span class="small">' + esc(foot) + '</span><span class="go-link">' + (c.type === 'path' ? 'Продолжить' : 'Открыть') + ' →</span></div></div></button>';
  }

  function resumeTarget() {
    var last = st.lastStudy, c, i;
    if (last && (c = course(last.cid)) && c.type === 'path') {
      i = c.steps.findIndex(function (s) { return s.id === last.sid; });
      if (i >= 0 && !stepDone(c.steps[i]) && stepState(c, i) === 'open') return {c:c,i:i};
      i = nextIdx(c); if (i >= 0 && stepState(c,i) === 'open') return {c:c,i:i};
    }
    for (var k = 0; k < COURSES.length; k++) {
      c = COURSES[k]; if (c.type !== 'path') continue;
      i = nextIdx(c); if (i >= 0 && stepState(c,i) === 'open') return {c:c,i:i};
    }
    return null;
  }
  function resumeCard() {
    var x = resumeTarget();
    if (!x) return '<div class="study-focus"><span class="eyebrow">Отличная работа</span><h2>Все доступные блоки пройдены</h2><p>Можно повторить материал в разделе «Обучение».</p><button class="btn primary" data-tab="learn">К направлениям →</button></div>';
    var s = x.c.steps[x.i], ps = pathStats(x.c), saved = st.session && st.session.cid === x.c.id && st.session.i === x.i;
    return '<div class="study-focus"><div class="focus-copy"><span class="eyebrow">' + (saved ? 'Продолжи с того же места' : 'Твой следующий шаг') + '</span><h2>' + esc(s.exam ? 'Пора проверить знания' : x.c.name) + '</h2><p>' + esc(s.t) + '</p><span class="focus-meta">' + ps.lesDone + ' из ' + ps.les + ' уроков · ' + Math.round(ps.pct * 100) + '% пути</span></div>' +
      '<button class="btn primary" data-act="resume">' + (s.exam ? 'Начать экзамен' : saved ? 'Продолжить урок' : 'Начать урок') + ' ' + I.right + '</button></div>';
  }
  function taskRow(x, priority, timeline) {
    var on = isDone(sel,x.id), c = course(x.cat), own = x.id.indexOf('u-') === 0;
    return '<li class="task' + (on ? ' done' : '') + (priority ? ' priority-task' : '') + '">' + (timeline ? '<span class="tl-min">' + x.min + ' мин</span>' : '') + '<button class="chk" data-task="' + esc(x.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Снять отметку: ' : 'Отметить: ') + esc(x.t) + '">' + I.check + '</button>' +
      '<div class="tb"><div class="tt"><i class="dot" style="background:var(--c-' + esc(x.cat) + ')"></i><span>' + esc(x.t) + '</span></div>' + (x.n ? '<div class="tn">' + esc(x.n) + '</div>' : '') +
      (c && !on ? '<button class="go" data-course="' + c.id + '">' + (c.type === 'path' ? 'Открыть урок' : 'Открыть') + ' →</button>' : '') + '</div>' +
      (timeline ? (own ? '<button class="icon-btn del-task" data-deltask="' + esc(x.id) + '" aria-label="Удалить дело">' + I.x + '</button>' : '') : '<span class="min">' + x.min + '<small>мин</small></span>') + '</li>';
  }

  // ----- Главная -----
  function viewToday() {
    var d = dateOf(sel), s = stat(sel), wk = Math.floor(sel / 7), rt = rawToday(), x = resumeTarget();
    var pending = s.tasks.filter(function (x) { return !isDone(sel,x.id); });
    var priority = pending.slice(0,3), rest = s.tasks.filter(function (x) { return priority.indexOf(x) < 0; });
    var ov = overall(), dateText = d.getDate() + ' ' + MON[d.getMonth()] + ', ' + DOWF[sel % 7].toLowerCase();
    var h = '<section class="view home-view">' + topbar() +
      '<div class="hero">' + heroArt() + '<div class="hero-copy"><span class="hero-leaf">' + I.leaf + '</span><h1 class="hero-title"><span class="only-d">ROSTOK</span><span class="only-m">Развивай себя каждый день</span></h1><p class="hero-tag only-d">Знания. Привычки. Развитие.</p><p class="hero-sub only-d">Маленькие шаги каждый день приводят к большим результатам.</p><p class="hero-date only-m">' + dateText + '</p>' +
      '<button class="btn primary only-d" data-act="resume">' + (x ? (x.c.steps[x.i].exam ? 'Пройти экзамен' : 'Продолжить обучение') : 'К направлениям') + ' ' + I.right + '</button></div>' +
      '<blockquote class="hero-quote only-d">«' + quote(sel) + '»<span>' + I.leaf + '</span></blockquote>' + weekStrip() + '</div>';
    if (rt < 0) h += '<p class="muted">План начнётся ' + START.getDate() + ' ' + MON[START.getMonth()] + '.</p>';
    h += '<div class="dcards only-d">' + COURSES.map(function (c) { return courseCard(c, true); }).join('') + '</div>';
    h += '<div class="today-panel"><div class="section-head"><div><h2>' + (sel === rt ? 'Сегодня' : d.getDate() + ' ' + MON[d.getMonth()]) + '</h2><p class="muted"><span class="only-d">' + dateText + '</span><span class="only-m">' + s.done + ' из ' + s.n + ' выполнено</span>' + (sel !== clamp(rt) ? ' · <button class="back" data-act="gotoday">К сегодня</button>' : '') + '</p></div><button class="link" data-tab="plan">План на день ' + I.right + '</button></div>' +
      '<div class="today-cols"><div class="today-list"><span class="eyebrow">Три главных дела <span class="pill">' + pending.length + ' осталось</span></span>';
    h += priority.length ? '<ul class="tasks priority-list">' + priority.map(function (t) { return taskRow(t,true); }).join('') + '</ul>' : '<div class="empty-state"><span>✓</span><h3>На сегодня всё</h3><p>Хороший повод отдохнуть. Завтра продолжим.</p></div>';
    if (rest.length) h += '<details class="remaining-tasks"><summary>Остальной план <span>' + rest.length + '</span></summary><ul class="tasks">' + rest.map(function (t) { return taskRow(t,false); }).join('') + '</ul></details>';
    h += '<button class="btn primary block only-m" data-act="resume">' + (x ? (x.c.steps[x.i].exam ? 'Пройти экзамен' : 'Продолжить обучение') : 'К направлениям') + ' ' + I.right + '</button></div>';
    h += '<div class="today-chart only-d"><div class="spread"><h3>Прогресс за неделю</h3>' + weekDelta(wk) + '</div>' + weekChart(wk) + '</div>';
    h += '<div class="today-overall only-d"><h3>Общий прогресс</h3><div class="overall-row">' + donut(ov.pct) + '<ul class="legend-list">' + ov.list.map(function (o) { return '<li><i class="dot" style="background:var(--c-' + o.c.cat + ')"></i><span>' + esc(o.c.name) + '</span><b>' + o.pct + '%</b></li>'; }).join('') + '</ul></div></div></div></div>';
    var bd = backupDays();
    if (hasProgress() && (bd === null || bd >= 7)) h += '<div class="backup-hint card"><span>Сохрани свой путь</span><p class="small">Файл копии поможет перенести прогресс на другое устройство.</p><button class="btn" data-act="export">Сохранить копию</button></div>';
    return h + '</section>';
  }

  // ----- Обучение: список -----
  var FILTERS = [['all', 'Все'], ['rus', 'Русский'], ['eng', 'Английский'], ['code', 'Программирование'], ['ai', 'ИИ'], ['art', 'Творчество']];
  var FILTER_CATS = { rus: ['rus'], eng: ['eng'], code: ['code'], ai: ['ai'], art: ['poem', 'read', 'music', 'book'] };
  function viewLearn() {
    var f = V.filter || 'all';
    var h = '<section class="view learn-view">' + topbar('Обучение', 'Выбирай направление и двигайся в своём темпе') +
      '<div class="chips" role="group" aria-label="Фильтр направлений">' + FILTERS.map(function (x) { return '<button class="chip" data-filter="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div class="course-grid">';
    COURSES.forEach(function (c) { if (f !== 'all' && FILTER_CATS[f].indexOf(c.cat) < 0) return; h += courseCard(c, false); });
    return h + '</div></section>';
  }

  // ----- План дня -----
  function viewPlan() {
    var d = dateOf(sel), s = stat(sel), wk = Math.floor(sel / 7), rt = rawToday(), pct = s.n ? Math.round(s.done / s.n * 100) : 0;
    var h = '<section class="view plan-view">' + topbar('План дня') +
      '<div class="daynav-row card"><button class="nav" data-act="prev" aria-label="Предыдущий день"' + (sel === 0 ? ' disabled' : '') + '>' + I.left + '</button><div class="daynav-title"><b>' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + '</b><span class="small">' + DOWF[sel % 7] + ' · неделя ' + (wk + 1) + ' · день ' + (sel + 1) + ' из ' + N + (sel !== clamp(rt) ? ' · <button class="back" data-act="gotoday">К сегодня</button>' : '') + '</span></div><button class="nav" data-act="next" aria-label="Следующий день"' + (sel === N - 1 ? ' disabled' : '') + '>' + I.right + '</button></div>';
    h += '<div class="plan-grid"><div class="card timeline">' + (s.tasks.length ? '<ul class="tasks timeline-list">' + s.tasks.map(function (t) { return taskRow(t, false, true); }).join('') + '</ul>' : '<p class="muted">На этот день дел нет.</p>') +
      '<div class="add-task"><input id="new-task" placeholder="Новое дело" maxlength="80" aria-label="Название дела"><input id="new-task-min" type="number" inputmode="numeric" min="1" max="600" value="15" aria-label="Минут"><button class="btn" data-act="addtask">+ Добавить задачу</button></div></div>';
    h += '<aside class="plan-side"><div class="card day-progress"><span class="eyebrow">Твой ритм</span><div class="progress-value">' + pct + '<small>%</small></div>' + bar(pct / 100, 'var(--accent)') + '<p><b>' + s.done + ' из ' + s.n + '</b> дел выполнено</p><div class="mini-stats"><span><b>' + fmtShort(s.doneMin) + '</b>из ' + fmtShort(s.totalMin) + ' по плану</span><span><b>' + streak() + ' ' + plural(streak(), 'день', 'дня', 'дней') + '</b>подряд</span></div><span class="small">Время считается по выполненным делам, а не по таймеру.</span></div>' +
      '<div class="card mode-card"><h3>Какой сегодня день?</h3><p class="small">Подстрой нагрузку под свой график.</p><div class="modes" role="group" aria-label="Тип дня">' + MODES.map(function (x) { return '<button data-mode="' + x[0] + '" aria-pressed="' + (modeOf(sel) === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="card quote-card"><span>' + I.leaf + '</span>«' + quote(sel + 1) + '»</div></aside></div></section>';
    return h;
  }

  // ----- Обучение: направление -----
  function viewCourse() {
    var c = course(V.course), col = 'var(--c-' + c.cat + ')';
    var h = '<section class="view"><button class="back" data-act="tolearn">‹ Обучение</button>';
    if (c.type === 'path') return h + coursePath(c, col) + '</section>';
    h += '<div class="title"><h1 class="h1">' + c.name + '</h1>' + (c.title ? '<div class="muted">' + esc(c.title) + '</div>' : '') + '</div>';
    if (c.type === 'counter') {
      var k = counter(c.id);
      h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="counter">' +
        '<button class="sq" data-cnt="-1" aria-label="Минус один">−</button><div class="val">' + k.v + '</div><button class="sq" data-cnt="1" aria-label="Плюс один">+</button>' +
        '<div class="muted">' + c.unit + (k.target ? '<br>' + Math.round(k.v / k.target * 100) + '% от цели' : '') + '</div></div>' +
        bar(k.target ? k.v / k.target : 0, col) +
        '<label class="inl" for="cnt-target">Цель: всего <input type="number" inputmode="numeric" min="0" id="cnt-target" value="' + (k.target || '') + '" placeholder="?"> ' + c.unit + '</label></div>';
    } else if (c.type === 'books') {
      h += '<div class="card">';
      allBooks().forEach(function (b) {
        h += '<div class="item"><div class="spread"><b style="font-weight:600">' + esc(b.t) + '</b>' + (bookDone(b) ? '<span class="pill" style="color:var(--done)">прочитана</span>' : '') + '</div>' +
          bar(b.pages ? b.page / b.pages : 0, col) +
          '<div class="inl"><label for="pg-' + b.id + '">Страница</label><input type="number" inputmode="numeric" min="0" id="pg-' + b.id + '" data-book="' + b.id + '" data-f="page" value="' + (b.page || '') + '">' +
          '<label for="pp-' + b.id + '">из</label><input type="number" inputmode="numeric" min="0" id="pp-' + b.id + '" data-book="' + b.id + '" data-f="pages" value="' + (b.pages || '') + '" placeholder="?"></div>' +
          (b.added ? delBtn('book:' + b.id, 'Убрать книгу') : '') + '</div>';
      });
      h += '</div><div class="card" style="display:flex;flex-direction:column;gap:8px"><label class="lab" for="new-book">Добавить книгу<input id="new-book" placeholder="Название и автор"></label><button class="btn" data-act="addbook">Добавить</button></div>';
    } else if (c.type === 'stages') {
      h += '<div class="card">';
      if (!st.tracks.length) h += '<p class="muted">Пока нет треков. Добавь первый ниже.</p>';
      st.tracks.forEach(function (t, ti) {
        h += '<div class="item"><div class="spread"><b style="font-weight:600">' + esc(t.name) + '</b><span class="small">' + (t.stage >= 5 ? 'выпущен' : 'этап: ' + c.stages[t.stage].toLowerCase()) + '</span></div>' +
          '<div class="stg">' + c.stages.map(function (s, i) { return '<button class="' + (t.stage > i ? 'on' : '') + '" data-track="' + ti + '" data-stage="' + i + '" aria-pressed="' + (t.stage > i) + '">' + s + '</button>'; }).join('') + '</div>' +
          delBtn('track:' + ti, 'Удалить трек') + '</div>';
      });
      h += '</div><p class="muted">Нажми на этап, когда он готов. Этапы: идея, аранжировка, сведение, мастеринг, релиз.</p>' +
        '<div class="card" style="display:flex;flex-direction:column;gap:8px"><label class="lab" for="new-track">Новый трек<input id="new-track" placeholder="Рабочее название"></label><button class="btn" data-act="addtrack">Добавить</button></div>';
    }
    return h + '</section>';
  }
  function delBtn(key, label) {
    return pendingDel === key ? '<button class="del warn" data-del="' + key + '">Нажми ещё раз, чтобы удалить</button>' : '<button class="del" data-del="' + key + '">' + label + '</button>';
  }

  function coursePath(c, col) {
    var ps = pathStats(c), ni = nextIdx(c), si = V.step != null ? V.step : ni;
    var h = '<div class="row" style="gap:14px"><div class="title"><h1 class="h1">' + c.name + '</h1><div class="muted">Цель: ' + esc(c.goal) + '</div></div>' +
      (c.level ? '<div class="lvl" style="background:' + col + '"><b>' + c.level + '</b><span>цель ' + c.target + '</span></div>' : '') + '</div>';
    if (si >= 0) h += stepHero(c, si);
    else h += '<div class="hero"><div class="tl">Все уроки и экзамены пройдены</div><div class="pl">Новые материалы появятся в следующих обновлениях.</div></div>';
    h += '<div class="card" style="padding:4px 0"><ul class="path">';
    c.steps.forEach(function (s, i) {
      var x = stepState(c, i), cur = i === si, ic, stx = '';
      if (s.exam) {
        ic = '<span class="ic ex' + (x === 'done' ? ' ok' : cur ? ' now' : '') + '">' + I.cap + '</span>';
        var e = st.exams[s.id];
        stx = x === 'done' ? 'сдан ' + e.best + '/' + e.n : x === 'open' ? (s.q.length ? 'открыт' : 'скоро') : e ? 'лучший ' + e.best + '/' + e.n : '';
      } else {
        ic = '<span class="ic' + (x === 'done' ? ' ok' : cur ? ' now' : '') + '">' + (x === 'done' ? I.check : x === 'locked' ? I.lock : lessonNo(c, i)) + '</span>';
        stx = x === 'done' ? 'пройден' : i === ni ? 'сейчас' : '';
      }
      h += '<li><button class="step' + (cur ? ' cur' : '') + (x === 'locked' ? ' locked' : '') + '" data-step="' + i + '">' + ic + '<span class="tx">' + esc(s.exam ? s.t : s.t) + '</span><span class="st' + (i === ni && x !== 'done' ? ' now' : '') + '">' + stx + '</span></button></li>';
    });
    h += '</ul></div>';
    var tiles = '<div class="tile"><b>' + ps.lesDone + '/' + ps.les + '</b><span>' + (c.unit === 'правило' ? 'правил' : 'уроков') + ' пройдено</span></div>';
    var lastEx = null; c.steps.forEach(function (s) { if (s.exam && st.exams[s.id]) lastEx = st.exams[s.id]; });
    tiles += '<div class="tile"><b>' + (lastEx ? lastEx.last + '/' + lastEx.n : '—') + '</b><span>последний экзамен</span></div>';
    h += '<div class="tiles two">' + tiles + '</div>';
    if (c.id === 'eng') {
      var w = learnedWords();
      h += '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="spread"><h2 class="h2">Мой словарь: ' + w.length + ' ' + plural(w.length, 'слово', 'слова', 'слов') + '</h2></div>';
      if (w.length) {
        h += '<div class="words">' + w.slice(-6).reverse().map(function (x) { return '<span><b style="font-weight:600">' + esc(x[0]) + '</b> <span class="tr">[' + esc(x[1]) + ']</span></span><span class="tr">' + esc(x[2]) + '</span>'; }).join('') + '</div>' +
          '<button class="btn" data-act="cards">Повторить ' + Math.min(10, w.length) + ' ' + plural(Math.min(10, w.length), 'слово', 'слова', 'слов') + '</button>';
      } else h += '<p class="muted">Слова появятся, когда отметишь первый урок пройденным.</p>';
      h += '</div>';
    }
    return h;
  }

  function stepHero(c, i) {
    var s = c.steps[i], x = stepState(c, i), h = '<div class="hero">';
    if (s.exam) {
      var e = st.exams[s.id];
      h += '<div class="lab">Экзамен · ' + (s.q.length ? s.q.length + ' ' + plural(s.q.length, 'вопрос', 'вопроса', 'вопросов') + ' · ' : '') + 'порог ' + Math.round(s.pass * 100) + '%</div><div class="tl">' + esc(s.t) + '</div>';
      if (e) h += '<div class="pl">Лучший результат: ' + e.best + ' из ' + e.n + (e.passed ? ', сдан.' : ', пока не сдан.') + '</div>';
      if (!s.q.length) h += '<div class="pl">Вопросы появятся после уроков этого блока: Claude добавит их в обновлении.</div>';
      else if (x === 'wait') h += '<div class="pl">Откроется, когда отметишь все уроки этого блока.</div>';
      else if (x === 'locked') h += '<div class="pl">Сначала сдай предыдущий экзамен.</div>';
      else h += '<button class="btn primary block" data-exam="' + c.id + ':' + i + '">' + (e ? (e.passed ? 'Пересдать на лучший результат' : 'Пересдать') : 'Начать экзамен') + '</button>';
      if (e && e.wrong && e.wrong.length) h += '<button class="btn block" data-result="' + c.id + ':' + i + '">Последний результат и ошибки</button>';
    } else {
      var n = lessonNo(c, i);
      h += '<div class="lab">' + (c.unit === 'правило' ? 'Правило ' : 'Урок ') + n + (x === 'done' ? ' · пройден' : '') + '</div><div class="tl">' + esc(s.t) + '</div><div class="pl">' + esc(s.plan) + '</div>';
      if (x === 'locked') h += '<div class="pl">Откроется после экзамена по прошлому блоку.</div>';
      else {
        var prompt = c.prompt.replace('{n}', n).replace('{t}', s.t).replace('{plan}', s.plan || '').replace('{words}', (s.words || []).map(function (w) { return w[0] + ' — ' + w[2]; }).join(', ') || 'на твой выбор');
        if (s.ex && s.theory) {
          h += '<button class="btn primary block" data-lopen="' + c.id + ':' + i + '">' + (x === 'done' ? 'Повторить урок' : 'Начать урок') + '</button>' +
            claudeLink(prompt, 'Разобрать с Claude', 'block') +
            (x === 'done' ? '<button class="btn block" data-lesson="' + s.id + '">Снять отметку</button>' : '');
        } else {
          h += claudeLink(prompt, 'Начать урок с Claude', 'primary block') +
          '<div class="pl" style="font-size:12.5px;opacity:.75">Кнопка скопирует задание урока и откроет Claude. Вставь его в чат.</div>' +
          (x === 'done' ? '<button class="btn block" data-lesson="' + s.id + '">Снять отметку</button>' : '<button class="btn block" data-lesson="' + s.id + '">Урок пройден</button>');
        }
      }
    }
    return h + '</div>';
  }

  // ----- Урок внутри приложения -----
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function startLesson(cid, i) {
    var c = course(cid), s = c.steps[i];
    if (stepState(c,i) === 'locked' || s.exam || !s.ex || !s.theory) return;
    if (validSession(st.session) && st.session.cid === cid && st.session.i === i) {
      LS = JSON.parse(JSON.stringify(st.session)); V.tab = 'learn'; V.course = cid; V.page = 'lesson'; render(); window.scrollTo(0,0); return;
    }
    var qs = s.ex.map(function (q) {
      var idx = shuffle(q.options.map(function (x, j) { return j; }));
      return { q: q.q, options: idx.map(function (j) { return q.options[j]; }), right: idx.indexOf(0), pick: null, why: q.explanation || q.why || '' };
    });
    LS = { cid: cid, i: i, qs: qs, phase: 'theory', retry: false };
    st.lastStudy = {cid:cid,sid:s.id,at:Date.now()};
    V.tab = 'learn'; V.course = cid; rememberLesson();
    V.page = 'lesson'; render(); window.scrollTo(0, 0);
  }
  function validSession(x) {
    if (!plain(x)) return false;
    var c = course(x.cid), s = c && c.steps && c.steps[x.i];
    return !!(s && Number.isInteger(x.i) && !s.exam && s.ex && (x.firstScore==null || validCount(x.firstScore) && x.firstScore<=s.ex.length) && (x.retry==null || typeof x.retry==='boolean') &&
      (!x.retry || Array.isArray(x.retrySet) && x.retrySet.length>0 && x.retrySet.every(function(i){return Number.isInteger(i)&&i>=0&&i<s.ex.length;}) && x.firstScore!=null) && Array.isArray(x.qs) && x.qs.length === s.ex.length && x.qs.every(function (q,j) {
      if(x.retry && q && q.pick==null && x.retrySet.indexOf(j)<0)return false;
      return plain(q) && q.q === s.ex[j].q && Array.isArray(q.options) && JSON.stringify(q.options.slice().sort())===JSON.stringify(s.ex[j].options.slice().sort()) && q.options[q.right] === s.ex[j].options[0] && (q.pick == null || Number.isInteger(q.pick) && q.pick >= 0 && q.pick < q.options.length);
    }));
  }
  function rememberLesson() { st.session = JSON.parse(JSON.stringify(LS)); save(); }
  function explanation(c, s, q) {
    return q.why ? md(q.why) : md(s.theory ? s.theory.rule : 'Повтори правило по этой теме.') + (s.theory && s.theory.ex.length ? '<div class="explain-example">Например: ' + esc(s.theory.ex[0][0]) + ' — ' + esc(s.theory.ex[0][1]) + '</div>' : '');
  }
  function resumeStudy() {
    var x = resumeTarget(); if (!x) { go('learn'); return; }
    V.tab = 'learn'; V.course = x.c.id; V.step = x.i;
    var s = x.c.steps[x.i];
    if (s.exam) startExam(x.c.id,x.i);
    else if (s.ex && s.theory) startLesson(x.c.id,x.i);
    else go('learn','course',{course:x.c.id,step:x.i});
  }
  // ----- Текст стихов: русские классики подгружаются с Викитеки (общественное достояние), для переводов и английских оригиналов только ссылка -----
  var PC = {}, PP = {};
  function ny(x) { return String(x).toLowerCase().replace(/ё/g, 'е'); }
  function wsLink(s) { return 'https://ru.wikisource.org/w/index.php?search=' + encodeURIComponent(s.wiki.q + ' ' + s.wiki.a); }
  function poemBlock(s) {
    if (s.wiki) return '<div class="card qcard"><h2 class="h2">Текст стихотворения</h2><div id="poemtext" data-id="' + s.id + '" class="small">Загружаю с Викитеки…</div></div>';
    if (s.link) return '<div class="card qcard"><h2 class="h2">Текст стихотворения</h2><div class="small">Перевод может быть под авторским правом, поэтому текст здесь не показываю. Оригинал можно найти по ссылке.</div>' +
      '<a class="btn block" href="' + esc(s.link) + '" target="_blank" rel="noopener">Найти текст</a></div>';
    return '';
  }
  function paintPoem(id) {
    var el = document.getElementById('poemtext'); if (!el || el.getAttribute('data-id') !== id || !PC[id]) return;
    var r = PC[id], s = course(LS.cid).steps[LS.i];
    el.textContent = '';
    if (r.fail) {
      var m = document.createElement('div'); m.textContent = 'Не удалось подгрузить текст автоматически.'; el.appendChild(m);
      var b = document.createElement('a'); b.className = 'btn block'; b.href = wsLink(s); b.target = '_blank'; b.rel = 'noopener'; b.textContent = 'Найти в Викитеке'; el.appendChild(b);
      return;
    }
    var t = document.createElement('div'); t.className = 'poemtxt'; t.textContent = r.text; el.appendChild(t);
    var a = document.createElement('a'); a.className = 'small'; a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Источник: Викитека, «' + r.title + '»'; el.appendChild(a);
  }
  function poemText(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html'), out = [];
    var poems = doc.querySelectorAll('.poem');
    for (var i = 0; i < poems.length; i++) {
      var refs = poems[i].querySelectorAll('sup, .reference'); for (var j = 0; j < refs.length; j++) refs[j].parentNode.removeChild(refs[j]);
      var brs = poems[i].querySelectorAll('br'); for (var k = 0; k < brs.length; k++) brs[k].parentNode.replaceChild(doc.createTextNode('\n'), brs[k]);
      var ps = poems[i].querySelectorAll('p');
      if (ps.length) { for (var q = 0; q < ps.length; q++) { var tx = ps[q].textContent.replace(/^\s+|\s+$/g, ''); if (tx) out.push(tx); } }
      else { var t2 = poems[i].textContent.replace(/^\s+|\s+$/g, ''); if (t2) out.push(t2); }
    }
    return out.join('\n\n');
  }
  function loadPoem() {
    var s = course(LS.cid).steps[LS.i]; if (!s.wiki) return;
    var id = s.id; if (PC[id]) { paintPoem(id); return; } if (PP[id]) return; PP[id] = 1;
    var api = 'https://ru.wikisource.org/w/api.php?format=json&origin=*&';
    function fail() { PC[id] = { fail: true }; PP[id] = 0; paintPoem(id); }
    try {
      fetch(api + 'action=query&list=search&srnamespace=0&srlimit=10&srsearch=' + encodeURIComponent(s.wiki.q + ' ' + s.wiki.a))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var list = (d.query && d.query.search) || [], title = null;
          for (var i = 0; i < list.length && !title; i++) { var nt = ny(list[i].title); for (var j = 0; j < s.wiki.m.length; j++) if (nt.indexOf(ny(s.wiki.m[j])) >= 0) { title = list[i].title; break; } }
          if (!title) { fail(); return; }
          return fetch(api + 'action=parse&prop=text&formatversion=2&redirects=1&page=' + encodeURIComponent(title))
            .then(function (r) { return r.json(); })
            .then(function (p) {
              var txt = p && p.parse ? poemText(p.parse.text) : '';
              if (!txt || txt.length > 4000) { fail(); return; }
              PC[id] = { text: txt, title: title, url: 'https://ru.wikisource.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')) }; PP[id] = 0; paintPoem(id);
            });
        })
        .catch(fail);
    } catch (e) { fail(); }
  }
  function viewLesson() {
    var c = course(LS.cid), s = c.steps[LS.i], th = s.theory, col = 'var(--c-' + c.cat + ')';
    var answered = LS.qs.filter(function (q) { return q.pick != null; }).length, n = LS.qs.length;
    var okN = LS.qs.filter(function (q) { return q.pick === q.right; }).length;
    var lesNo = lessonNo(c, LS.i), lesN = pathStats(c).les;
    var h = '<section class="view lesson-view"><div class="lesson-top"><button class="back" data-act="endlesson">' + I.left + esc(c.name) + '</button><span class="save-indicator">Ответы сохраняются</span></div>' +
      '<div class="lesson-grid"><aside class="lesson-side card only-d"><span class="eyebrow">' + (c.unit === 'правило' ? 'Правило ' : 'Урок ') + lesNo + ' / ' + lesN + '</span><ol class="lesson-steps"><li class="done"><i></i>Теория</li>' +
      LS.qs.map(function (q, qi) { return '<li class="' + (q.pick == null ? '' : q.pick === q.right ? 'done' : 'wrong') + (LS.retry && LS.retrySet.indexOf(qi) < 0 ? ' skip' : '') + '"><i></i>Вопрос ' + (qi + 1) + '</li>'; }).join('') +
      '<li class="' + (answered === n ? 'active' : '') + '"><i></i>Итог</li></ol>' + bar(answered / n, col) + '<span class="small">' + answered + ' из ' + n + ' ответов</span></aside><div class="lesson-main">' +
      '<div class="page-heading"><span class="eyebrow only-m">' + (c.unit === 'правило' ? 'Правило ' : 'Урок ') + lesNo + ' / ' + lesN + '</span><h1 class="h1">' + esc(s.t) + '</h1></div>' +
      '<div class="lesson-stages only-m"><span class="stage done">01 · Теория</span><span class="stage' + (answered ? ' done' : ' active') + '">02 · Практика</span><span class="stage' + (answered === n ? ' active' : '') + '">03 · Итог</span></div>' +
      '<details class="card theory-details"' + (!answered ? ' open' : '') + '><summary>Правило и примеры</summary><div class="theory-content"><div class="rule" style="border-color:' + col + '">' + md(th.rule) + '</div>' +
      th.ex.map(function (e) { return c.cat === 'code' ? '<div class="exm code"><code>' + esc(e[0]) + '</code><span class="small">' + esc(e[1]) + '</span></div>' : '<div class="exm"><span class="ex">' + esc(e[0]) + '</span><span class="small">' + esc(e[1]) + '</span></div>'; }).join('') + (th.tip ? '<div class="tip">' + md(th.tip) + '</div>' : '') + '</div></details>' + poemBlock(s) +
      '<div class="section-head" id="practice"><h2>' + (LS.retry ? 'Работа над ошибками' : 'Проверь себя') + '</h2><span class="pill">' + answered + '/' + n + '</span></div>' +
      '<div class="qbar" role="img" aria-label="Ответов ' + answered + ' из ' + n + '" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + LS.qs.map(function (q) { return '<i class="' + (q.pick == null ? '' : q.pick === q.right ? 'ok' : 'no') + '"></i>'; }).join('') + '</div>';
    LS.qs.forEach(function (q, qi) {
      if (LS.retry && LS.retrySet.indexOf(qi) < 0) return;
      var done = q.pick != null;
      h += '<div class="card qcard exercise-card"><span class="eyebrow">Вопрос ' + (qi + 1) + '</span><div class="qtext sm">' + esc(q.q) + '</div><div class="opts row2">' + q.options.map(function (o, oi) {
        var cls = 'opt';
        if (done) { if (oi === q.right) cls += ' right'; else if (oi === q.pick) cls += ' wrong'; }
        return '<button class="' + cls + '" data-lp="' + qi + ':' + oi + '"' + (done ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>' +
      (done ? '<div class="feedback ' + (q.pick === q.right ? 'ok' : 'no') + '"><b>' + (q.pick === q.right ? 'Верно.' : 'Пока нет. Правильный ответ: ' + esc(q.options[q.right])) + '</b><div class="explanation"><strong>Почему так</strong><p>' + explanation(c,s,q) + '</p></div></div>' : '') + '</div>';
    });
    if (answered < n) h += '<p class="muted">Ответь на оставшиеся вопросы: ' + (n - answered) + '. Можно вернуться позже — ответы сохранятся.</p>';
    else {
      h += '<div class="lesson-result"><span class="eyebrow">' + (LS.retry ? 'После повторения' : 'Результат практики') + '</span><h2>' + okN + ' из ' + n + ' — ' + (okN === n ? 'отлично!' : 'есть над чем поработать') + '</h2><p>Первая попытка: ' + (LS.firstScore == null ? okN : LS.firstScore) + ' из ' + n + '. Повторение помогает разобраться, но не меняет эту оценку.</p></div>';
      if (okN < n) h += '<button class="btn" data-act="retrywrong">Повторить только ошибки (' + (n - okN) + ')</button>';
      h += '<button class="btn primary block" data-act="lessondone">' + (st.lessons[s.id] ? 'Завершить повторение' : 'Завершить урок') + ' →</button>';
    }
    return h + '</div></div></section>';
  }
  function finishLesson() {
    if (!LS || LS.qs.some(function(q) { return q.pick == null; })) return;
    var c = course(LS.cid), s = c.steps[LS.i], n = LS.qs.length;
    var okN = LS.firstScore == null ? LS.qs.filter(function (q) { return q.pick === q.right; }).length : LS.firstScore;
    var wrong = []; LS.qs.forEach(function(q,j) {if(q.pick !== q.right) wrong.push(j);});
    var previous = st.practice[s.id] || {};
    st.practice[s.id] = {last:okN,n:n,wrong:wrong,attempts:(previous.attempts || []).concat([{d:isoOf(new Date()),at:Date.now(),ok:okN,n:n}]).slice(-30)};
    if (wrong.length && okN / n < 0.75) {
      var tm = new Date(); tm.setDate(tm.getDate() + 1); var tk = isoOf(tm), id = 'rep-' + s.id;
      st.extraTasks[tk] = st.extraTasks[tk] || [];
      if (!st.extraTasks[tk].some(function (x) { return x.id === id; })) st.extraTasks[tk].push({ id: id, cat: c.cat, t: 'Повторить: ' + s.t, min: 15, n: 'В уроке были ошибки.' });
    }
    var earned = !st.lessons[s.id];
    if (earned) st.lessons[s.id] = isoOf(new Date());
    V.completed = {cid:c.id,i:LS.i,ok:okN,n:n,earned:earned};
    delete st.session; save(); LS = null; V.page = 'completed'; V.step = null; render(); window.scrollTo(0, 0);
  }
  function viewCompleted() {
    var r = V.completed, c = course(r.cid), ni = nextIdx(c), next = ni >= 0 ? c.steps[ni] : null;
    return '<section class="view completion-view"><div class="completion-mark">✓</div><span class="eyebrow">Ещё один шаг вперёд</span><h1 class="h1">Урок завершён</h1><p class="muted">' + esc(c.steps[r.i].t) + '</p><div class="card"><strong class="completion-score">' + r.ok + '/' + r.n + '</strong><p>в первой попытке' + (r.earned ? ' · +20 очков' : '') + '</p></div>' +
      (next && stepState(c,ni) === 'open' ? '<div class="next-preview"><span class="eyebrow">Дальше по пути</span><h2>' + esc(next.t) + '</h2><button class="btn primary block" data-act="nextlesson">' + (next.exam ? 'Перейти к экзамену' : 'Следующий урок') + ' →</button></div>' : '<p class="muted">Этот блок завершён. Посмотри другие направления.</p>') + '<button class="btn block" data-course="' + c.id + '">К программе курса</button><button class="back" data-tab="today">На сегодня хватит</button></section>';
  }

  // ----- Экзамен -----
  function startExam(cid, i, review) {
    var c = course(cid), s = c.steps[i];
    if (!s.exam || !s.q.length || /locked|wait/.test(stepState(c,i))) return;
    var errors = review && st.exams[s.id] ? st.exams[s.id].wrong : null;
    var source = errors ? s.q.filter(function(q) {return errors.some(function(w) {return w.q===q.q && w.s===q.s;});}) : s.q;
    if (!source.length) return;
    var qs = source.map(function (q) {
      var o = { k: q.k, s: q.s, q: q.q };
      if (q.k === 'choice') { var idx = shuffle(q.options.map(function (x, j) { return j; })); o.options = idx.map(function (j) { return q.options[j]; }); o.right = idx.indexOf(0); }
      if (q.k === 'input') o.a = q.a;
      if (q.k === 'order') { o.words = shuffle(q.words); o.a = q.a; }
      return o;
    });
    EX = { cid: cid, i: i, qs: qs, cur: 0, res: [], pick: null, typed: '', built: [], checked: false, review: !!review };
    st.lastStudy = {cid:cid,sid:s.id,at:Date.now()}; save();
    V.tab = 'learn'; V.course = cid; V.page = 'exam'; render(); window.scrollTo(0, 0);
  }
  function answerText(q) { return q.k === 'choice' ? q.options[q.right] : q.k === 'input' ? q.a[0] : q.a; }
  function check() {
    var q = EX.qs[EX.cur], ok = false, your = '';
    if (q.k === 'choice') { if (EX.pick == null) return; ok = EX.pick === q.right; your = q.options[EX.pick]; }
    if (q.k === 'input') { your = (document.getElementById('ans') || {}).value || EX.typed; if (!your.trim()) return; EX.typed = your; ok = q.a.some(function (a) { return norm(a) === norm(your); }); }
    if (q.k === 'order') { if (!EX.built.length) return; your = EX.built.map(function (j) { return q.words[j]; }).join(' '); ok = norm(your) === norm(q.a); }
    EX.res[EX.cur] = { ok: ok, your: your }; EX.checked = true; render();
  }
  function nextQ() {
    if (EX.cur < EX.qs.length - 1) { EX.cur++; EX.pick = null; EX.typed = ''; EX.built = []; EX.checked = false; render(); window.scrollTo(0, 0); return; }
    finishExam();
  }
  function finishExam() {
    var c = course(EX.cid), s = c.steps[EX.i], n = EX.qs.length, ok = EX.res.filter(function (r) { return r && r.ok; }).length;
    if (EX.review) { V.result = EX.cid + ':' + EX.i; EX = null; V.page = 'result'; render(); toast('Повторение: ' + ok + ' из ' + n + '. Оценка экзамена не изменена.'); return; }
    var e = st.exams[s.id] || { best: 0, n: n, attempts: [] };
    e.n = n; e.last = ok; e.best = Math.max(e.best || 0, ok); e.passed = e.passed || ok / n >= s.pass;
    e.attempts = (e.attempts || []).concat([{ d: isoOf(new Date()), at:Date.now(), ok: ok, n: n }]).slice(-20);
    e.wrong = EX.qs.map(function (q, j) { var r = EX.res[j]; return r && !r.ok ? { q: q.q, your: r.your, right: answerText(q), s: q.s } : null; }).filter(Boolean);
    var by = {}; EX.qs.forEach(function (q, j) { by[q.s] = by[q.s] || [0, 0]; by[q.s][1]++; if (EX.res[j] && EX.res[j].ok) by[q.s][0]++; });
    e.by = by;
    // слабые темы — на повторение завтра
    var tm = new Date(); tm.setDate(tm.getDate() + 1); var tk = isoOf(tm), weak = [];
    Object.keys(by).forEach(function (sid) {
      if (by[sid][0] / by[sid][1] < 0.75) {
        var stp = c.steps.filter(function (x) { return x.id === sid; })[0]; if (!stp) return;
        var id = 'rep-' + sid; st.extraTasks[tk] = st.extraTasks[tk] || [];
        if (!st.extraTasks[tk].some(function (x) { return x.id === id; })) st.extraTasks[tk].push({ id: id, cat: c.cat, t: 'Повторить: ' + stp.t, min: 15, n: 'После экзамена: в этой теме были ошибки.' });
        weak.push(stp.t);
      }
    });
    e.weak = weak;
    st.exams[s.id] = e; save();
    EX = null; V.page = 'result'; V.result = c.id + ':' + EX_I(s, c); render(); window.scrollTo(0, 0);
  }
  function EX_I(s, c) { return c.steps.indexOf(s); }

  function viewExam() {
    var c = course(EX.cid), s = c.steps[EX.i], q = EX.qs[EX.cur], r = EX.res[EX.cur], stp = c.steps.filter(function (x) { return x.id === q.s; })[0];
    var h = '<section class="view"><div class="spread"><button class="back" data-act="quitexam">✕ Прервать</button><span class="small">Порог: ' + Math.round(s.pass * 100) + '%</span></div>' +
      '<div class="title"><div class="eyebrow">' + esc(c.name) + ' · ' + esc(s.t) + '</div><h1 class="h1">Вопрос ' + (EX.cur + 1) + ' из ' + EX.qs.length + '</h1></div>' +
      '<div class="qbar" style="grid-template-columns:repeat(' + EX.qs.length + ',minmax(0,1fr))">' + EX.qs.map(function (x, j) { var rr = EX.res[j]; return '<i class="' + (rr ? (rr.ok ? 'ok' : 'no') : j === EX.cur ? 'cur' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="card qcard">' + (stp ? '<span class="pill" style="align-self:flex-start;color:var(--c-' + c.cat + ')">' + esc(stp.t) + '</span>' : '') +
      '<div class="small">' + (q.k === 'choice' ? 'Выбери ответ' : q.k === 'input' ? 'Впиши ответ' : 'Нажимай на слова по порядку') + '</div><div class="qtext">' + esc(q.q) + '</div></div>';
    if (q.k === 'choice') {
      h += '<div class="opts">' + q.options.map(function (o, j) {
        var cls = 'opt';
        if (EX.checked) { if (j === q.right) cls += ' right'; else if (j === EX.pick) cls += ' wrong'; }
        else if (j === EX.pick) cls += ' sel';
        return '<button class="' + cls + '" data-pick="' + j + '"' + (EX.checked ? ' disabled' : '') + ' aria-pressed="' + (j === EX.pick) + '">' + esc(o) + '</button>';
      }).join('') + '</div>';
    } else if (q.k === 'input') {
      h += '<label class="lab" for="ans">Ответ<input id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(EX.typed) + '"' + (EX.checked ? ' disabled' : '') + '></label>';
    } else {
      h += '<div class="chips built" aria-label="Собранная фраза">' + (EX.built.length ? EX.built.map(function (j, p) { return '<button class="chip" data-unbuild="' + p + '"' + (EX.checked ? ' disabled' : '') + '>' + esc(q.words[j]) + '</button>'; }).join('') : '<span class="small" style="align-self:center">Сюда встанут слова</span>') + '</div>' +
        '<div class="chips">' + q.words.map(function (w, j) { return EX.built.indexOf(j) >= 0 ? '' : '<button class="chip" data-build="' + j + '"' + (EX.checked ? ' disabled' : '') + '>' + esc(w) + '</button>'; }).join('') + '</div>';
    }
    if (EX.checked) {
      h += '<div class="feedback ' + (r.ok ? 'ok' : 'no') + '"><b>' + (r.ok ? 'Верно.' : 'Правильно: ' + esc(answerText(q))) + '</b>' + (stp && stp.theory ? '<div class="explanation"><strong>Почему так</strong><p>' + explanation(c,stp,q) + '</p></div>' : '') + '</div>';
      h += '<button class="btn primary block" data-act="nextq">' + (EX.cur < EX.qs.length - 1 ? 'Дальше' : 'Показать результат') + '</button>';
    } else h += '<button class="btn primary block" data-act="check">Ответить</button>';
    return h + '</section>';
  }

  function viewResult() {
    var p = V.result.split(':'), c = course(p[0]), s = c.steps[+p[1]], e = st.exams[s.id];
    if (!e) { V.page = 'course'; return viewCourse(); }
    var pct = Math.round(e.last / e.n * 100), pass = e.last / e.n >= s.pass;
    var h = '<section class="view"><div class="eyebrow">' + esc(c.name) + ' · ' + esc(s.t) + '</div>' +
      '<div class="hero"><div class="score"><div style="display:flex;flex-direction:column;align-items:center"><span class="pct">' + pct + '%</span><span class="pl">' + e.last + ' из ' + e.n + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="badge" style="background:' + (pass ? 'var(--done)' : 'var(--bad)') + '">' + (pass ? 'Сдано' : 'Не сдано') + '</span>' +
      '<span class="pl">' + (pass ? '+' + e.last * 10 + ' очков. Следующий блок открыт.' : 'Нужно ' + Math.ceil(s.pass * e.n) + ' из ' + e.n + '. Повтори слабые темы и пересдай.') + '</span></div></div></div>';
    h += '<div class="card"><h2 class="h2" style="margin-bottom:6px">По темам</h2>';
    Object.keys(e.by || {}).forEach(function (sid) {
      var b = e.by[sid], stp = c.steps.filter(function (x) { return x.id === sid; })[0], r = b[0] / b[1];
      h += '<div class="trow"><span>' + esc(stp ? stp.t : sid) + '</span>' + bar(r, r === 1 ? 'var(--done)' : r >= 0.75 ? 'var(--c-read)' : 'var(--bad)') + '<span class="v">' + b[0] + '/' + b[1] + '</span></div>';
    });
    if (e.weak && e.weak.length) h += '<p class="small" style="color:var(--bad);margin-top:6px">На повторение в план на завтра: ' + esc(e.weak.join('; ')) + '.</p>';
    h += '</div>';
    if (e.wrong.length) {
      h += '<div class="card"><h2 class="h2" style="margin-bottom:4px">Ошибки</h2>' + e.wrong.map(function (w) {
        return '<div class="err"><span class="small">' + esc(w.q) + '</span><span><s>' + esc(w.your) + '</s> → <b>' + esc(w.right) + '</b></span></div>';
      }).join('') + '</div>';
      var txt = 'Я сдавал экзамен «' + c.name + ': ' + s.t + '» и ошибся в этих вопросах. Объясни каждую ошибку простыми словами и дай по 2 упражнения на каждую тему.\n\n' +
        e.wrong.map(function (w, j) { return (j + 1) + '. ' + w.q + '\nМой ответ: ' + w.your + '\nПравильно: ' + w.right; }).join('\n\n');
      h += claudeLink(txt, 'Разобрать ошибки с Claude', 'primary block');
    } else h += '<div class="card"><p class="muted">Ни одной ошибки.</p></div>';
    if (e.wrong.length) h += '<button class="btn primary block" data-repeat-exam="' + c.id + ':' + p[1] + '">Повторить только ошибки</button>';
    var next = nextIdx(c);
    if (pass && next >= 0 && stepState(c,next) === 'open') h += '<button class="btn primary block" data-next-course="' + c.id + '">Следующий шаг →</button>';
    h += '<button class="btn block" data-course="' + c.id + '">К урокам</button></section>';
    return h;
  }

  // ----- Карточки слов -----
  function viewCards() {
    var q = CARDS.list[CARDS.i];
    var h = '<section class="view"><div class="spread"><button class="back" data-act="endcards">‹ Английский</button><span class="small">' + (CARDS.i + 1) + ' из ' + CARDS.list.length + '</span></div>';
    if (CARDS.done) {
      return h + '<div class="card flash"><div class="w">' + CARDS.known + ' из ' + CARDS.list.length + '</div><div class="t">слов вспомнил сразу</div></div>' +
        '<button class="btn primary block" data-act="cards">Ещё 10 слов</button><button class="btn block" data-act="endcards">Готово</button></section>';
    }
    h += '<div class="card flash"><div class="w">' + esc(q[0]) + '</div><div class="t">[' + esc(q[1]) + ']</div>' + (CARDS.shown ? '<div class="r">' + esc(q[2]) + '</div>' : '') + '</div>';
    h += CARDS.shown ? '<div class="btns" style="display:grid;grid-template-columns:1fr 1fr"><button class="btn" data-card="0">Не вспомнил</button><button class="btn primary" data-card="1">Знаю</button></div>'
      : '<button class="btn primary block" data-act="show">Показать перевод</button>';
    return h + '</section>';
  }

  // ----- Мой рост -----
  function weekStats(wk) {
    var out = {min:0,tasks:0,lessons:0,days:0};
    for (var d=wk*7;d<Math.min(N,wk*7+7);d++) { var s=stat(d); out.min+=s.doneMin; out.tasks+=s.done; if(s.done)out.days++; }
    Object.keys(st.lessons).forEach(function(id) {var date=st.lessons[id];if(typeof date==='string' && date>=keyOf(wk*7) && date<=keyOf(Math.min(N-1,wk*7+6)))out.lessons++;});
    return out;
  }
  function deltaText(now,before) { var d=now-before; return (d>0?'+':'')+d; }
  function weekOverview(wk) {
    var s=weekStats(wk),prev=wk>0?weekStats(wk-1):null;
    return '<div class="week-panel"><div class="section-head"><div><span class="eyebrow">Смотри на путь целиком</span><h2>Твоя неделя</h2></div></div><div class="week-switch" role="group" aria-label="Выбрать неделю">' + P.weeks.map(function(w,i){return '<button data-week="'+i+'" aria-pressed="'+(wk===i)+'">'+(i+1)+'</button>';}).join('') + '</div><div class="week-summary"><span class="eyebrow">Неделя '+(wk+1)+'</span><div class="week-numbers"><div><strong>'+fmtShort(s.min)+'</strong><span>по выполненным делам</span></div><div><strong>'+s.tasks+'</strong><span>дел завершено</span></div><div><strong>'+s.lessons+'</strong><span>уроков пройдено</span></div></div><p class="week-comparison">'+(prev?'К прошлой неделе: <b>'+deltaText(s.min,prev.min)+' мин</b> · '+deltaText(s.tasks,prev.tasks)+' дел · '+deltaText(s.lessons,prev.lessons)+' уроков.':'Первая неделя — точка отсчёта. Сравнение появится со второй.')+'</p></div></div>';
  }
  function learningInsights() {
    var weak={},history=[],evidence={};
    function latest(attempts) {return (attempts||[]).reduce(function(best,a){return Math.max(best,a.at || Date.parse(a.d) || 0);},0);}
    COURSES.forEach(function(c) {
      if(c.type!=='path')return;
      c.steps.forEach(function(s,i) {
        if(!s.exam)return;
        var e=st.exams[s.id]; if(!e)return;
        (e.attempts||[]).forEach(function(a) {history.push({c:c,i:i,t:s.t,d:a.d,ok:a.ok,n:a.n,pass:a.ok/a.n>=s.pass});});
        Object.keys(e.by||{}).forEach(function(sid) {var result=e.by[sid],j=c.steps.findIndex(function(x){return x.id===sid;}),at=latest(e.attempts);if(j<0 || evidence[sid]!=null && at<evidence[sid])return;evidence[sid]=at;if(result[0]/result[1]<.75)weak[sid]={c:c,i:j,ok:result[0],n:result[1]};else delete weak[sid];});
      });
      c.steps.forEach(function(s,i) {var p=st.practice[s.id];if(!p||s.exam || evidence[s.id]!=null && latest(p.attempts)<=evidence[s.id])return;if(p.wrong&&p.wrong.length)weak[s.id]={c:c,i:i,ok:p.last,n:p.n};else if(p.wrong)delete weak[s.id];});
    });
    var ids=Object.keys(weak),h='<div class="card weak-topics"><div class="section-head"><div><span class="eyebrow">Знания становятся прочнее</span><h2>Что стоит повторить</h2></div><span class="pill">'+ids.length+'</span></div>';
    if(!ids.length)h+='<p class="muted">Пока нет тем с неразобранными ошибками. Они появятся здесь после практики и экзаменов.</p>';
    ids.forEach(function(sid){var w=weak[sid];h+='<button class="insight-row" data-review-topic="'+w.c.id+':'+w.i+'"><span><small>'+esc(w.c.name)+'</small><b>'+esc(w.c.steps[w.i].t)+'</b></span><span>'+w.ok+'/'+w.n+' '+I.right+'</span></button>';});
    h+='</div><div class="card exam-history"><div class="section-head"><div><span class="eyebrow">Каждая попытка — опыт</span><h2>История экзаменов</h2></div></div>';
    history.sort(function(a,b){return String(b.d).localeCompare(String(a.d));});
    if(!history.length)h+='<p class="muted">Пока нет попыток. Пройди уроки блока, чтобы открыть первый экзамен.</p>';
    history.slice(0,30).forEach(function(a){h+='<button class="insight-row" data-result="'+a.c.id+':'+a.i+'"><span><small>'+esc(a.c.name)+' · '+esc(a.d)+'</small><b>'+esc(a.t)+'</b></span><span class="attempt-score '+(a.pass?'passed':'failed')+'">'+a.ok+'/'+a.n+'<small>'+(a.pass?'сдан':'на повторение')+'</small></span></button>';});
    if(history.length>30)h+='<p class="small">Показаны 30 последних попыток.</p>';
    return h+'</div>';
  }
  function viewGrowth() {
    var t = totals(), sk = streak(), aw = awards(t), got = aw.filter(function (a) { return a.ok; }).length, rt = rawToday();
    var into = t.xp % XP_LEVEL;
    var ov = overall(), maxP = 1; ov.list.forEach(function (o) { if (o.pct > maxP) maxP = o.pct; });
    var mt = new Date();
    var h = '<section class="view growth-view">' + topbar('Статистика', rt < 0 ? 'План ещё не начался' : rt >= N ? 'План пройден целиком' : 'День ' + (rt + 1) + ' из ' + N) +
      '<div class="stat-tiles"><div class="tile"><b>' + t.lessons + '</b><span>' + plural(t.lessons, 'урок пройден', 'урока пройдено', 'уроков пройдено') + '</span></div><div class="tile"><b>' + sk + '</b><span>' + plural(sk, 'день', 'дня', 'дней') + ' подряд</span></div><div class="tile"><b>' + ov.pct + '%</b><span>общий прогресс</span></div><div class="tile"><b>' + fmtShort(t.min) + '</b><span>занятий</span></div></div>' +
      '<div class="stat-grid"><div class="card"><div class="spread"><h2 class="h2">Активность за месяц</h2><span class="small">30 дней до ' + mt.getDate() + ' ' + MONS[mt.getMonth()] + '</span></div>' + monthChart() + '</div>' +
      '<div class="card"><h2 class="h2" style="margin-bottom:10px">Распределение по направлениям</h2>' + ov.list.map(function (o) { return '<div class="trow dist-row"><span class="row"><i class="dot" style="background:var(--c-' + o.c.cat + ')"></i>' + esc(o.c.name) + '</span>' + bar(o.pct / 100, 'var(--c-' + o.c.cat + ')') + '<span class="v">' + o.pct + '%</span></div>'; }).join('') + '</div></div>' +
      weekOverview(V.week) + learningInsights();
    h += '<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="spread"><b style="font-family:var(--f-d);font-size:24px;font-weight:600">Уровень ' + t.level + '</b><span class="small">' + t.xp + ' ' + plural(t.xp, 'очко', 'очка', 'очков') + ' · до ' + (t.level + 1) + '-го ' + (XP_LEVEL - into) + '</span></div>' +
      '<div class="bar" style="height:10px;border-radius:5px"><i style="width:' + Math.round(into / XP_LEVEL * 100) + '%;background:var(--accent)"></i></div>' +
      '<div class="small">Очки: 1 минута занятий = 1, урок = 20, сданный экзамен = 10 за каждый верный ответ.</div></div>';
    // календарь
    var first = dateOf(0), last = dateOf(N - 1);
    h += '<div class="card"><div class="spread" style="margin-bottom:8px"><h2 class="h2">Календарь</h2><span class="small">' + first.getDate() + ' ' + MONS[first.getMonth()] + ' — ' + last.getDate() + ' ' + MONS[last.getMonth()] + '</span></div>' +
      '<div class="dows">' + DOW.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="cal" style="margin-top:8px">';
    for (var i = 0; i < N; i++) {
      var d = dateOf(i), s = stat(i), cls = 'cell';
      if (s.n && s.done === s.n) cls += ' full'; else if (s.done) cls += ' part';
      if (i === rt) cls += ' today';
      if (modeOf(i) === 'shift') cls += ' shift';
      h += '<button class="' + cls + '" data-day="' + i + '" aria-label="' + d.getDate() + ' ' + MON[d.getMonth()] + (modeOf(i) === 'shift' ? ', смена' : '') + ', сделано ' + s.done + ' из ' + s.n + '">' +
        ((i === 0 || d.getDate() === 1) ? '<span class="m">' + MONS[d.getMonth()] + '</span>' : '') + d.getDate() + '</button>';
    }
    h += '</div><div class="legend"><span><i class="sw" style="background:var(--full)"></i>всё сделано</span><span><i class="sw" style="background:var(--part)"></i>частично</span>' +
      '<span><i class="sw" style="border:2px solid var(--accent)"></i>сегодня</span><span><i class="sw" style="width:5px;height:5px;border-radius:50%;background:var(--ink)"></i>смена</span></div></div>';
    // неделя
    var wk = V.week, maxNorm = 1, cols = [];
    for (var k = 0; k < 7; k++) { var cs = stat(wk * 7 + k); cols.push(cs); if (cs.totalMin > maxNorm) maxNorm = cs.totalMin; }
    var svg = '<svg viewBox="0 0 322 132" role="img" aria-label="Минуты по дням недели ' + (wk + 1) + ': ' + cols.map(function (c, k) { return DOW[k] + ' ' + c.doneMin + ' из ' + c.totalMin; }).join(', ') + '">';
    cols.forEach(function (c, k) {
      var x = 9 + k * 46, hn = 102 * c.totalMin / maxNorm, hd = 102 * c.doneMin / maxNorm, isT = wk * 7 + k === rt;
      svg += '<rect x="' + x + '" y="' + (110 - hn).toFixed(1) + '" width="30" height="' + hn.toFixed(1) + '" rx="5" fill="var(--soft)"/>';
      if (hd > 0) svg += '<rect x="' + x + '" y="' + (110 - hd).toFixed(1) + '" width="30" height="' + hd.toFixed(1) + '" rx="5" fill="' + (c.done === c.n ? 'var(--full)' : 'var(--done)') + '"/>';
      svg += '<text x="' + (x + 15) + '" y="126" text-anchor="middle" font-family="Onest, system-ui, sans-serif" font-size="11" font-weight="' + (isT ? 600 : 400) + '" fill="' + (isT ? 'var(--accent)' : 'var(--mute)') + '">' + DOW[k] + '</text>';
    });
    h += '<div class="card chart"><div class="spread" style="margin-bottom:8px"><h2 class="h2">Неделя ' + (wk + 1) + ' по дням</h2><span class="small">серое — план, зелёное — сделано</span></div>' + svg + '</svg></div>';
    // по темам
    var maxCat = 1; CATS.forEach(function (c) { if ((t.byCat[c[0]] || 0) > maxCat) maxCat = t.byCat[c[0]]; });
    h += '<div class="card"><h2 class="h2" style="margin-bottom:6px">Время по темам</h2>';
    CATS.forEach(function (c) {
      var v = t.byCat[c[0]] || 0; if (c[0] === 'plan' && !v) return;
      h += '<div class="trow" style="grid-template-columns:110px minmax(0,1fr) 60px"><span class="row"><i class="dot" style="background:var(--c-' + c[0] + ')"></i>' + c[1] + '</span>' + bar(v / maxCat, 'var(--c-' + c[0] + ')') + '<span class="v">' + fmtShort(v) + '</span></div>';
    });
    h += '</div>';
    // награды
    h += '<div class="card"><div class="spread" style="margin-bottom:12px"><h2 class="h2">Награды</h2><span class="small">' + got + ' из ' + aw.length + '</span></div><div class="awards">' + aw.map(function (a) {
      return '<div class="aw' + (a.ok ? '' : ' off') + '"><span class="c" style="' + (a.ok ? 'background:' + a.col : '') + '">' + (a.ok ? a.c : I.lock.replace('<svg ', '<svg width="18" height="18" ')) + '</span>' + a.t + '</div>';
    }).join('') + '</div></div>';
    // итоги недели
    var rf = st.reflect[wk] || {};
    h += '<div class="card" style="display:flex;flex-direction:column;gap:10px"><h2 class="h2">Итоги недели ' + (wk + 1) + '</h2>' +
      '<label class="lab" for="rf-a">Что получилось<textarea id="rf-a" data-rf="a">' + esc(rf.a) + '</textarea></label>' +
      '<label class="lab" for="rf-b">Что мешало<textarea id="rf-b" data-rf="b">' + esc(rf.b) + '</textarea></label>' +
      '<label class="lab" for="rf-c">Что изменю на следующей неделе<textarea id="rf-c" data-rf="c">' + esc(rf.c) + '</textarea></label>' +
      '<span class="small">Сохраняется само.</span></div>';
    // копия
    h += '<div class="card"><h2 class="h2" style="margin-bottom:6px">Резервная копия</h2>' +
      '<p class="muted">Весь прогресс хранится только в этом телефоне. Раз в неделю сохраняй копию в файл, чтобы не потерять его при очистке браузера или смене телефона.</p>' +
      '<p class="small" style="margin-top:6px">' + (st.backupAt ? 'Последняя копия: ' + st.backupAt.split('-').reverse().join('.') : 'Копию ещё не делал.') + '</p>' +
      '<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="export">Сохранить в файл</button>' +
      '<label class="btn" for="importFile">Восстановить из файла</label><input type="file" id="importFile" accept=".json,application/json"></div></div>';
    h += syncCard();
    h += '<div class="card theme-card only-m"><h2 class="h2" style="margin-bottom:6px">Тема</h2><div class="theme-switch" role="group" aria-label="Тема оформления">' + [['', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(function (x) { return '<button data-theme="' + x[0] + '" aria-pressed="' + (theme === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    return h + '<div class="ver">Версия ' + APP_VERSION + ' · план v' + P.version + '</div></section>';
  }

  // ---------- синхронизация через секретный Gist ----------
  // Токен и снимок «как было при прошлой синхронизации» лежат в отдельном ключе: ни в файл копии, ни в Gist они не попадают.
  var SK = 'rostok-sync', SEP = '\u001f', GFILE = 'rostok-state.json';
  var SY = { cfg: null, busy: false, again: false, err: '', timer: null };
  function syLoad() { try { var r = localStorage.getItem(SK); SY.cfg = r ? JSON.parse(r) : null; } catch (e) { SY.cfg = null; } }
  function sySave() { try { localStorage.setItem(SK, JSON.stringify(SY.cfg)); } catch (e) {} }
  function flat(x) {
    var c = {}, o = {}, tm = {}, bm = {};
    Object.keys(x).forEach(function (k) { if (['tracks','booksAdded','session','lastStudy','backupAt'].indexOf(k)<0) c[k] = x[k]; });
    (x.tracks || []).forEach(function (t) { if (t && t.name != null) tm[t.name] = t.stage; });
    (x.booksAdded || []).forEach(function (b) { if (b && b.id != null) bm[b.id] = b.t; });
    c.tracksM = tm; c.booksAddedM = bm;
    function rec(p, v) {
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(function (k) { rec(p === '' ? k : p + SEP + k, v[k]); });
      else if (p !== '') o[p] = JSON.stringify(v);
    }
    rec('', c); return o;
  }
  function unflat(o) {
    var x = {};
    Object.keys(o).forEach(function (p) {
      var a = p.split(SEP), cur = x, i;
      for (i = 0; i < a.length; i++) if (a[i] === '__proto__' || a[i] === 'constructor' || a[i] === 'prototype') return;
      for (i = 0; i < a.length - 1; i++) { if (!cur[a[i]] || typeof cur[a[i]] !== 'object') cur[a[i]] = {}; cur = cur[a[i]]; }
      cur[a[a.length - 1]] = JSON.parse(o[p]);
    });
    var tm = x.tracksM || {}; x.tracks = Object.keys(tm).map(function (n) { return { name: n, stage: num(tm[n]) }; }); delete x.tracksM;
    var bm = x.booksAddedM || {}; x.booksAdded = Object.keys(bm).map(function (i) { return { id: i, t: bm[i] }; }); delete x.booksAddedM;
    return x;
  }
  function same(a, b) { var ka = Object.keys(a); if (ka.length !== Object.keys(b).length) return false; return ka.every(function (k) { return a[k] === b[k]; }); }
  // Если один пункт изменён на обоих устройствах: число — большее, текст — длиннее, иначе большее по алфавиту (одинаково на обоих устройствах).
  function pick(l, r) {
    var a = JSON.parse(l), b = JSON.parse(r);
    if (typeof a === 'number' && typeof b === 'number') return a >= b ? l : r;
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return a.length > b.length ? l : r;
    if (typeof a === 'string' && typeof b === 'string' && a.length !== b.length) return a.length > b.length ? l : r;
    return l >= r ? l : r;
  }
  // Три стороны: здесь (L), в Gist (R) и «как было при прошлой синхронизации» (B). Так удаление отметки не воскресает.
  function merge3(L, R, B) {
    var m = {}, keys = Object.keys(L);
    Object.keys(R).forEach(function (k) { if (!(k in L)) keys.push(k); });
    keys.forEach(function (k) {
      var l = L[k], r = R[k], b = B[k], v;
      if (l === r) v = l; else if (l === b) v = r; else if (r === b) v = l; else if (l === undefined) v = r; else if (r === undefined) v = l; else v = pick(l, r);
      if (v !== undefined) m[k] = v;
    });
    return m;
  }
  function gh(method, path, body) {
    var h = { 'Authorization': 'Bearer ' + SY.cfg.token, 'Accept': 'application/vnd.github+json' };
    if (body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      if (r.status === 401) throw new Error('auth');
      if (r.status === 403 || r.status === 429) throw new Error('limit');
      if (!r.ok) throw new Error('http' + r.status);
      return r.json();
    });
  }
  function findGist(pg) {
    return gh('GET', '/gists?per_page=100&page=' + pg).then(function (l) {
      for (var i = 0; i < l.length; i++) if (l[i].files && l[i].files[GFILE]) return l[i].id;
      return (l.length === 100 && pg < 5) ? findGist(pg + 1) : null;
    });
  }
  function readGist(id) {
    return gh('GET', '/gists/' + id).then(function (g) {
      var f = g.files && g.files[GFILE]; if (!f) throw new Error('nofile');
      return f.truncated ? fetch(f.raw_url).then(function (r) { return r.text(); }) : f.content;
    }).then(function (t) {
      var o; try { o = JSON.parse(t); } catch (e) { throw new Error('bad'); }
      if (!o || !validState(o.state)) throw new Error('bad');
      return o.state;
    });
  }
  function pushGist(id, state) {
    var shared={};Object.keys(state).forEach(function(k){if(['session','lastStudy','backupAt'].indexOf(k)<0)shared[k]=state[k];});
    var files = {}; files[GFILE] = { content: JSON.stringify({ app: 'rostok-sync', v: 1, saved: new Date().toISOString(), state: shared }) };
    return id ? gh('PATCH', '/gists/' + id, { files: files }).then(function () { return id; })
              : gh('POST', '/gists', { description: 'Росток: прогресс (синхронизация)', public: false, files: files }).then(function (g) { return g.id; });
  }
  function syErr(e) {
    var m = e && e.message;
    if (m === 'auth') return 'Токен не подошёл. Создай новый и подключи заново.';
    if (m === 'limit') return 'GitHub просит подождать. Попробуй позже.';
    if (m === 'http404') return 'Gist не найден. Нажми «Синхронизировать» ещё раз.';
    if (m === 'bad' || m === 'nofile') return 'Файл в Gist повреждён. Ничего не перезаписал.';
    if (e instanceof TypeError) return 'Нет связи.';
    return 'Не получилось синхронизировать.';
  }
  function schedSync() { if (!SY.cfg) return; clearTimeout(SY.timer); SY.timer = setTimeout(function () { syncNow(false); }, 6000); }
  function syncNow(manual) {
    if (!SY.cfg) return;
    if (storageReadOnly || storageProblem) { if(manual)toast('Сначала восстанови локальное сохранение. Синхронизация приостановлена.'); return; }
    if (SY.busy) { SY.again = true; return; }
    SY.busy = true; SY.err = ''; if (manual) render();
    var gid = SY.cfg.gistId, changedLocal = false;
    (gid ? Promise.resolve(gid) : findGist(1)).then(function (id) { gid = id; return id ? readGist(id) : null; })
      .then(function (remote) {
        var L = flat(st), R = remote ? flat(remote) : {}, B = SY.cfg.base || {};
        var M = merge3(L, R, B);
        changedLocal = !same(M, L);
        if (changedLocal) {
          if (!same(flat(st), L)) { SY.again = true; return null; } // пока шла сеть, ты что-то изменил: объединим в следующий раз
          var previousState=st, candidate=unflat(M);
          if(!Object.prototype.hasOwnProperty.call(candidate,'checks'))candidate.checks={};
          ['session','lastStudy','backupAt'].forEach(function(k){if(previousState[k]!=null)candidate[k]=previousState[k];});
          if(!validState(candidate))throw new Error('bad');
          st = candidate; fixState();
          if(!persist()) {st=previousState;throw new Error('local');}
        }
        SY.cfg.base = M;
        var pr = (!remote || !same(M, R)) ? pushGist(gid, st) : Promise.resolve(gid);
        return pr.then(function (id) { SY.cfg.gistId = id; SY.cfg.at = Date.now(); sySave(); });
      })
      .then(function () { SY.busy = false; if (manual) toast('Синхронизировано'); var ae = document.activeElement; if ((manual || changedLocal) && !(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName))) render(); })
      .catch(function (e) {
        SY.busy = false; SY.err = syErr(e);
        if (e && e.message === 'http404') { SY.cfg.gistId = null; SY.cfg.base = {}; sySave(); }
        if (manual) toast(SY.err); var ae = document.activeElement; if (!(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName))) render();
      })
      .then(function () { if (SY.again) { SY.again = false; setTimeout(function () { syncNow(false); }, 800); } });
  }
  function syncOn() {
    var el = document.getElementById('sy-token'), tk = el ? el.value.trim() : '';
    if (!/^[\w-]{20,}$/.test(tk)) { toast('Вставь токен целиком'); return; }
    SY.cfg = { token: tk, gistId: null, base: {}, at: 0 };
    gh('GET', '/gists?per_page=1').then(function () {
      if (!confirm('Перед включением сохраню копию прогресса в файл, на всякий случай. Продолжить?')) { SY.cfg = null; return; }
      exportFile(); sySave(); syncNow(true);
    }).catch(function (e) { SY.cfg = null; toast(syErr(e)); });
  }
  function syncOff() {
    if (!confirm('Отключить синхронизацию на этом устройстве? Данные в Gist останутся, токен удалится отсюда.')) return;
    SY.cfg = null; clearTimeout(SY.timer); try { localStorage.removeItem(SK); } catch (e) {} render();
  }
  function fmtAt(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function syncCard() {
    var h = '<div class="card"><h2 class="h2" style="margin-bottom:6px">Синхронизация телефона и компьютера</h2>';
    if (SY.cfg) {
      h += '<p class="muted">Включена. Прогресс объединяется через твой секретный Gist на GitHub.</p>' +
        '<p class="small" style="margin-top:6px">' + (SY.busy ? 'Синхронизирую…' : SY.err ? esc(SY.err) : SY.cfg.at ? 'Последняя синхронизация: ' + fmtAt(SY.cfg.at) : 'Ещё не синхронизировалось.') + '</p>' +
        '<p class="small" style="margin-top:6px">Изменения объединяются с последним снимком. При одновременном редактировании одного поля на двух устройствах возможен конфликт; перед переносом сохраняй файл копии.</p>' +
        '<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="syncnow"' + (SY.busy ? ' disabled' : '') + '>Синхронизировать</button><button class="btn" data-act="syncoff">Отключить</button></div></div>';
      return h;
    }
    return h + '<p class="muted">Сейчас прогресс у каждого устройства свой. Чтобы он был общим:</p>' +
      '<p class="small" style="margin-top:6px">1. Открой <a class="lnk" href="https://github.com/settings/tokens/new?scopes=gist&description=Rostok" target="_blank" rel="noopener">страницу создания токена</a>, войди в GitHub, внизу нажми Generate token. Нужен токен (classic) только с правом gist. Токен — это длинный пароль для приложения.<br>2. Скопируй его и вставь ниже. Он хранится только в этом браузере. В чат его не присылай.<br>3. На другом устройстве сделай то же самое с тем же токеном.</p>' +
      '<p class="small" style="margin-top:6px">Gist секретный: его нельзя найти поиском, но он открывается по ссылке без пароля. Там будут твой прогресс и записи «Итоги недели». Перед включением приложение сохранит копию в файл.</p>' +
      '<label class="lab" for="sy-token" style="margin-top:10px">Токен<input type="password" id="sy-token" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Вставь токен"></label>' +
      '<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="syncon">Подключить</button></div></div>';
  }

  // ---------- отрисовка ----------
  function render() {
    var html, full = false;
    if (V.page === 'exam' && EX) { html = viewExam(); full = true; }
    else if (V.page === 'lesson' && LS) { html = viewLesson(); full = true; }
    else if (V.page === 'completed' && V.completed) { html = viewCompleted(); full = true; }
    else if (V.page === 'result') { html = viewResult(); full = true; }
    else if (V.page === 'cards' && CARDS) { html = viewCards(); full = true; }
    else if (V.tab === 'learn' && V.page === 'course') html = viewCourse();
    else html = V.tab === 'learn' ? viewLearn() : V.tab === 'growth' ? viewGrowth() : V.tab === 'plan' ? viewPlan() : viewToday();
    app.innerHTML = (storageProblem ? '<div class="storage-alert" role="alert"><strong>' + esc(storageProblem) + '</strong><button class="btn" data-act="' + (storageReadOnly ? 'exportoriginal' : 'export') + '">' + (storageReadOnly ? 'Скачать оригинал' : 'Сохранить в файл') + '</button></div>' : '') + (recoveryNotice ? '<div class="recovery-notice" role="status">' + esc(recoveryNotice) + '</div>' : '') + html;
    app.className = full ? 'full' : '';
    document.body.classList.toggle('app-full', full);
    if (V.page === 'lesson' && LS) loadPoem();
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) { if (tabs[i].getAttribute('data-tab') === V.tab) tabs[i].setAttribute('aria-current', 'page'); else tabs[i].removeAttribute('aria-current'); }
    var tb = document.querySelectorAll('[data-theme]');
    for (var j = 0; j < tb.length; j++) tb[j].setAttribute('aria-pressed', tb[j].getAttribute('data-theme') === theme);
  }
  function go(tab, page, extra) {
    V.tab = tab; V.page = page || null; V.step = null; pendingDel = null;
    if (extra) for (var k in extra) V[k] = extra[k];
    try { history.replaceState(null, '', tab === 'today' ? location.pathname + location.search : '#' + tab); } catch (e) {}
    render(); window.scrollTo(0, 0);
  }

  var tt;
  function toast(msg) { var el = document.getElementById('toast'); el.textContent = msg; el.hidden = false; clearTimeout(tt); tt = setTimeout(function () { el.hidden = true; }, 2600); }
  function showCopyModal(text) {
    var m = document.getElementById('modal');
    m.innerHTML = '<div class="card"><h2 class="h2">Скопируй текст для Claude</h2><p class="muted">Телефон не дал скопировать автоматически. Выдели текст и скопируй, потом вставь в чат.</p>' +
      '<textarea id="copyText" readonly>' + esc(text) + '</textarea><div class="btns"><a class="btn primary" href="' + CLAUDE_URL + '" target="_blank" rel="noopener">Открыть Claude</a><button class="btn" data-act="closemodal">Закрыть</button></div></div>';
    m.hidden = false;
    var ta = document.getElementById('copyText'); try { ta.focus(); ta.select(); } catch (e) {}
  }

  // ---------- действия ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-copy]');
    if (a) {
      var text = a.getAttribute('data-copy');
      try {
        navigator.clipboard.writeText(text).then(function () { toast('Задание скопировано. Вставь его в чат с Claude'); }, function () { showCopyModal(text); });
      } catch (err) { e.preventDefault(); showCopyModal(text); }
      return;
    }
    var b = e.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act'), v;
    if ((v = b.getAttribute('data-tab'))) { go(v); return; }
    if ((v = b.getAttribute('data-week')) != null) { V.week = Math.max(0,Math.min(P.weeks.length-1,+v)); render(); return; }
    if ((v = b.getAttribute('data-filter'))) { V.filter = v; render(); return; }
    if ((v = b.getAttribute('data-sel')) != null) { sel = clamp(+v); render(); return; }
    if ((v = b.getAttribute('data-theme')) != null) { theme = v; try { if (v) localStorage.setItem(THEME_KEY, v); else localStorage.removeItem(THEME_KEY); } catch (err) {} applyTheme(); render(); return; }
    if ((v = b.getAttribute('data-find'))) { var fd = v.split(':'), fc = course(fd[0]), fi = +fd[1]; if (fc && stepState(fc, fi) === 'open' && !fc.steps[fi].exam) startLesson(fd[0], fi); else go('learn', 'course', { course: fd[0] }); return; }
    if ((v = b.getAttribute('data-deltask'))) { var dk = keyOf(sel); st.extraTasks[dk] = (st.extraTasks[dk] || []).filter(function (x) { return x.id !== v; }); if (st.checks[dk]) delete st.checks[dk][v]; save(); render(); return; }
    if ((v = b.getAttribute('data-review-topic'))) { var topic=v.split(':'); V.tab='learn'; V.course=topic[0]; startLesson(topic[0],+topic[1]); return; }
    if ((v = b.getAttribute('data-next-course'))) { nextInCourse(v); return; }
    if ((v = b.getAttribute('data-repeat-exam'))) { var er=v.split(':'); startExam(er[0],+er[1],true); return; }
    if ((v = b.getAttribute('data-day')) != null) { sel = +v; go('today'); return; }
    if ((v = b.getAttribute('data-mode'))) { st.modes[keyOf(sel)] = v; save(); render(); return; }
    if ((v = b.getAttribute('data-task')) != null) {
      var k = keyOf(sel); st.checks[k] = st.checks[k] || {};
      if (st.checks[k][v]) delete st.checks[k][v]; else st.checks[k][v] = 1;
      save(); render();
      var s = stat(sel); if (s.n && s.done === s.n && st.checks[k][v]) toast('День закрыт полностью');
      return;
    }
    if ((v = b.getAttribute('data-course'))) { go('learn', 'course', { course: v }); return; }
    if ((v = b.getAttribute('data-step')) != null) { V.step = +v; render(); window.scrollTo(0, 0); return; }
    if ((v = b.getAttribute('data-lesson'))) {
      if (st.lessons[v]) delete st.lessons[v]; else { st.lessons[v] = isoOf(new Date()); toast('+20 очков. Урок пройден'); }
      save(); V.step = null; render(); return;
    }
    if ((v = b.getAttribute('data-lopen'))) { var lp = v.split(':'); startLesson(lp[0], +lp[1]); return; }
    if ((v = b.getAttribute('data-lp'))) { var lq = v.split(':'); if (LS && LS.qs[+lq[0]].pick == null) {
      LS.qs[+lq[0]].pick = +lq[1];
      if (LS.firstScore == null && LS.qs.every(function(q){return q.pick!=null;})) {LS.firstScore=LS.qs.filter(function(q){return q.pick===q.right;}).length;}
      rememberLesson(); render();
    } return; }
    if ((v = b.getAttribute('data-exam'))) { var p = v.split(':'); startExam(p[0], +p[1]); return; }
    if ((v = b.getAttribute('data-result'))) { V.result = v; V.page = 'result'; render(); window.scrollTo(0, 0); return; }
    if ((v = b.getAttribute('data-pick')) != null) { EX.pick = +v; render(); return; }
    if ((v = b.getAttribute('data-build')) != null) { EX.built.push(+v); render(); return; }
    if ((v = b.getAttribute('data-unbuild')) != null) { EX.built.splice(+v, 1); render(); return; }
    if ((v = b.getAttribute('data-cnt'))) { var cid = V.course, c0 = counter(cid); st.counters[cid] = { v: Math.max(0, c0.v + (+v)), target: c0.target }; save(); render(); return; }
    if ((v = b.getAttribute('data-track')) != null) { var tr = st.tracks[+v], sg = +b.getAttribute('data-stage'); tr.stage = tr.stage === sg + 1 ? sg : sg + 1; save(); render(); if (tr.stage === 5) toast('Трек выпущен!'); return; }
    if ((v = b.getAttribute('data-del'))) {
      if (pendingDel !== v) { pendingDel = v; render(); return; }
      var q = v.split(':');
      if (q[0] === 'track') st.tracks.splice(+q[1], 1);
      if (q[0] === 'book') { st.booksAdded = st.booksAdded.filter(function (x) { return x.id !== q[1]; }); delete st.books[q[1]]; }
      pendingDel = null; save(); render(); return;
    }
    if ((v = b.getAttribute('data-card')) != null) { if (v === '1') CARDS.known++; if (CARDS.i < CARDS.list.length - 1) { CARDS.i++; CARDS.shown = false; } else CARDS.done = true; render(); return; }
    switch (act) {
      case 'reloadapp': if(!EX || confirm('Экзамен будет начат заново. Обновить приложение сейчас?')) location.reload(); break;
      case 'resume': resumeStudy(); break;
      case 'retrywrong': LS.retrySet=[]; LS.qs.forEach(function(q,j){if(q.pick!==q.right) {LS.retrySet.push(j);q.pick=null;}}); LS.retry=true; rememberLesson(); render(); document.getElementById('practice').scrollIntoView({block:'start'}); break;
      case 'nextlesson': nextInCourse(V.completed.cid); break;
      case 'prev': if (sel > 0) { sel--; render(); } break;
      case 'next': if (sel < N - 1) { sel++; render(); } break;
      case 'gotoday': sel = clamp(rawToday()); render(); break;
      case 'prevweek': if (sel >= 7) { sel -= 7; render(); } break;
      case 'nextweek': if (sel + 7 < N) { sel += 7; render(); } break;
      case 'search': { var sb = document.getElementById('search'), si = document.getElementById('search-input'); if (sb && sb.classList.toggle('open') && si) si.focus(); else if (si) { si.value = ''; renderSearch(''); } break; }
      case 'addtask': {
        var ti = document.getElementById('new-task'), tm = document.getElementById('new-task-min'), tt0 = ti ? ti.value.trim() : '', tmin = tm ? num(tm.value) : 15;
        if (!tt0) { toast('Напиши, что нужно сделать'); if (ti) ti.focus(); break; }
        var tk0 = keyOf(sel); st.extraTasks[tk0] = st.extraTasks[tk0] || [];
        st.extraTasks[tk0].push({ id: 'u-' + Date.now().toString(36), cat: 'plan', t: tt0, min: tmin || 15 });
        save(); render(); break;
      }
      case 'tolearn': go('learn'); break;
      case 'check': check(); break;
      case 'nextq': nextQ(); break;
      case 'endlesson': LS = null; V.page = 'course'; render(); break;
      case 'lessondone': finishLesson(); break;
      case 'quitexam': EX = null; V.page = V.tab === 'learn' ? 'course' : null; render(); break;
      case 'cards': CARDS = { list: shuffle(learnedWords()).slice(0, 10), i: 0, shown: false, known: 0, done: false }; V.page = 'cards'; render(); window.scrollTo(0, 0); break;
      case 'show': CARDS.shown = true; render(); break;
      case 'endcards': CARDS = null; V.page = 'course'; V.course = 'eng'; render(); break;
      case 'addtrack': var tn = document.getElementById('new-track').value.trim(); if (!tn) { toast('Впиши название трека'); break; } st.tracks.push({ name: tn, stage: 0 }); save(); render(); break;
      case 'addbook': var bn = document.getElementById('new-book').value.trim(); if (!bn) { toast('Впиши название книги'); break; } st.booksAdded.push({ id: 'u' + Date.now(), t: bn }); save(); render(); break;
      case 'export': exportFile(); break;
      case 'exportoriginal': downloadJSON(localStorage.getItem(KEY)||'', 'rostok-original.json'); break;
      case 'syncon': syncOn(); break;
      case 'syncnow': syncNow(true); break;
      case 'syncoff': syncOff(); break;
      case 'closemodal': document.getElementById('modal').hidden = true; break;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'ans' && EX && !EX.checked) { e.preventDefault(); check(); }
    if (e.key === 'Enter' && (e.target.id === 'new-task' || e.target.id === 'new-task-min')) { e.preventDefault(); var ab = document.querySelector('[data-act="addtask"]'); if (ab) ab.click(); }
    if (e.key === 'Escape' && e.target.id === 'search-input') { e.target.value = ''; renderSearch(''); e.target.blur(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'ans' && EX) { EX.typed = t.value; return; }
    if (t.id === 'search-input') { renderSearch(t.value); return; }
    var f = t.getAttribute('data-rf');
    if (f) { var wk = V.week; st.reflect[wk] = st.reflect[wk] || {}; st.reflect[wk][f] = t.value; save(); updateStorageAlert(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'cnt-target') { var c0 = counter(V.course); st.counters[V.course] = { v: c0.v, target: num(t.value) }; save(); render(); return; }
    var bk = t.getAttribute('data-book');
    if (bk) { st.books[bk] = st.books[bk] || {}; st.books[bk][t.getAttribute('data-f')] = num(t.value); save(); render(); return; }
    if (t.id === 'importFile' && t.files && t.files[0]) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var o = JSON.parse(r.result); if (!o || (o.app !== 'dnevnik' && o.app !== 'rostok') || !validState(o.state)) throw 0;
          if (!confirm('Заменить текущий прогресс данными из файла? Перед заменой сохраню локальный резервный снимок.')) return;
          var previous = st, locked = storageReadOnly;
          if (locked) localStorage.setItem('dnevnik-state-damaged',localStorage.getItem(KEY)||'');
          storageReadOnly = false; st = o.state; fixState();
          if (!persist()) { st = previous; storageReadOnly = locked; render(); toast('Не удалось записать копию. Старый прогресс сохранён.'); return; }
          LS = null; EX = null; V.page = null; recoveryNotice=''; schedSync(); render(); toast('Прогресс восстановлен из файла');
        }
        catch (err) { toast('Это не файл копии Ростка'); }
      };
      r.readAsText(t.files[0]);
    }
  });

  function exportFile() {
    try {
      downloadJSON(JSON.stringify({ app: 'dnevnik', v: APP_VERSION, saved: new Date().toISOString(), state: st }, null, 1), 'rostok-' + isoOf(new Date()) + '.json');
      st.backupAt = isoOf(new Date()); save();
      toast('Скачивание копии начато. Проверь папку загрузок.'); render();
    } catch (e) { toast('Не получилось сохранить файл'); }
  }
  function downloadJSON(text,name) {
    var blob = new Blob([text], {type:'application/json'}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},4000);
  }
  function updateStorageAlert() { if(storageProblem && !app.querySelector('.storage-alert')) {var el=document.createElement('div');el.className='storage-alert';el.setAttribute('role','alert');el.textContent=storageProblem;app.prepend(el);} }
  function nextInCourse(cid) {
    var c=course(cid),i=nextIdx(c); V.tab='learn';V.course=cid;
    if(i<0||stepState(c,i)!=='open'){go('learn','course',{course:cid});return;}
    if(c.steps[i].exam)startExam(cid,i);else if(c.steps[i].ex&&c.steps[i].theory)startLesson(cid,i);else go('learn','course',{course:cid,step:i});
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (SY.cfg && Date.now() - (SY.cfg.at || 0) > 60000) syncNow(false);
    var nt = rawToday();
    if (nt !== today) { if (sel === clamp(today)) sel = clamp(nt); today = nt; if (!V.page) render(); }
  });

  load();
  syLoad();
  render();
  if (SY.cfg) syncNow(false);
})();
