/* TaxSphere account: Google sign-in (via browser), cloud backup, UPI purchases of paid tools and report credits.
   Everything is off (all tools free, no sign-in) until ACCOUNT_BASE is set to the server address. */
(function () {
  const BASE_SET = "https://taxsphere.sachintaxsphere.workers.dev";
  const BASE = (window.__ACCT_BASE || BASE_SET).replace(/\/+$/, "");
  const ON = /^https?:\/\//.test(BASE) && (BASE.startsWith("https://") || !!window.__ACCT_BASE);
  const KEY = "acct.v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const toast = m => (window.appToast ? appToast(m) : null);
  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  const signedIn = () => !!S.token;
  const cat = () => S.cat || {items: [], upi: {}};
  const toolName = id => { for (const s of SECTIONS) for (const t of (s.tools || [])) if (t.id === id) return t.name; return id; };
  const toolHref = id => { for (const s of SECTIONS) for (const t of (s.tools || [])) if (t.id === id) return "#/" + s.id + "/" + id; return "#/home"; };
  const inr = n => "₹" + (+n || 0).toLocaleString("en-IN");
  const rnd = n => { const a = crypto.getRandomValues(new Uint8Array(n)); return [...a].map(b => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[b % 56]).join(""); };

  async function api(path, opt = {}) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), opt.timeout || 15000);
    const headers = {"Content-Type": "application/json"};
    if (S.token && !opt.noAuth) headers.Authorization = "Bearer " + S.token;
    try {
      const r = await fetch(BASE + path, {method: opt.method || "GET", headers, body: opt.body ? JSON.stringify(opt.body) : undefined, signal: ctl.signal, cache: "no-store"});
      const d = await r.json().catch(() => ({}));
      if (r.status === 401 && S.token && !opt.noAuth) { signOutLocal(); throw new Error("Please sign in again"); }
      if (!r.ok) throw new Error(d.error || "Server error " + r.status);
      return d;
    } catch (e) {
      if (e.name === "AbortError" || e instanceof TypeError) throw new Error("No internet connection. Try again when you're online.");
      throw e;
    } finally { clearTimeout(tm); }
  }
  function setMe(d) {
    ["email", "name", "picture", "tools", "reports", "pending"].forEach(k => { if (k in d) S[k] = d[k]; });
    if (d.token) S.token = d.token;
    save();
  }
  function signOutLocal() { ["token", "email", "name", "picture", "tools", "reports", "pending"].forEach(k => delete S[k]); save(); }
  function rerender() { if (typeof go === "function") go(); paintTop(); }

  async function refresh(quiet) {
    if (!ON) return;
    try { S.cat = await api("/catalog", {noAuth: true}); save(); } catch (e) {}
    if (signedIn()) { try { setMe(await api("/me")); } catch (e) { if (!quiet) toast(e.message); } }
  }

  // ---------------------------------------------------------------- entitlement
  const itemsFor = (tool, kind) => (cat().items || []).filter(i => i.kind === kind && (i.tools || []).includes(tool));
  const ownsTool = tool => !!(S.tools && S.tools[tool]);
  function lockedTool(tool) { return ON && itemsFor(tool, "tool").length > 0 && !ownsTool(tool); }
  function reportGated(tool) { return ON && itemsFor(tool, "report").length > 0 && !ownsTool(tool); }
  const credits = tool => (S.reports && S.reports[tool]) || 0;
  const pendingFor = title => (S.pending || []).filter(p => p.status === "pending" && p.title === title);

  // ---------------------------------------------------------------- sheet (modal)
  let sheetEl = null;
  function sheet(inner) {
    closeSheet();
    sheetEl = document.createElement("div"); sheetEl.className = "acsheet";
    sheetEl.innerHTML = `<div class="acsheet-bg"></div><div class="acsheet-card" role="dialog" aria-modal="true"><button class="acx" aria-label="Close">×</button><div class="acsheet-in">${inner}</div></div>`;
    document.body.appendChild(sheetEl);
    sheetEl.querySelector(".acsheet-bg").onclick = closeSheet; sheetEl.querySelector(".acx").onclick = closeSheet;
    requestAnimationFrame(() => sheetEl && sheetEl.classList.add("on"));
    return sheetEl.querySelector(".acsheet-in");
  }
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } stopPoll(); }
  function openExternal(url) {
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------------------------------------------------------- sign in
  let pollT = null, pollCode = null, pollUntil = 0, afterLogin = null, pollTick = null;
  function stopPoll() { clearTimeout(pollT); pollT = null; pollCode = null; }
  function signIn(then) {
    if (!ON) return;
    afterLogin = then || null;
    const code = rnd(32);
    const url = BASE + "/login?c=" + code;
    const el = sheet(`<div class="acc-center"><div class="acspin"></div><h2>Finish signing in</h2>
      <p>We opened Google sign-in in your browser. Choose your Gmail account there, then come back here.</p>
      <p class="note">Nothing opened? <a href="#" id="acReopen">Open sign-in again</a></p>
      <button class="btn ghost" id="acCancel" style="margin-top:12px">Cancel</button></div>`);
    el.querySelector("#acCancel").onclick = closeSheet;
    el.querySelector("#acReopen").onclick = e => { e.preventDefault(); openExternal(url); };
    pollCode = code; pollUntil = Date.now() + 10 * 60 * 1000;
    openExternal(url);
    const tick = async () => {
      if (!pollCode || pollCode !== code) return;
      if (Date.now() > pollUntil) { closeSheet(); toast("Sign-in timed out. Please try again."); return; }
      try {
        const d = await api("/auth/poll?c=" + code, {noAuth: true});
        if (d.token) {
          setMe(d); stopPoll(); closeSheet(); toast("Signed in as " + d.email);
          await refresh(true); rerender(); offerRestoreOnce();
          if (afterLogin) { const f = afterLogin; afterLogin = null; f(); }
          return;
        }
      } catch (e) { if (/already used/i.test(e.message)) { closeSheet(); toast("Sign-in link expired. Please try again."); return; } }
      pollT = setTimeout(tick, 2500);
    };
    pollTick = tick; pollT = setTimeout(tick, 2500);
  }
  // coming back from the browser: check straight away
  document.addEventListener("visibilitychange", () => { if (!document.hidden && pollCode && pollTick) { clearTimeout(pollT); pollT = setTimeout(pollTick, 200); } });
  async function signOut() {
    try { await api("/logout", {method: "POST", body: {}}); } catch (e) {}
    signOutLocal(); toast("Signed out. Your data stays on this device."); rerender();
  }

  // ---------------------------------------------------------------- backup
  const skip = k => k === KEY || k.startsWith("acct.") || k.startsWith("semi.upd");
  function collect() { const d = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!skip(k)) d[k] = localStorage.getItem(k); } return d; }
  async function backupNow(quiet) {
    if (!signedIn()) return;
    try {
      const data = collect();
      const r = await api("/backup", {method: "PUT", body: {data, device: (IS_ANDROID ? "Android phone" : /Windows/.test(navigator.userAgent) ? "Windows PC" : "Device")}, timeout: 30000});
      S.lastBackup = r.at; save();
      if (!quiet) toast("Backed up " + r.keys + " items");
      if (route && route.sec === "account") renderAccount();
    } catch (e) { if (!quiet) toast(e.message); }
  }
  async function restore() {
    let b;
    try { b = await api("/backup", {timeout: 30000}); } catch (e) { toast(e.message); return; }
    if (b.empty || !b.data) { toast("No cloud backup yet. Tap Back up now first."); return; }
    const el = sheet(`<h2>Restore from cloud?</h2><p>Backup from <b>${h(new Date(b.at).toLocaleString("en-IN"))}</b>${b.device ? " (" + h(b.device) + ")" : ""}, ${b.keys} items.</p>
      <p class="note">Your study progress, saved GST data and notes on this device will be replaced with the backup. Anything on this device that isn't in the backup is kept.</p>
      <div class="acrow"><button class="btn" id="acDoRestore">Restore now</button><button class="btn ghost" id="acNo">Cancel</button></div>`);
    el.querySelector("#acNo").onclick = closeSheet;
    el.querySelector("#acDoRestore").onclick = () => {
      let n = 0; for (const [k, v] of Object.entries(b.data)) { if (skip(k) || typeof v !== "string") continue; try { localStorage.setItem(k, v); n++; } catch (e) {} }
      S.lastBackup = b.at; save(); closeSheet(); toast("Restored " + n + " items"); setTimeout(() => location.reload(), 700);
    };
  }
  function offerRestoreOnce() {
    // first sign-in on a device that has almost nothing saved: offer the cloud copy
    if (S.offered) return; S.offered = 1; save();
    const mine = Object.keys(collect()).filter(k => !/^semi\.(theme|syl\.course)$/.test(k)).length;
    if (mine <= 2) api("/backup").then(b => { if (b && b.data && b.keys) restore(); }).catch(() => {});
  }

  // ---------------------------------------------------------------- buying
  function upiLink(it, ref) {
    const u = cat().upi || {};
    return "upi://pay?" + [["pa", u.vpa], ["pn", u.name || "TaxSphere"], ["am", String(it.price) + ".00"], ["cu", "INR"], ["tn", "TaxSphere " + ref]]
      .map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  }
  function qrSvg(text) {
    try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({cellSize: 5, margin: 2, scalable: true}); } catch (e) { return ""; }
  }
  function buy(itemId) {
    const it = (cat().items || []).find(i => i.id === itemId);
    if (!it) { toast("This item is not available"); return; }
    if (!signedIn()) {
      const el = sheet(`<div class="acc-center"><div class="aclock">🔒</div><h2>${h(it.title)}</h2>
        <p>Sign in with Google first, so your purchase stays with your account on every phone and PC.</p>
        <button class="btn" id="acSi">${G_ICON} Sign in with Google</button></div>`);
      el.querySelector("#acSi").onclick = () => signIn(() => buy(itemId));
      return;
    }
    const u = cat().upi || {};
    if (!u.vpa) { sheet(`<h2>${h(it.title)}</h2><p>Payments aren't open yet. Please check again later.</p>`); return; }
    const ref = "TS-" + rnd(6).toUpperCase(), link = upiLink(it, ref);
    const what = it.kind === "tool" ? "Lifetime unlock of " + h(it.tools.map(toolName).join(", ")) : it.credits + " report" + (it.credits > 1 ? "s" : "") + " (downloads/exports) in " + h(it.tools.map(toolName).join(", "));
    const el = sheet(`<div class="acpay">
      <h2>${h(it.title)}</h2><p class="note">${what}${it.desc ? " · " + h(it.desc) : ""}</p>
      <div class="acamt">${inr(it.price)}</div>
      <div class="acqr">${qrSvg(link)}</div>
      <p class="note" style="text-align:center">Scan with any UPI app: GPay, PhonePe, Paytm, BHIM</p>
      ${IS_ANDROID ? `<a class="btn acupi" href="${h(link)}">Pay ${inr(it.price)} with UPI app</a>` : ""}
      <div class="acpayee"><span>Pay to <b>${h(u.name || "")}</b><br><code>${h(u.vpa)}</code></span><button class="btn ghost acsm" id="acCopy">Copy UPI ID</button></div>
      <div class="acstep"><b>After paying</b>, enter the 12-digit UTR / UPI Ref No. from your UPI app's payment details.</div>
      <label class="fld"><span>UTR / UPI reference number</span><input id="acUtr" inputmode="numeric" maxlength="16" placeholder="12 digits" autocomplete="off"></label>
      <button class="btn" id="acSend" style="width:100%;margin-top:10px">Submit for verification</button>
      ${cat().note ? `<p class="note" style="margin-top:10px">${h(cat().note)}</p>` : ""}
      <p class="note" style="margin-top:6px">Your reference: <b>${ref}</b>. Access opens after the payment is verified.</p></div>`);
    el.querySelector("#acCopy").onclick = () => { (navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(u.vpa) : Promise.reject()).then(() => toast("UPI ID copied"), () => toast(u.vpa)); };
    el.querySelector("#acSend").onclick = async () => {
      const utr = el.querySelector("#acUtr").value.replace(/\s/g, "");
      if (!/^\d{12}$/.test(utr)) { toast("UTR should be 12 digits"); el.querySelector("#acUtr").focus(); return; }
      const b = el.querySelector("#acSend"); b.disabled = true; b.textContent = "Sending…";
      try {
        setMe(await api("/pay", {method: "POST", body: {item: it.id, utr, ref}}));
        sheet(`<div class="acc-center"><div class="aclock" style="background:var(--good-wash);color:var(--good)">✓</div><h2>Payment sent for verification</h2>
          <p>UTR <b>${h(utr)}</b> for ${h(it.title)} (${inr(it.price)}).</p><p class="note">It unlocks automatically once verified. You can check under Account → Purchases.</p>
          <button class="btn" onclick="ACCT.close()">OK</button></div>`);
        rerender();
      } catch (e) { toast(e.message); b.disabled = false; b.textContent = "Submit for verification"; }
    };
  }

  // ---------------------------------------------------------------- tool lock + report gate (called by index.html)
  function paywall(t) {
    const its = itemsFor(t.id, "tool"), it = its.sort((a, b) => a.price - b.price)[0], pend = pendingFor(it.title);
    return `<div class="card acwall"><div class="aclock">🔒</div><h2>${h(t.name)} is a paid tool</h2>
      <p>${h(it.desc || t.sub || "")}</p><div class="acamt">${inr(it.price)} <small>one-time · lifetime access</small></div>
      ${pend.length ? `<div class="acpend">⏳ Payment under verification (UTR ${h(pend[0].utr)}). It unlocks automatically once approved.</div>
        <button class="btn ghost" onclick="ACCT.recheck()">Check again</button>`
        : `<button class="btn" onclick="ACCT.buy('${h(it.id)}')">Unlock with UPI</button>`}
      ${signedIn() ? "" : `<p class="note" style="margin-top:12px">Already bought it? <a href="#" onclick="ACCT.signIn();return false">Sign in</a> with the same Gmail.</p>`}
    </div>${window.CREDIT_HTML || ""}`;
  }
  function badge(tool) {
    if (!ON) return "";
    if (lockedTool(tool)) { const p = Math.min(...itemsFor(tool, "tool").map(i => i.price)); return `<span class="acbadge">🔒 ${inr(p)}</span>`; }
    if (reportGated(tool)) return `<span class="acbadge pro">Paid reports</span>`;
    return "";
  }
  function frameTool(src) { // which tool does this iframe belong to? (the open tool page)
    return (typeof route !== "undefined" && route.tool) || null;
  }
  window.addEventListener("message", async e => {
    const d = e.data; if (!d || typeof d !== "object") return;
    if (d.semi !== "gatehello" && d.semi !== "export") return;
    const f = [...document.querySelectorAll("iframe")].find(x => x.contentWindow === e.source); if (!f) return;
    const tool = frameTool(f), reply = m => { try { e.source.postMessage(m, "*"); } catch (x) {} };
    if (d.semi === "gatehello") { reply({semiGate: !!(tool && reportGated(tool))}); return; }
    if (!tool || !reportGated(tool)) { reply({semiExportOk: true, id: d.id}); return; }
    const its = itemsFor(tool, "report").sort((a, b) => a.price - b.price);
    if (!signedIn() || credits(tool) < 1) {
      reply({semiExportOk: false, id: d.id});
      if (!signedIn()) { buy(its[0].id); return; }
      reportSheet(tool, its); return;
    }
    try {
      const r = await api("/spend", {method: "POST", body: {tool}});
      setMe(r); reply({semiExportOk: true, id: d.id});
      toast("1 report used · " + r.left + " left");
    } catch (x) { reply({semiExportOk: false, id: d.id}); toast(x.message); if (/no report credits/i.test(x.message)) reportSheet(tool, its); }
  });
  function reportSheet(tool, its) {
    const el = sheet(`<div class="acc-center"><div class="aclock">📄</div><h2>Reports in ${h(toolName(tool))} are paid</h2>
      <p>You have <b>${credits(tool)}</b> report credits left. Each download or export uses one.</p></div>
      <div class="aclist">${its.map(i => `<button class="acitem" data-i="${h(i.id)}"><span><b>${h(i.title)}</b><small>${i.credits} report${i.credits > 1 ? "s" : ""}${i.desc ? " · " + h(i.desc) : ""}</small></span><em>${inr(i.price)}</em></button>`).join("")}</div>`);
    el.querySelectorAll(".acitem").forEach(b => b.onclick = () => buy(b.dataset.i));
  }

  // ---------------------------------------------------------------- account page
  const G_ICON = `<svg class="acg" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
  const ago = t => { if (!t) return "never"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString("en-IN", {day: "numeric", month: "short", year: "numeric"}); };
  function renderAccount() {
    const app = document.getElementById("app");
    if (!ON) {
      app.innerHTML = `<div class="head"><h1>Account</h1><p>Sign in, cloud backup and purchases.</p></div>
        <div class="card acwide"><h2>Coming soon</h2><p>Google sign-in and cloud backup are being set up. Everything in TaxSphere works and is saved on this device.</p></div>${window.CREDIT_HTML || ""}`;
      return;
    }
    if (!signedIn()) {
      app.innerHTML = `<div class="head"><h1>Account</h1><p>Sign in to back up your work and keep purchases on every phone and PC.</p></div>
        <div class="card acwide acc-center"><div class="acav big">${icon("user")}</div><h2>Sign in to TaxSphere</h2>
        <ul class="acben"><li>☁️ Back up study progress, GST data and notes</li><li>📲 Restore on a new phone or PC</li><li>🔓 Keep paid tools and reports with your account</li></ul>
        <button class="btn acgbtn" onclick="ACCT.signIn()">${G_ICON} Sign in with Google</button>
        <p class="note" style="margin-top:10px">Sign-in opens in your browser. We only get your name and email.</p></div>${store_()}${window.CREDIT_HTML || ""}`;
      return;
    }
    const owned = Object.keys(S.tools || {}).filter(k => S.tools[k]);
    const rep = Object.entries(S.reports || {}).filter(([, v]) => v > 0);
    const pend = (S.pending || []).slice().reverse();
    app.innerHTML = `<div class="head"><h1>Account</h1></div>
      <div class="card acwide acprof"><div class="acav">${S.picture ? `<img src="${h(S.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span>${h((S.name || S.email || "?").trim()[0].toUpperCase())}</span></div>
        <div class="acwho"><b>${h(S.name || "")}</b><small>${h(S.email || "")}</small></div><button class="btn ghost acsm" onclick="ACCT.signOut()">Sign out</button></div>
      <div class="card acwide"><h2>☁️ Cloud backup</h2><p>Last backup: <b>${ago(S.lastBackup)}</b></p>
        <div class="acrow"><button class="btn" onclick="ACCT.backup()">Back up now</button><button class="btn ghost" onclick="ACCT.restore()">Restore from cloud</button></div>
        <label class="check" style="margin-top:12px"><input type="checkbox" ${S.auto !== false ? "checked" : ""} onchange="ACCT.setAuto(this.checked)"> Back up automatically once a day</label>
        <p class="note">Includes syllabus progress, planner, quiz scores, notes, GST businesses and invoices, and tool inputs.</p></div>
      <div class="card acwide"><h2>🔓 Purchases</h2>
        ${owned.length || rep.length ? `<div class="aclist">${owned.map(id => `<a class="acitem" href="${toolHref(id)}"><span><b>${h(toolName(id))}</b><small>Lifetime access</small></span><em class="ok">✓ Owned</em></a>`).join("")}
          ${rep.map(([id, n]) => `<a class="acitem" href="${toolHref(id)}"><span><b>${h(toolName(id))}</b><small>Report credits</small></span><em>${n} left</em></a>`).join("")}</div>` : `<p class="note">No purchases yet.</p>`}
        ${pend.length ? `<div class="eyebrow" style="margin-top:14px">Payments</div><div class="aclist">${pend.map(p => `<div class="acitem"><span><b>${h(p.title)}</b><small>${inr(p.amount)} · UTR ${h(p.utr)} · ${ago(p.at)}${p.reason ? " · " + h(p.reason) : ""}</small></span><em class="${p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : ""}">${p.status === "approved" ? "✓ Approved" : p.status === "rejected" ? "Rejected" : "⏳ Verifying"}</em></div>`).join("")}</div>` : ""}
        <button class="btn ghost" style="margin-top:12px" onclick="ACCT.recheck()">Refresh</button></div>
      ${store_()}${window.CREDIT_HTML || ""}`;
  }
  function store_() {
    const its = (cat().items || []);
    if (!its.length) return "";
    return `<div class="card acwide"><h2>🛒 Paid tools & reports</h2><div class="aclist">${its.map(i => {
      const own = i.kind === "tool" && i.tools.every(ownsTool);
      return `<button class="acitem" ${own ? "disabled" : `onclick="ACCT.buy('${h(i.id)}')"`}><span><b>${h(i.title)}</b><small>${i.kind === "tool" ? "Lifetime unlock" : i.credits + " report" + (i.credits > 1 ? "s" : "")}${i.desc ? " · " + h(i.desc) : ""}</small></span><em class="${own ? "ok" : ""}">${own ? "✓ Owned" : inr(i.price)}</em></button>`;
    }).join("")}</div></div>`;
  }
  function paintTop() {
    const b = document.getElementById("acctTop"); if (!b) return;
    b.style.display = ON ? "" : "none";
    b.innerHTML = signedIn() ? `<span class="acmini">${h((S.name || S.email || "?").trim()[0].toUpperCase())}</span>` : icon("user");
    b.title = signedIn() ? S.email : "Sign in";
  }

  // ---------------------------------------------------------------- styles
  const css = document.createElement("style");
  css.textContent = `
.acsheet{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center}
.acsheet-bg{position:absolute;inset:0;background:rgba(10,8,20,.5);opacity:0;transition:.2s}
.acsheet-card{position:relative;background:var(--surface);color:var(--text);width:100%;max-width:460px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:22px 18px calc(18px + env(safe-area-inset-bottom));transform:translateY(30px);opacity:0;transition:.22s;box-shadow:0 -10px 40px rgba(0,0,0,.2)}
.acsheet.on .acsheet-bg{opacity:1}.acsheet.on .acsheet-card{transform:none;opacity:1}
@media (min-width:700px){.acsheet{align-items:center}.acsheet-card{border-radius:22px}}
.acx{position:absolute;right:10px;top:8px;border:0;background:var(--surface2);color:var(--ink);width:34px;height:34px;border-radius:50%;font-size:22px;line-height:1;cursor:pointer}
.acsheet h2{font-size:19px;margin:0 0 6px;padding-right:30px}.acc-center{text-align:center}.acc-center h2{padding:0}
.acsheet p{margin:6px 0}
.acrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.acrow .btn{flex:1 1 140px}
.acspin{width:40px;height:40px;margin:4px auto 12px;border-radius:50%;border:4px solid var(--accent-wash);border-top-color:var(--accent);animation:acsp 1s linear infinite}@keyframes acsp{to{transform:rotate(360deg)}}
.aclock{width:56px;height:56px;margin:0 auto 10px;border-radius:16px;display:grid;place-items:center;font-size:26px;background:var(--accent-wash);color:var(--accent);font-weight:800}
.acamt{font:700 30px var(--display);color:var(--ink);text-align:center;margin:8px 0}.acamt small{display:block;font:500 12.5px var(--sans);color:var(--soft)}
.acqr{width:210px;height:210px;margin:6px auto;background:#fff;border-radius:14px;padding:6px;border:1px solid var(--rule)}.acqr svg{width:100%;height:100%;display:block}
.acupi{display:flex;justify-content:center;align-items:center;text-decoration:none;width:100%;margin-top:8px}
.acpayee{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface2);border-radius:12px;padding:10px 12px;margin-top:12px;font-size:13.5px}
.acpayee code{font-size:13px;color:var(--ink);word-break:break-all}.acsm{min-height:36px;padding:7px 12px;font-size:13px;flex:none}
.acstep{margin-top:14px;font-size:13.5px}.acpay .fld input{width:100%;font-size:17px;letter-spacing:.06em}
.acwall{max-width:560px;text-align:center;padding:26px 20px}.acwall h2{margin-bottom:4px}.acwall .btn{min-width:220px;margin-top:6px}
.acpend{background:var(--accent-wash);color:var(--accent);border-radius:12px;padding:10px 12px;font-size:13.5px;margin:8px 0;font-weight:600}
.acbadge{display:inline-block;margin-top:8px;font-size:11.5px;font-weight:700;border-radius:20px;padding:3px 9px;background:var(--accent-wash);color:var(--accent)}.acbadge.pro{background:var(--surface2);color:var(--soft)}
.acwide{max-width:640px;margin-bottom:14px}.acwide h2{font-size:17px;margin:0 0 8px}
.acprof{display:flex;align-items:center;gap:12px}.acwho{flex:1;min-width:0}.acwho b{display:block;color:var(--ink)}.acwho small{color:var(--soft);display:block;overflow:hidden;text-overflow:ellipsis}
.acav{position:relative;width:48px;height:48px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),#9b4dff 55%,#ff5fa2);color:#fff;font:700 20px var(--display);overflow:hidden}
.acav img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.acav.big{width:64px;height:64px;margin:0 auto 10px}.acav svg{width:30px;height:30px}
.acben{list-style:none;padding:0;margin:10px auto 16px;text-align:left;max-width:330px}.acben li{padding:6px 0;border-bottom:1px solid var(--rule)}.acben li:last-child{border:0}
.acgbtn,.acsheet .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px}.acgbtn{background:var(--surface);color:var(--ink);border:1px solid var(--rule);box-shadow:var(--shadow);min-width:240px}
.acg{width:20px;height:20px;flex:none}
.aclist{display:flex;flex-direction:column;gap:8px}
.acitem{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;width:100%;border:1px solid var(--rule);background:var(--surface);color:var(--text);border-radius:12px;padding:11px 12px;text-decoration:none;font:inherit;cursor:pointer}
.acitem[disabled]{cursor:default;opacity:.85}.acitem b{display:block;color:var(--ink);font-size:14.5px}.acitem small{display:block;color:var(--soft);font-size:12.5px}
.acitem em{font-style:normal;font-weight:700;color:var(--accent);white-space:nowrap}.acitem em.ok{color:var(--good)}.acitem em.bad{color:var(--bad)}
.acmini{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink);font:700 13px var(--display)}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- boot
  window.ACCT = {
    on: ON, lockedTool, paywall, badge, signIn, signOut, buy, restore, close: closeSheet,
    backup: () => backupNow(false),
    setAuto: v => { S.auto = !!v; save(); toast(v ? "Daily backup on" : "Daily backup off"); },
    recheck: async () => { await refresh(false); rerender(); toast("Updated"); }
  };
  window.renderAccount = renderAccount;
  document.addEventListener("DOMContentLoaded", paintTop);
  if (ON) {
    const snap = () => JSON.stringify([cat(), S.tools, S.reports, S.pending, S.email]), before = snap();
    refresh(true).then(() => { if (snap() !== before) rerender(); else paintTop(); });
    setTimeout(() => { if (signedIn() && S.auto !== false && Date.now() - (S.lastBackup || 0) > 20 * 3600 * 1000) backupNow(true); }, 6000);
  }
})();
