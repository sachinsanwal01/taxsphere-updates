/* TaxSphere live updates.
   Checks version.json on the update site, downloads only the files that changed (each checked against its
   SHA-256), keeps them in IndexedDB and lets the boot script in index.html start the app from them next time.
   This file can itself be updated by a patch. base.js (hashes of the files built into this APK) never is. */
(function () {
  "use strict";
  const BASE = "https://raw.githubusercontent.com/sachinsanwal01/taxsphere-updates/main/";               // filled in at build time, e.g. https://raw.githubusercontent.com/<owner>/<repo>/main/
  const EVERY = 10 * 60 * 1000;                 // automatic check each time the app opens (at most every 10 minutes)
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const bundled = window.SEMI_BUNDLED || 0, apk = window.SEMI_APK || 0;
  const S = {state: "idle", msg: "", remote: null};

  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open("semi-upd", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (db, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction("files", mode), st = t.objectStore("files"), q = fn(st);
    t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error);
  });
  const get = (db, k) => tx(db, "readonly", s => s.get(k));
  const put = (db, k, v) => tx(db, "readwrite", s => s.put(v, k));
  const keys = db => tx(db, "readonly", s => s.getAllKeys());
  const del = (db, k) => tx(db, "readwrite", s => s.delete(k));

  async function sha(t) {
    if (!(window.crypto && crypto.subtle)) return null;
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  function baseHashes() {
    if (window.SEMI_BASE_HASHES) return Promise.resolve(window.SEMI_BASE_HASHES);
    return new Promise(res => {
      const s = document.createElement("script"); s.src = "base.js";        // always the built-in copy
      s.onload = () => res(window.SEMI_BASE_HASHES || {}); s.onerror = () => res({});
      document.head.appendChild(s);
    });
  }
  const installed = () => +(ls && ls.getItem("semi.upd.v")) || 0;
  const current = () => Math.max(bundled, installed() && ls.getItem("semi.upd.bad") !== String(installed()) ? installed() : 0);
  const fetchText = async (u) => { const r = await fetch(u, {cache: "no-store"}); if (!r.ok) throw new Error(r.status + " " + u); return r.text(); };

  async function check(manual) {
    if (!/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:\/])/.test(BASE) || !ls) { S.state = "off"; S.msg = "Live updates are not set up in this build."; return S; }
    if (S.state === "busy") return S;
    S.state = "busy"; S.msg = "Checking for updates…"; paint();
    try {
      const V = JSON.parse(await fetchText(BASE + "version.json?t=" + Date.now()));
      ls.setItem("semi.upd.checked", String(Date.now()));
      S.remote = V;
      if (V.apk && V.apk.code > apk) ls.setItem("semi.upd.apk", JSON.stringify(V.apk)); else ls.removeItem("semi.upd.apk");
      if (String(V.code) === ls.getItem("semi.upd.bad")) { S.state = "current"; S.msg = "You have the latest working version."; return S; }   // that update failed to start here; wait for the next one
      if (!(V.code > current())) { S.state = "current"; S.msg = "You have the latest version."; return S; }
      if ((V.minApk || 0) > apk) { S.state = "needapk"; S.msg = "This update needs the new app version. Download it from the banner on Home."; return S; }
      S.msg = "Downloading update " + (V.name || V.code) + "…"; paint();
      const BH = await baseHashes(), db = await idb();
      const iv = installed(), old = iv ? await get(db, iv) : null;
      const files = {}, hashes = {};
      let changed = 0, bytes = 0;
      const need = async (p, h) => {
        if (old && old.hashes && old.hashes[p] === h && old.files[p] != null) { files[p] = old.files[p]; return; }
        const t = await fetchText(BASE + "files/" + p + "?h=" + h.slice(0, 12));
        const got = await sha(t);
        if (got && got !== h) throw new Error("Download check failed for " + p);
        files[p] = t; bytes += t.length;
      };
      for (const [p, h] of Object.entries(V.files || {})) {
        hashes[p] = h;
        if (BH[p] === h) continue;                     // same as the copy built into the app
        changed++; await need(p, h);
      }
      if (!changed) { S.state = "current"; S.msg = "You have the latest version."; return S; }
      if (files["index.html"] == null) await need("index.html", V.files["index.html"]);   // the boot script starts from index.html
      await put(db, V.code, {code: V.code, name: V.name, notes: V.notes || "", files, hashes, at: Date.now()});
      ls.setItem("semi.upd.v", String(V.code));
      ls.removeItem("semi.upd.bad"); ls.removeItem("semi.upd.trial");
      try { sessionStorage.removeItem("semi.upd.skip"); } catch (e) {}
      for (const k of await keys(db)) if (k !== V.code) await del(db, k);
      S.state = "ready"; S.msg = `Update ${V.name || V.code} is ready (${Math.max(1, Math.round(bytes / 1024))} KB). Restart the app to use it.`;
      return S;
    } catch (e) {
      S.state = "error"; S.msg = manual ? "Couldn't check for updates. Check your internet connection and try again." : "";
      return S;
    } finally {
      paint();
      if (S.state === "ready") {
        // Just opened and not used yet: switch to the new version straight away. Otherwise show the banner;
        // the update also starts by itself the next time the app is opened.
        if (!manual && !touched && Date.now() - T0 < 15000) restart(); else banner();
      }
    }
  }

  async function reset() {          // go back to the version built into the APK
    try { const db = await idb(); for (const k of await keys(db)) await del(db, k); } catch (e) {}
    ["semi.upd.v", "semi.upd.bad", "semi.upd.trial"].forEach(k => ls && ls.removeItem(k));
    try { sessionStorage.removeItem("semi.upd.skip"); } catch (e) {}
    location.reload();
  }
  function restart() { try { sessionStorage.removeItem("semi.upd.skip"); } catch (e) {} location.reload(); }

  // ---------- UI ----------
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  function info() {
    const run = window.SEMI_BUILD || bundled, name = window.SEMI_NAME || "";
    const t = +(ls && ls.getItem("semi.upd.checked")) || 0;
    return {run, name, checked: t ? new Date(t).toLocaleString("en-IN", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}) : "never"};
  }
  // Card on the Feedback page
  function card() {
    if (!/^https:\/\//.test(BASE)) return "";          // live updates not switched on in this build: show nothing
    const i = info(), apkInfo = ls && JSON.parse(ls.getItem("semi.upd.apk") || "null");
    return `<div class="card" id="updCard" style="margin-top:14px"><h3 style="margin:0 0 4px">App updates</h3>
      <p class="note" style="margin:0 0 10px">Version <b>${esc(i.name || i.run)}</b>${window.__SEMI_PATCHED ? " (live update)" : ""} · last checked ${esc(i.checked)}.
      New tools and fixes arrive automatically when you're online; no reinstall needed.</p>
      <p id="updMsg" class="note" style="margin:0 0 10px;${S.msg ? "" : "display:none"}">${esc(S.msg)}</p>
      ${apkInfo ? `<p class="note" style="margin:0 0 10px">New app version <b>${esc(apkInfo.name)}</b> available. <a href="${esc(apkInfo.url)}">Download</a></p>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="updCheck">Check for updates</button>
      ${S.state === "ready" ? `<button class="btn" id="updRestart" style="background:var(--lime);color:var(--lime-ink)">Restart now</button>` : ""}
      ${window.__SEMI_PATCHED ? `<button class="btn ghost" id="updReset">Use built-in version</button>` : ""}</div></div>`;
  }
  function paint() {
    const c = document.getElementById("updCard"); if (!c) return;
    c.outerHTML = card(); bind();
  }
  function bind() {
    const b = id => document.getElementById(id);
    if (b("updCheck")) b("updCheck").onclick = () => check(true);
    if (b("updRestart")) b("updRestart").onclick = restart;
    if (b("updReset")) b("updReset").onclick = () => { if (b("updReset").dataset.arm) reset(); else { b("updReset").dataset.arm = 1; b("updReset").textContent = "Tap again to confirm"; } };
  }
  function banner() {
    if (document.getElementById("updBar")) return;
    const d = document.createElement("div"); d.id = "updBar";
    d.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:9999;display:flex;gap:10px;align-items:center;background:#1f1a33;color:#fff;border-radius:14px;padding:11px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:600 13px/1.4 Inter,system-ui,sans-serif";
    d.innerHTML = `<span style="flex:1">✨ ${esc(S.msg)}</span><button style="border:0;border-radius:10px;padding:8px 12px;font-weight:700;background:#c6f36b;color:#1d2a00">Restart</button><button aria-label="Later" style="border:0;background:none;color:#fff;font-size:18px;padding:0 4px">×</button>`;
    d.children[1].onclick = restart; d.children[2].onclick = () => d.remove();
    document.body.appendChild(d);
  }
  // Home banner when a new APK exists (things a live update can't change: icon, name, permissions)
  function apkBanner() {
    const a = ls && JSON.parse(ls.getItem("semi.upd.apk") || "null");
    return a && a.code > apk ? `<a class="card" href="${esc(a.url)}" style="display:block;text-decoration:none;margin-bottom:14px;border-color:var(--accent)"><b>New app version ${esc(a.name)} available</b><p class="note" style="margin:2px 0 0">${esc(a.notes || "Tap to download and install it over this one. Your data stays.")}</p></a>` : "";
  }
  function justUpdated() {
    if (!window.__SEMI_PATCHED || !ls) return;
    const k = "semi.upd.seen", v = String(window.__SEMI_PATCHED);
    if (ls.getItem(k) === v) return; ls.setItem(k, v);
    setTimeout(() => {
      const t = document.createElement("div"); t.textContent = `✨ TaxSphere updated to ${window.SEMI_NAME || v}`;
      t.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;background:#1f1a33;color:#fff;font:600 13px/1.4 Inter,system-ui,sans-serif;padding:10px 16px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);transition:opacity .4s";
      document.body.appendChild(t); setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 500); }, 3500);
    }, 700);
  }

  window.SEMI_UPDATE = {check, reset, restart, card, bind, apkBanner, state: () => S};
  justUpdated();
  // automatic check when the app opens, when it comes back to the screen and when the internet comes back
  const T0 = Date.now(); let touched = false;
  ["pointerdown", "keydown", "input"].forEach(ev => addEventListener(ev, () => { touched = true; }, {capture: true, once: true}));
  const auto = () => {
    const last = +(ls && ls.getItem("semi.upd.checked")) || 0;
    if (navigator.onLine !== false && Date.now() - last > EVERY && S.state !== "ready") check(false);
  };
  setTimeout(auto, 1500);
  addEventListener("online", () => setTimeout(auto, 1000));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) auto(); });
})();
