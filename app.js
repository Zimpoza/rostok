(function () {
  'use strict';
  var APP_VERSION = '2.8';
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
  var KEY = 'dnevnik-state';
  var st = {};
  function fixState() {
    ['modes', 'checks', 'lessons', 'exams', 'counters', 'books', 'reflect', 'extraTasks'].forEach(function (k) { if (!st[k] || typeof st[k] !== 'object' || Array.isArray(st[k])) st[k] = {}; });
    ['booksAdded', 'tracks'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
  }
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var o = JSON.parse(r); if (o && typeof o === 'object') st = o; } } catch (e) {}
    fixState();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { toast('Не получилось сохранить'); } }

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
  var V = { tab: 'today', page: null, course: null, step: null };
  var EX = null, LS = null, CARDS = null, pendingDel = null;
  try { var h0 = location.hash.slice(1); if (h0 === 'learn' || h0 === 'growth') V.tab = h0; } catch (e) {}
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

  // ----- Сегодня -----
  function viewToday() {
    var d = dateOf(sel), s = stat(sel), m = modeOf(sel), wk = Math.floor(sel / 7), rt = rawToday();
    var left = s.n - s.done, sub = (s.n && !left) ? 'Все дела на день сделаны.' : 'Осталось ' + left + ' ' + plural(left, 'дело', 'дела', 'дел') + '.';
    var sk = streak(); if (sk) sub += ' Серия: ' + sk + ' ' + plural(sk, 'день', 'дня', 'дней') + ' подряд.';
    var h = '<section class="view"><div class="brand"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--done)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-8M12 13C12 8 8 6 4 6c0 4 3 7 8 7zM12 15c0-4 3-6 8-6 0 4-3 6-8 6z"/></svg><b>Росток</b><span>Обрастать мясом</span></div><div class="daynav">' +
      '<button class="nav" data-act="prev" aria-label="Предыдущий день"' + (sel === 0 ? ' disabled' : '') + '>' + I.left + '</button>' +
      '<div class="title"><div class="eyebrow">' + (sel === rt ? 'Сегодня · ' : '') + 'неделя ' + (wk + 1) + ' · день ' + (sel + 1) + ' из ' + N + '</div>' +
      '<h1 class="h1">' + DOWF[sel % 7] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + '</h1>' +
      (sel !== clamp(rt) ? '<button class="back" data-act="gotoday">Вернуться к сегодня</button>' : '') + '</div>' +
      '<button class="nav" data-act="next" aria-label="Следующий день"' + (sel === N - 1 ? ' disabled' : '') + '>' + I.right + '</button></div>';
    if (rt < 0 && sel === 0) h += '<p class="muted">План начинается в понедельник, ' + START.getDate() + ' ' + MON[START.getMonth()] + '.</p>';
    openExams().slice(0, 1).forEach(function (x) {
      h += '<div class="banner"><div class="tb"><b>Экзамен открыт</b>' + esc(x.c.name) + ', ' + esc(x.c.steps[x.i].t.replace('Экзамен: ', '')) + '</div>' +
        '<button class="btn primary" data-exam="' + x.c.id + ':' + x.i + '">Сдать</button></div>';
    });
    var bd = backupDays();
    if (hasProgress() && (bd === null || bd >= 7)) {
      h += '<div class="banner"><div class="tb"><b>Сохрани копию</b>' + (bd === null ? 'Копию прогресса ты ещё не делал.' : 'Копию не делал ' + bd + ' ' + plural(bd, 'день', 'дня', 'дней') + '.') + '</div>' +
        '<button class="btn primary" data-act="export">Сохранить</button></div>';
    }
    h += '<div class="card sumcard">' + ring(s.done, s.n) + '<div><div class="big">' + fmt(s.doneMin) + ' из ' + fmt(s.totalMin) + '</div><div class="muted">' + sub + '</div></div></div>';
    h += '<div class="modes" role="group" aria-label="Тип дня">' + MODES.map(function (x) { return '<button data-mode="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="card" style="padding:4px 0"><ul class="tasks">';
    s.tasks.forEach(function (x) {
      var on = isDone(sel, x.id), c = course(x.cat);
      h += '<li class="task' + (on ? ' done' : '') + '"><button class="chk" data-task="' + esc(x.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Снять отметку: ' : 'Отметить: ') + esc(x.t) + '">' + I.check + '</button>' +
        '<div class="tb"><div class="tt"><i class="dot" style="background:var(--c-' + esc(x.cat) + ')"></i><span>' + esc(x.t) + '</span></div>' +
        (x.n ? '<div class="tn">' + esc(x.n) + '</div>' : '') +
        (c && !on ? '<button class="go" data-course="' + c.id + '">' + (c.type === 'path' ? 'Открыть урок' : 'Открыть') + ' →</button>' : '') + '</div>' +
        '<div class="min">' + x.min + ' мин</div></li>';
    });
    return h + '</ul></div></section>';
  }

  // ----- Обучение: список -----
  function viewLearn() {
    var h = '<section class="view"><div class="title"><h1 class="h1">Обучение</h1><div class="muted">' + COURSES.length + ' направлений. У каждого свой путь и свои единицы прогресса.</div></div>';
    COURSES.forEach(function (c) {
      var col = 'var(--c-' + c.cat + ')', right = '', inner = '', l = '', r = '';
      if (c.type === 'path') {
        var ps = pathStats(c), ni = nextIdx(c);
        right = c.level ? '<span class="pill" style="color:' + col + '">' + c.level + ' → ' + c.target + '</span>' : '<span class="small">экзаменов ' + ps.exDone + '/' + ps.ex + '</span>';
        inner = bar(ps.pct, col);
        l = (c.unit === 'правило' ? 'Правил' : 'Уроков') + ' ' + ps.lesDone + ' из ' + ps.les + (c.id === 'eng' ? ' · ' + learnedWords().length + ' слов' : '');
        r = ni < 0 ? 'Всё пройдено' : 'Дальше: ' + c.steps[ni].t;
      } else if (c.type === 'counter') {
        var k = counter(c.id);
        right = '<span class="small">' + esc(c.title) + '</span>';
        inner = bar(k.target ? k.v / k.target : 0, col);
        l = k.v + ' ' + c.unit + (k.target ? ' из ' + k.target : '');
        r = k.target ? Math.round(k.v / k.target * 100) + '%' : 'Укажи, сколько всего';
        if (c.id === 'poem') right = '';
        if (c.id === 'book') right = '';
      } else if (c.type === 'books') {
        var bs = allBooks(), done = bs.filter(bookDone).length, cur = bs.filter(function (b) { return !bookDone(b); })[0];
        right = '<span class="small">прочитано ' + done + ' из ' + bs.length + '</span>';
        inner = bar(cur && cur.pages ? cur.page / cur.pages : 0, col);
        l = cur ? cur.t : 'Все книги прочитаны';
        r = cur ? (cur.pages ? 'стр. ' + cur.page + ' из ' + cur.pages : 'стр. ' + cur.page) : '';
      } else if (c.type === 'stages') {
        var tr = st.tracks.filter(function (x) { return x.stage < 5; })[0] || st.tracks[st.tracks.length - 1];
        right = '<span class="small">треков ' + st.tracks.length + '</span>';
        inner = '<div class="stages">' + c.stages.map(function (x, i) { return '<i style="' + (tr && tr.stage > i ? 'background:' + col : '') + '"></i>'; }).join('') + '</div>';
        l = tr ? tr.name : 'Добавь первый трек';
        r = tr ? (tr.stage >= 5 ? 'Выпущен' : 'Сейчас: ' + c.stages[tr.stage].toLowerCase()) : '';
      }
      h += '<button class="ccard" data-course="' + c.id + '"><div class="row"><i class="dot" style="width:10px;height:10px;border-radius:3px;background:' + col + '"></i><span class="nm">' + c.name + '</span>' + right + '</div>' + inner +
        '<div class="sub"><span>' + esc(l) + '</span><span>' + esc(r) + '</span></div></button>';
    });
    return h + '</section>';
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
    else h += '<div class="hero"><div class="tl">Все уроки и экзамены пройдены</div><div class="pl">Claude добавит следующий блок в обновлении.</div></div>';
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
    var qs = s.ex.map(function (q) {
      var idx = shuffle(q.options.map(function (x, j) { return j; }));
      return { q: q.q, options: idx.map(function (j) { return q.options[j]; }), right: idx.indexOf(0), pick: null };
    });
    LS = { cid: cid, i: i, qs: qs };
    V.page = 'lesson'; render(); window.scrollTo(0, 0);
  }
  function viewLesson() {
    var c = course(LS.cid), s = c.steps[LS.i], th = s.theory, col = 'var(--c-' + c.cat + ')';
    var answered = LS.qs.filter(function (q) { return q.pick != null; }).length, n = LS.qs.length;
    var okN = LS.qs.filter(function (q) { return q.pick === q.right; }).length;
    var h = '<section class="view"><button class="back" data-act="endlesson">‹ ' + esc(c.name) + '</button>' +
      '<div class="title"><div class="eyebrow">' + (c.unit === 'правило' ? 'Правило ' : 'Урок ') + lessonNo(c, LS.i) + '</div><h1 class="h1">' + esc(s.t) + '</h1></div>' +
      '<div class="card qcard"><h2 class="h2">Правило</h2><div class="rule" style="border-color:' + col + '">' + md(th.rule) + '</div>' +
      th.ex.map(function (e) { return '<div class="exm"><span class="ex">' + esc(e[0]) + '</span> <span class="small">' + esc(e[1]) + '</span></div>'; }).join('') +
      (th.tip ? '<div class="small">' + md(th.tip) + '</div>' : '') + '</div>' +
      '<div class="spread"><h2 class="h2">Упражнения</h2><span class="small">' + answered + ' из ' + n + '</span></div>' +
      '<div class="qbar" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + LS.qs.map(function (q) { return '<i class="' + (q.pick == null ? '' : q.pick === q.right ? 'ok' : 'no') + '"></i>'; }).join('') + '</div>';
    LS.qs.forEach(function (q, qi) {
      var done = q.pick != null;
      h += '<div class="card qcard"><div class="qtext sm">' + esc(q.q) + '</div><div class="opts row2">' + q.options.map(function (o, oi) {
        var cls = 'opt';
        if (done) { if (oi === q.right) cls += ' right'; else if (oi === q.pick) cls += ' wrong'; }
        return '<button class="' + cls + '" data-lp="' + qi + ':' + oi + '"' + (done ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>' +
      (done ? (q.pick === q.right ? '<div class="feedback ok"><b>Верно.</b></div>' : '<div class="feedback no"><b>Неверно.</b> Правильно: <b>' + esc(q.options[q.right]) + '</b></div>') : '') + '</div>';
    });
    if (answered < n) h += '<button class="btn block" disabled>Ответь на все упражнения (осталось ' + (n - answered) + ')</button>';
    else h += '<div class="card"><b>Верно ' + okN + ' из ' + n + '.</b> ' + (okN / n < 0.75 ? 'Тема слабая: завтра она появится в плане на повторение.' : 'Хороший результат.') + '</div>' +
      '<button class="btn primary block" data-act="lessondone">' + (st.lessons[s.id] ? 'Готово' : 'Урок пройден') + '</button>';
    return h + '</section>';
  }
  function finishLesson() {
    var c = course(LS.cid), s = c.steps[LS.i], n = LS.qs.length;
    var okN = LS.qs.filter(function (q) { return q.pick === q.right; }).length;
    if (okN / n < 0.75) {
      var tm = new Date(); tm.setDate(tm.getDate() + 1); var tk = isoOf(tm), id = 'rep-' + s.id;
      st.extraTasks[tk] = st.extraTasks[tk] || [];
      if (!st.extraTasks[tk].some(function (x) { return x.id === id; })) st.extraTasks[tk].push({ id: id, cat: c.cat, t: 'Повторить: ' + s.t, min: 15, n: 'В уроке были ошибки.' });
    }
    if (!st.lessons[s.id]) { st.lessons[s.id] = isoOf(new Date()); toast('+20 очков. Урок пройден'); }
    save(); LS = null; V.page = 'course'; V.step = null; render(); window.scrollTo(0, 0);
  }

  // ----- Экзамен -----
  function startExam(cid, i) {
    var c = course(cid), s = c.steps[i];
    var qs = s.q.map(function (q) {
      var o = { k: q.k, s: q.s, q: q.q };
      if (q.k === 'choice') { var idx = shuffle(q.options.map(function (x, j) { return j; })); o.options = idx.map(function (j) { return q.options[j]; }); o.right = idx.indexOf(0); }
      if (q.k === 'input') o.a = q.a;
      if (q.k === 'order') { o.words = shuffle(q.words); o.a = q.a; }
      return o;
    });
    EX = { cid: cid, i: i, qs: qs, cur: 0, res: [], pick: null, typed: '', built: [], checked: false };
    V.page = 'exam'; render(); window.scrollTo(0, 0);
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
    var e = st.exams[s.id] || { best: 0, n: n, attempts: [] };
    e.n = n; e.last = ok; e.best = Math.max(e.best || 0, ok); e.passed = e.passed || ok / n >= s.pass;
    e.attempts = (e.attempts || []).concat([{ d: isoOf(new Date()), ok: ok, n: n }]).slice(-20);
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
      h += r.ok ? '<div class="feedback ok"><b>Верно.</b></div>' : '<div class="feedback no"><b>Неверно.</b> Правильно: <b>' + esc(answerText(q)) + '</b></div>';
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
  function viewGrowth() {
    var t = totals(), sk = streak(), aw = awards(t), got = aw.filter(function (a) { return a.ok; }).length, rt = rawToday();
    var into = t.xp % XP_LEVEL;
    var h = '<section class="view"><div class="title"><h1 class="h1">Мой рост</h1><div class="muted">' + (rt < 0 ? 'План ещё не начался' : rt >= N ? 'План пройден целиком' : 'День ' + (rt + 1) + ' из ' + N) + '</div></div>';
    h += '<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="spread"><b style="font-family:var(--f-d);font-size:24px;font-weight:600">Уровень ' + t.level + '</b><span class="small">' + t.xp + ' ' + plural(t.xp, 'очко', 'очка', 'очков') + ' · до ' + (t.level + 1) + '-го ' + (XP_LEVEL - into) + '</span></div>' +
      '<div class="bar" style="height:10px;border-radius:5px"><i style="width:' + Math.round(into / XP_LEVEL * 100) + '%;background:var(--accent)"></i></div>' +
      '<div class="small">Очки: 1 минута занятий = 1, урок = 20, сданный экзамен = 10 за каждый верный ответ.</div></div>';
    h += '<div class="tiles"><div class="tile hot"><b>' + sk + '</b><span>' + plural(sk, 'день', 'дня', 'дней') + ' подряд</span></div>' +
      '<div class="tile"><b>' + fmtShort(t.min) + '</b><span>занятий</span></div><div class="tile"><b>' + got + '/' + aw.length + '</b><span>наград</span></div></div>';
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
    var wk = Math.floor(clamp(rt) / 7), maxNorm = 1, cols = [];
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
    h += '<div class="card"><h2 class="h2" style="margin-bottom:12px">Награды</h2><div class="awards">' + aw.map(function (a) {
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
    return h + '<div class="ver">Версия ' + APP_VERSION + ' · план v' + P.version + '</div></section>';
  }

  // ---------- отрисовка ----------
  function render() {
    var html, full = false;
    if (V.page === 'exam' && EX) { html = viewExam(); full = true; }
    else if (V.page === 'lesson' && LS) { html = viewLesson(); full = true; }
    else if (V.page === 'result') { html = viewResult(); full = true; }
    else if (V.page === 'cards' && CARDS) { html = viewCards(); full = true; }
    else if (V.tab === 'learn' && V.page === 'course') html = viewCourse();
    else html = V.tab === 'learn' ? viewLearn() : V.tab === 'growth' ? viewGrowth() : viewToday();
    app.innerHTML = html;
    app.className = full ? 'full' : '';
    document.getElementById('tabbar').hidden = full;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) { if (tabs[i].getAttribute('data-tab') === V.tab) tabs[i].setAttribute('aria-current', 'page'); else tabs[i].removeAttribute('aria-current'); }
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
    if ((v = b.getAttribute('data-lp'))) { var lq = v.split(':'); if (LS && LS.qs[+lq[0]].pick == null) { LS.qs[+lq[0]].pick = +lq[1]; render(); } return; }
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
      case 'prev': if (sel > 0) { sel--; render(); } break;
      case 'next': if (sel < N - 1) { sel++; render(); } break;
      case 'gotoday': sel = clamp(rawToday()); render(); break;
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
      case 'closemodal': document.getElementById('modal').hidden = true; break;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'ans' && EX && !EX.checked) { e.preventDefault(); check(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'ans' && EX) { EX.typed = t.value; return; }
    var f = t.getAttribute('data-rf');
    if (f) { var wk = Math.floor(clamp(rawToday()) / 7); st.reflect[wk] = st.reflect[wk] || {}; st.reflect[wk][f] = t.value; save(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'cnt-target') { var c0 = counter(V.course); st.counters[V.course] = { v: c0.v, target: num(t.value) }; save(); render(); return; }
    var bk = t.getAttribute('data-book');
    if (bk) { st.books[bk] = st.books[bk] || {}; st.books[bk][t.getAttribute('data-f')] = num(t.value); save(); render(); return; }
    if (t.id === 'importFile' && t.files && t.files[0]) {
      var r = new FileReader();
      r.onload = function () {
        try { var o = JSON.parse(r.result); if (!o || !o.state || typeof o.state.checks !== 'object') throw 0; st = o.state; fixState(); save(); render(); toast('Прогресс восстановлен из файла'); }
        catch (err) { toast('Это не файл копии Ростка'); }
      };
      r.readAsText(t.files[0]);
    }
  });

  function exportFile() {
    try {
      st.backupAt = isoOf(new Date()); save();
      var blob = new Blob([JSON.stringify({ app: 'dnevnik', v: APP_VERSION, saved: new Date().toISOString(), state: st }, null, 1)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rostok-' + isoOf(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('Файл копии сохранён'); render();
    } catch (e) { toast('Не получилось сохранить файл'); }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var nt = rawToday();
    if (nt !== today) { if (sel === clamp(today)) sel = clamp(nt); today = nt; if (!V.page) render(); }
  });

  load();
  render();
})();
