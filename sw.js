/* Signal 站点 Service Worker
 * 目标只有两个：① 手机上「添加到主屏幕」后秒开；② 断网/弱网时还能看到上一次的数据。
 * 策略：
 *   - 页面骨架（html/js/css/manifest/icon）：缓存优先 + 后台更新
 *   - 行情 JSON：网络优先（保证新鲜），网络失败才回退到上次缓存
 * 不做的事：不改写任何数据、不碰 /sub/（节点订阅），不拦截非 GET。
 */
const VERSION = 'v1';
const SHELL = 'sig-shell-' + VERSION;
const DATA = 'sig-data-' + VERSION;
const SHELL_FILES = ['./', 'index.html', 'live.html', 'status.html', 'app.js', 'style.css', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isData(url) {
  return url.pathname.endsWith('.json') && !url.pathname.includes('/sub/');
}

async function networkFirst(req) {
  const cache = await caches.open(DATA);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const resp = await fetch(req, { signal: ctl.signal });
    clearTimeout(timer);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set('X-From-Cache', '1');            // 页面据此显示「离线数据」
      return new Response(hit.body, { status: 200, headers: h });
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) {
    fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
    return hit;
  }
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    if (req.mode === 'navigate') {
      const fallback = await cache.match('index.html', { ignoreSearch: true });
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isData(url)) { e.respondWith(networkFirst(req)); return; }
  if (req.mode === 'navigate' || SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '/')))) {
    e.respondWith(cacheFirst(req));
  }
});
