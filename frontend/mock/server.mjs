// Локальный мок API среза 1 (порт 8080). Данные и логика — в demo/src/demo/mockApi.js, общие с демо.
import http from "node:http";
import { route } from "./mockApi.js";

const sessions = new Map();
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const sid = /session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    const r = route(req.method, path, Object.fromEntries(url.searchParams), raw ? JSON.parse(raw) : {}, sessions.get(sid));
    const headers = { "Content-Type": "application/json", ...r.headers };
    if (r.session !== undefined) {
      if (r.session) {
        const s = Math.random().toString(36).slice(2);
        sessions.set(s, r.session);
        headers["Set-Cookie"] = `session=${s}; Path=/; HttpOnly; SameSite=Lax`;
      } else headers["Set-Cookie"] = "session=; Path=/; Max-Age=0";
    }
    res.writeHead(r.status, headers);
    res.end(r.body === undefined ? undefined : JSON.stringify(r.body));
  })
  .listen(8080, () => console.log("mock :8080"));
