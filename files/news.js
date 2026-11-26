/* "New Context": a pop-up of what's new, each item with a link straight to the tool or page.
   The list comes from the account server (editable in the admin page), then GitHub, then the copy built into the app. */
(function () {
  const SOURCES = ["https://taxsphere.sachintaxsphere.workers.dev/news", "https://raw.githubusercontent.com/sachinsanwal01/taxsphere-updates/main/news.json"];
  const BUILT_IN = {title: "New Context", items: [
    {id: "bill-maker", date: "2026-11-23", emoji: "🧾", title: "Bill Maker", text: "Make professional GST bills with your logo. 4 templates, PDF download, UPI QR with the amount, and WhatsApp sharing.", link: "#/returns/billmaker", cta: "Open Bill Maker"},
    {id: "meesho-json", date: "2026-11-22", emoji: "🛍️", title: "Meesho GSTR-1 JSON", text: "Download a GSTR-1 JSON ready to upload on the GST portal, with checks, due dates and GSTR-8 matching.", link: "#/returns/meeshogst", cta: "Open Meesho GST Filing"},
    {id: "excel-templates", date: "2026-11-22", emoji: "📊", title: "Complete Excel templates", text: "One Excel file for all your data in GST Return Studio and Meesho filing. Fill it and import every sheet at once.", link: "#/returns/gstreturn", cta: "Open GST Return Studio"},
    {id: "account-backup", date: "2026-11-22", emoji: "☁️", title: "Sign in & cloud backup", text: "Sign in with Gmail to back up your study progress, GST data and notes, and restore them on a new phone or PC.", link: "#/account", cta: "Open Account"}]};
  const KEY = "semi.news";
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const get = (k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch (e) { return d; } };
  const set = (k, v) => { try { ls.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  let DATA = get(KEY + ".data", null) || BUILT_IN;
  const seen = () => new Set(get(KEY + ".seen", []));
  const items = () => (DATA.items || []).filter(i => i && i.id && i.title && i.active !== false);
  const unseen = () => { const s = seen(); return items().filter(i => !s.has(i.id)); };
  const markAll = () => set(KEY + ".seen", [...new Set([...seen(), ...items().map(i => i.id)])].slice(-200));

  // floating "Updates" button, stacked above the KINTY AI one (bottom-right)
  function paintFab() {
    let f = document.getElementById("nfab");
    if (!f) { f = document.createElement("button"); f.id = "nfab"; f.type = "button"; f.setAttribute("aria-label", "Updates"); f.onclick = open; document.body.appendChild(f); }
    const n = unseen().length;
    f.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><span>Updates</span>` + (n ? `<b class="nfb">${n > 9 ? "9+" : n}</b>` : "");
    f.classList.toggle("has", !!n);
    f.style.display = /^#\/kinty/.test(location.hash) ? "none" : "";
  }
  addEventListener("hashchange", () => paintFab());
  function paintBell() {
    paintFab();
    const b = document.getElementById("newsTop"); if (!b) return;
    const n = unseen().length;
    b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>` + (n ? `<span class="nbadge">${n > 9 ? "9+" : n}</span>` : "");
    b.title = n ? `${n} new` : (DATA.title || "New Context");
  }
  function go(link) {
    close();
    if (/^#\//.test(link)) { if (location.hash === link && typeof window.go === "function") window.go(); else location.hash = link; }
    else if (/^https?:\/\//.test(link)) { const a = document.createElement("a"); a.href = link; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
  }
  let el = null;
  function close() { if (el) { el.remove(); el = null; } markAll(); paintBell(); }
  function open() {
    if (el) return;
    const s = seen(), list = items().slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const fd = d => { if (!d) return ""; const x = new Date(d + "T00:00"); return isNaN(x) ? "" : x.toLocaleDateString("en-IN", {day: "numeric", month: "short", year: "numeric"}); };
    el = document.createElement("div"); el.className = "nwrap";
    el.innerHTML = `<div class="nbg"></div><div class="ncard" role="dialog" aria-modal="true" aria-label="${h(DATA.title || "New Context")}">
      <div class="nhead"><div class="nic">✨</div><div><b>${h(DATA.title || "New Context")}</b><small>${h(DATA.subtitle || "New in TaxSphere. Tap any item to open it.")}</small></div><button class="nx" aria-label="Close">×</button></div>
      <div class="nlist">${list.length ? list.map(i => `<button class="nitem${s.has(i.id) ? "" : " fresh"}" data-l="${h(i.link || "")}">
          <span class="nem">${h(i.emoji || "🆕")}</span><span class="ntx"><span class="nt">${h(i.title)}${s.has(i.id) ? "" : `<em>NEW</em>`}</span>${i.text ? `<span class="nd">${h(i.text)}</span>` : ""}
          <span class="nf">${fd(i.date)}${i.link ? `<span class="ncta">${h(i.cta || "Open")} →</span>` : ""}</span></span></button>`).join("") : `<p class="nempty">Nothing new right now.</p>`}</div>
      <button class="btn nok">Got it</button></div>`;
    document.body.appendChild(el);
    el.querySelector(".nbg").onclick = close; el.querySelector(".nx").onclick = close; el.querySelector(".nok").onclick = close;
    el.querySelectorAll(".nitem").forEach(b => b.onclick = () => { if (b.dataset.l) go(b.dataset.l); });
    requestAnimationFrame(() => el && el.classList.add("on"));
  }
  async function refresh() {
    for (const u of SOURCES) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 6e5), {cache: "no-store", signal: ctl.signal}); clearTimeout(t);
        if (!r.ok) continue;
        const d = await r.json(); if (!d || !Array.isArray(d.items)) continue;
        DATA = d; set(KEY + ".data", d); return true;
      } catch (e) {}
    }
    return false;
  }
  const css = document.createElement("style");
  css.textContent = `
#newsTop{position:relative}#newsTop .nbadge{position:absolute;top:2px;right:2px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#e5484d;color:#fff;font:700 10.5px/17px var(--sans);text-align:center}
#nfab{position:fixed;right:16px;bottom:80px;z-index:6;display:flex;align-items:center;gap:7px;border:0;border-radius:999px;padding:11px 16px 11px 12px;cursor:pointer;
  background:linear-gradient(135deg,#0f766e,#12855a 55%,#2bb673);color:#fff;font:700 14px var(--sans);box-shadow:0 8px 24px rgba(18,133,90,.4)}
#nfab svg{width:19px;height:19px}#nfab .nfb{min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#fff;color:#e5484d;font:800 11px/19px var(--sans);text-align:center;margin-left:1px}
#nfab.has{animation:nfp 2.4s ease-in-out infinite}@keyframes nfp{0%,100%{box-shadow:0 8px 24px rgba(18,133,90,.4)}50%{box-shadow:0 8px 24px rgba(18,133,90,.4),0 0 0 7px rgba(43,182,115,.22)}}
@media (max-width:899px){#nfab{bottom:calc(132px + env(safe-area-inset-bottom));right:12px;padding:10px 14px 10px 11px;font-size:13px}}
@media (prefers-reduced-motion:reduce){#nfab.has{animation:none}}
.nwrap{position:fixed;inset:0;z-index:70;display:flex;align-items:flex-end;justify-content:center}
.nbg{position:absolute;inset:0;background:rgba(10,8,20,.5);opacity:0;transition:.2s}
.ncard{position:relative;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column;background:var(--surface);color:var(--text);border-radius:22px 22px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom));transform:translateY(30px);opacity:0;transition:.22s;box-shadow:0 -10px 40px rgba(0,0,0,.2)}
.nwrap.on .nbg{opacity:1}.nwrap.on .ncard{transform:none;opacity:1}
@media (min-width:700px){.nwrap{align-items:center}.ncard{border-radius:22px}}
.nhead{display:flex;gap:12px;align-items:center;margin-bottom:12px}.nhead>div:nth-child(2){flex:1}.nhead b{display:block;font:700 18px var(--display);color:var(--ink)}.nhead small{color:var(--soft);font-size:12.5px}
.nic{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;font-size:22px;background:linear-gradient(135deg,var(--accent),#9b4dff 55%,#ff5fa2);flex:none}
.nx{border:0;background:var(--surface2);color:var(--ink);width:34px;height:34px;border-radius:50%;font-size:22px;line-height:1;cursor:pointer;flex:none}
.nlist{overflow:auto;display:flex;flex-direction:column;gap:8px;padding:2px}
.nitem{display:flex;gap:12px;text-align:left;width:100%;border:1px solid var(--rule);background:var(--surface);color:var(--text);border-radius:14px;padding:12px;font:inherit;cursor:pointer}
.nitem.fresh{border-color:transparent;background:var(--accent-wash)}.nitem:active{transform:scale(.99)}
.nem{font-size:24px;line-height:1.2;flex:none}.ntx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.nt{font-weight:700;color:var(--ink);font-size:15px}.nt em{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.04em;background:#e5484d;color:#fff;border-radius:6px;padding:2px 6px;margin-left:6px;vertical-align:2px}
.nd{font-size:13px;color:var(--text);line-height:1.45}.nf{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--soft);margin-top:2px}.ncta{color:var(--accent);font-weight:700}
.nok{margin-top:12px;width:100%}.nempty{color:var(--soft);text-align:center;padding:20px}`;
  document.head.appendChild(css);

  window.NEWS = {open, refresh, count: () => unseen().length};
  const boot = () => {
    paintBell();
    // show the pop-up by itself only on the Home screen, and only when there's something not seen yet
    const auto = () => { if (unseen().length && (!location.hash || /^#\/?(home)?$/.test(location.hash)) && !document.querySelector(".acsheet,.nwrap")) open(); };
    refresh().then(() => { paintBell(); setTimeout(auto, 1800); });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
