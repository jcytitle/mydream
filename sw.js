// 진로·대입 통합 앱 — 오프라인 지원(Service Worker)
// · 프로그램 화면(HTML): 인터넷이 되면 최신 것을 받아 저장, 안 되면 저장해 둔 것을 보여 줌
// · 학생 파일(.gtd·.json)과 GitHub 목록은 저장하지 않음(항상 최신·개인정보를 기기 캐시에 남기지 않음)
// · PDF 읽기 도구·글꼴 등 외부 도구: 한 번 받으면 저장해 두고 오프라인에서도 사용
const VERSION = "codex-2026-10-28-1";
const SHELL = ["./", "./index.html", "./myway/", "./bns/", "./together/", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const PDFJS = ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"];
const SHELL_CACHE = VERSION + "-shell", LIB_CACHE = "codex-lib-v1";

self.addEventListener("install", (e) => {
    e.waitUntil((async () => {
        const c = await caches.open(SHELL_CACHE);
        await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => null)));
        const l = await caches.open(LIB_CACHE);
        await Promise.all(PDFJS.map(async u => { if (!(await l.match(u))) { try { const r = await fetch(u, { mode: "no-cors" }); await l.put(u, r); } catch (err) { /* 나중에 다시 */ } } }));
        self.skipWaiting();
    })());
});
self.addEventListener("activate", (e) => {
    e.waitUntil((async () => {
        for (const k of await caches.keys()) if (k.endsWith("-shell") && k !== SHELL_CACHE) await caches.delete(k);
        await self.clients.claim();
    })());
});
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    // 학생 파일·GitHub 목록: 저장하지 않고 그대로 인터넷에서
    if (url.hostname === "api.github.com" || /\.(gtd|json)$/i.test(url.pathname) && !/manifest\.webmanifest$/.test(url.pathname)) return;
    if (url.origin === location.origin) {
        // 프로그램 화면: 인터넷 우선(5초 안에 응답 없으면 저장본), 받은 최신본은 저장
        e.respondWith((async () => {
            const c = await caches.open(SHELL_CACHE);
            try {
                const r = await Promise.race([fetch(req, { cache: "no-store" }), timeout(5000)]);
                if (r && r.ok && (req.mode === "navigate" || SHELL.some(s => url.pathname.endsWith(s.replace("./", "")))) ) c.put(req, r.clone()).catch(() => {});
                return r;
            } catch (err) {
                const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match(new URL("index.html", req.url).href) || await c.match(url.pathname.replace(/[^/]*$/, "")) : null);
                if (hit) return hit;
                throw err;
            }
        })());
        return;
    }
    // 외부 도구(PDF 읽기·글자 인식·글꼴): 저장본 우선, 없으면 받아서 저장
    if (/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
        e.respondWith((async () => {
            const l = await caches.open(LIB_CACHE);
            const hit = await l.match(req, { ignoreVary: true }) || await l.match(req.url);
            if (hit) return hit;
            const r = await fetch(req);
            if (r && (r.ok || r.type === "opaque")) l.put(req, r.clone()).catch(() => {});
            return r;
        })());
    }
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
