// KINTY AI – TaxSphere's offline study assistant.
// Answers from the app's own data (kinty/kb.js, generated from notes, quiz, syllabus, practicals, GST forms,
// The Thin Line, due dates and tools) and runs the app's calculators from chat. No internet, no API.
(function () {
"use strict";
const SRC = {note: "Concept notes", quiz: "Quiz bank", syl: "Syllabus", paper: "Syllabus", chap: "Syllabus chapter", prac: "CMA Inter practical",
  due: "Due dates", tool: "Calculator", rate: "Tax rates", gstf: "GST Forms Reckoner", gstt: "GST tips", thin: "The Thin Line", case: "Case law",
  law: "GAAR law", app: "TaxSphere", qa: "KINTY explains", anim: "Animated concept", rk: "Reckoner"};
const LEAD = {note: "From TaxSphere's concept notes:", quiz: "From the quiz bank:", syl: "From the official syllabus:", paper: "From the official syllabus:",
  chap: "From the official syllabus:", prac: "Here's a CMA Inter practical with its full solution:", due: "Here's the due date:", tool: "TaxSphere has a tool for this:",
  rate: "Tax rates under the Finance Act 2025:", gstf: "From the GST Forms Reckoner:", gstt: "From the GST Forms Reckoner:",
  thin: "From The Thin Line (tax planning vs avoidance vs evasion):", case: "From The Thin Line's case law:", law: "From The Thin Line (GAAR, Income-tax Act 2025):", app: "", qa: "", anim: "There's an animated explainer for this:", rk: "From TaxSphere's reckoners:"};
const STOP = new Set(("a an the is are was were be been of to in on for and or with by at from as it its this that these those what whats which who whom how why when where " +
  "do does did can could should would will shall may might i me my we our you your please tell explain define definition meaning means about give show list " +
  "more help understand concept detail details simple briefly short example examples brief know need want also some any " +
  "kya hai ka ki ke ko me mein batao samjhao bata kaise kitna kab").split(" "));
const SYN = {itc: "input tax credit", hra: "house rent allowance", tds: "tax deducted source", tcs: "tax collected source", gst: "goods services tax",
  itr: "income tax return", ltcg: "long term capital gain", stcg: "short term capital gain", eoq: "economic order quantity", cvp: "cost volume profit break even",
  bep: "break even point", breakeven: "break even", npv: "net present value", irr: "internal rate return", emi: "equated monthly instalment loan",
  brs: "bank reconciliation statement", fm: "financial management", inter: "intermediate", gaar: "general anti avoidance rule", mcq: "quiz",
  slab: "rate", slabs: "rates", ca: "chartered accountancy", cma: "cost management accountancy", cs: "company secretary", dep: "depreciation",
  wdv: "written down value depreciation", slm: "straight line method depreciation", nps: "national pension 80ccd", rcm: "reverse charge",
  eway: "e way bill", einvoice: "e invoice", qrmp: "quarterly return monthly payment", aay: "assessment year", fy: "financial year", ay: "assessment year",
  fr: "financial reporting", afm: "advanced financial management", sfm: "strategic financial management", dt: "direct tax", idt: "indirect tax gst",
  aa: "advanced auditing", spom: "self paced", ibs: "integrated business solutions", sm: "strategic management", fa: "financial accounting", "87a": "rebate", "80c": "deduction", "80d": "health insurance deduction", ind: "indian accounting standard", as: "accounting standard"};
const MULT = {lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5, crore: 1e7, crores: 1e7, cr: 1e7, k: 1e3, thousand: 1e3, million: 1e6, mn: 1e6};

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const stem = w => w.length > 4 ? w.replace(/ies$/, "y").replace(/(ss)$/, "$1").replace(/([^s])s$/, "$1").replace(/ing$/, "").replace(/ed$/, "") : w;
function toks(s) {
  s = String(s).toLowerCase().replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/[₹]/g, " ")
    .replace(/\b([a-z]+)-(\d+[a-z]?)\b/g, "$1$2 $1 $2").replace(/\b(p|gstr)\s(\d+[a-z]?)\b/g, "$1$2 $1 $2").replace(/\bpaper\s*(\d+[a-z]?)\b/g, "paper$1 p$1 paper");
  return (s.match(/[a-z0-9]+/g) || []).filter(w => w.length > 1 && !STOP.has(w)).map(stem);
}

// ---------------------------------------------------------------- index (BM25)
let IDX = null;
function buildIndex() {
  const KB = window.KINTY_KB || [], df = new Map(), docs = [];
  let tot = 0;
  for (const d of KB) {
    const tf = new Map(), add = (s, w) => { for (const t of toks(s)) tf.set(t, (tf.get(t) || 0) + w); };
    add(d.t, 3); add(d.k, 1.5); add(d.c, 1); add(d.b, 1);
    let len = 0; for (const v of tf.values()) len += v;
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    docs.push({d, tf, len, tl: d.t.toLowerCase()}); tot += len;
  }
  IDX = {docs, df, N: docs.length, avg: tot / Math.max(1, docs.length)};
}
const PRIOR = {anim: 1.15, qa: 1.35, note: 1.2, quiz: 1.05, rate: 1.15, gstf: 1.05, due: 1.05, tool: .9, prac: 1.0, paper: 1.0, syl: .8, chap: .8, law: .95, case: .95, thin: 1.25, gstt: .9, app: 1.0, rk: 1.1};
function search(q, only) {
  if (!IDX) buildIndex();
  const qt = toks(q), terms = new Map();
  for (const t of qt) { terms.set(t, Math.max(terms.get(t) || 0, 1)); const syn = SYN[t]; if (syn) for (const s of toks(syn)) if (!terms.has(s)) terms.set(s, .8); }
  if (!terms.size) return [];
  const ql = q.toLowerCase(), wantSyl = /syllabus|chapter|paper|subject|weightage|topics/.test(ql), wantPrac = /practical|question|solve|solution|sum|problem/.test(ql),
    wantDue = /due|deadline|last date/.test(ql), wantPaper = /paper\s*\d|\bp\d|syllabus|weightage|chapters|subjects/.test(ql),
    wantCourse = /course|structure|levels|all papers|stages/.test(ql), wantCalc = /calculat|tool|compute|working/.test(ql);
  const out = [];
  for (const x of IDX.docs) {
    if (only && !only.includes(x.d.s)) continue;
    let sc = 0, hit = 0;
    for (const [t, w] of terms) {
      const f = x.tf.get(t); if (!f) continue;
      const idf = Math.log(1 + (IDX.N - IDX.df.get(t) + .5) / (IDX.df.get(t) + .5));
      sc += w * idf * (f * 2.2) / (f + 1.2 * (.4 + .6 * x.len / IDX.avg)); hit += w;
    }
    if (!sc) continue;
    sc *= .6 + .4 * hit / [...terms.values()].reduce((a, b) => a + b, 0);   // coverage
    sc *= PRIOR[x.d.s] || 1;
    if (wantSyl && /syl|paper|chap/.test(x.d.s)) sc *= 1.35;
    if (wantPaper && x.d.s === "paper") sc *= 1.6;
    if (x.d.s === "syl" && !wantCourse) sc *= .7;
    if (x.d.s === "chap" && !wantSyl) sc *= .65;
    if (wantCalc && x.d.s === "tool") sc *= 1.4;
    if (wantPrac && x.d.s === "prac") sc *= 1.35;
    if (wantDue && /due|gstf/.test(x.d.s)) sc *= 1.4;
    const core = qt.filter(t => t.length > 2).join(" ");
    if (core && x.tl.includes(core)) sc *= 1.3;
    out.push([sc, x.d, hit]);
  }
  out.sort((a, b) => b[0] - a[0]);
  out.cov = out.length ? qt.filter(t => (out[0][1]._tf || (out[0][1]._tf = IDX.docs.find(z => z.d === out[0][1]).tf)).has(t)).length / Math.max(1, qt.length) : 0;
  return out;
}

// ---------------------------------------------------------------- numbers
function amounts(q) {
  const out = [], re = /(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|thousand|million|mn|l|k)?\b/gi;
  let m;
  while ((m = re.exec(q))) {
    const after = q.slice(re.lastIndex, re.lastIndex + 12).toLowerCase(), before = q.slice(Math.max(0, m.index - 4), m.index).toLowerCase();
    if (/^\s*(%|percent|p\.?a)/.test(after) || /^-\d{2}\b/.test(after) || /(fy|ay|sec|u\/s|80|gstr)[\s-]*$/.test(before)) continue;
    let v = parseFloat(m[1].replace(/,/g, "")); const u = (m[2] || "").toLowerCase();
    if (MULT[u]) v *= MULT[u];
    let kind = "amt";
    if (/^\s*(years?|yrs?|y\b)/.test(after)) kind = "yr"; else if (/^\s*(months?|mo\b|mths?)/.test(after)) kind = "mo";
    out.push({v, kind});
  }
  return out;
}
const pcts = q => [...q.matchAll(/(\d+(?:\.\d+)?)\s*(%|percent|pc\b|p\.?a)/gi)].map(m => parseFloat(m[1]));
const big = a => a.filter(x => x.kind === "amt").sort((x, y) => y.v - x.v)[0];
const R = n => "₹" + Math.round(n).toLocaleString("en-IN");
const R2 = n => "₹" + n.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const tbl = rows => '<div class="kt"><table>' + rows.map((r, i) => "<tr>" + r.map(c => i ? `<td>${c}</td>` : `<th>${c}</th>`).join("") + "</tr>").join("") + "</table></div>";
const link = (h, t) => `<a class="klink" href="${h}">${t} →</a>`;

// ---------------------------------------------------------------- intents
function intentTax(q) {
  if (!/(income\s*tax|\btax\b)/i.test(q) || /\bgst\b|surcharge rate|slab|rate/i.test(q) && !/\d/.test(q)) return null;
  if (/gst|tds rate|tcs|slab rate/i.test(q)) return null;
  const a = big(amounts(q)); if (!a || a.v < 1000) return null;
  const sal = /salar|ctc|employ|job|naukri|package/i.test(q);
  const ageN = (q.match(/\bage\s*(\d{2})|(\d{2})\s*(years?|yrs?)\s*old/i) || []);
  const age = /super\s*senior|\b8\d\s*(years?|yrs?)/i.test(q) || +(ageN[1] || ageN[2]) >= 80 ? "80" : /senior/i.test(q) || +(ageN[1] || ageN[2]) >= 60 ? "60" : "0";
  const p = {age, salary: sal ? a.v : 0, other: sal ? 0 : a.v, nps2: 0, hra: 0, hl: 0, c80: 0, d80: 0, nps1: 0, oth: 0};
  const n = incomeTax(p, "new"), o = incomeTax(p, "old"), best = n.total <= o.total ? "New" : "Old", save = Math.abs(n.total - o.total);
  return {lead: `Tax on ${sal ? "a salary" : "income"} of <b>${R(a.v)}</b> (FY 2025-26, resident${age === "0" ? "" : age === "60" ? ", senior citizen" : ", super senior"}):`,
    body: tbl([["", "New regime", "Old regime"], ["Standard deduction", R(n.sd), R(o.sd)], ["Taxable income", R(n.ti), R(o.ti)], ["Tax on slabs", R(n.base), R(o.base)],
      ["Rebate 87A", R(n.rebate), R(o.rebate)], ["Surcharge", R(n.sc), R(o.sc)], ["Cess 4%", R(n.cess), R(o.cess)], ["<b>Total tax</b>", `<b>${R(n.total)}</b>`, `<b>${R(o.total)}</b>`]]) +
      `<p>${save ? `<b>${best} regime</b> saves you <b>${R(save)}</b>.` : "Both regimes give the same tax."} Monthly: ${R(Math.min(n.total, o.total) / 12)}.</p>` +
      `<p class="kn">Old regime shown without 80C/80D/HRA/home-loan deductions. Add them in the calculator for an exact comparison.</p>` + link("#/calc/itax", "Open Income Tax calculator"), src: "Income Tax calculator"};
}
function intentGST(q) {
  if (!/\bgst\b/i.test(q)) return null;
  const a = big(amounts(q)); if (!a) return null;
  const r = pcts(q)[0] ?? 18, inc = /incl|inclusive|including|with gst|mrp/i.test(q);
  const base = inc ? a.v * 100 / (100 + r) : a.v, g = base * r / 100;
  return {lead: `GST @ ${r}% on <b>${R2(a.v)}</b> (${inc ? "GST-inclusive" : "excluding GST"}):`,
    body: tbl([["", "Amount"], ["Taxable value", R2(base)], [`GST @ ${r}%`, R2(g)], [`CGST ${r / 2}% + SGST ${r / 2}% (same state)`, `${R2(g / 2)} + ${R2(g / 2)}`],
      [`or IGST ${r}% (other state)`, R2(g)], ["<b>Total</b>", `<b>${R2(base + g)}</b>`]]) +
      `<p class="kn">GST 2.0 slabs: 5%, 18% and 40% (plus 0%, 3% gold). Say “inclusive” if the amount already has GST in it.</p>` + link("#/calc/gst", "Open GST calculator"), src: "GST calculator"};
}
function intentEMI(q) {
  if (!/\bemi\b|loan/i.test(q)) return null;
  const am = amounts(q), a = big(am), r = pcts(q)[0] ?? (q.match(/at\s+(\d+(?:\.\d+)?)\b/i) || [])[1];
  const yr = am.find(x => x.kind === "yr"), mo = am.find(x => x.kind === "mo");
  if (!a || !r || !(yr || mo)) return null;
  const n = Math.round(yr ? yr.v * 12 : mo.v), i = +r / 1200, e = i ? a.v * i * (1 + i) ** n / ((1 + i) ** n - 1) : a.v / n;
  return {lead: `EMI for a loan of <b>${R(a.v)}</b> at <b>${r}%</b> for <b>${yr ? yr.v + " years" : n + " months"}</b>:`,
    body: tbl([["", "Amount"], ["Monthly EMI", `<b>${R2(e)}</b>`], ["Total interest", R(e * n - a.v)], ["Total payment", R(e * n)]]) + link("#/calc/emi", "Open EMI calculator"), src: "EMI calculator"};
}
function intentMath(q) {
  const p = q.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(.+)/i);
  if (p) { const a = big(amounts(p[2])); if (a) return {lead: `${p[1]}% of ${a.v.toLocaleString("en-IN")} =`, body: `<p class="kbig">${(a.v * p[1] / 100).toLocaleString("en-IN", {maximumFractionDigits: 2})}</p>`, src: "Calculator"}; }
  const e = q.replace(/^(what is|calculate|solve|=)\s*/i, "").replace(/[x×]/g, "*").replace(/÷/g, "/").replace(/,/g, "").replace(/\?$/, "").trim();
  if (/^[\d\s+\-*/().%]+$/.test(e) && /\d\s*[+\-*/%]\s*[\d(]/.test(e)) {
    try { const v = Function('"use strict";return (' + e.replace(/%/g, "/100") + ")")(); if (isFinite(v)) return {lead: esc(e) + " =", body: `<p class="kbig">${(+v.toFixed(6)).toLocaleString("en-IN", {maximumFractionDigits: 6})}</p>`, src: "Calculator"}; } catch (_) {}
  }
  return null;
}
function intentDue(q) {
  if (!/due|deadline|last date|kab tak|upcoming/i.test(q)) return null;
  if (/gstr|itr|tds|advance tax|iff|pmt|audit|reg-|cmp|itc-|rfd|form/i.test(q)) return null;   // specific → search
  const list = upcoming(45).slice(0, 8);
  return {lead: "Tax & GST due dates in the next 45 days:", body: list.length ? `<div class="kdue">${list.map(dueRow).join("")}</div>` + link("#/dates", "All due dates") : "<p>Nothing due in the next 45 days.</p>", src: "Due dates"};
}
function intentExam(q) {
  if (!/(days?|how long|kitne din).*(exam|left)|exam date|my exam|exam kab/i.test(q)) return null;
  const ex = store.get("exam", "");
  if (!ex) return {lead: "You haven't set your exam date yet.", body: "<p>Set it on the Home page and I'll count down for you.</p>" + link("#/home", "Set exam date"), src: "TaxSphere"};
  const d = Math.ceil((new Date(ex) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  return {lead: d >= 0 ? `<b>${d} days</b> left until your exam on ${new Date(ex).toLocaleDateString("en-IN", {day: "numeric", month: "long", year: "numeric"})}.` : "Your exam date has passed. Set the next one on the Home page.",
    body: d >= 0 ? `<p>${d > 90 ? "Plenty of time. Build a plan and stick to it." : d > 30 ? "Time to finish first reading and start revision." : "Final stretch: revise and attempt mock papers."}</p>` + link("#/planner", "Open study planner") : link("#/home", "Set exam date"), src: "TaxSphere"};
}
const NAV = [["return", "#/returns", "Return Filings"], ["filing", "#/returns", "Return Filings"], ["reckoner", "#/reckoners", "Tax & GST Reckoners"], ["company", "#/company", "Company Law toolkit"], ["home", "#/home", "Home"], ["syllab", "#/syllabus", "Syllabus"], ["plan", "#/planner", "Study planner"], ["calculator", "#/calc", "Calculators"], ["tax", "#/calc", "Calculators"], ["account", "#/calc", "Calculators"], ["study", "#/study", "Study"],
  ["cost", "#/calc", "Calculators"], ["note", "#/learn", "Concept notes"], ["learn", "#/learn", "Concept notes"], ["quiz", "#/quiz", "Quiz"], ["practical", "#/practice", "Practicals"], ["due", "#/dates", "Due dates"], ["meesho", "#/returns/meeshogst", "Meesho GST filing"]];
function intentAnim(q) {
  if (!/animat|video|visual|show me how|diagram/i.test(q)) return null;
  const m = CKEYS.find(([, r]) => r.test(q)) || (/gst/i.test(q) ? ["gstfiling"] : null);
  const c = m && (window.CONCEPTS || []).find(x => x.id === m[0]);
  if (!c) return {lead: "Animated concepts available:", body: `<div class="kopts">${(window.CONCEPTS || []).map(x => `<a class="kopt kplay" href="#/concepts/${x.id}">▶ ${esc(x.title)}</a>`).join("")}</div>`, src: "Animated concepts"};
  return {lead: `Opening the animation: <b>${esc(c.title)}</b>…`, body: `<p>${esc(c.sub)}</p>` + link("#/concepts/" + c.id, "▶ Watch the animation"), go: "#/concepts/" + c.id, src: "Animated concepts"};
}
function intentNav(q) {
  const m = q.match(/^(open|go to|goto|show me|take me to|kholo)\s+(.+)/i); if (!m) return null;
  const n = NAV.find(([k]) => m[2].toLowerCase().includes(k)); if (!n) return null;
  return {lead: `Opening ${n[2]}…`, body: link(n[1], "Go to " + n[2]), go: n[1], src: "TaxSphere"};
}
const GREET = /^(hi+|hello+|hey+|hii+|namaste|namaskar|hola|yo|good\s*(morning|afternoon|evening|night))\b[\s!.]*$/i;
const HELP = `<ul><li><b>Concepts:</b> “What is residential status?”, “Explain GAAR”</li><li><b>Syllabus:</b> “CMA Inter Paper 8 syllabus”, “CA Final FR chapters”</li>
  <li><b>Practicals:</b> “Minor's agreement practical”, “EOQ question with solution”</li><li><b>Tax maths:</b> “Tax on ₹15 lakh salary”, “GST 18% on 5000”, “EMI 20 lakh at 9% for 15 years”</li>
  <li><b>GST forms & dates:</b> “When is GSTR-3B due?”, “What is REG-01?”, “Upcoming due dates”</li><li><b>Practice:</b> “Quiz me on GST”</li></ul>`;
function intentChat(q) {
  if (GREET.test(q.trim())) return {lead: "Hi! I'm <b>KINTY AI</b>, your study assistant in TaxSphere. 👋", body: "<p>Ask me anything from your CA, CMA or CS studies. For example:</p>" + HELP, src: "KINTY AI"};
  if (/^(thanks|thank you|thx|ty|shukriya|dhanyavad)/i.test(q.trim())) return {lead: "You're welcome! All the best for your exams. 📚", body: "", src: "KINTY AI"};
  if (/who (are|r) (you|u)|your name|what are you|who (made|built|created|developed) (you|this)|developer|kinty kaun/i.test(q))
    return {lead: "I'm <b>KINTY AI</b>, the offline study assistant inside TaxSphere.", body: "<p>I answer from TaxSphere's own notes, syllabus, practicals, quiz bank, GST forms, tax rules and due dates, and I can run the app's calculators. I work without internet, so your questions stay on your phone.</p><p>TaxSphere is developed &amp; managed by <b class=\"gold\">Sachin Sanwal</b>.</p>", src: "KINTY AI"};
  if (/feedback|suggestion|complain|contact|email id|report (a )?(bug|problem|mistake)|developer email/i.test(q))
    return {lead: "You can send feedback and suggestions to the developer.", body: "<p>Email: <b>SachinSanwal01@gmail.com</b></p><p>Or open the Feedback tab to write your message. It opens your email app with everything filled in.</p>" + link("#/feedback", "Open Feedback & suggestions"), src: "KINTY AI"};
  if (/^(help|what can you do|how to use|features|menu)\b/i.test(q.trim())) return {lead: "Here's what you can ask me:", body: HELP, src: "KINTY AI"};
  return null;
}

// ---------------------------------------------------------------- quiz mode
let QZ = null;
function intentQuiz(q) {
  if (!/quiz me|test me|ask me|mcq|practice question|quiz on|quiz from/i.test(q)) return null;
  const cat = /gst|tax|income/i.test(q) ? "tax" : /account|journal|depreciat|ratio/i.test(q) ? "acc" : /cost|fm|financ|eoq|cvp|npv/i.test(q) ? "cost" : null;
  return askQuiz(cat);
}
function askQuiz(cat) {
  const pool = QUIZ.filter(x => !cat || x[0] === cat), it = pool[Math.floor(Math.random() * pool.length)];
  const opts = shuffle(it[2]);
  QZ = {it, opts, cat};
  return {lead: `Quiz time${cat ? " · " + {tax: "Tax & GST", acc: "Accounts", cost: "Costing & FM"}[cat] : ""}! 🎯`,
    body: `<p><b>${esc(it[1])}</b></p><div class="kopts">${opts.map((o, i) => `<button class="kopt" data-ask="${esc("ABCD"[i] + ") " + o)}">${"ABCD"[i]}) ${esc(o)}</button>`).join("")}</div>`, src: "Quiz bank"};
}
function quizAnswer(q) {
  if (!QZ) return null;
  const t = q.trim(), L = t.match(/^\(?([a-d])\)?(\W|$)/i), {it, opts, cat} = QZ;
  let pick = L ? opts["abcd".indexOf(L[1].toLowerCase())] : opts.find(o => t.toLowerCase().includes(o.toLowerCase()));
  if (!pick) { if (/^(skip|next|another|again)/i.test(t)) { return askQuiz(cat); } QZ = null; return null; }
  QZ = null;
  const ok = pick === it[2][0];
  return {lead: ok ? "✅ Correct!" : `❌ Not quite. The answer is <b>${esc(it[2][0])}</b>.`, body: `<p>${esc(it[3])}</p><div class="kopts"><button class="kopt" data-ask="quiz me${cat ? " on " + {tax: "tax", acc: "accounts", cost: "costing"}[cat] : ""}">Next question →</button></div>`, src: "Quiz bank"};
}

// ---------------------------------------------------------------- conversation context & follow-ups
let CTX = null;   // {doc, rest, shown:Set}
const plain = h => String(h || "").replace(/<li>/g, "• ").replace(/<\/(p|li|tr|h\d)>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{2,}/g, "\n").trim();
function ctxDoc() {
  if (CTX) return CTX.doc;
  const t = store.get("kinty.ctx", ""); if (!t || !window.KINTY_KB) return null;
  const d = window.KINTY_KB.find(x => x.t === t); if (d) CTX = {doc: d, rest: [], shown: new Set([d.t])};
  return d;
}
function setCtx(doc, rest) { CTX = {doc, rest: rest || [], shown: new Set([doc.t])}; store.set("kinty.ctx", doc.t); }
const pdfLinks = arr => (arr || []).map(f => `<a class="kpdf" href="${esc(f.u)}" target="_blank" rel="noopener">📘 ${esc(f.t)}</a>`).join("");
function mapBlock(d) {
  if (d.m && d.m.length) return `<div class="kmap"><div class="kn"><b>Where this is in your syllabus</b></div>${d.m.map(m => `<div class="kmrow"><a href="${m.l}">${esc(m.c)} › ${esc(m.t)}</a>${pdfLinks(m.pdf)}</div>`).join("")}</div>`;
  if (d.pdf && d.pdf.length) return `<div class="kmap"><div class="kn"><b>Official study material</b></div><div class="kmrow">${pdfLinks(d.pdf)}</div></div>`;
  return "";
}
const CKEYS = [["gstfiling", /gstr-?3b|gstr-?1\b|gstr-?2b|gst (return|filing)|filing process|set.?off|invoice management|\bims\b/i],
  ["demerger", /demerger|resulting company|2\(19aa\)|scheme of arrangement/i],
  ["busicomb", /business combination|ind as 103|goodwill|bargain purchase|acquisition method|amalgamation|common control/i],
  ["accstd", /accounting standards? in india|\bind as\b|\bnfra\b|ind as applicab|who (makes|sets) accounting/i],
  ["tp", /transfer pricing|arm.?s length|associated enterprise|\btnmm\b|\bsec(tion)?\.? ?92/i]];
const conceptFor = d => { const h = `${d.t} ${d.k || ""} ${d.c || ""}`; const m = CKEYS.find(([, r]) => r.test(h)); return m && m[0]; };
function actions(d) {
  const a = [], cid = d.s === "anim" ? null : conceptFor(d);
  if (d.ex) a.push(["💡 Give an example", "Give an example"]);
  if (d.s === "qa" || d.s === "note") a.push(["🧒 Explain simpler", "Explain simpler"]);
  a.push(["➕ Tell me more", "Tell me more"]);
  if ((d.m && d.m.some(m => m.pdf && m.pdf.length)) || (d.pdf && d.pdf.length)) a.push(["📘 Official PDF", "Show official PDF"]);
  return `<div class="kopts kact">${cid ? `<a class="kopt kplay" href="#/concepts/${cid}">▶ Watch animation</a>` : ""}${a.map(([l, q]) => `<button class="kopt" data-ask="${esc(q)}">${l}</button>`).join("")}</div>`;
}
function followUp(q) {
  const t = q.trim().toLowerCase(), short = t.split(/\s+/).length <= 7;
  if (!short) return null;
  const d = ctxDoc(); if (!d) return null;
  if (/^(give|show|share|any)?\s*(me\s*)?(an?\s*)?(example|illustration|udaharan|eg\b)|example\s*(do|dijiye|please|de do)?$/.test(t)) {
    if (d.ex) return {lead: `Example: ${esc(d.t)}`, body: `<div class="kbody">${d.ex}</div>` + actions({...d, ex: ""}), src: SRC[d.s] || "KINTY explains", keep: true};
    const prs = search(d.t, ["prac"]), pr = prs[0];
    if (pr && prs.cov >= .6 && pr[0] > 4) { setCtx(pr[1]); return render(pr[1], `Here's a worked practical related to <b>${esc(d.t)}</b>:`); }
    return {lead: "I don't have a worked example stored for this topic yet.", body: actions({...d, ex: ""}), src: "KINTY AI", keep: true};
  }
  if (/simpl|easy|easier|in short|short me|summar|brief|one line|samjha|eli5|asaan/.test(t)) {
    const txt = plain(d.b).split("\n").map(x => x.replace(/^•\s*/, "").trim()).filter(Boolean);
    let one = (txt[0] || "").split(/(?<=\.)\s/)[0], used = 1;
    if (/:$/.test(one)) { const items = txt.slice(1, 4); one = one + " " + items.join("; ") + "."; used = 1 + items.length; }
    const pts = txt.slice(used, used + 3);
    return {lead: "In simple words:", body: `<p class="kbig2">${esc(one)}</p>${pts.length ? `<p class="kn">Also remember:</p><ul>${pts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` + actions(d), src: "KINTY explains", keep: true};
  }
  if (/pdf|study material|official|icai|icmai|icsi|read (more|chapter)|book|module/.test(t)) {
    const mb = mapBlock(d);
    return {lead: mb ? `Official material for <b>${esc(d.t)}</b>:` : "I don't have an official PDF linked for this topic.", body: mb || "", src: "Official study material", keep: true};
  }
  if (/which (chapter|paper|subject)|where.*syllabus|syllabus me|kis chapter/.test(t)) {
    const mb = mapBlock(d); if (mb) return {lead: "Here's where it sits in your syllabus:", body: mb, src: "Syllabus", keep: true};
  }
  if (/^(more|tell me more|explain more|aur|aur batao|continue|go on|details?|elaborate|next|something else|related)\b/.test(t)) {
    const nx = (CTX && CTX.rest || []).find(([, x]) => !CTX.shown.has(x.t));
    if (nx) { CTX.shown.add(nx[1].t); const keepRest = CTX.rest, shown = CTX.shown; const r = render(nx[1], `More on this: <b>${esc(nx[1].t)}</b>`); CTX = {doc: nx[1], rest: keepRest, shown}; store.set("kinty.ctx", nx[1].t); return r; }
    const rel = search(d.t + " " + (d.k || "")).filter(([, x]) => x.t !== d.t).slice(0, 4);
    if (rel.length) return {lead: "Related topics you can ask about:", body: `<div class="kopts">${rel.map(([, x]) => `<button class="kopt" data-ask="${esc(x.t)}">${esc(x.t)}</button>`).join("")}</div>`, src: "KINTY AI", keep: true};
  }
  return null;
}
function render(d, lead) {
  const long = d.b.length > 1400;
  return {lead: lead ?? (LEAD[d.s] || ""), src: SRC[d.s] || "TaxSphere",
    body: `<div class="ktitle">${esc(d.t)}</div>${d.c ? `<div class="kn">${esc(d.c)}</div>` : ""}<div class="kbody${long ? " kclip" : ""}">${d.b}</div>` +
      (long ? '<button class="kmore">Show full answer</button>' : "") + mapBlock(d) + (d.l ? link(d.l, d.s === "anim" ? "▶ Watch the animation" : "Open in TaxSphere") : "") + actions(d)};
}

// ---------------------------------------------------------------- answer
function answer(q) {
  const qa = quizAnswer(q); if (qa) return qa;
  const fu = followUp(q); if (fu) return fu;
  if (q.trim().split(/\s+/).length <= 4 && /^(give (an? )?example|example|explain (more|simpler)|tell me more|more|simpler|show (official )?pdf|elaborate)\b/i.test(q.trim()))
    return {lead: "Ask me a topic first and I'll explain it, give an example or open its official PDF.", body: HELP, src: "KINTY AI"};
  for (const f of [intentChat, intentAnim, intentNav, intentQuiz, intentExam, intentEMI, intentGST, intentTax, intentMath, intentDue]) { const r = f(q); if (r) { CTX = null; store.set("kinty.ctx", ""); return r; } }
  let res = search(q);
  if (!res.length || res[0][0] < 2.2 || res.cov < .6) {
    const sugg = res.slice(0, 3).map(([, d]) => d.t);
    return {lead: "I couldn't find that in TaxSphere's study data.", src: "KINTY AI",
      body: "<p>I'm an offline assistant, so I answer from the app's notes, syllabus, practicals, quiz bank, GST forms, tax rules and due dates. Try different words or a shorter question.</p>" +
        (sugg.length ? `<p class="kn">Closest matches:</p><div class="kopts">${sugg.map(t => `<button class="kopt" data-ask="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : HELP)};
  }
  const [top, d] = res[0];
  const rest = res.slice(1, 15).filter(([sc, x]) => sc > top * .4 && x.t !== d.t);
  setCtx(d, rest);
  const r = render(d);
  const seenT = new Set([d.t.toLowerCase()]), rel = rest.filter(([, x]) => (x.s !== d.s || x.s === "qa") && !seenT.has(x.t.toLowerCase()) && seenT.add(x.t.toLowerCase())).slice(0, 3);
  if (rel.length) r.body += `<p class="kn" style="margin-top:10px">People also ask:</p><div class="kopts">${rel.map(([, x]) => `<button class="kopt" data-ask="${esc(x.t)}">${esc(x.t)}</button>`).join("")}</div>`;
  return r;
}

// ---------------------------------------------------------------- UI
const CSS = `
.khead{display:flex;align-items:center;gap:12px;margin:4px 0 14px}
.kav{width:48px;height:48px;border-radius:15px;flex:none;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#6d4aff,#e0459b);box-shadow:0 6px 18px rgba(109,74,255,.35)}
.kav svg{width:26px;height:26px}
.khead h1{font-size:24px}.khead p{margin:0;font-size:12.5px;color:var(--soft)}
.khead .kclr{margin-left:auto;border:1px solid var(--rule);background:var(--surface);border-radius:10px;padding:7px 10px;font-size:12.5px;font-weight:600;color:var(--soft);cursor:pointer}
.klog{display:flex;flex-direction:column;gap:12px;padding-bottom:12px}
.kmsg{max-width:88%;border-radius:18px;padding:11px 14px;font-size:14.5px;line-height:1.5;overflow-wrap:anywhere}
.kmsg.u{align-self:flex-end;background:var(--accent);color:var(--accent-ink);border-bottom-right-radius:6px}
.kmsg.b{align-self:flex-start;background:var(--surface);border:1px solid var(--rule);border-bottom-left-radius:6px;box-shadow:var(--shadow);max-width:94%}
.kmsg.b .ksrc{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--accent);background:var(--accent-wash);padding:2px 8px;border-radius:8px;margin-bottom:6px}
.kmsg.b .klead{color:var(--ink);font-weight:600;margin-bottom:4px}
.kmsg ul,.kmsg ol{margin:.3em 0;padding-left:20px}.kmsg li{margin:2px 0}.kmsg p{margin:.35em 0}
.ktitle{font-family:var(--display);font-weight:700;color:var(--ink);font-size:16px;margin-top:2px}
.kn{font-size:12.5px;color:var(--soft)}
.kt{overflow-x:auto;margin:6px 0}.kt table{border-collapse:collapse;font-size:13px;min-width:100%}
.kt th,.kt td{border-bottom:1px solid var(--rule);padding:6px 7px;text-align:left;white-space:nowrap}.kt th{color:var(--soft);font-weight:600;white-space:normal;font-size:11.5px;text-transform:uppercase;letter-spacing:.02em}
body.kfab-on main{padding-bottom:150px}
@media (max-width:899px){body.kfab-on main{padding-bottom:calc(150px + env(safe-area-inset-bottom))}}
.kclip{max-height:330px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 75%,transparent)}
.kmore{border:0;background:none;color:var(--accent);font-weight:700;padding:6px 0;cursor:pointer}
.klink{display:inline-block;margin-top:8px;font-weight:700;font-size:13.5px;text-decoration:none}
.kopts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.kopt{border:1px solid var(--rule);background:var(--surface2);color:var(--ink);border-radius:12px;padding:8px 11px;font-size:13px;text-align:left;cursor:pointer}
.kopt:active{transform:scale(.98)}
.kbig{font-family:var(--display);font-size:28px;font-weight:700;color:var(--ink);margin:2px 0}
.kdue>*{margin:0}
.ktyping{display:flex;gap:4px;padding:14px 16px}.ktyping i{width:7px;height:7px;border-radius:50%;background:var(--soft);animation:kb 1s infinite}
.ktyping i:nth-child(2){animation-delay:.15s}.ktyping i:nth-child(3){animation-delay:.3s}
@keyframes kb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
.kcomp{position:sticky;bottom:12px;display:flex;gap:8px;padding:8px;background:var(--surface);border:1px solid var(--rule);border-radius:18px;box-shadow:var(--shadow);z-index:3}
.kcomp textarea{flex:1;border:0;background:transparent;resize:none;outline:none;font:inherit;font-size:15px;padding:8px 6px;max-height:110px;color:var(--ink)}
.kcomp button{flex:none;width:44px;height:44px;border-radius:13px;border:0;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;cursor:pointer}
.kcomp button svg{width:20px;height:20px}
.ksug{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 14px}
.kfoot{text-align:center;font-size:11.5px;color:var(--soft);margin:8px 0 0}
.krow{display:flex;gap:8px;align-items:flex-end;max-width:96%}
.krow .kmini{flex:none;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#6d4aff,#e0459b);margin-bottom:2px}
.krow .kmini svg{width:16px;height:16px}
.krow .kmsg.b{max-width:100%;flex:1;min-width:0}
.knew{animation:kin .35s ease-out}
@keyframes kin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.kmap{margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--rule)}
.kmrow{margin-top:6px;font-size:13px;line-height:1.45}
.kmrow>a:first-child{font-weight:600;text-decoration:none}
.kpdf{display:inline-block;margin:4px 6px 0 0;font-size:12.5px;font-weight:600;text-decoration:none;padding:3px 8px;border-radius:8px;background:var(--accent-wash);color:var(--accent)}
.kact{margin-top:10px}
.kopt.kplay{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:700;text-decoration:none}
.ktools{display:flex;gap:4px;margin-top:8px;border-top:1px dashed var(--rule);padding-top:6px}
.ktools button{border:0;background:none;color:var(--soft);font-size:12px;padding:4px 7px;border-radius:8px;cursor:pointer}
.ktools button.on{color:var(--accent);background:var(--accent-wash)}
.kbig2{font-size:16px;color:var(--ink);font-weight:600}
.kac{display:flex;gap:6px;overflow-x:auto;padding:0 2px 8px;scrollbar-width:none}.kac::-webkit-scrollbar{display:none}
.kac .kopt{flex:none;white-space:nowrap;background:var(--surface)}
.kstat{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--good);font-weight:600}
.kstat i{width:7px;height:7px;border-radius:50%;background:var(--good)}
#kfab{position:fixed;right:16px;bottom:24px;z-index:6;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:11px 16px 11px 12px;
  background:linear-gradient(135deg,#6d4aff,#e0459b);color:#fff;font:700 14px var(--sans);box-shadow:0 8px 24px rgba(109,74,255,.45);text-decoration:none}
#kfab svg{width:20px;height:20px}
@media (max-width:899px){.kcomp{bottom:calc(80px + env(safe-area-inset-bottom))}#kfab{bottom:calc(78px + env(safe-area-inset-bottom));right:12px;padding:10px 14px 10px 11px;font-size:13px}}
`;
const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" opacity=".8"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const SUGG = ["Tax on ₹15 lakh salary", "When is GSTR-3B due?", "CMA Inter Paper 8 syllabus", "What is residential status?", "Quiz me on GST",
  "EMI for 20 lakh at 9% for 15 years", "What is GAAR?", "GST 18% on 5000"];
function css() { if (!document.getElementById("kcss")) { const s = document.createElement("style"); s.id = "kcss"; s.textContent = CSS; document.head.appendChild(s); } }
function loadKB(cb) {
  if (window.KINTY_KB) { if (!IDX) buildIndex(); return cb(); }
  const s = document.createElement("script"); s.src = window.SEMI_URL ? SEMI_URL("kinty/kb.js") : "kinty/kb.js"; s.onload = () => { buildIndex(); cb(); };
  s.onerror = () => cb(); document.head.appendChild(s);
}
const LOG = () => store.get("kinty.log", []);
function bubble(m, i, last) {
  if (m.r === "u") return `<div class="kmsg u${last ? " knew" : ""}">${esc(m.t)}</div>`;
  return `<div class="krow${last ? " knew" : ""}"><div class="kmini">${SPARK}</div><div class="kmsg b" data-i="${i}">${m.src ? `<span class="ksrc">${esc(m.src)}</span>` : ""}` +
    `${m.lead ? `<div class="klead">${m.lead}</div>` : ""}${m.body || ""}` +
    `<div class="ktools"><button data-copy="${i}">📋 Copy</button><button data-fb="${i}:1" class="${m.fb === 1 ? "on" : ""}">👍</button><button data-fb="${i}:-1" class="${m.fb === -1 ? "on" : ""}">👎</button></div></div></div>`;
}
function draw() {
  const log = LOG(), el = $("#klog"); if (!el) return;
  el.innerHTML = log.length ? log.map((m, i) => bubble(m, i, i === log.length - 1 && FRESH)).join("") : `<div class="kmsg b"><span class="ksrc">KINTY AI</span><div class="klead">Hi! I'm KINTY AI 👋</div>
    <p>Ask me about tax, GST, accounts, costing, law or your CA/CMA/CS syllabus. I can also calculate tax, GST and EMI, show due dates and quiz you.</p></div>
    <div class="ksug">${SUGG.map(s => `<button class="kopt" data-ask="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
}
let FRESH = false;
function typeLead() {
  const msgs = document.querySelectorAll("#klog .kmsg.b"), last = msgs[msgs.length - 1]; if (!last) return;
  const L = last.querySelector(".klead"); if (!L) return;
  const html = L.innerHTML, txt = L.textContent; if (txt.length > 160) return;
  let n = 0; L.textContent = "";
  const step = () => { n += 2; if (n >= txt.length) { L.innerHTML = html; return; } L.textContent = txt.slice(0, n) + "▍"; setTimeout(step, 14); };
  step();
}
function scrollEnd() { requestAnimationFrame(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior: "smooth"})); }
function ask(q) {
  q = String(q || "").trim(); if (!q) return;
  const log = LOG(); log.push({r: "u", t: q}); store.set("kinty.log", log.slice(-40)); draw();
  $("#klog").insertAdjacentHTML("beforeend", '<div class="kmsg b ktyping" id="ktyp"><i></i><i></i><i></i></div>'); scrollEnd();
  loadKB(() => setTimeout(() => {
    let a; try { a = answer(q); } catch (e) { a = {lead: "Sorry, something went wrong with that question.", body: `<p class="kn">${esc(e.message)}</p>`, src: "KINTY AI"}; }
    const L = LOG(); L.push({r: "b", lead: a.lead, body: a.body, src: a.src, q}); store.set("kinty.log", L.slice(-40));
    FRESH = true; draw(); FRESH = false; typeLead(); scrollEnd();
    if (a.go) setTimeout(() => { location.hash = a.go; }, 700);
  }, 450 + Math.min(500, q.length * 8)));
}
window.renderKinty = function () {
  css();
  $("#app").innerHTML = `<div class="khead"><div class="kav">${SPARK}</div><div><h1>KINTY AI</h1><p><span class="kstat"><i></i>Ready · works offline</span> · CA, CMA & CS study assistant</p></div>
      <button class="kclr" id="kclr">＋ New chat</button></div>
    <div class="klog" id="klog"></div>
    <div class="kac" id="kac"></div>
    <form class="kcomp" id="kform"><textarea id="kin" rows="1" placeholder="Ask KINTY anything…" enterkeyhint="send"></textarea><button aria-label="Send">${SEND}</button></form>
    <p class="kfoot">KINTY works offline from TaxSphere's study data. Check important answers with your study material and the latest amendments.</p>`;
  draw();
  const inp = $("#kin");
  $("#kform").onsubmit = e => { e.preventDefault(); const v = inp.value; inp.value = ""; inp.style.height = ""; $("#kac").innerHTML = ""; ask(v); };
  inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#kform").requestSubmit(); } };
  let acT;
  inp.oninput = () => {
    inp.style.height = "auto"; inp.style.height = Math.min(110, inp.scrollHeight) + "px";
    clearTimeout(acT); acT = setTimeout(() => {
      const v = inp.value.trim(), box = $("#kac"); if (!box) return;
      if (v.length < 3 || !window.KINTY_KB) { box.innerHTML = ""; return; }
      const seen = new Set(), types = ["qa", "note", "gstf", "prac", "rate", "due", "paper", "case"];
      const words = v.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const pre = window.KINTY_KB.filter(d => types.includes(d.s) && words.every(w => (d.t + " " + (d.k || "")).toLowerCase().split(/[^a-z0-9]+/).some(x => x.startsWith(w))))
        .sort((x, y) => (PRIOR[y.s] || 1) - (PRIOR[x.s] || 1)).map(d => [0, d]);
      const hits = pre.concat(search(v, types)).filter(([, d]) => !seen.has(d.t) && seen.add(d.t)).slice(0, 4);
      box.innerHTML = hits.map(([, d]) => `<button class="kopt" data-ask="${esc(d.t)}">🔎 ${esc(d.t)}</button>`).join("");
    }, 160);
  };
  $("#kclr").onclick = () => { store.set("kinty.log", []); store.set("kinty.ctx", ""); QZ = null; CTX = null; draw(); };
  $("#app").onclick = e => {
    const b = e.target.closest("[data-ask]"); if (b) { if ($("#kac")) $("#kac").innerHTML = ""; if ($("#kin")) $("#kin").value = ""; ask(b.dataset.ask); return; }
    const c = e.target.closest("[data-copy]");
    if (c) { const m = c.closest(".kmsg"), txt = plain(m.innerHTML.replace(/<div class="ktools">[\s\S]*$/, "")) + "\n— KINTY AI, TaxSphere";
      const done = () => { c.textContent = "✓ Copied"; setTimeout(() => c.textContent = "📋 Copy", 1500); };
      const old = () => { const t = document.createElement("textarea"); t.value = txt; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (_) {} t.remove(); done(); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, old); else old(); return; }
    const f = e.target.closest("[data-fb]");
    if (f) { const [i, v] = f.dataset.fb.split(":").map(Number), L = LOG(); if (L[i]) { L[i].fb = L[i].fb === v ? 0 : v; store.set("kinty.log", L);
      const fb = store.get("kinty.feedback", []); fb.push({q: L[i].q || "", src: L[i].src, v: L[i].fb, at: Date.now()}); store.set("kinty.feedback", fb.slice(-200)); draw(); } return; }
    const m = e.target.closest(".kmore"); if (m) { const k = m.previousElementSibling; k.classList.remove("kclip"); m.remove(); }
  };
  loadKB(() => {});
  const pend = store.get("kinty.pending", ""); if (pend) { store.set("kinty.pending", ""); ask(pend); return; }
  if (LOG().length) setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 50);
};
window.kintyAsk = function (q) { q = String(q || "").trim(); if (q) store.set("kinty.pending", q); location.hash = "#/kinty"; };
window.kintyFab = function (sec) {
  css();
  let f = document.getElementById("kfab");
  document.body.classList.toggle("kfab-on", sec !== "kinty");
  if (sec === "kinty") { if (f) f.remove(); return; }
  if (!f) { f = document.createElement("a"); f.id = "kfab"; f.href = "#/kinty"; f.innerHTML = SPARK + "<span>KINTY AI</span>"; f.setAttribute("aria-label", "KINTY AI"); document.body.appendChild(f); }
};
window.KINTY = {answer: q => (window.KINTY_KB && !IDX && buildIndex(), answer(q)), search};
})();
