// Signal 新站脚本（2026-10-24 由 Gemini 原型拆分，接真实数据）
// 页面切换只用 #hash：#index #pool #tag/标签名 #stock/代码 #research #ledger #health

// ---------- 小工具 ----------
var esc = function (s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
  });
};
var $ = function (id) { return document.getElementById(id); };
var DATA = {};
// 示例模式：只在本机地址加 ?sample 时，这几份从 sample/ 读（假数据，不上线），页面顶部出红条
var SAMPLE = /^(127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(location.hostname) && /[?&]sample\b/.test(location.search);
var SAMPLE_FILES = ['market.json', 'research.json', 'themes.json', 'ledger.json', 'health.json'];
function load(name) {               // 同一个文件只取一次；失败返回 null，页面显示"暂不可用"
  if (!DATA[name]) {
    var dir = SAMPLE && SAMPLE_FILES.indexOf(name) >= 0 ? 'sample/' : 'data/';
    DATA[name] = fetch(dir + name, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  return DATA[name];
}
function pct(v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
function tone(v) { return v > 0 ? 't-rise' : v < 0 ? 't-fall' : ''; }   // 红涨绿跌
function pxHtml(p, chg, big) {          // 股价和涨跌一起跟着红涨绿跌；p 为空显示“—”
  if (p == null) return '<span class="num t-muted">—</span>';
  return '<span class="num ' + tone(chg) + '"' + (big ? ' style="font-size:1.6rem; font-weight:700;"' : ' style="font-weight:700;"') + '>' + p.toFixed(2) + '</span> <span class="num ' + tone(chg) + '" style="font-size:' + (big ? '1rem' : '0.86rem') + ';">' + pct(chg) + '</span>';
}
function store(k, v) {              // 存储可能被禁用，读写都包起来
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
}

// ---------- 主题 ----------
var THEME_KEY = 'signal_theme_pref';
function isSystemDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
function applyTheme(pref) {
  var root = document.documentElement;
  if (pref === 'dark' || pref === 'light') root.setAttribute('data-theme', pref); else root.removeAttribute('data-theme');
  var dark = pref === 'dark' || (pref !== 'light' && isSystemDark());
  var sun = $('theme-icon-sun'), moon = $('theme-icon-moon');
  if (sun && moon) { sun.style.display = dark ? 'block' : 'none'; moon.style.display = dark ? 'none' : 'block'; }
  var meta = $('meta-theme-color');
  if (meta) meta.setAttribute('content', dark ? '#17161a' : '#f7f7f5');
}
function cycleTheme() {
  var root = document.documentElement;
  var dark = root.getAttribute('data-theme') === 'dark' || (!root.hasAttribute('data-theme') && isSystemDark());
  var next = dark ? 'light' : 'dark';
  store(THEME_KEY, next); applyTheme(next);
  showToast(next === 'dark' ? '已切换为深色（已记住）' : '已切换为浅色（已记住）');
}
if (window.matchMedia) {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!store(THEME_KEY)) applyTheme(null);
    });
  } catch (e) {}
}
applyTheme(store(THEME_KEY));

// ---------- 提示条 ----------
var toastTimer = null;
function showToast(msg) {
  var t = $('pixel-toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

// ---------- 页面切换 ----------
var PAGES = ['index', 'tag', 'research', 'theme', 'stock', 'pool', 'seats', 'ledger', 'health'];
var NAV_OF = { tag: 'index' };      // 标签页在导航上算首页；席位、查一只票、体检表手机底栏没有对应项，不高亮
function route() {
  var raw = decodeURIComponent((location.hash || '#index').slice(1));
  var page = raw.split('/')[0], arg = raw.slice(page.length + 1);
  if (PAGES.indexOf(page) < 0) page = 'index';
  var secs = document.querySelectorAll('section[data-page]');
  for (var i = 0; i < secs.length; i++) secs[i].classList.toggle('active', secs[i].getAttribute('data-page') === page);
  var nav = NAV_OF[page] || page;
  document.querySelectorAll('.desktop-nav .nav-link').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === nav); });
  document.querySelectorAll('.mobile-bottom-nav .mob-nav-item').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-mob-nav') === nav); });
  window.scrollTo(0, 0);
  if (page === 'pool') drawPool();
  if (page === 'seats') drawSeats();
  if (page === 'tag') drawTag(arg);
  if (page === 'research') drawResearch();
  if (page === 'theme') drawTheme(arg);
  if (page === 'ledger') drawLedger();
  if (page === 'health') drawHealth();
  if (page === 'stock' && arg && !/^\d{6}$/.test(arg)) arg = '';   // 地址栏来的代码只认 6 位数字，防注入
  if (page === 'stock') { if (arg) showStock(arg); else { $('stock-empty').style.display = ''; $('stock-body').style.display = 'none'; } }
}
window.addEventListener('hashchange', route);
// 页头高度随窗口宽度变化，表头和左栏筛选按它停靠
function setHeaderH() { var h = document.querySelector('.site-header'); if (h) document.documentElement.style.setProperty('--hh', h.offsetHeight + 'px'); }
window.addEventListener('resize', setHeaderH);
setHeaderH();
$('qr-reveal').onclick = function () { $('qr-pair').classList.add('open'); };
if (SAMPLE) $('sample-banner').style.display = '';

// ---------- 数据新鲜度（页头小圆点、过期提示条） ----------
function bjToday() { return new Date(Date.now() + new Date().getTimezoneOffset() * 60000 + 8 * 3600000); }
function lastTradingDay() {          // 周末不算；工作日 19 点前，当天的数据还没出，算前一个工作日
  var d = bjToday();
  if (d.getHours() < 19) d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
load('status.json').then(function (s) {
  if (!s) return;
  $('header-update-text').textContent = '数据 ' + s.updated.slice(5);
  if (s.updated < lastTradingDay()) {
    ['header-health-dot', 'footer-health-dot'].forEach(function (id) { var el = $(id); if (el) el.className = 'status-dot expired'; });
    $('stale-date').textContent = s.updated;
    document.body.setAttribute('data-state', 'expired');
  }
  $('portal-pool-count').textContent = s.pool.toLocaleString();
  $('scan-count').textContent = s.stocks.toLocaleString() + ' 只票带线索标签';
});

// ---------- 首页：搜索 ----------
var NAMES = {}, TAGGED = [];
var KEY = { '解禁': '解禁压力', '外资': '外资扎堆', '扎堆': '外资扎堆', '成本': '低于机构估算成本', '倒挂': '低于机构估算成本',
  '低于': '低于机构估算成本', '龙虎榜': '龙虎榜常客', '游资': '龙虎榜常客', '拉升': '季末拉升', '国资': '国资在十大股东',
  '重组': '重组在途', '定增': '定增在途', '重整': '重整在途', '摘帽': '摘帽在途', '定点': '大厂定点' };
Promise.all([load('names.json'), load('tags.json')]).then(function (r) {
  if (r[0]) Object.assign(NAMES, r[0]);
  if (r[1]) Object.keys(r[1].stocks).forEach(function (c) { if (r[1].stocks[c].name) NAMES[c] = r[1].stocks[c].name; TAGGED.push(c); });
});
function ask() {
  var v = $('q').value.trim(), box = $('search-res');
  if (!v) { box.innerHTML = ''; return; }
  if (/^\d{6}$/.test(v)) { location.hash = '#stock/' + v; return; }
  for (var k in KEY) if (v.indexOf(k) >= 0) { location.hash = '#tag/' + encodeURIComponent(KEY[k]); return; }
  var hit = Object.keys(NAMES).filter(function (c) { return NAMES[c].indexOf(v) >= 0; }).slice(0, 8);
  box.innerHTML = hit.length
    ? hit.map(function (c) { return '<a href="#stock/' + c + '">' + esc(NAMES[c]) + '<span>' + c + '</span></a>'; }).join('')
    : '<a href="#index">没找到「' + esc(v) + '」，可以直接输 6 位代码<span></span></a>';
}
$('home-search').addEventListener('submit', function (e) { e.preventDefault(); ask(); });
$('q').addEventListener('input', function () { if (!$('q').value.trim()) $('search-res').innerHTML = ''; });
$('random-btn').addEventListener('click', function () {
  if (!TAGGED.length) return;
  location.hash = '#stock/' + TAGGED[Math.floor(Math.random() * TAGGED.length)];
});

// 最近看过的票（只存在这台设备上）
function recent() {
  try { return (JSON.parse(store('signal_recent') || '[]') || []).filter(function (c) { return /^\d{6}$/.test(c); }); } catch (e) { return []; }
}
function drawRecent() {
  var r = recent(), row = $('recent-row');
  if (!r.length) { row.style.display = 'none'; return; }
  row.style.display = '';
  row.innerHTML = '<span>最近看过：</span>' + r.map(function (c) {
    return '<a href="#stock/' + esc(c) + '" class="quick-stock"><span class="num">' + esc(c) + '</span> ' + esc(NAMES[c] || '') + '</a>';
  }).join('');
}

// ---------- 首页：标签 ----------
load('tags.json').then(function (t) {
  if (!t) { $('tags-upd').textContent = '标签数据暂不可用'; return; }
  var cnt = tagCounts(t);
  $('tags-upd').textContent = '更新于 ' + t.updated + ' · 点进去看是哪些票';
  $('home-tags').innerHTML = tagGroupsHtml(cnt);
  drawRecent();
});
// 标签：数据里的原名不改（老系统和网址都用它），页面上按这张表显示、分组
var TAG_SHOW = { '低于机构估算成本': '低于机构成本', '外资扎堆': '外资同季扎堆', '季末拉升': '近月强势拉升', '国资新进': '国资当期新进',
  '国家级产业基金': '国家产业基金', '定增在途': '定增推进中', '重组在途': '并购重组在途', '重整在途': '破产重整在途',
  '摘帽在途': '申请摘帽在途', '解禁压力': '远期解禁压力', '近月解禁': '30天内解禁', '减持在途': '股东减持在途' };
var TAG_GROUPS = [
  ['资金与筹码', ['低于机构估算成本', '外资扎堆', '龙虎榜常客', '季末拉升']],
  ['国资与产业定点', ['国资在十大股东', '国资新进', '国家级产业基金', '大厂定点']],
  ['资本运作在途（近 90 天公告未终止）', ['定增在途', '重组在途', '重整在途', '摘帽在途']],
  ['解禁与减持风险', ['解禁压力', '近月解禁', '减持在途']]
];
function tagName(k) { return TAG_SHOW[k] || k; }
function tagGroupsHtml(cnt, active) {        // 没归进任何组的新标签放进"其他"，不会被漏掉
  var seen = {}, groups = TAG_GROUPS.map(function (g) { g[1].forEach(function (k) { seen[k] = 1; }); return g; });
  var rest = Object.keys(cnt).filter(function (k) { return !seen[k]; });
  if (rest.length) groups = groups.concat([['其他', rest]]);
  return groups.map(function (g) {
    var ks = g[1].filter(function (k) { return cnt[k]; });
    if (!ks.length) return '';
    return '<div class="tag-category"><div class="tag-cat-head">' + esc(g[0]) + '</div><div class="tag-grid-2col">' + ks.map(function (k) {
      return '<a class="clue-tag-btn' + (k === active ? ' active' : '') + '" href="#tag/' + encodeURIComponent(k) + '"><span class="clue-tag-name">' + esc(tagName(k)) +
        '</span><span class="clue-tag-count">' + cnt[k] + '</span></a>';
    }).join('') + '</div></div>';
  }).join('');
}
function tagCounts(t) {
  var cnt = {};
  Object.keys(t.stocks).forEach(function (c) { t.stocks[c].tags.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; }); });
  return cnt;
}

// ---------- 标签列表页 ----------
var TAG = { name: '', limit: 50 };
function drawTag(name) {
  Promise.all([load('tags.json'), load('names.json'), load('px.json')]).then(function (r) {
    var t = r[0], PX = (r[2] && r[2].px) || {};
    var px = function (c) { var q = PX[c]; return q ? pxHtml(q[0], q[1]) : pxHtml(null); };
    if (r[1]) Object.assign(NAMES, r[1]);           // 只因公告事件进标签的票，tags.json 里可能没名字
    if (!t) { $('tag-meta').textContent = '标签数据暂不可用'; return; }
    var cnt = tagCounts(t), names = Object.keys(t.rules).filter(function (k) { return cnt[k]; });
    if (name !== TAG.name) TAG.limit = 50;
    TAG.name = cnt[name] ? name : names[0];
    $('tag-title').textContent = tagName(TAG.name);
    $('tag-rule').textContent = '判定规则：' + (t.rules[TAG.name] || '');
    $('tag-upd').textContent = '更新于 ' + t.updated;
    $('tag-chips').innerHTML = tagGroupsHtml(cnt, TAG.name);
    $('tag-switch').open = false;
    var all = Object.keys(t.stocks).filter(function (c) { return t.stocks[c].tags.indexOf(TAG.name) >= 0; });
    var rows = all.slice(0, TAG.limit);
    $('tag-meta').textContent = '共 ' + all.length + ' 只，显示前 ' + rows.length + ' 只';
    $('tag-tbody').innerHTML = rows.map(function (c) {
      var v = t.stocks[c];
      return '<tr onclick="location.hash=\'#stock/' + c + '\'" style="cursor:pointer;"><td><strong class="serif">' + esc(v.name || NAMES[c] || '') +
        '</strong> <span class="num t-muted">' + c + '</span></td><td class="text-right" style="white-space:nowrap;">' + px(c) + '</td><td>' + esc(v.why[TAG.name] || '') + '</td><td>' +
        esc(v.tags.filter(function (x) { return x !== TAG.name; }).map(tagName).join('、')) + '</td></tr>';
    }).join('');
    $('tag-cards').innerHTML = rows.map(function (c) {
      var v = t.stocks[c], others = v.tags.filter(function (x) { return x !== TAG.name; });
      return '<div class="card" onclick="location.hash=\'#stock/' + c + '\'"><div style="margin-bottom:6px; display:flex; justify-content:space-between; gap:8px; align-items:baseline;"><span><strong class="serif" style="font-size:1.05rem;">' +
        esc(v.name || NAMES[c] || '') + '</strong> <span class="num t-muted" style="font-size:0.82rem;">' + c + '</span></span><span style="white-space:nowrap;">' + px(c) + '</span></div>' +
        '<div style="font-size:0.84rem; color:var(--ink-2); margin-bottom:8px;">' + esc(v.why[TAG.name] || '') + '</div>' +
        (others.length ? '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + others.map(function (x) { return '<span class="fact-tag">' + esc(tagName(x)) + '</span>'; }).join('') + '</div>' : '') +
        '</div>';
    }).join('');
    more('tag-more', all.length - rows.length, function () { TAG.limit += 100; drawTag(TAG.name); });
  });
}
function more(id, left, fn) {
  var b = $(id);
  if (left <= 0) { b.style.display = 'none'; return; }
  b.style.display = ''; b.textContent = '再显示一些（还有 ' + left + ' 条）'; b.onclick = fn;
}

// ---------- 机构持仓池 ----------
// 原始数据一条＝一个机构在一只票的一个报告期；页面按"票＋报告期"合并，一只票一行，机构并排列出
var BANDS = {
  '全部': function () { return true; },
  '低于成本 20% 以上': function (r) { return r.dev <= -20; },
  '低于 10—20%': function (r) { return r.dev > -20 && r.dev <= -10; },
  '相差 10% 以内': function (r) { return r.dev > -10 && r.dev < 10; },
  '高出 10—30%': function (r) { return r.dev >= 10 && r.dev < 30; },
  '高出 30% 以上': function (r) { return r.dev >= 30; }
};
var SORTS = {
  '机构家数': function (a, b) { return b.holders.length - a.holders.length || b.ratio - a.ratio; },
  '偏离从低到高': function (a, b) { return a.dev - b.dev; },
  '占流通从高到低': function (a, b) { return b.ratio - a.ratio; }
};
function snapDate(x) { return x.kind === '快照' ? ' <span class="fact-tag">快照 ' + x.q.slice(5) + '</span>' : ''; }
var BAND_TXT = { '全部': '全部区间', '低于成本 20% 以上': '低 >20%', '低于 10—20%': '低 10~20%', '相差 10% 以内': '±10% 内',
  '高出 10—30%': '高 10~30%', '高出 30% 以上': '高 >30%' };
var BAND_LOW = { '低于成本 20% 以上': 1, '低于 10—20%': 1 };
var SORT_TXT = { '机构家数': '排序：机构家数（多→少）', '偏离从低到高': '排序：偏离成本（低→高）', '占流通从高到低': '排序：占流通股（高→低）' };
var POOL = { histOpen: false, q: '', holder: '全部', band: '全部', sort: '机构家数', limit: 50 };
// 一组单选按钮：kind 是 'seg-btn'（分段条）或 'cell-btn'（格子）；item = {v, label, cnt, dot, cls}
function btnSet(id, kind, items, cur, pick, redraw) {
  $(id).innerHTML = items.map(function (x) {
    return '<button type="button" role="radio" aria-checked="' + (x.v === cur) + '" class="' + kind + (x.cls ? ' ' + x.cls : '') + (x.v === cur ? ' active' : '') +
      '" data-v="' + esc(x.v) + '"><span>' + esc(x.label) + '</span>' + (x.cnt != null ? '<span class="cnt">' + x.cnt + '</span>' : '') +
      (x.dot ? '<span class="dot-amber" title="还在陆续披露"></span>' : '') + '</button>';
  }).join('');
  $(id).querySelectorAll('button').forEach(function (b) { b.onclick = function () { pick(b.getAttribute('data-v')); redraw(); }; });
  var ai = 0; items.forEach(function (x, i) { if (x.v === cur) ai = i; });
  $(id).style.setProperty('--i', ai);          // 手机分段条的滑块位置
}
// 手机：筛选和排序从底部弹出，一次只显示一组；电脑上这些都不显示（持仓池、题材、各页排序共用，11-04 起）
var SHEET_TITLE = { period: '报告期', holder: '外资通道', band: '现价较估算成本', theme: '题材', seg: '环节', sort: '排序' };
var SHEET = null;
function openSheet(id, g) {
  var f = $(id); SHEET = f;
  f.setAttribute('data-show', g); f.querySelector('.sheet-head strong').textContent = SHEET_TITLE[g];
  f.classList.add('open'); $('sheet-backdrop').classList.add('open');
}
function closeSheet() { if (!SHEET) return; SHEET.classList.remove('open'); SHEET.style.transform = ''; $('sheet-backdrop').classList.remove('open'); }
$('sheet-backdrop').onclick = closeSheet;
document.querySelectorAll('.filter-card.sheet').forEach(function (f) {
  f.querySelector('.sheet-close').onclick = closeSheet;
  f.addEventListener('click', function (e) { if (e.target.closest('.cell-btn')) closeSheet(); });   // 选完一项就收起
  var y0 = null, h = f.querySelector('.sheet-head');               // 按住顶部小横条往下拉，超过 80px 就关
  h.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; f.style.transition = 'none'; }, { passive: true });
  h.addEventListener('touchmove', function (e) { if (y0 != null) f.style.transform = 'translateY(' + Math.max(0, e.touches[0].clientY - y0) + 'px)'; }, { passive: true });
  h.addEventListener('touchend', function (e) {
    f.style.transition = '';
    if (y0 != null && e.changedTouches[0].clientY - y0 > 80) closeSheet(); else f.style.transform = '';
    y0 = null;
  });
});
var DOWN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
$('pool-honest-btn').onclick = function () { $('pool-honest').classList.add('open'); };
function sortSelect(id, keys, labels, cur, pick, redraw) {
  var el = $(id);
  el.innerHTML = keys.map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(labels[k]) + '</option>'; }).join('');
  el.onchange = function () { pick(el.value); redraw(); };
  // 手机：下拉藏起来，旁边放一个按钮，点开从底部弹出选项
  var w = el.parentNode, b = w.nextElementSibling;
  if (!b || !b.classList.contains('sort-chip')) { b = document.createElement('button'); b.type = 'button'; b.className = 'sort-chip'; w.parentNode.insertBefore(b, w.nextSibling); }
  b.innerHTML = esc(labels[cur]) + DOWN;
  b.onclick = function () {
    btnSet('sort-cells', 'cell-btn', keys.map(function (k) { return { v: k, label: labels[k].replace('排序：', '') }; }), cur, pick, redraw);
    openSheet('sort-sheet', 'sort');
  };
}
function poolRedraw() { POOL.limit = 50; drawPool(); }
function drawPool() {
  load('pool.json').then(function (P) {
    if (!P) { $('pool-meta').textContent = '持仓池数据暂不可用'; return; }
    var R = P.rows;
    $('pool-upd').textContent = '行情 ' + (P.price_date || P.updated);
    // 报告期只列季报；回购公告附带的快照日期很多，合成一个"季报后的快照"
    var quarters = Array.from(new Set(R.filter(function (r) { return r.kind !== '快照'; }).map(function (r) { return r.q; }))).sort().reverse();
    // 季后快照只认最近一个季末之后的（10 月看 9-30 之后，1 月看 12-31 之后），更早的已被季报取代
    var bj = bjToday(), qm = Math.floor(bj.getMonth() / 3) * 3;
    var qEnd = qm === 0 ? (bj.getFullYear() - 1) + '-12-31' : bj.getFullYear() + ['', '', '', '-03-31', '', '', '-06-30', '', '', '-09-30'][qm];
    // 默认看最新的季后快照；季初还没有快照时看最新一期季报
    var defaultQ = R.some(function (r) { return r.kind === '快照' && r.q > qEnd; }) ? 'snap' : quarters[0];
    if (!POOL.q) POOL.q = defaultQ;
    var deadline = { '03-31': '04-30', '06-30': '08-31', '09-30': '10-31', '12-31': '04-30' };
    var dueDate = function (q) {                  // 披露截止日；年报在次年
      var md = q.slice(5); return (+q.slice(0, 4) + (md === '12-31' ? 1 : 0)) + '-' + deadline[md];
    };
    var disclosing = function (q) { return bjToday().toISOString().slice(0, 10) <= dueDate(q); };   // 截止前，这一期还没出齐
    var QNAME = { '03-31': '一季报', '06-30': '半年报', '09-30': '三季报', '12-31': '年报' };   // 正式叫法
    // 报告期：常用的摆出来（最新一期＋季后快照），往期收在"往期报告"里，点开才显示
    var qText = function (q) { return q.slice(0, 4) + ' ' + QNAME[q.slice(5)]; };
    if (POOL.q !== 'snap' && quarters.indexOf(POOL.q) < 0) POOL.q = quarters[0];
    var hist = quarters.slice(1), inHist = hist.indexOf(POOL.q) >= 0;
    if (inHist) POOL.histOpen = true;                      // 正在看往期时保持展开
    btnSet('pool-period', 'cell-btn', [{ v: 'snap', label: '季后快照' }, { v: quarters[0], label: qText(quarters[0]) }],
      POOL.q, function (v) { POOL.q = v; }, poolRedraw);
    var tg = $('pool-hist-toggle');
    tg.style.display = hist.length ? '' : 'none';
    tg.textContent = '往期报告（' + hist.length + '）' + (POOL.histOpen ? ' ▴' : ' ▾');
    tg.onclick = function () { POOL.histOpen = !POOL.histOpen; drawPool(); };
    $('pool-hist').style.display = POOL.histOpen && hist.length ? '' : 'none';
    btnSet('pool-hist', 'cell-btn', hist.map(function (q) { return { v: q, label: qText(q) }; }), POOL.q, function (v) { POOL.q = v; }, poolRedraw);
    $('pool-q-hint').innerHTML = POOL.q === 'snap' ? qEnd.slice(5) + ' 之后 · 回购公告附带'
      : (disclosing(POOL.q) ? '<span class="dot-amber"></span>披露中 · ' + dueDate(POOL.q).slice(5) + ' 截止' : '已披露完毕');
    var inView;                                    // 当前视图要用哪些原始记录
    if (POOL.q === 'snap') {
      var lastSnap = {};
      R.forEach(function (r) { if (r.kind === '快照' && r.q > qEnd && (!lastSnap[r.code] || r.q > lastSnap[r.code])) lastSnap[r.code] = r.q; });
      inView = function (r) { return r.kind === '快照' && r.q === lastSnap[r.code]; };
    } else inView = function (r) { return r.q === POOL.q && r.kind !== '快照'; };
    var hc = {};
    R.forEach(function (r) { if (inView(r)) hc[r.holder] = (hc[r.holder] || 0) + 1; });
    var holders = Object.keys(hc).sort(function (a, b) { return hc[b] - hc[a]; });
    if (POOL.holder !== '全部' && !hc[POOL.holder]) POOL.holder = '全部';
    var total = holders.reduce(function (a, h) { return a + hc[h]; }, 0);
    btnSet('pool-holder', 'cell-btn', [{ v: '全部', label: '全部', cnt: total }].concat(holders.map(function (h) { return { v: h, label: h, cnt: hc[h] }; })),
      POOL.holder, function (v) { POOL.holder = v; }, poolRedraw);
    btnSet('pool-band', 'cell-btn', Object.keys(BANDS).map(function (k) { return { v: k, label: BAND_TXT[k], cls: BAND_LOW[k] ? 'focus-low' : '' }; }),
      POOL.band, function (v) { POOL.band = v; }, poolRedraw);
    sortSelect('pool-sort', Object.keys(SORTS), SORT_TXT, POOL.sort, function (v) { POOL.sort = v; }, poolRedraw);
    var chip = function (g, on, html) { return '<button type="button" class="fchip' + (on ? ' on' : '') + '" data-g="' + g + '">' + html + DOWN + '</button>'; };
    $('pool-chips').innerHTML =
      chip('period', POOL.q !== defaultQ, (POOL.q !== 'snap' && disclosing(POOL.q) ? '<span class="dot-amber"></span>' : '') + esc(POOL.q === 'snap' ? '季后快照' : qText(POOL.q))) +
      chip('holder', POOL.holder !== '全部', POOL.holder === '全部' ? '全部通道' : esc(POOL.holder) + ' <span class="cnt">' + hc[POOL.holder] + '</span>') +
      chip('band', POOL.band !== '全部', esc(BAND_TXT[POOL.band]));
    $('pool-chips').querySelectorAll('.fchip').forEach(function (b) { b.onclick = function () { openSheet('pool-filter', b.getAttribute('data-g')); }; });

    var g = {};
    R.forEach(function (r) {
      if (!inView(r)) return;
      var x = g[r.code] || (g[r.code] = { code: r.code, name: r.name, price: r.price, cost: r.cost, dev: r.dev, kind: r.kind, q: r.q, holders: [], chg: [], ratio: 0, susp: r.susp });
      x.holders.push(r.holder); x.chg.push(r.chg); x.ratio += r.ratio || 0;
    });
    var list = Object.keys(g).map(function (k) { return g[k]; }).filter(function (x) {
      return (POOL.holder === '全部' || x.holders.indexOf(POOL.holder) >= 0) && BANDS[POOL.band](x);
    }).sort(SORTS[POOL.sort]);
    var rows = list.slice(0, POOL.limit);
    $('pool-meta').innerHTML = '符合条件：<strong class="num">' + list.length + '</strong> 只票';
    var chgTag = function (x) {
      var n = x.chg.filter(function (c) { return c === '新进'; }).length;
      return n ? (n === x.holders.length ? '新进' : n + ' 家新进') : (x.chg[0] || '');
    };
    $('pool-tbody').innerHTML = rows.map(function (x) {
      return '<tr onclick="location.hash=\'#stock/' + x.code + '\'" style="cursor:pointer;"><td><strong class="serif">' + esc(x.name) +
        '</strong> <span class="num t-muted">' + x.code + '</span>' + snapDate(x) + '</td><td>' + esc(x.holders.join(' / ')) +
        (x.holders.length > 1 ? '（' + x.holders.length + ' 家）' : '') + '</td><td><span class="fact-tag">' + esc(chgTag(x)) + '</span></td>' +
        '<td class="num text-right">' + x.price.toFixed(2) + '</td><td class="num text-right">' + x.cost.toFixed(2) + '</td>' +
        '<td class="num text-right ' + tone(x.dev) + '">' + pct(x.dev) + '</td><td class="num text-right">' + x.ratio.toFixed(2) + '%</td></tr>';
    }).join('');
    $('pool-cards').innerHTML = rows.map(function (x) {
      return '<div class="card" onclick="location.hash=\'#stock/' + x.code + '\'">' +
        '<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">' +
        '<div><strong class="serif" style="font-size:1.05rem;">' + esc(x.name) + '</strong> <span class="num t-muted" style="font-size:0.82rem;">' + x.code + '</span>' + snapDate(x) + '</div>' +
        '<div class="num"><strong>' + x.price.toFixed(2) + '</strong></div></div>' +
        '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;"><span class="fact-tag" style="color:var(--accent);">' + esc(chgTag(x)) + '</span>' +
        '<span class="fact-tag">' + esc(x.holders.join(' / ')) + '</span></div>' +
        '<div style="display:grid; grid-template-columns:repeat(3, 1fr); background:var(--panel-subtle); padding:8px 10px; border-radius:8px; font-size:0.78rem;">' +
        '<div><div class="t-muted">估算成本</div><div class="num" style="font-weight:600;">' + x.cost.toFixed(2) + '</div></div>' +
        '<div><div class="t-muted">现价偏离</div><div class="num ' + tone(x.dev) + '" style="font-weight:600;">' + pct(x.dev) + '</div></div>' +
        '<div><div class="t-muted">占流通股</div><div class="num" style="font-weight:600;">' + x.ratio.toFixed(2) + '%</div></div></div></div>';
    }).join('');
    more('pool-more', list.length - rows.length, function () { POOL.limit += 100; drawPool(); });
  });
}

// ---------- 龙虎榜席位 ----------
var SEAT_MIN = { '全部': 0, '≥10 次': 10, '≥30 次': 30, '≥60 次': 60 };
var SEAT_SORT = { '上榜次数': 'n', '净买入': 'net_yi', '5日均涨': 'd5', '5日胜率': 'win5' };
var SEAT_SORT_TXT = { '上榜次数': '排序：上榜次数（多→少）', '净买入': '排序：净买入额（高→低）', '5日均涨': '排序：5 日均涨（高→低）', '5日胜率': '排序：5 日胜率（高→低）' };
var SEATS = { type: '营业部', min: '≥10 次', sort: '上榜次数', limit: 50 };
function signed(v, unit) { return v == null ? '—' : '<span class="' + tone(v) + '">' + (v > 0 ? '+' : '') + v + unit + '</span>'; }
function seatRecent(s) {
  return (s.recent || []).map(function (r) {
    return '<div class="seat-row"><span class="num t-muted">' + esc(r.date.slice(5)) + '</span><a href="#stock/' + r.code + '">' + esc(r.name || r.code) +
      '</a><span>净买 ' + r.net + ' 万</span><span>买后5日 ' + (r.d5 == null ? '—' : r.d5 + '%') + '</span></div>';
  }).join('') || '—';
}
function drawSeats() {
  load('seats.json').then(function (D) {
    if (!D) { $('seats-meta').textContent = '席位数据暂不可用'; return; }
    var A = D.seats;
    $('seats-upd').textContent = '更新于 ' + D.updated;
    $('seats-sub').textContent = '看的是统计倾向，不是预测：龙虎榜只告诉你昨天谁买了。一个席位背后可能好几拨人，也可能换了人。统计区间最近 ' + D.days + ' 天。';
    // 四个汇总数：按"有后续涨跌统计的买入笔数"加权
    $('seats-tiles').innerHTML = [['全部', '全部席位'], ['营业部', '营业部'], ['机构专用', '机构专用'], ['北向', '北向']].map(function (x) {
      var r = A.filter(function (s) { return (x[0] === '全部' || s.type === x[0]) && s.n_perf; });
      var n = r.reduce(function (a, s) { return a + s.n_perf; }, 0);
      if (!n) return '';
      var d5 = r.reduce(function (a, s) { return a + s.d5 * s.n_perf; }, 0) / n, win = r.reduce(function (a, s) { return a + s.win5 * s.n_perf; }, 0) / n;
      return '<div class="seat-tile"><b class="' + tone(d5) + '">' + d5.toFixed(2) + '%</b><span>' + x[1] + '：买后 5 日平均涨跌，' + Math.round(win) + '% 为正</span></div>';
    }).join('');
    var ofType = function (t) { return A.filter(function (s) { return t === '全部' || s.type === t; }); };
    var redraw = function () { SEATS.limit = 50; drawSeats(); };
    btnSet('seats-type', 'seg-btn', [['全部', '全部'], ['营业部', '营业部'], ['机构专用', '机构'], ['北向', '北向']].map(function (x) {
      return { v: x[0], label: x[1], cnt: ofType(x[0]).length }; }), SEATS.type, function (v) { SEATS.type = v; }, redraw);
    btnSet('seats-min', 'seg-btn', Object.keys(SEAT_MIN).map(function (k) { return { v: k, label: k }; }), SEATS.min, function (v) { SEATS.min = v; }, redraw);
    $('seats-type-hint').textContent = '共 ' + A.length + ' 个席位';
    $('seats-min-hint').textContent = '统计近 ' + D.days + ' 天';
    sortSelect('seats-sort', Object.keys(SEAT_SORT), SEAT_SORT_TXT, SEATS.sort, function (v) { SEATS.sort = v; }, redraw);
    var k = SEAT_SORT[SEATS.sort];
    var list = A.filter(function (s) { return (SEATS.type === '全部' || s.type === SEATS.type) && s.n >= SEAT_MIN[SEATS.min]; })
      .sort(function (a, b) { return (b[k] == null ? -1e9 : b[k]) - (a[k] == null ? -1e9 : a[k]); });
    var rows = list.slice(0, SEATS.limit);
    $('seats-meta').innerHTML = '符合条件：<strong class="num">' + list.length + '</strong> 个席位';
    $('seats-tbody').innerHTML = rows.map(function (s) {
      return '<tr><td><details class="seat-card"><summary><strong>' + esc(s.name) + '</strong></summary><div class="seat-recent">' + seatRecent(s) + '</div></details></td>' +
        '<td class="num text-right">' + s.n + '</td><td class="num text-right">' + s.buy_yi + '</td><td class="num text-right">' + signed(s.net_yi, '') + '</td>' +
        '<td class="num text-right">' + signed(s.d1, '%') + '</td><td class="num text-right">' + signed(s.d5, '%') + '</td><td class="num text-right">' + signed(s.d10, '%') + '</td>' +
        '<td class="num text-right">' + (s.win5 == null ? '—' : s.win5 + '%') + '<span class="t-muted" style="font-size:0.72rem;"> /' + s.n_perf + '</span></td></tr>';
    }).join('');
    $('seats-cards').innerHTML = rows.map(function (s) {
      return '<details class="card seat-card"><summary>' +
        '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:8px;"><strong style="font-size:0.95rem;">' + esc(s.name) + '</strong>' +
        '<span class="num t-muted" style="font-size:0.8rem; white-space:nowrap;">上榜 ' + s.n + ' 次</span></div>' +
        '<div style="display:grid; grid-template-columns:repeat(3, 1fr); background:var(--panel-subtle); padding:8px 10px; border-radius:8px; font-size:0.78rem;">' +
        '<div><div class="t-muted">净买入(亿)</div><div class="num" style="font-weight:600;">' + signed(s.net_yi, '') + '</div></div>' +
        '<div><div class="t-muted">5日均涨</div><div class="num" style="font-weight:600;">' + signed(s.d5, '%') + '</div></div>' +
        '<div><div class="t-muted">5日胜率</div><div class="num" style="font-weight:600;">' + (s.win5 == null ? '—' : s.win5 + '%') + '</div></div></div>' +
        '<div class="t-muted" style="font-size:0.76rem; margin-top:8px;">点开看最近买了什么 ▾</div></summary>' +
        '<div class="seat-recent">' + seatRecent(s) + '</div></details>';
    }).join('');
    more('seats-more', list.length - rows.length, function () { SEATS.limit += 100; drawSeats(); });
  });
}

// ---------- 共用：潮水、站主判定、建设中切换 ----------
// 数据文件不存在 → 显示"建设中"卡片；存在 → 显示内容
function ready(name, ok) { $(name + '-empty').style.display = ok ? 'none' : ''; $(name + '-body').style.display = ok ? '' : 'none'; }
function tideHtml(t) {
  if (!t) return '';
  return '<span class="tide"><span>量能 <b>' + (t.vol_ratio == null ? '—' : t.vol_ratio + '×') + '</b></span><span>离高点 <b class="' + (t.from_high < 0 ? 'down' : '') + '">' +
    pct(t.from_high) + '</b></span><span>近 5 日涨停 <b>' + t.limit_ups + '</b></span></span>';
}
var PEN = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.5 7.5"/></svg>';
function riskHtml(x) {
  var n = function (v, u) { return v == null ? '—' : v + (u || ''); };
  var neg = function (v) { return v != null && v < 0 ? ' class="t-amber"' : ''; };
  var row = function (k, v, note) { return '<div class="risk-row"><span class="risk-k">' + k + '</span><span class="num">' + v + '</span>' + (note ? '<span class="risk-note">' + note + '</span>' : '') + '</div>'; };
  var cf = x.cf.map(function (v, i) { return '<span' + neg(v) + '>' + n(v) + '</span>' + '<span class="t-muted">（' + (i ? x.cf_d[i].slice(0, 4) + ' 年' : x.cf_d[0].slice(0, 7) + ' 累计') + '）</span>'; }).join(' · ');
  return (x.flags.length ? '<div class="risk-flags">' + x.flags.map(function (f) { return '<span class="fact-tag t-amber">⚠ ' + esc(f) + '</span>'; }).join('') + '</div>'
      : '<p class="t-muted" style="font-size:0.84rem; margin:0 0 8px;">下面几项没有触发雷标。</p>') +
    row('经营现金流（亿）', cf) +
    row('净资产（亿）', '<span' + neg(x.equity) + '>' + n(x.equity) + '</span>') +
    row('资产负债率', n(x.debt, '%'), '金融业天然偏高') +
    row(x.y + ' 年营收 / 净利（亿）', n(x.rev_y) + ' / <span' + neg(x.np_y) + '>' + n(x.np_y) + '</span>') +
    row('今年累计营收 / 净利（亿）', n(x.rev) + ' / <span' + neg(x.np) + '>' + n(x.np) + '</span>') +
    row('股权质押比例', n(x.pledge, '%'), x.pledge_d ? '中登 ' + x.pledge_d : '') +
    '<p class="risk-foot">只做排雷，不判断好坏。亏损不等于不能碰，A 股常有亏损公司靠资本运作翻身；雷标是提醒你先去看原文。诉讼、立案、问询等法律信息还没接上。</p>';
}
function analysisHtml(a) {
  var src = function (L) { return (L || []).length ? ' <span class="t-muted num">' + L.map(esc).join(' ') + '</span>' : ''; };
  var row = function (k, v) { return v ? '<p class="an-row"><span class="an-k">' + k + '</span>' + v + '</p>' : ''; };
  return '<div class="chain-head"><span class="voice-badge voice-ai">Signal 分析</span><span class="num t-muted">基于 ' + esc(a.data_date) + ' 的数据</span></div>' +
    '<p class="an-one">' + esc(a.one_line) + '</p>' +
    (a.facts || []).map(function (e) { return row('事实', esc(e.text) + src(e.src)); }).join('') +
    (a.reads || []).map(function (e) { return row(esc(e.level), esc(e.text) + src(e.src)); }).join('') +
    row('下一步', esc(a.next)) +
    (a.risks || []).map(function (r) { return row('风险', '<span class="t-amber">' + esc(r) + '</span>'); }).join('') +
    row('别误读', esc(a.not_this)) +
    '<p class="an-foot">研究记录，不是买卖建议。编号对应上面打包的事实；✅ 公告证实 · 🟡 间接迹象 · ❓ 猜测。</p>';
}
function verdictHtml(v) {
  if (!v) return '<span class="voice-badge voice-owner">' + PEN + ' 站主判定：暂无</span>';
  return '<span class="voice-badge voice-owner">' + PEN + ' 站主判定：' + esc(v.v) + '</span><span class="num t-muted" style="font-size:0.74rem; margin-left:8px;">' + esc(v.date) + '</span>' +
    '<p class="serif" style="font-size:0.84rem; margin-top:6px;">' + esc(v.why) + '</p>';
}
function stockLink(code, name) { return /^\d{6}$/.test(code) ? '<a href="#stock/' + code + '" class="serif stk">' + esc(name) + '</a> <span class="num t-muted">' + code + '</span>' : esc(name); }
function safeUrl(u) { return /^https:\/\//.test(u || '') ? esc(u) : ''; }   // 外链只认 https

// ---------- 首页：市场状态、研究榜前 5 ----------
load('market.json').then(function (M) {
  if (!M) return;
  var row = function (x) {
    return '<div class="index-row"><div class="index-top"><span><strong>' + esc(x.name) + '</strong> <span class="num ' + tone(x.chg) + '">' + pct(x.chg) + '</span></span>' +
      '<span class="num t-ink2">' + pct(x.from_high) + '</span></div><div class="drawdown-bar"><div class="drawdown-fill" style="width:' + Math.max(0, 100 + x.from_high) + '%;"></div></div></div>';
  };
  var sec = function (list) { return list.map(function (x) { return '<div class="sector-item"><span>' + esc(x.name) + '</span><span class="num ' + tone(x.chg) + '">' + pct(x.chg) + '</span></div>'; }).join(''); };
  var b = M.breadth;
  $('market-box').innerHTML = '<div class="market-bento">' +
    '<div class="bento-summary"><span>' + esc(M.summary) + '</span><span class="sec-meta">更新于 ' + esc(M.updated) + '</span></div>' +
    '<div class="card"><div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--ink-3); margin-bottom:8px;"><span>主要指数 / 今日</span><span>离近一年高点</span></div>' +
      M.indices.map(row).join('') +
      (b ? '<div style="font-size:0.78rem; color:var(--ink-2); margin-top:10px; padding-top:8px; border-top:1px solid var(--line);">抽样 ' + b.sample + ' 只：低于 924 前 <b class="num">' + b.below_924 + '%</b>，从今年高点跌一半以上 <b class="num">' + b.down_half + '%</b></div>' : '') + '</div>' +
    '<div class="card"><div class="sector-cols"><div><div style="font-size:0.76rem; color:var(--ink-3); margin-bottom:6px; border-bottom:1px solid var(--line); padding-bottom:4px;">今日领涨行业</div>' + sec(M.sectors.up) +
      '</div><div><div style="font-size:0.76rem; color:var(--ink-3); margin-bottom:6px; border-bottom:1px solid var(--line); padding-bottom:4px;">今日领跌行业</div>' + sec(M.sectors.down) + '</div></div></div>' +
    '<div class="card"><div style="font-size:0.78rem; color:var(--ink-3); margin-bottom:8px;">外盘参考</div>' + M.overseas.map(function (x) {
      return '<div class="index-row" style="display:flex; justify-content:space-between; align-items:center;"><div><strong>' + esc(x.name) + '</strong> <span class="fact-tag" style="margin-left:4px;">' + esc(x.when) + '</span></div><span class="num ' + tone(x.chg) + '">' + pct(x.chg) + '</span></div>';
    }).join('') + '</div></div>';
});
load('research.json').then(function (R) {
  if (!R) return;
  $('portal-research-tag').textContent = '每天更新';
  $('home-research').style.display = '';
  $('home-research-list').innerHTML = R.items.slice(0, 5).map(function (x) {
    return '<div class="top5-row"><span class="num t-muted">' + x.rank + '</span>' + stockLink(x.code, x.name) +
      (x.is_new ? '<span class="new-dot">新</span>' : '') + '<span class="why">' + esc(x.reasons.map(function (r) { return r.text; }).join('；')) + '</span><span class="num">' + x.score + ' 分</span></div>';
  }).join('');
});

// ---------- 研究榜 ----------
var RS_ST = { '全部': function () { return true; }, '新上榜': function (x) { return x.is_new; },
  '值得研究': function (x) { return x.verdict && x.verdict.v === '值得'; }, '已放弃': function (x) { return x.verdict && x.verdict.v === '放弃'; } };
var RS_SORT = { '综合分': function (a, b) { return b.score - a.score; }, '今日涨跌': function (a, b) { return b.chg - a.chg; },
  '首次上榜': function (a, b) { return b.first_date.localeCompare(a.first_date); } };
var RS_SORT_TXT = { '综合分': '排序：综合分（高→低）', '今日涨跌': '排序：今日涨跌（高→低）', '首次上榜': '排序：首次上榜（新→旧）' };
var RS = { st: '全部', sort: '综合分' };
function drawResearch() {
  load('research.json').then(function (R) {
    ready('research', !!R); if (!R) { $('research-upd').textContent = '建设中'; return; }
    $('research-upd').textContent = '更新于 ' + R.updated;
    btnSet('research-st', 'cell-btn', Object.keys(RS_ST).map(function (k) { return { v: k, label: k, cnt: R.items.filter(RS_ST[k]).length }; }),
      RS.st, function (v) { RS.st = v; }, drawResearch);
    sortSelect('research-sort', Object.keys(RS_SORT), RS_SORT_TXT, RS.sort, function (v) { RS.sort = v; }, drawResearch);
    var list = R.items.filter(RS_ST[RS.st]).sort(RS_SORT[RS.sort]);
    $('research-meta').innerHTML = '符合条件：<strong class="num">' + list.length + '</strong> 只票';
    $('research-list').innerHTML = list.map(function (x) {
      return '<article class="card r-card"><div><div class="r-header"><div class="r-name"><span class="rank-num">#' + x.rank + '</span>' + stockLink(x.code, x.name) +
        (x.is_new ? '<span class="status-badge new">● 新上榜</span>' : '<span class="status-badge">首次上榜 ' + esc(x.first_date) + '</span>') + '</div>' +
        '<div style="text-align:right; white-space:nowrap;">' + pxHtml(x.price, x.chg) + '</div></div>' +
        '<div class="box-machine"><div class="bm-head"><span class="voice-badge voice-machine">机器事实 · 上榜理由</span><span class="num" style="font-size:0.84rem;">综合 <strong>' + x.score + '</strong> 分</span></div>' +
        '<div class="r-reasons">' + x.reasons.map(function (r) { return '<div>' + esc(r.text) + '<span class="sc">' + (r.score > 0 ? '+' : '') + r.score + '</span></div>'; }).join('') + '</div>' +
        '<div class="bm-tide">' + tideHtml(x.tide) + '</div></div>' +
        '<div class="box-owner">' + verdictHtml(x.verdict) + '</div></div>' +
        '<div class="r-footer"><span class="voice-badge voice-ai">' + (x.report ? 'AI 报告 ' + '★'.repeat(x.report.stars) : 'AI 报告：待研究') + '</span><a href="#stock/' + x.code + '" style="color:var(--accent); font-weight:600;">查看详情 →</a></div></article>';
    }).join('');
    $('research-rules').innerHTML = '<table class="rules-table">' + R.rules.map(function (r) { return '<tr><td>' + esc(r.fact) + '</td><td>' + esc(r.score) + '</td></tr>'; }).join('') +
      '</table><p style="margin-top:8px;">候选：带线索标签的票加上近 5 日涨停的票。每天留前 30 名，第一次进前 30 记为“新上榜”，首次上榜日期永久保留。</p>' +
      '<p style="margin-top:6px;">成绩：用 2026-09-23 的数据回放，这套规则还挑不出之后一个月大涨的票，所以这里只是线索排序，不是预测。每天的前 30 名都存档，满一个月起公布它们后来的表现，权重照成绩调。</p>';
  });
}

// ---------- 题材 ----------
// 一次只看一个环节（默认第一个），可按外资通道筛；手机上三个按钮点开从底部弹出（11-04 用户提：原来一百多张卡片摞在一起要一直往下滑）
var TH = { name: null, seg: '', holder: '全部', limit: 25 };
function drawTheme(name) {
  load('themes.json').then(function (T) {
    ready('theme', !!T); if (!T) { $('theme-upd').textContent = '建设中'; return; }
    var th = T.themes.filter(function (x) { return x.name === name; })[0] || T.themes[0];
    if (TH.name !== th.name) { TH.name = th.name; TH.seg = th.segments[0].name; TH.holder = '全部'; TH.limit = 25; }
    var redraw = function () { TH.limit = 25; drawTheme(th.name); };
    $('theme-title').textContent = th.name;
    $('theme-sub').textContent = th.intro;
    $('theme-upd').textContent = '更新于 ' + T.updated;
    var nOf = function (t) { var u = {}; t.segments.forEach(function (g) { g.items.forEach(function (x) { u[x.code] = 1; }); }); return Object.keys(u).length; };   // 跨环节重复的只算一次
    $('theme-pick').innerHTML = T.themes.map(function (x) {
      return '<a class="cell-btn' + (x === th ? ' active' : '') + '" href="#theme/' + encodeURIComponent(x.name) + '"><span>' + esc(x.name) + '</span><span class="cnt">' + nOf(x) + '</span></a>';
    }).join('');
    var segs = TH.seg === '全部' ? th.segments : th.segments.filter(function (g) { return g.name === TH.seg; });
    var hc = {}, seen = {};                        // 当前环节里每个通道在几家；一家在几个环节都出现只算一次
    segs.forEach(function (g) { g.items.forEach(function (x) { if (seen[x.code]) return; seen[x.code] = 1; (x.holders || []).forEach(function (h) { hc[h.h] = (hc[h.h] || 0) + 1; }); }); });
    if (TH.holder !== '全部' && !hc[TH.holder]) TH.holder = '全部';
    var holders = Object.keys(hc).sort(function (a, b) { return hc[b] - hc[a]; });
    btnSet('theme-seg', 'cell-btn', [{ v: '全部', label: '全部环节', cnt: nOf(th) }].concat(th.segments.map(function (g) { return { v: g.name, label: g.name, cnt: g.items.length }; })),
      TH.seg, function (v) { TH.seg = v; }, redraw);
    btnSet('theme-holder', 'cell-btn', [{ v: '全部', label: '全部通道' }].concat(holders.map(function (h) { return { v: h, label: h, cnt: hc[h] }; })),
      TH.holder, function (v) { TH.holder = v; }, redraw);
    var chip = function (g, on, html) { return '<button type="button" class="fchip' + (on ? ' on' : '') + '" data-g="' + g + '">' + html + DOWN + '</button>'; };
    $('theme-chips').innerHTML = chip('theme', false, esc(th.name)) + chip('seg', TH.seg !== '全部', TH.seg === '全部' ? '全部环节' : esc(TH.seg)) +
      chip('holder', TH.holder !== '全部', TH.holder === '全部' ? '全部通道' : esc(TH.holder) + ' <span class="cnt">' + hc[TH.holder] + '</span>');
    $('theme-chips').querySelectorAll('.fchip').forEach(function (b) { b.onclick = function () { openSheet('theme-filter', b.getAttribute('data-g')); }; });

    var isNew = function (d) { return d && (Date.parse(T.updated) - Date.parse(d)) / 864e5 <= 30; };
    var ev = function (e) { var u = safeUrl(e.url); return '<div class="quote">“' + esc(e.quote) + '”' + (u ? '<a href="' + u + '" target="_blank" rel="noopener">' + esc(e.date) + ' ' + esc(e.title) + ' ↗</a>' : '<span class="t-muted" style="font-size:0.74rem; margin-left:4px;">' + esc(e.date) + ' ' + esc(e.title) + '</span>') + '</div>'; };
    var chs = function (x) { return (x.holders || []).map(function (h) { return '<span class="ch-tag' + (h.new ? ' new' : '') + '">' + esc(h.h) + (h.new ? ' 新进' : '') + '</span>'; }).join(''); };
    var keep = function (x) { return TH.holder === '全部' || (x.holders || []).some(function (h) { return h.h === TH.holder; }); };
    var left = TH.limit, shown = 0, all = 0, uniq = {};
    $('theme-segs').innerHTML = segs.map(function (g) {
      var list = g.items.filter(keep); all += list.length; list.forEach(function (x) { uniq[x.code] = 1; });
      var rows = list.slice(0, Math.max(0, left)); left -= rows.length; shown += rows.length;
      if (!rows.length) return '';
      var cut = g.total > g.items.length ? '共 ' + g.total + ' 家，列进度最靠前的 ' + g.items.length + ' 家' : g.items.length + ' 家';
      return '<div class="theme-seg"><div class="sec-head"><h2 class="sec-title">' + esc(g.name) + '</h2><span class="sec-meta">' + (TH.holder === '全部' ? cut : list.length + ' 家') + '</span></div>' +
        '<div class="pool-table-wrap"><table class="data-table"><thead><tr><th>代码 / 名称</th><th>角色</th><th>进度</th><th>公告原文</th><th>潮水</th></tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr><td style="white-space:nowrap;">' + stockLink(x.code, x.name) + (isNew(x.first_seen) ? '<span class="new-dot">新</span>' : '') + '<div>' + chs(x) + '</div></td><td>' + esc(x.role) + '</td><td><span class="fact-tag">' + esc(x.stage) + '</span></td><td>' + ev(x.evidence) + '</td><td>' + tideHtml(x.tide) + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="pool-mobile-cards">' +
        rows.map(function (x) {
          return '<div class="card"><div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:6px;"><div>' + stockLink(x.code, x.name) + (isNew(x.first_seen) ? '<span class="new-dot">新</span>' : '') + '</div>' +
            '<span class="fact-tag">' + esc(x.role) + ' · ' + esc(x.stage) + '</span></div>' + (chs(x) ? '<div style="margin-bottom:6px;">' + chs(x) + '</div>' : '') + ev(x.evidence) + '<div style="margin-top:8px;">' + tideHtml(x.tide) + '</div></div>';
        }).join('') + '</div></div>';
    }).join('');
    $('theme-meta').innerHTML = '共 <strong>' + Object.keys(uniq).length + '</strong> 家' + (TH.holder !== '全部' ? '有' + esc(TH.holder) : '');
    more('theme-more', all - shown, function () { TH.limit += 25; drawTheme(th.name); });
  });
}

// ---------- 研究台账 ----------
var LG = { res: '全部', sort: '进入日期' };
var LG_SORT = { '进入日期': function (a, b) { return b.found.localeCompare(a.found); }, '到期日': function (a, b) { return a.due.localeCompare(b.due); } };
var LG_SORT_TXT = { '进入日期': '排序：进入日期（新→旧）', '到期日': '排序：到期日（近→远）' };
var LG_CLS = { '看对了': ' verdict-right', '看错了': ' verdict-wrong' };
function drawLedger() {
  load('ledger.json').then(function (L) {
    var ok = !!(L && L.v === 2);               // 老站拷来的旧格式（里面有站主持仓）不显示
    ready('ledger', ok); if (!ok) { $('ledger-upd').textContent = '建设中'; return; }
    $('ledger-upd').textContent = '更新于 ' + L.updated;
    var E = L.entries;
    btnSet('ledger-res', 'cell-btn', ['全部', '未到期', '看对了', '看错了'].map(function (k) {
      return { v: k, label: k, cnt: E.filter(function (e) { return k === '全部' || e.result === k; }).length };
    }), LG.res, function (v) { LG.res = v; }, drawLedger);
    sortSelect('ledger-sort', Object.keys(LG_SORT), LG_SORT_TXT, LG.sort, function (v) { LG.sort = v; }, drawLedger);
    var list = E.filter(function (e) { return LG.res === '全部' || e.result === LG.res; }).sort(LG_SORT[LG.sort]);
    $('ledger-meta').innerHTML = '符合条件：<strong class="num">' + list.length + '</strong> 条';
    var f = function (k, v, n) { return '<div class="lf lf-' + n + '"><div class="field-label">' + k + '</div><div>' + v + '</div></div>'; };
    $('ledger-list').innerHTML = list.map(function (e) {
      return '<article class="card ledger-card' + (LG_CLS[e.result] || '') + '"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">' +
        '<div>' + stockLink(e.code, e.name) + '</div><div style="display:flex; gap:6px; flex-wrap:wrap;"><span class="fact-tag">到期 <span class="num">' + esc(e.due) + '</span></span><span class="fact-tag">' + esc(e.result) + '</span></div></div>' +
        '<div class="ledger-grid">' + f('1. 进入视野', '<span class="num">' + esc(e.found) + '（' + e.price_found + ' 元）</span>', 1) +
        f('2. 触发事实', esc(e.trigger) + ' <span class="t-muted">［' + esc(e.source) + '］</span>', 2) + f('3. 在等节点', esc(e.waiting), 3) +
        f('4. 怎样算看错', esc(e.falsify), 4) + f('5. 后来怎样', e.later ? esc(e.later) : '<span class="t-muted">跟踪中</span>', 5) + '</div></article>';
    }).join('');
  });
}

// ---------- 体检表 ----------
var HS = { ok: ['正常', 'var(--fall-bg)', 'var(--fall)', ''], warn: ['快过期', 'var(--amber-bg)', 'var(--amber)', ' warn'], stale: ['已停更', 'var(--rise-bg)', 'var(--rise)', ' expired'] };
function healthBadge(x) {
  var h = HS[x.status] || HS.stale;
  return '<span class="health-badge" style="background:' + h[1] + '; color:' + h[2] + ';"><span class="status-dot' + h[3] + '"></span> ' + h[0] + (x.note ? '（' + esc(x.note) + '）' : '') + '</span>';
}
function drawHealth() {
  load('health.json').then(function (H) {
    ready('health', !!H); if (!H) { $('health-upd').textContent = '建设中'; return; }
    $('health-upd').textContent = '自检 ' + H.checked;
    $('health-tbody').innerHTML = H.sources.map(function (x) {
      return '<tr><td><strong>' + esc(x.name) + '</strong></td><td class="num">' + esc(x.last) + '</td><td>' + esc(x.every) + '</td><td>' + healthBadge(x) + '</td></tr>';
    }).join('');
    $('health-cards').innerHTML = H.sources.map(function (x) {
      return '<div class="card"><div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;"><strong>' + esc(x.name) + '</strong></div>' +
        '<div style="font-size:0.8rem; color:var(--ink-2); margin-bottom:8px;">最后更新 <span class="num">' + esc(x.last) + '</span> · ' + esc(x.every) + '</div>' + healthBadge(x) + '</div>';
    }).join('');
  });
}

// ---------- 查一只票 ----------
// 时间线图标（取自 Gemini 稿，单色线条）
var ICON = {
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  bars: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  bank: '<polygon points="12 2 2 7 22 7 12 2"/><line x1="6" y1="12" x2="6" y2="17"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="18" y1="12" x2="18" y2="17"/><line x1="2" y1="21" x2="22" y2="21"/>'
};
function icon(k) { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; }

// ---------- 进度条：每类在途事件走过哪几步、现在在哪、后面还有哪几步 ----------
// 每一步认公告标题里的字眼；一条公告从最后一步往前比，认最靠后的那一步。公告事件只收了近 3 个月，更早的步骤标“早于收录”
var CHAINS = {
  '重组在途': { name: '重组', steps: [['筹划', /筹划|停牌/], ['预案', /预案/], ['草案', /草案|重组报告书|购买资产.{0,20}报告书/], ['受理', /受理/],
    ['问询', /问询/], ['上会', /上会稿|会议安排/], ['审核通过', /审核通过|审议会议结果|重组委.{0,10}(审议|通过)/],
    ['提交注册', /提交注册|报送.{0,8}注册/], ['同意注册', /同意.{0,40}注册|注册的批复|注册批复|注册生效|核准/],
    ['实施过户', /过户|交割|实施进展/], ['新股上市', /新增股份上市|上市公告书|实施情况暨|限售股.{0,4}上市流通/]] },
  '定增在途': { name: '定增', steps: [['预案', /预案|方案|论证分析|可行性分析|摊薄即期/], ['受理', /受理/], ['问询', /问询/],
    ['审核通过', /审核通过|上市审核委员会|上市委/], ['提交注册', /提交注册|报送.{0,8}注册/], ['同意注册', /同意.{0,40}注册|注册的批复|注册批复|注册生效/],
    ['发行', /发行情况报告|发行过程和认购对象|认购资金验资|缴款|发行结果|竞价结果/], ['新股上市', /新增股份上市|上市公告书|限售股.{0,4}上市流通|专户.{0,6}(销户|注销)/]] },
  '减持在途': { name: '股东减持', steps: [['计划披露', /预披露|拟.{0,4}减持|减持.{0,8}计划(的)?(提示性)?公告|减持.{0,8}计划$/],
    ['实施中', /进展|过半|实施情况(?!.*届满)/], ['结束', /结果|实施完毕|完成|届满|到期|终止/]], reset: 0 },
  '重整在途': { name: '重整', steps: [['被申请', /申请.{0,12}重整|自查/], ['预重整', /预重整/], ['法院受理', /裁定受理|受理.{0,10}重整申请|进入重整程序/],
    ['重整计划', /重整计划.{0,4}草案|债权人会议|出资人.{0,4}会议/], ['法院批准', /裁定批准|批准.{0,8}重整计划/], ['执行完毕', /执行完毕/]],
    note: function (L) { return L.some(function (e) { return /子公司|控股股东|第一大股东|大股东/.test(e.title); }) ? '有的公告主体是子公司或股东，不是公司本身，以原文为准' : ''; } },
  '摘帽在途': { name: '摘帽', steps: [['申请撤销', /申请撤销/], ['已撤销', /^(?!.*申请撤销).*撤销.{0,6}风险警示/]],
    note: function (L) { return L.some(function (e) { return /继续被实施/.test(e.title); }) ? '撤销后仍有其他风险警示，以原文为准' : ''; } },
  '大厂定点': { name: '大厂定点', steps: [['只是意向'], ['验厂'], ['送样试制'], ['定点'], ['量产']], noEarly: true }   // 阶段名取老系统 ann_scan 的原样；“未说明”不上进度条
};
// 交易所审核状态 → 定增/重组链上的哪一步（交易所数据比公告标题准，取两者里靠后的）
var AUDIT_AT = { '已受理': '受理', '已问询': '问询', '已回复': '问询', '审核通过': '审核通过', '上市委会议通过': '审核通过', '提交注册': '提交注册', '注册生效': '同意注册', '注册结果': '同意注册' };
var AUDIT_STOP = /终止|撤回|不予注册|未通过/;
var THEME_STEPS = [['提到'], ['研发'], ['验证'], ['定点'], ['量产']];
function stepOf(steps, e) {
  if (!steps[0][1]) { for (var j = 0; j < steps.length; j++) if (steps[j][0] === e.stage) return j; return -1; }   // 大厂定点、主题：直接给了阶段
  for (var i = steps.length - 1; i >= 0; i--) if (steps[i][1].test(e.title)) return i;
  return -1;
}
// 一类事件 → {name, steps, at, hit[i]=该步第一条公告, stop, note}
function auditKind(au) { return /发行股份|购买资产|重组/.test(au.name) ? '重组在途' : '定增在途'; }   // 交易所这条审核是定增还是重组
function buildChain(kind, L, au) {
  var C = CHAINS[kind], steps = C.steps, list = L.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  if (C.reset === 0) {                    // 减持：一轮计划一条链，只看最近一轮
    var start = -1; list.forEach(function (e, i) { if (stepOf(steps, e) === 0) start = i; });
    if (start > 0) list = list.slice(start);
  }
  var hit = [], at = -1, stop = null;
  list.forEach(function (e) {
    var i = stepOf(steps, e);
    if (e.stop && kind !== '减持在途') { stop = e; return; }
    if (i < 0) return;
    if (!hit[i]) hit[i] = e;
    if (i >= at) at = i;
  });
  var src = '公告标题';
  if (au && kind === auditKind(au)) {
    if (AUDIT_STOP.test(au.st)) stop = stop || { date: au.updt, title: au.ex + '审核状态：' + au.st };
    var ai = -1; steps.forEach(function (s, i) { if (s[0] === AUDIT_AT[au.st]) ai = i; });
    if (ai >= at) { at = ai; hit[ai] = hit[ai] || { date: au.updt, title: au.ex + '审核状态：' + au.st }; src = au.ex + '审核状态＋公告标题'; }
  }
  if (stop && at >= 0 && hit[at] && hit[at].date > stop.date) stop = null;   // 终止之后又重新启动，看新的
  var last = list[list.length - 1];
  return { name: C.name, steps: steps, at: at, hit: hit, stop: stop, last: last, n: L.length, src: src,
    done: at === steps.length - 1, note: C.note ? C.note(L) : '', noEarly: C.noEarly };
}
function stepperHtml(ch) {
  var n = ch.steps.length;
  return '<div class="stepper-scroll"><div class="stepper" style="grid-template-columns:repeat(' + n + ', minmax(84px, 1fr)); min-width:' + (n * 90) + 'px;">' +
    ch.steps.map(function (s, i) {
      var h = ch.hit[i], cls = i < ch.at || (i === ch.at && ch.done) ? ' done' : i === ch.at ? ' current' : '';
      if (ch.stop && i === ch.at) cls = ' current stopped';
      var d = h ? esc(h.date) : i < ch.at && !ch.noEarly ? '早于收录' : '';
      return '<div class="step-node' + cls + '"><div>' + (i + 1) + '. ' + esc(s[0]) + '</div>' + (d ? '<div class="num step-date">' + d + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
}
function chainState(ch) {
  if (ch.stop) return '已终止（' + ch.stop.date + '）';
  if (ch.at < 0) return '标题看不出走到哪一步，看原文';
  return (ch.done ? '已走完：' : '现在：') + ch.steps[ch.at][0] + (ch.hit[ch.at] ? '（' + ch.hit[ch.at].date + '）' : '');
}
function chainBlock(title, ch, foot) {
  return '<div class="chain"><div class="chain-head"><strong>' + esc(title) + '</strong><span class="chain-state' + (ch.stop ? ' t-rise' : ch.done ? ' t-muted' : '') + '">' + esc(chainState(ch)) + '</span></div>' +
    stepperHtml(ch) + '<div class="chain-foot">' + foot + '</div></div>';
}
function daysTo(d) { var t = bjToday(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return Math.round((Date.parse(d) - Date.parse(t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()))) / 864e5); }

// 数据按代码最后一位分成 10 份（s0—s9），只下载这只票所在的那一份
var CUR = null;                        // 当前这只票的全部事实，给"复制给 AI"用
function showStock(code) {
  $('stock-empty').style.display = 'none';
  $('stock-body').style.display = '';
  Promise.all([load('names.json'), load('tags.json'), load('s' + code.slice(-1) + '.json'), load('audit.json')]).then(function (r) {
    var sh = r[2] || {}, pick = function (k) { return (sh[k] && sh[k][code]) || null; };
    var t = pick('tags'), pool = pick('pool') || [], lhb = pick('lhb') || [], soe = pick('soe') || [], ev = pick('ev') || [], lift = pick('lift') || [];
    var au = r[3] && r[3].stocks[code];
    var name = (t && t.name) || NAMES[code] || '未收录';
    CUR = { code: code, name: name, t: t, pool: pool, lhb: lhb, soe: soe, ev: ev, lift: lift, au: au, updated: sh.updated };
    $('stock-title-name').textContent = name;
    $('stock-title-code').textContent = code;
    $('stock-px').innerHTML = '';
    load('px.json').then(function (X) {
      var q = X && X.px[code];
      if (!CUR || CUR.code !== code) return;
      $('stock-px').innerHTML = q ? pxHtml(q[0], q[1], true) + '<div class="sec-meta">收盘 ' + esc(X.at.slice(5, 10)) + '</div>'
        : '<span class="sec-meta">' + (X ? '停牌或暂无行情' : '') + '</span>';
      if (q) CUR.px = { p: q[0], chg: q[1], at: X.at };
    });
    $('stock-tags').innerHTML = t ? t.tags.map(function (x) { return '<a class="fact-tag" href="#tag/' + encodeURIComponent(x) + '">' + esc(tagName(x)) + '</a>'; }).join('') : '';
    $('stock-why').innerHTML = t
      ? t.tags.map(function (x) { return '<p style="font-size:0.86rem; margin:4px 0;"><strong>' + esc(tagName(x)) + '</strong>：' + esc(t.why[x] || '') + '</p>'; }).join('')
      : '<p style="font-size:0.86rem; color:var(--ink-3);">这只票目前没有触发任何线索标签。</p>';
    // 在途事件进度：每类一条进度条；正在走的排前面，走完、终止的排后面
    var byKind = {};
    ev.forEach(function (e) { if (CHAINS[e.kind]) (byKind[e.kind] = byKind[e.kind] || []).push(e); });
    if (au && !byKind[auditKind(au)]) byKind[auditKind(au)] = [];
    var chains = Object.keys(byKind).map(function (k) {
      var ch = buildChain(k, byKind[k], au);
      var last = ch.last ? '最近一条：' + esc(ch.last.date) + ' ' + esc(ch.last.title) : '';
      var foot = [last, '近 3 个月相关公告 ' + ch.n + ' 条，依据' + esc(ch.src), ch.note ? '<span class="t-amber">' + esc(ch.note) + '</span>' : ''].filter(Boolean).join('<br>');
      return { ch: ch, html: chainBlock(ch.name, ch, foot), key: (ch.stop || ch.done ? '0' : '1') + (ch.last ? ch.last.date : au ? au.updt : '') };
    });
    var futLift = lift.filter(function (e) { return daysTo(e.date) >= 0; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    CUR.chains = chains.map(function (c) { return c.ch.name + '：' + chainState(c.ch); });
    var liftHtml = '';
    if (futLift.length) {
      var y = futLift.filter(function (e) { return daysTo(e.date) <= 365; }).reduce(function (a, e) { return a + e.free_ratio; }, 0);
      var nx = futLift[0];
      liftHtml = '<div class="chain"><div class="chain-head"><strong>限售解禁</strong><span class="chain-state">下一次还有 ' + daysTo(nx.date) + ' 天</span></div>' +
        '<div class="chain-foot">下一次 ' + esc(nx.date) + '，占流通股 ' + nx.free_ratio + '%；未来 12 个月合计约占流通股 ' + (Math.round(y * 100) / 100) + '%（共 ' + futLift.length + ' 次）</div></div>';
      CUR.chains.push('限售解禁：下一次 ' + nx.date + '（还有 ' + daysTo(nx.date) + ' 天），占流通 ' + nx.free_ratio + '%');
    }
    chains.sort(function (a, b) { return b.key.localeCompare(a.key); });
    $('stock-progress-wrap').style.display = chains.length || liftHtml ? '' : 'none';
    $('stock-progress').innerHTML = chains.map(function (c) { return c.html; }).join('') + liftHtml;
    setTimeout(function () { [].forEach.call(document.querySelectorAll('#stock-progress .stepper-scroll'), function (sc) {   // 进度条太宽时，滚到当前那一步（等页面排好版再量）
      var cur = sc.querySelector('.current'); if (!cur) return;
      var a = sc.getBoundingClientRect(), b = cur.getBoundingClientRect();
      sc.scrollLeft = Math.max(0, sc.scrollLeft + b.left - a.left - (a.width - b.width) / 2);
    }); }, 60);
    // 主题：在哪条链、哪一段、什么角色、走到哪个阶段、公告原文
    $('stock-theme-wrap').style.display = 'none'; $('stock-theme').innerHTML = '';
    load('themes.json').then(function (T) {
      var hits = [];
      (T ? T.themes : []).forEach(function (th) { th.segments.forEach(function (g) { g.items.forEach(function (x) { if (x.code === code) hits.push({ th: th.name, seg: g.name, x: x }); }); }); });
      if (!hits.length || !CUR || CUR.code !== code) return;
      CUR.themes = hits.map(function (h) { return h.th + ' · ' + h.seg + '（' + h.x.role + '，' + h.x.stage + '）：' + h.x.evidence.date + ' “' + h.x.evidence.quote + '”'; });
      $('stock-theme-wrap').style.display = '';
      $('stock-theme').innerHTML = hits.map(function (h) {
        var e = h.x.evidence, u = safeUrl(e.url), at = THEME_STEPS.map(function (s) { return s[0]; }).indexOf(h.x.stage);
        var ch = { steps: THEME_STEPS, at: at, hit: [], done: at === THEME_STEPS.length - 1, noEarly: true };   // 主题阶段只有一条证据，前面几步不标日期
        ch.hit[at] = { date: e.date };
        return chainBlock('', ch, '<div class="quote">“' + esc(e.quote) + '”' + (u ? '<a href="' + u + '" target="_blank" rel="noopener">' + esc(e.date) + ' ' + esc(e.title) + ' ↗</a>' : '') + '</div>')
          .replace('<strong></strong>', '<a href="#theme/' + encodeURIComponent(h.th) + '"><strong>' + esc(h.th) + ' · ' + esc(h.seg) + '</strong></a> <span class="fact-tag">' + esc(h.x.role) + '</span>');
      }).join('');
    });
    // 时间线：公告事件、龙虎榜、解禁、外资、国资，按日期倒序
    var tl = [];
    ev.forEach(function (e) { tl.push({ d: e.date, ic: 'doc', tone: 'accent', k: '公告 · ' + tagName(e.kind), x: e.title + (e.stop ? '（已终止）' : '') }); });
    lhb.forEach(function (e) { tl.push({ d: e.date, ic: 'bars', k: '龙虎榜', x: e.explain + '，当日 ' + pct(e.chg) }); });
    lift.forEach(function (e) { tl.push({ d: e.date, ic: 'lock', tone: 'warn', k: '限售解禁', x: '解禁占流通股 ' + e.free_ratio + '%，占总股本 ' + e.total_ratio + '%' }); });
    pool.forEach(function (e) { tl.push({ d: e.notice || e.q, ic: 'globe', k: '外资通道', x: e.holder + ' ' + e.chg + '（' + e.q + ' ' + e.kind + '，第 ' + e.rank + ' 名，占流通 ' + e.ratio + '%，估算成本 ' + e.cost + '，现价偏离 ' + pct(e.dev) + '）' }); });
    soe.forEach(function (e) { tl.push({ d: e.q, ic: 'bank', k: '国资', x: e.holder + ' ' + e.chg + '（' + e.q + '，第 ' + e.rank + ' 名，占流通 ' + e.ratio + '%）' }); });
    tl.sort(function (a, b) { return b.d.localeCompare(a.d); });
    $('stock-tl-meta').textContent = '数据 ' + (sh.updated || '');
    var TL_SHOW = 8;                           // 默认只显示最近 8 条，其余点按钮展开
    var drawTl = function (n) {
    $('stock-tl').innerHTML = tl.length ? tl.slice(0, n).map(function (e) {
      return '<div class="tl-row"><div class="tl-icon-box' + (e.tone ? ' ' + e.tone : '') + '" title="' + esc(e.k) + '">' + icon(e.ic) + '</div>' +
        '<div class="tl-body"><div class="tl-meta"><span class="tl-cat-name">' + esc(e.k) + '</span><span class="num">' + esc(e.d) + '</span></div>' +
        '<div class="tl-text">' + esc(e.x) + '</div></div></div>';
    }).join('') : '<p style="font-size:0.86rem; color:var(--ink-3);">暂无记录。</p>';
    more('stock-tl-more', tl.length - n, function () { drawTl(tl.length); });
    };
    drawTl(TL_SHOW);
    // 排雷体检：财报四项＋质押，标雷的放最上面；只标、不下结论
    $('stock-risk-wrap').style.display = 'none'; $('stock-risk').innerHTML = '';
    load('risk' + code.slice(-1) + '.json').then(function (K) {
      var x = K && K.stocks[code];
      if (!x || !CUR || CUR.code !== code) return;
      CUR.risk = x;
      $('stock-risk-meta').textContent = '财报 ' + x.period + '（' + x.notice + ' 披露）';
      $('stock-risk').innerHTML = riskHtml(x);
      $('stock-risk-wrap').style.display = '';
    });
    // Signal 分析（Muse 写、经校验）：放在“复制给 AI”下面，打包时附在最后
    $('stock-analysis').style.display = 'none'; $('stock-analysis').innerHTML = '';
    load('analysis.json').then(function (A) {
      var a = A && A.items && A.items[code];
      if (!a || !CUR || CUR.code !== code) return;
      CUR.analysis = a;
      $('stock-analysis').innerHTML = analysisHtml(a);
      $('stock-analysis').style.display = '';
    });
    load('research.json').then(function (R) {
      var it = R && R.items.filter(function (x) { return x.code === code; })[0];
      $('stock-verdict').innerHTML = verdictHtml(it && it.verdict);
      if (!CUR || CUR.code !== code) return;
      CUR.research = it ? '研究榜第 ' + it.rank + ' 名，' + it.score + ' 分：' + it.reasons.map(function (r) { return r.text + '（' + (r.score > 0 ? '+' : '') + r.score + '）'; }).join('；') : '';
      $('stock-research').innerHTML = !R ? '<p class="t-muted" style="font-size:0.84rem;">研究榜暂不可用。</p>'
        : !it ? '<p class="t-muted" style="font-size:0.84rem;">不在研究榜前 ' + R.items.length + ' 名（' + esc(R.updated) + '）。</p>'
        : '<div class="chain-head"><a href="#research"><strong>研究榜第 ' + it.rank + ' 名</strong></a><span class="num"><b>' + it.score + '</b> 分 · ' + esc(R.updated) + (it.is_new ? ' <span class="new-dot">新</span>' : '') + '</span></div>' +
          it.reasons.map(function (r) { return '<p style="font-size:0.84rem; margin:6px 0;"><span class="num ' + (r.score > 0 ? '' : 't-amber') + '">' + (r.score > 0 ? '+' : '') + r.score + '</span> ' + esc(r.text) + '</p>'; }).join('') +
          (it.tide ? '<div style="margin-top:8px;">' + tideHtml(it.tide) + '</div>' : '');
    });
    var rc = recent().filter(function (c) { return c !== code; });
    rc.unshift(code); store('signal_recent', JSON.stringify(rc.slice(0, 4)));
    drawRecent();
  });
}
$('copy-ai-btn').addEventListener('click', function () {
  if (!CUR) return;
  var c = CUR, L = ['【Signal 公开事实包】请只根据下面的公开事实做独立研究，不要给买卖建议。',
    '标的：' + c.name + '（' + c.code + '），数据日期 ' + (c.updated || '')];
  if (c.px) L.push('股价：' + c.px.p.toFixed(2) + '，当日 ' + pct(c.px.chg) + '（' + c.px.at + '）');
  if (c.t) L.push('线索标签：' + c.t.tags.map(function (x) { return x + '（' + (c.t.why[x] || '') + '）'; }).join('；'));
  if (c.au) L.push('审核状态：' + c.au.ex + ' ' + c.au.st + '，更新 ' + c.au.updt + (c.au.acpt ? '，受理 ' + c.au.acpt : ''));
  c.pool.forEach(function (e) { L.push('外资：' + e.q + ' ' + e.holder + ' ' + e.chg + '，第' + e.rank + '名，占流通' + e.ratio + '%，估算成本' + e.cost + '（估算值，季报滞后）'); });
  c.soe.forEach(function (e) { L.push('国资：' + e.q + ' ' + e.holder + ' ' + e.chg + '，占流通' + e.ratio + '%'); });
  if (c.research) L.push(c.research);
  if (c.risk) { var k = c.risk; L.push('排雷（' + k.period + ' 财报）：' + (k.flags.length ? '雷标 ' + k.flags.join('、') + '；' : '无雷标；') + '经营现金流 ' + k.cf.join('/') + ' 亿（今年累计/' + k.cf_d[1].slice(0, 4) + '/' + k.cf_d[2].slice(0, 4) + '），净资产 ' + k.equity + ' 亿，负债率 ' + k.debt + '%，质押比例 ' + (k.pledge == null ? '无' : k.pledge + '%')); }
  (c.chains || []).forEach(function (x) { L.push('进度：' + x); });
  (c.themes || []).forEach(function (x) { L.push('题材：' + x); });
  c.ev.slice(0, 8).forEach(function (e) { L.push('公告：' + e.date + ' ' + e.title); });
  c.lhb.slice(0, 5).forEach(function (e) { L.push('龙虎榜：' + e.date + ' ' + e.explain); });
  c.lift.forEach(function (e) { L.push('解禁：' + e.date + '，占流通' + e.free_ratio + '%'); });
  L.push('请帮我梳理：1) 这些事实说明它处在什么阶段；2) 下一个要等的节点是什么；3) 什么情况算看错。');
  if (c.analysis) {
    var a = c.analysis;
    L.push('', '以上是原始数据。请先独立判断，再看下面这段 Signal 的初步分析，指出你和它哪里不同、它哪里可能错了。',
      '【Signal 分析（基于 ' + a.data_date + ' 的数据）】' + a.one_line);
    (a.facts || []).forEach(function (e) { L.push('事实：' + e.text); });
    (a.reads || []).forEach(function (e) { L.push(e.text + ' ' + e.level); });
    if (a.next) L.push('下一个节点：' + a.next);
    (a.risks || []).forEach(function (r) { L.push('风险：' + r); });
    if (a.not_this) L.push('不是什么：' + a.not_this);
  }
  var text = L.join('\n');
  var done = function () { showToast('已复制 ' + (L.length - 3) + ' 条事实，可以粘贴给 AI'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
  else { fallbackCopy(text); done(); }
});
function fallbackCopy(text) {
  var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
}

function setAppState() { document.body.setAttribute('data-state', 'normal'); }
function togglePwaDrawer() { var d = $('pwa-drawer'); d.style.display = d.style.display === 'none' ? 'block' : 'none'; pwaHowto(); }
// 网页没法自己把自己装到主屏（苹果不允许），只能按设备告诉用户点哪里
var SHARE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;" aria-label="分享"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
function pwaHowto() {
  var ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), h;
  if (window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) h = '已经在主屏幕上了。';
  else if (/MicroMessenger/i.test(ua)) h = '微信里加不了。先点右上角「···」→「在浏览器打开」' + (ios ? '（用 Safari）' : '') + '，再按那边的提示加。';
  else if (ios && /CriOS|FxiOS|EdgiOS/.test(ua)) h = 'iPhone 只有 Safari 能加到主屏。请用 Safari 打开 signal.zentaox.com。';
  else if (ios) h = '① 点屏幕底部中间的分享按钮 ' + SHARE_ICON + '<br>② 往下滑，点「添加到主屏幕」<br>③ 点右上角「添加」';
  else if (/Android/i.test(ua)) h = '点浏览器右上角菜单「⋮」→「添加到主屏幕」或「安装应用」。';
  else h = '在手机上打开 signal.zentaox.com 再添加：iPhone 用 Safari 点分享 → 添加到主屏幕；安卓在浏览器菜单里选添加到主屏幕。';
  $('pwa-howto').innerHTML = h;
}

route();
