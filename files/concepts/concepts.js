// Animated concept explainers for TaxSphere. Original content; law position: CGST Act 2017 (after GST 2.0, Sept 2025),
// Companies Act 2013, Income-tax Act 1961 section numbers (renumbered in the Income-tax Act 2025 from tax year 2026-27), Ind AS / AS.
(function () {
"use strict";
// ---------------------------------------------------------------- tiny SVG scene kit (viewBox 360 x 230)
const E = s => String(s).replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]));
const st = d => `style="--d:${d || 0}s"`;
function txt(x, y, lines, o = {}) {
  lines = [].concat(lines); const fs = o.fs || 11, lh = fs * 1.25, y0 = y - (lines.length - 1) * lh / 2;
  return `<text x="${x}" y="${y0}" text-anchor="${o.a || "middle"}" dominant-baseline="middle" class="ct ${o.cls || ""}" font-size="${fs}" ${o.bold ? 'font-weight="700"' : ""}>` +
    lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${E(l)}</tspan>`).join("") + "</text>";
}
function B(x, y, w, h, lines, o = {}) {
  return `<g class="a" ${st(o.d)}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 10}" class="bx ${o.c || "c0"}"/>` +
    txt(x + w / 2, y + h / 2, lines, {fs: o.fs, bold: o.bold ?? true, cls: o.tc}) + "</g>";
}
function L(x, y, lines, o = {}) { return `<g class="a" ${st(o.d)}>${txt(x, y, lines, {fs: o.fs || 10, a: o.a, cls: o.cls || "cs", bold: o.bold})}</g>`; }
function A(x1, y1, x2, y2, o = {}) {
  const mx = (x1 + x2) / 2 + (o.bx || 0), my = (y1 + y2) / 2 + (o.by || 0);
  const d = o.curve ? `M${x1},${y1} Q${mx},${my} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
  return `<path d="${d}" class="ar ${o.c || ""}" ${st(o.d)} marker-end="url(#ah${o.c === "bad" ? "r" : o.c === "good" ? "g" : ""})"/>` +
    (o.label ? L(o.lx ?? mx, (o.ly ?? my) - 15, o.label, {d: (o.d || 0) + .4, fs: o.fs || 9.5, cls: "cl"}) : "");
}
function T(path, label, o = {}) {   // moving token
  return `<g class="a" ${st(o.d)}><g><circle r="${o.r || 9}" class="tk ${o.c || ""}"/>${label ? `<text text-anchor="middle" dominant-baseline="central" font-size="${o.fs || 9}">${E(label)}</text>` : ""}` +
    `<animateMotion path="${path}" dur="${o.dur || 2}s" begin="${o.d || 0}s" repeatCount="${o.rep || "indefinite"}" fill="freeze"/></g></g>`;
}
function bar(x, base, w, h, label, val, o = {}) {
  return `<g class="a" ${st(o.d)}><rect x="${x}" y="${base - h}" width="${w}" height="${h}" rx="4" class="bx ${o.c || "c1"} grow" style="--d:${o.d || 0}s;transform-origin:${x}px ${base}px"/>` +
    txt(x + w / 2, base - h - 9, val, {fs: 10, bold: true}) + txt(x + w / 2, base + 10, label, {fs: 9, cls: "cs"}) + "</g>";
}
const svg = body => `<svg viewBox="0 0 360 230" class="cvs" role="img"><defs>
  <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahd"/></marker>
  <marker id="ahr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahd bad"/></marker>
  <marker id="ahg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahd good"/></marker></defs>${body}</svg>`;
const chk = (x, y, items, d0 = .3, gap = .35, o = {}) => items.map((t, i) => L(x, y + i * (o.lh || 19), (t[0] === "✗" ? "" : "") + t, {d: d0 + i * gap, a: "start", fs: o.fs || 10.5, cls: t[0] === "✗" ? "cbad" : t[0] === "✓" ? "cgood" : "cs"})).join("");

// ---------------------------------------------------------------- concepts
const C = [];

C.push({id: "gstfiling", title: "GST filing process", sub: "Invoice to GSTR-1, GSTR-2B, ITC, GSTR-3B, set-off and annual return", tag: "GST", steps: [
 {t: "1 · Issue tax invoices", n: "Every taxable sale needs a <b>tax invoice</b> showing GSTIN, HSN/SAC, taxable value and GST. If your aggregate turnover has exceeded ₹5 crore, B2B invoices must be reported to the IRP for an <b>IRN (e-invoice)</b>. Moving goods worth over ₹50,000 needs an <b>e-way bill</b>.",
  s: () => svg(B(14, 60, 112, 58, ["Supplier", "(you)"], {c: "c1"}) + B(234, 60, 112, 58, ["Buyer", "registered"], {c: "c2", d: .3}) +
    A(126, 89, 232, 89, {d: .6, label: "tax invoice + GST"}) + T("M126,89 L232,89", "📄", {d: 1, dur: 1.8, r: 10}) +
    B(70, 150, 220, 52, ["e-invoice (IRN) if turnover > ₹5 cr", "e-way bill if goods > ₹50,000"], {c: "c3", d: 1.4, fs: 10, bold: false}))},
 {t: "2 · File GSTR-1 by the 11th", n: "<b>GSTR-1</b> reports all outward supplies: B2B invoice-wise, B2C state-wise and rate-wise, credit/debit notes and HSN summary. Monthly filers file by the <b>11th</b>. Under <b>QRMP</b> it is quarterly by the 13th, with the optional IFF for B2B invoices in the first two months.",
  s: () => svg(B(14, 75, 104, 58, ["Supplier"], {c: "c1"}) + B(238, 55, 108, 98, ["GST", "portal"], {c: "c4", d: .3, r: 22}) +
    A(118, 104, 236, 104, {d: .6, label: "GSTR-1 · by 11th"}) + T("M118,104 L236,104", "📤", {d: 1, dur: 1.6, r: 10}) +
    L(180, 180, ["B2B invoices · B2C summary · notes · HSN"], {d: 1.3}) + L(180, 202, ["QRMP: IFF by 13th · quarterly GSTR-1 by 13th"], {d: 1.7, cls: "cl"}))},
 {t: "3 · Auto-flow to the buyer's GSTR-2B", n: "Your GSTR-1 flows into the buyer's <b>GSTR-2B</b>, a static ITC statement generated on the <b>14th</b>. Through the <b>Invoice Management System (IMS)</b> the buyer can accept, reject or keep each invoice pending before 2B is generated.",
  s: () => svg(B(14, 70, 100, 60, ["GST", "portal"], {c: "c4", r: 22}) + B(246, 70, 100, 60, ["Buyer's", "GSTR-2B"], {c: "c2", d: .3}) +
    A(114, 100, 244, 100, {d: .6, label: "auto-populated · 14th"}) + T("M114,100 L244,100", "🧾", {d: 1, dur: 1.6, r: 10}) +
    B(40, 160, 80, 30, ["✓ Accept"], {c: "c2", d: 1.4, fs: 10}) + B(140, 160, 80, 30, ["✗ Reject"], {c: "c5", d: 1.6, fs: 10}) + B(240, 160, 80, 30, ["⏸ Pending"], {c: "c3", d: 1.8, fs: 10}) +
    L(180, 210, "IMS: buyer's action before GSTR-2B is generated", {d: 2})) },
 {t: "4 · Work out eligible ITC", n: "ITC is allowed only if the invoice is in <b>GSTR-2B</b>, goods or services are received, the supplier has paid the tax and you file your return (Sec. 16). <b>Blocked credits</b> under Sec. 17(5), such as most motor cars, food and personal use, are not allowed. Unpaid suppliers after <b>180 days</b> means ITC is reversed.",
  s: () => svg(B(12, 30, 120, 170, ["Buyer's", "ITC", "check"], {c: "c2"}) +
    chk(148, 48, ["✓ Invoice appears in GSTR-2B", "✓ Goods / services received", "✓ Supplier paid the tax", "✓ Return filed", "✗ Blocked credits (Sec 17(5))", "✗ Supplier unpaid after 180 days", "✗ Claimed after 30 Nov cut-off"], .4, .3))},
 {t: "5 · File GSTR-3B by the 20th", n: "<b>GSTR-3B</b> is the summary return with tax payment. Output liability is auto-filled from your GSTR-1 and ITC from GSTR-2B. Monthly filers file by the <b>20th</b>; QRMP filers by the 22nd or 24th after the quarter, paying monthly through PMT-06 by the 25th.",
  s: () => svg(B(14, 34, 130, 50, ["Liability", "from GSTR-1"], {c: "c1"}) + B(14, 140, 130, 50, ["ITC", "from GSTR-2B"], {c: "c2", d: .3}) +
    B(232, 82, 114, 62, ["GSTR-3B", "by 20th"], {c: "c4", d: .6}) +
    A(144, 59, 230, 105, {d: .9, curve: true, by: -10}) + A(144, 165, 230, 121, {d: 1.1, curve: true, by: 10}) +
    T("M144,59 Q187,72 230,105", "₹", {d: 1.4, dur: 1.6}) + T("M144,165 Q187,153 230,121", "₹", {d: 1.6, dur: 1.6, c: "g"}) +
    L(180, 210, "QRMP: 22nd / 24th after quarter · PMT-06 by 25th monthly", {d: 2}))},
 {t: "6 · Set off ITC, pay the rest in cash", n: "Credit is used in a fixed order: <b>IGST credit</b> first against IGST, then CGST and SGST. <b>CGST credit</b> goes against CGST then IGST. <b>SGST credit</b> against SGST then IGST. CGST credit can <b>never</b> pay SGST or the other way round. The balance is paid in cash, with <b>18%</b> interest if late.",
  s: () => svg(B(14, 20, 92, 40, ["IGST credit"], {c: "c2", fs: 10}) + B(14, 95, 92, 40, ["CGST credit"], {c: "c2", fs: 10, d: .1}) + B(14, 170, 92, 40, ["SGST credit"], {c: "c2", fs: 10, d: .2}) +
    B(254, 20, 92, 40, ["IGST due"], {c: "c1", fs: 10, d: .3}) + B(254, 95, 92, 40, ["CGST due"], {c: "c1", fs: 10, d: .4}) + B(254, 170, 92, 40, ["SGST due"], {c: "c1", fs: 10, d: .5}) +
    A(106, 40, 252, 40, {d: .8, label: "1st"}) + A(106, 45, 252, 110, {d: 1.3, label: "2nd", lx: 150, ly: 66}) + A(106, 50, 252, 185, {d: 1.8, label: "3rd", lx: 130, ly: 92}) +
    A(106, 115, 252, 118, {d: 2.3, c: "good"}) + A(106, 120, 252, 45, {d: 2.6, c: "good"}) + A(106, 190, 252, 190, {d: 2.9, c: "good"}) + A(106, 185, 252, 52, {d: 3.2, c: "good"}) +
    L(180, 224, "✗ CGST credit ⇄ SGST never allowed", {d: 3.6, cls: "cbad", bold: true}))},
 {t: "7 · Year end: annual return", n: "After 12 months of returns, file <b>GSTR-9</b> by <b>31 December</b> if turnover exceeds ₹2 crore, and the <b>GSTR-9C</b> reconciliation if it exceeds ₹5 crore. Missed ITC and credit notes for the year can be taken only until <b>30 November</b>.",
  s: () => svg(Array.from({length: 12}, (_, i) => B(10 + i * 28.5, 40, 24, 34, [["A", "M", "J", "J", "A", "S", "O", "N", "D", "J", "F", "M"][i]], {c: "c4", d: i * .12, fs: 10})).join("") +
    L(180, 92, "GSTR-1 + GSTR-3B every month (Apr–Mar)", {d: 1.6}) + A(180, 104, 180, 136, {d: 1.9}) +
    B(40, 140, 130, 50, ["GSTR-9", "by 31 Dec · > ₹2 cr"], {c: "c1", d: 2.2, fs: 10.5}) + B(190, 140, 130, 50, ["GSTR-9C", "> ₹5 cr turnover"], {c: "c3", d: 2.5, fs: 10.5}) +
    L(180, 212, "ITC & credit-note cut-off: 30 November", {d: 2.9, cls: "cl"}))},
]});

C.push({id: "demerger", title: "Demerger", sub: "Scheme of arrangement, transfer of undertaking, shares to shareholders, tax neutrality", tag: "Law & Tax", steps: [
 {t: "1 · Before the demerger", n: "Company <b>A</b> runs two businesses (undertakings X and Y). Its shareholders own A. The group wants Y to be run separately, for focus, valuation or to bring in a partner.",
  s: () => svg(B(130, 12, 100, 40, ["Shareholders"], {c: "c3"}) + A(180, 52, 180, 82, {d: .4, label: "own 100%"}) +
    `<g class="a" style="--d:.6s"><rect x="60" y="86" width="240" height="124" rx="14" class="bx c0"/>${txt(180, 102, "Company A", {bold: true})}</g>` +
    B(80, 120, 92, 74, ["Undertaking", "X"], {c: "c1", d: .9}) + B(188, 120, 92, 74, ["Undertaking", "Y"], {c: "c2", d: 1.1}))},
 {t: "2 · Scheme of arrangement (Sec 230–232)", n: "A demerger happens through a <b>scheme of arrangement</b>. The board approves it, applies to the <b>NCLT</b>, and the scheme must be approved by a majority representing <b>three-fourths in value</b> of shareholders and creditors at meetings. After NCLT sanction, the order is filed with the ROC in <b>INC-28</b>.",
  s: () => svg(["Board", "approves"].length && [["Board", "approves"], ["NCLT", "application"], ["Members &", "creditors ¾"], ["NCLT", "sanction"], ["INC-28", "to ROC"]].map((l, i) =>
    B(8 + i * 71, 80, 60, 64, l, {c: i === 3 ? "c2" : "c4", d: i * .5, fs: 9.5})).join("") +
    [0, 1, 2, 3].map(i => A(68 + i * 71, 112, 77 + i * 71, 112, {d: .3 + i * .5})).join("") +
    L(180, 180, "Valuation report · share-swap ratio · notice to tax & other authorities", {d: 2.6}))},
 {t: "3 · Undertaking Y moves to company B", n: "All assets and liabilities of undertaking <b>Y</b> move to the <b>resulting company B</b>, as a <b>going concern</b> and at <b>book values</b>. A keeps undertaking X.",
  s: () => svg(`<g class="a"><rect x="8" y="40" width="150" height="150" rx="14" class="bx c0"/>${txt(83, 56, "Company A", {bold: true})}</g>` +
    `<g class="a" style="--d:.2s"><rect x="202" y="40" width="150" height="150" rx="14" class="bx c0"/>${txt(277, 56, "Resulting Co B", {bold: true})}</g>` +
    B(20, 80, 60, 90, ["X"], {c: "c1", d: .4}) +
    `<g class="a" style="--d:.6s"><g><rect x="88" y="80" width="60" height="90" rx="10" class="bx c2"/>${txt(118, 125, ["Y", "assets +", "liabilities"], {fs: 9.5, bold: true})}` +
    `<animateTransform attributeName="transform" type="translate" from="0 0" to="138 0" begin="1.2s" dur="1.6s" fill="freeze"/></g></g>` +
    L(180, 214, "at book value · as a going concern", {d: 2.9, cls: "cl", bold: true}))},
 {t: "4 · B issues shares to A's shareholders", n: "B pays for undertaking Y by issuing its shares <b>to A's shareholders</b>, not to A, in proportion to their holding in A. That's what makes it a demerger rather than a slump sale.",
  s: () => svg(B(120, 14, 120, 40, ["A's shareholders"], {c: "c3"}) + B(230, 150, 116, 56, ["Resulting", "Co B"], {c: "c2", d: .3}) + B(14, 150, 116, 56, ["Company A"], {c: "c0", d: .2}) +
    A(288, 148, 220, 56, {d: .7, curve: true, bx: 40, label: "new B shares", lx: 300, ly: 100}) + T("M288,148 Q294,102 220,56", "📈", {d: 1.2, dur: 1.8}) +
    L(72, 120, ["no consideration", "to A itself"], {d: 1.8, cls: "cbad"}) + L(180, 222, "share entitlement ratio fixed by the valuation report", {d: 2.2}))},
 {t: "5 · After the demerger", n: "The same shareholders now hold shares in <b>both</b> companies: A (running X) and B (running Y). Ownership mirrors what they had before; only the business structure changed.",
  s: () => svg(B(120, 12, 120, 40, ["Shareholders"], {c: "c3"}) + A(160, 52, 90, 100, {d: .4}) + A(200, 52, 270, 100, {d: .6}) +
    B(30, 104, 120, 90, ["Company A", "runs X"], {c: "c1", d: .8}) + B(210, 104, 120, 90, ["Company B", "runs Y"], {c: "c2", d: 1}) +
    L(180, 214, "mirror shareholding in both companies", {d: 1.4, cls: "cl", bold: true}))},
 {t: "6 · Tax-neutral if Sec 2(19AA) is met", n: "If the conditions of <b>Sec. 2(19AA)</b> are met there is <b>no capital gains tax</b> for the company (Sec. 47(vib)) or the shareholders (Sec. 47(vid)). Shareholders split the cost of their old A shares between A and B (Sec. 49(2C)/(2D)), and B can carry forward the losses of undertaking Y (Sec. 72A(4)).",
  s: () => svg(chk(14, 26, ["✓ All property & liabilities of the undertaking move", "✓ Transferred at book values", "✓ ≥ ¾ in value of A's shareholders get B shares", "✓ Shares issued proportionately", "✓ Undertaking moves as a going concern"], .3, .35) +
    B(14, 130, 160, 74, ["No capital gains", "47(vib) company", "47(vid) shareholders"], {c: "c2", d: 2.2, fs: 10}) +
    B(186, 130, 160, 74, ["Cost split", "49(2C)/(2D)", "Losses: 72A(4)"], {c: "c1", d: 2.5, fs: 10}))},
]});

C.push({id: "busicomb", title: "Business combination (Ind AS 103)", sub: "Acquisition method step by step, with a worked goodwill example", tag: "Accounts", steps: [
 {t: "1 · Acquirer gets control of a business", n: "A business combination happens when an acquirer obtains <b>control</b> of a <b>business</b> (inputs + processes that produce outputs). Buying just a group of assets is not a business combination. Here P pays <b>₹500 crore</b> for <b>80%</b> of S.",
  s: () => svg(B(14, 70, 110, 70, ["Acquirer", "P Ltd"], {c: "c1"}) + B(236, 70, 110, 70, ["Acquiree", "S Ltd"], {c: "c2", d: .3}) +
    A(124, 92, 234, 92, {d: .6, label: "₹500 cr"}) + T("M124,92 L234,92", "₹", {d: 1, dur: 1.6}) +
    A(234, 122, 124, 122, {d: 1.3, c: "good", label: "80% control", ly: 154}) + L(180, 196, "control of a business = business combination", {d: 2, cls: "cl", bold: true}))},
 {t: "2 · Identify acquirer and acquisition date", n: "Step 1: identify the <b>acquirer</b>, the entity that gains control (Ind AS 110). Step 2: fix the <b>acquisition date</b>, the date control actually passes, which may differ from the agreement date. Everything is measured at fair value on that date.",
  s: () => svg(B(20, 30, 150, 60, ["Step 1", "Identify the acquirer"], {c: "c1", fs: 10.5}) + B(190, 30, 150, 60, ["Step 2", "Acquisition date"], {c: "c4", d: .4, fs: 10.5}) +
    `<g class="a" style="--d:.9s"><line x1="30" y1="160" x2="330" y2="160" class="ar" style="--d:.9s"/></g>` +
    L(70, 140, "agreement signed", {d: 1.2}) + L(250, 140, "control passes", {d: 1.5, bold: true}) +
    `<g class="a" style="--d:1.5s"><circle cx="250" cy="160" r="7" class="tk g"/></g><g class="a" style="--d:1.2s"><circle cx="70" cy="160" r="5" class="tk"/></g>` +
    L(250, 186, "← acquisition date", {d: 1.8, cls: "cl"}))},
 {t: "3 · Net assets of S at fair value", n: "Step 3: recognise S's <b>identifiable assets and liabilities at fair value</b>, including intangibles S never recorded (brands, customer lists). Here assets are ₹700 crore and liabilities ₹250 crore, so <b>net assets = ₹450 crore</b>.",
  s: () => svg(`<line x1="40" y1="190" x2="330" y2="190" class="axis"/>` + bar(70, 190, 60, 140, "Assets (FV)", "₹700", {c: "c2", d: .3}) +
    bar(160, 190, 60, 50, "Liabilities (FV)", "₹250", {c: "c5", d: .8}) + bar(250, 190, 60, 90, "Net assets", "₹450", {c: "c1", d: 1.3}))},
 {t: "4 · Consideration and NCI", n: "Step 4: measure the <b>consideration</b> at fair value (cash, shares, contingent consideration): ₹500 crore. The 20% <b>non-controlling interest</b> is measured at its share of net assets, 20% × 450 = <b>₹90 crore</b>, or at fair value. Acquisition costs are <b>expensed</b>, not added to goodwill.",
  s: () => svg(B(14, 30, 160, 60, ["Consideration (FV)", "₹500 cr"], {c: "c1", fs: 11}) + B(186, 30, 160, 60, ["NCI 20% × 450", "₹90 cr"], {c: "c3", d: .5, fs: 11}) +
    L(180, 130, ["cash · shares · contingent consideration", "all at acquisition-date fair value"], {d: 1}) +
    B(70, 166, 220, 40, ["Acquisition costs → expensed"], {c: "c5", d: 1.5, fs: 10.5}))},
 {t: "5 · Goodwill or bargain purchase", n: "<b>Goodwill = consideration + NCI + fair value of any previously held interest − net assets</b> = 500 + 90 − 450 = <b>₹140 crore</b>. If the result is negative, it's a <b>bargain purchase</b>: the gain goes to OCI and is accumulated in <b>capital reserve</b> (directly to capital reserve if there's no clear evidence of a bargain).",
  s: () => svg(`<line x1="40" y1="200" x2="330" y2="200" class="axis"/>` +
    `<g class="a" style="--d:.3s"><rect x="80" y="${200 - 125}" width="70" height="125" rx="4" class="bx c1 grow" style="--d:.3s;transform-origin:80px 200px"/>${txt(115, 145, ["Consid.", "500"], {fs: 10, bold: true})}</g>` +
    `<g class="a" style="--d:.8s"><rect x="80" y="${200 - 125 - 22}" width="70" height="22" rx="4" class="bx c3 grow" style="--d:.8s;transform-origin:80px 75px"/>${txt(115, 64 + 2, "NCI 90", {fs: 9.5, bold: true})}</g>` +
    `<g class="a" style="--d:1.2s"><rect x="210" y="${200 - 112}" width="70" height="112" rx="4" class="bx c2 grow" style="--d:1.2s;transform-origin:210px 200px"/>${txt(245, 150, ["Net assets", "450"], {fs: 10, bold: true})}</g>` +
    `<g class="a" style="--d:1.8s"><rect x="210" y="53" width="70" height="35" rx="4" class="bx gw"/>${txt(245, 70, "Goodwill 140", {fs: 9.5, bold: true})}</g>` +
    L(180, 222, "590 − 450 = goodwill ₹140 cr", {d: 2.2, cls: "cl", bold: true}))},
 {t: "6 · After acquisition, and common control", n: "Goodwill is <b>not amortised</b>; it is tested for <b>impairment every year</b> (Ind AS 36). Provisional amounts can be adjusted within a <b>measurement period of up to one year</b>. Combinations of entities under <b>common control</b> use the <b>pooling of interests</b> method (Appendix C): book values, no goodwill, difference to capital reserve.",
  s: () => svg(B(14, 30, 160, 70, ["Goodwill", "impairment test", "every year"], {c: "c1", fs: 10.5}) + B(186, 30, 160, 70, ["Measurement", "period ≤ 1 year"], {c: "c4", d: .4, fs: 10.5}) +
    B(14, 126, 332, 76, ["Common control (Appendix C): pooling of interests", "carrying amounts · no new goodwill · difference → capital reserve"], {c: "c3", d: .9, fs: 10}))},
]});

C.push({id: "accstd", title: "Accounting standards in India", sub: "Who sets them, Ind AS vs AS, who applies what, and how a standard is made", tag: "Accounts", steps: [
 {t: "1 · Who makes accounting standards", n: "The <b>Accounting Standards Board of ICAI</b> formulates standards. The <b>NFRA</b> recommends them to the government, and the <b>Ministry of Corporate Affairs</b> notifies them for companies under <b>Sec. 133</b> of the Companies Act, 2013.",
  s: () => svg(B(10, 80, 96, 64, ["ICAI", "ASB", "drafts"], {c: "c4", fs: 10.5}) + B(132, 80, 96, 64, ["NFRA", "recommends"], {c: "c3", d: .5, fs: 10.5}) + B(254, 80, 96, 64, ["MCA", "notifies", "(Sec 133)"], {c: "c1", d: 1, fs: 10.5}) +
    A(106, 112, 130, 112, {d: .4}) + A(228, 112, 252, 112, {d: .9}) + T("M58,78 Q180,26 302,78", "📘", {d: 1.4, dur: 2.4, r: 10}) +
    L(180, 186, "Companies must follow standards notified by MCA", {d: 1.8, cls: "cl", bold: true}))},
 {t: "2 · Two sets of standards", n: "<b>Ind AS</b> are converged with IFRS and notified in the Companies (Indian Accounting Standards) Rules, 2015. <b>AS</b> (Accounting Standards) apply to everyone else and are notified in the Companies (Accounting Standards) Rules, 2021. A company follows one framework, not both.",
  s: () => svg(B(20, 30, 150, 150, ["Ind AS", "", "IFRS-converged", "Ind AS Rules 2015"], {c: "c1", fs: 11}) + B(190, 30, 150, 150, ["AS", "", "Indian GAAP", "AS Rules 2021"], {c: "c4", d: .5, fs: 11}) +
    L(180, 210, "one company → one framework", {d: 1.1, cls: "cl", bold: true}))},
 {t: "3 · Who must use Ind AS", n: "<b>Phase I (from FY 2016-17):</b> companies with net worth of <b>₹500 crore</b> or more. <b>Phase II (from FY 2017-18):</b> all listed companies (except on SME exchanges) and unlisted companies with net worth of <b>₹250 crore</b> or more. Their holding, subsidiary, joint venture and associate companies follow too. Voluntary adoption is allowed, but you can't go back.",
  s: () => svg(`<line x1="30" y1="60" x2="330" y2="60" class="axis"/>` + `<g class="a" style="--d:.2s"><circle cx="90" cy="60" r="7" class="tk"/></g><g class="a" style="--d:.7s"><circle cx="250" cy="60" r="7" class="tk"/></g>` +
    L(90, 38, "FY 2016-17", {d: .2, bold: true}) + L(250, 38, "FY 2017-18", {d: .7, bold: true}) +
    B(20, 80, 140, 70, ["Phase I", "net worth ≥ ₹500 cr"], {c: "c1", d: .4, fs: 10.5}) + B(180, 80, 160, 70, ["Phase II", "all listed + unlisted", "net worth ≥ ₹250 cr"], {c: "c4", d: .9, fs: 10}) +
    L(180, 172, "+ their holding, subsidiary, JV & associate companies", {d: 1.4}) + L(180, 196, "voluntary adoption allowed · cannot switch back", {d: 1.8, cls: "cl"}))},
 {t: "4 · Everyone else uses AS", n: "Companies outside Ind AS follow <b>AS</b>, with some relaxations for <b>small and medium-sized companies (SMCs)</b>. Non-company entities (firms, LLPs, trusts) follow ICAI's AS under a <b>four-level classification (Levels I–IV)</b> based on turnover and borrowings, with more relaxations at lower levels.",
  s: () => svg(B(20, 26, 320, 46, ["Non-Ind AS companies → AS (SMC relaxations)"], {c: "c4", fs: 10.5}) +
    ["Level I", "Level II", "Level III", "Level IV"].map((l, i) => B(20 + i * 82, 104 + i * 0, 74, 50 + 0, [l], {c: ["c1", "c2", "c3", "c0"][i], d: .5 + i * .3, fs: 10})).join("") +
    L(180, 180, "Non-company entities: ICAI's four-level classification", {d: 1.8}) + L(180, 200, "lower level = more relaxations", {d: 2.1, cls: "cl"}))},
 {t: "5 · How a standard is made", n: "The ASB identifies the issue, a study group drafts it, and an <b>exposure draft</b> is issued for public comments. The ASB finalises the standard, the ICAI Council approves it, NFRA reviews and recommends it, and <b>MCA notifies</b> it.",
  s: () => svg([["Identify", "issue"], ["Study", "group draft"], ["Exposure", "draft"], ["ASB &", "Council"], ["NFRA →", "MCA"]].map((l, i) =>
    B(6 + i * 71, 82, 62, 60, l, {c: i === 2 ? "c3" : i === 4 ? "c1" : "c4", d: i * .45, fs: 9.5})).join("") +
    [0, 1, 2, 3].map(i => A(68 + i * 71, 112, 76 + i * 71, 112, {d: .3 + i * .45})).join("") + L(180, 176, "public comments at the exposure-draft stage", {d: 2.3, cls: "cl"}))},
 {t: "6 · Key Ind AS to know", n: "The most-tested Ind AS are <b>115</b> revenue, <b>116</b> leases, <b>109</b> financial instruments, <b>103</b> business combinations, <b>110</b> consolidation, <b>36</b> impairment, <b>16</b> property, plant & equipment, <b>2</b> inventories, <b>7</b> cash flows and <b>1</b> presentation.",
  s: () => svg([["1", "Presentation"], ["2", "Inventories"], ["7", "Cash flows"], ["16", "PPE"], ["36", "Impairment"], ["103", "Bus. comb."], ["109", "Fin. instr."], ["110", "Consolidation"], ["115", "Revenue"], ["116", "Leases"]].map(([n, l], i) =>
    B(8 + (i % 5) * 70, 40 + Math.floor(i / 5) * 84, 64, 72, ["Ind AS " + n, l], {c: ["c1", "c2", "c3", "c4", "c0"][i % 5], d: i * .18, fs: 9.5})).join(""))},
]});

C.push({id: "tp", title: "Transfer pricing", sub: "Associated enterprises, arm's length price, methods, range and compliance", tag: "Tax", steps: [
 {t: "1 · Deals between associated enterprises", n: "Transfer pricing applies to transactions between <b>associated enterprises</b> (Sec. 92A): companies linked through capital, management or control, for example 26% or more of voting power, power to appoint over half the board, or major financing or dependence. Here Indian subsidiary <b>I</b> sells goods to its foreign parent <b>F</b>.",
  s: () => svg(B(14, 70, 120, 70, ["Indian", "subsidiary I"], {c: "c2"}) + B(226, 70, 120, 70, ["Foreign", "parent F"], {c: "c1", d: .3}) +
    A(226, 85, 134, 85, {d: .6, label: "owns 100%", ly: 70}) + A(134, 125, 226, 125, {d: 1, c: "good", label: "sells goods", ly: 148}) +
    T("M134,125 L226,125", "📦", {d: 1.4, dur: 1.8, r: 10}) + L(180, 200, "associated enterprises: Sec 92A", {d: 1.8, cls: "cl", bold: true}))},
 {t: "2 · Why tax authorities care", n: "If I sells to F at an artificially <b>low price</b> (₹80) and F resells at ₹150 from a low-tax country, the profit is <b>shifted out of India</b>. Transfer pricing rules test whether the price is what unrelated parties would have agreed.",
  s: () => svg(B(10, 80, 90, 60, ["I (India)", "tax 25%"], {c: "c2", fs: 10}) + B(135, 80, 90, 60, ["F (low-tax)", "tax 5%"], {c: "c1", d: .2, fs: 10}) + B(260, 80, 90, 60, ["Customer"], {c: "c0", d: .4, fs: 10}) +
    A(100, 110, 133, 110, {d: .6, label: "₹80", c: "bad"}) + A(225, 110, 258, 110, {d: 1, label: "₹150"}) +
    T("M100,110 L133,110", "📦", {d: .9, dur: 1.2}) + T("M225,110 L258,110", "📦", {d: 1.4, dur: 1.2}) +
    L(180, 180, "profit of ₹70 per unit taxed outside India", {d: 1.9, cls: "cbad", bold: true}))},
 {t: "3 · Arm's length price and methods", n: "The price must be at <b>arm's length</b>: what independent parties would charge in similar circumstances. Rule 10B lists the methods: <b>CUP</b>, <b>resale price</b>, <b>cost plus</b>, <b>profit split</b>, <b>TNMM</b> and the <b>other method</b>. The <b>most appropriate method</b> for the facts is used.",
  s: () => svg([["CUP", "comparable price"], ["RPM", "resale price"], ["CPM", "cost plus"], ["PSM", "profit split"], ["TNMM", "net margin"], ["Other", "method"]].map(([a, b], i) =>
    B(14 + (i % 3) * 114, 30 + Math.floor(i / 3) * 80, 104, 66, [a, b], {c: ["c1", "c2", "c3"][i % 3], d: i * .3, fs: 10.5})).join("") +
    L(180, 210, "choose the most appropriate method (Sec 92C, Rule 10B)", {d: 2, cls: "cl", bold: true}))},
 {t: "4 · Range, median and adjustment", n: "With <b>6 or more comparables</b>, the arm's length <b>range</b> is the <b>35th to 65th percentile</b>. If the actual price falls outside the range, it is adjusted to the <b>median</b>. Here comparables cluster around ₹100; I charged ₹80, so income rises by ₹20 × 10,000 units = <b>₹2 lakh</b>. With fewer comparables, the arithmetic mean with a ±3% tolerance (1% for wholesale traders) applies.",
  s: () => svg(`<line x1="30" y1="120" x2="330" y2="120" class="axis"/>` +
    `<g class="a" style="--d:.9s"><rect x="228" y="100" width="54" height="40" rx="6" class="bx band"/></g>` +
    [92, 95, 97, 99, 100, 101, 103, 105, 108].map((v, i) => `<g class="a" style="--d:${.15 * i}s"><circle cx="${30 + (v - 70) * 7.5}" cy="120" r="6" class="tk g"/></g>`).join("") +
    L(255, 90, "35th–65th percentile", {d: 1.1, cls: "cl"}) + `<g class="a" style="--d:1.4s"><circle cx="${30 + 10 * 7.5}" cy="120" r="8" class="tk r"/></g>` + L(105, 145, "actual ₹80", {d: 1.5, cls: "cbad", bold: true}) +
    A(105, 158, 252, 146, {d: 1.9, c: "good", curve: true, by: 34, label: "adjust to median ₹100", lx: 178, ly: 212}) + L(180, 40, "₹20 × 10,000 units = ₹2 lakh added to income", {d: 2.4, bold: true}))},
 {t: "5 · Domestic transactions too", n: "<b>Specified domestic transactions</b> (Sec. 92BA), for example between units claiming profit-linked tax holidays and related parties, are also tested at arm's length when their aggregate value exceeds <b>₹20 crore</b> in the year.",
  s: () => svg(B(14, 60, 130, 70, ["Unit with", "tax holiday"], {c: "c2", fs: 10.5}) + B(216, 60, 130, 70, ["Related", "domestic party"], {c: "c1", d: .3, fs: 10.5}) +
    A(144, 95, 214, 95, {d: .6}) + A(214, 105, 144, 105, {d: .8}) + L(180, 170, "aggregate > ₹20 crore → arm's length test (Sec 92BA)", {d: 1.3, cls: "cl", bold: true}))},
 {t: "6 · Compliance and disputes", n: "File the accountant's report in <b>Form 3CEB</b> by <b>31 October</b>. Keep documentation under Rule 10D if international transactions exceed ₹1 crore; large groups also file a <b>master file</b> and, above ₹6,400 crore group revenue, a <b>country-by-country report</b>. Disputes go to the <b>TPO</b>; certainty is possible through an <b>APA</b> (with rollback) or <b>safe harbour</b> rules. Section numbers here are from the 1961 Act; the Income-tax Act 2025 renumbers them.",
  s: () => svg(B(14, 20, 104, 58, ["Form 3CEB", "by 31 Oct"], {c: "c1", fs: 10}) + B(128, 20, 104, 58, ["Documentation", "Rule 10D"], {c: "c4", d: .3, fs: 10}) + B(242, 20, 104, 58, ["Master file", "& CbCR"], {c: "c3", d: .6, fs: 10}) +
    B(14, 110, 104, 58, ["TPO", "assessment"], {c: "c5", d: 1, fs: 10}) + B(128, 110, 104, 58, ["APA", "with rollback"], {c: "c2", d: 1.3, fs: 10}) + B(242, 110, 104, 58, ["Safe harbour", "rules"], {c: "c2", d: 1.6, fs: 10}) +
    L(180, 200, "1961 Act numbering · renumbered in Income-tax Act 2025", {d: 2, cls: "cl"}))},
]});

window.CONCEPTS = C;

// ---------------------------------------------------------------- player
const CSS = `
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.ccard{display:block;text-decoration:none;color:inherit;padding:14px;border-radius:16px;background:var(--surface);border:1px solid var(--rule);box-shadow:var(--shadow)}
.ccard .cthumb{border-radius:12px;background:var(--surface2);margin-bottom:10px;overflow:hidden}
.ccard h3{margin:0 0 3px}.ccard p{margin:0;font-size:13px;color:var(--soft)}
.ctag{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--accent);background:var(--accent-wash);padding:2px 8px;border-radius:8px;margin-bottom:6px}
.cstage{background:var(--surface);border:1px solid var(--rule);border-radius:18px;box-shadow:var(--shadow);padding:10px;margin:10px 0}
.cvs{width:100%;height:auto;display:block}
.cvs .bx{stroke:var(--rule);stroke-width:1.2;fill:var(--surface2)}
.cvs .c1{fill:var(--accent-wash);stroke:color-mix(in srgb,var(--accent) 45%,transparent)}
.cvs .c2{fill:var(--good-wash);stroke:color-mix(in srgb,var(--good) 45%,transparent)}
.cvs .c3{fill:#fff3d6;stroke:#e9c46a}:root[data-theme="dark"] .cvs .c3{fill:#3a2f12;stroke:#8a6d1c}
.cvs .c4{fill:var(--surface2);stroke:var(--rule)}
.cvs .c5{fill:var(--bad-wash);stroke:color-mix(in srgb,var(--bad) 45%,transparent)}
.cvs .c0{fill:var(--surface);stroke:var(--rule)}
.cvs .gw{fill:#ffe08a;stroke:#d4a017;stroke-width:1.5;animation:gl 1.4s ease-in-out infinite alternate}
@keyframes gl{from{opacity:.75}to{opacity:1}}
.cvs .band{fill:color-mix(in srgb,var(--good) 18%,transparent);stroke:var(--good);stroke-dasharray:4 3}
.cvs .ct{fill:var(--ink);font-family:var(--sans)}
.cvs .cs{fill:var(--text)}.cvs .cl{fill:var(--accent);font-weight:600}.cvs .cbad{fill:var(--bad);font-weight:600}.cvs .cgood{fill:var(--good);font-weight:600}
.cvs .ar{fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:420;stroke-dashoffset:420;animation:cdraw .8s ease-out forwards;animation-delay:var(--d)}
.cvs .ar.good{stroke:var(--good)}.cvs .ar.bad{stroke:var(--bad)}
.cvs .ahd{fill:var(--accent)}.cvs .ahd.bad{fill:var(--bad)}.cvs .ahd.good{fill:var(--good)}
.cvs .axis{stroke:var(--rule);stroke-width:2}
.cvs .tk{fill:var(--accent);stroke:#fff;stroke-width:1.5}.cvs .tk.g{fill:var(--good)}.cvs .tk.r{fill:var(--bad)}
.cvs .a{opacity:0;animation:cpop .55s cubic-bezier(.2,.9,.3,1.2) forwards;animation-delay:var(--d)}
.cvs .grow{transform:scaleY(0);animation:cgrow .8s ease-out forwards;animation-delay:var(--d)}
@keyframes cpop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes cdraw{to{stroke-dashoffset:0}}
@keyframes cgrow{to{transform:scaleY(1)}}
.cstep{font-family:var(--display);font-weight:700;color:var(--ink);font-size:17px;margin:4px 2px 4px}
.cnar{font-size:14.5px;line-height:1.6;margin:0 2px 10px;min-height:96px;animation:cfade .5s}
@keyframes cfade{from{opacity:0}to{opacity:1}}
.cprog{display:flex;gap:4px;margin:8px 2px}
.cprog i{flex:1;height:5px;border-radius:5px;background:var(--surface2);overflow:hidden;cursor:pointer}
.cprog i b{display:block;height:100%;width:0;background:var(--accent)}
.cprog i.done b{width:100%}
.cprog i.on b{animation:cbar var(--dur) linear forwards}
.cpaused .cprog i.on b{animation-play-state:paused}
@keyframes cbar{to{width:100%}}
.cctl{display:flex;gap:8px;align-items:center;justify-content:center;margin:6px 0 4px}
.cctl button{border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:12px;height:44px;min-width:52px;font-weight:700;font-size:15px;cursor:pointer}
.cctl button.pp{background:var(--accent);color:var(--accent-ink);border-color:transparent;min-width:72px}
.cctl span{font-size:12.5px;color:var(--soft);min-width:52px;text-align:center}
.casknote{font-size:12.5px;color:var(--soft);text-align:center;margin-top:8px}
`;
function css() { if (!document.getElementById("ccss")) { const s = document.createElement("style"); s.id = "ccss"; s.textContent = CSS; document.head.appendChild(s); } }
let TIMER = null;
window.renderConcepts = function (rest) {
  css(); clearTimeout(TIMER);
  const c = C.find(x => x.id === (rest || [])[0]);
  if (!c) {
    $("#app").innerHTML = `<div class="head"><h1>Animated concepts</h1><p>Tricky topics explained step by step with animations. Tap a topic, then play or swipe through the steps.</p></div>
      <div class="cgrid">${C.map(x => `<a class="ccard" href="#/concepts/${x.id}"><div class="cthumb">${x.steps[0].s()}</div><span class="ctag">${E(x.tag)} · ${x.steps.length} steps</span><h3>${E(x.title)}</h3><p>${E(x.sub)}</p></a>`).join("")}</div>` + (window.CREDIT_HTML || "");
    return;
  }
  let i = Math.min(Math.max(0, +(rest[1] || 1) - 1), c.steps.length - 1), playing = true;
  $("#app").innerHTML = `<div class="crumbs"><a href="#/concepts">Animated concepts</a> › <b>${E(c.title)}</b></div>
    <div class="cstage" id="cst"><div class="cprog" id="cpg">${c.steps.map((_, k) => `<i data-k="${k}"><b></b></i>`).join("")}</div>
      <div id="csvg"></div><div class="cstep" id="cti"></div><div class="cnar" id="cna"></div>
      <div class="cctl"><button id="cpv" aria-label="Previous">◀</button><button id="cpl" class="pp" aria-label="Play or pause">❚❚</button><button id="cnx" aria-label="Next">▶</button><span id="cno"></span></div></div>
    ${window.CREDIT_HTML || ""}<p class="casknote">Have a doubt? <a href="#/kinty" onclick="event.preventDefault();kintyAsk(${JSON.stringify(c.title).replace(/"/g, "&quot;")})">Ask KINTY AI about ${E(c.title)}</a></p>`;
  const show = () => {
    clearTimeout(TIMER);
    const s = c.steps[i], dur = Math.max(7, Math.min(15, 4 + s.n.replace(/<[^>]+>/g, "").length / 28));
    $("#csvg").innerHTML = s.s(); $("#cti").textContent = s.t;
    const na = $("#cna"); na.innerHTML = s.n; na.style.animation = "none"; void na.offsetWidth; na.style.animation = "";
    $("#cno").textContent = `${i + 1} / ${c.steps.length}`;
    $$("#cpg i").forEach((el, k) => { el.className = k < i ? "done" : k === i ? "on" : ""; el.style.setProperty("--dur", dur + "s"); const b = el.firstChild; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; });
    $("#cst").classList.toggle("cpaused", !playing); $("#cpl").textContent = playing ? "❚❚" : "▶ Play";
    if (playing) TIMER = setTimeout(() => { if (i < c.steps.length - 1) { i++; show(); } else { playing = false; show(); } }, dur * 1000);
    history.replaceState(null, "", `#/concepts/${c.id}/${i + 1}`);
  };
  $("#cpv").onclick = () => { if (i > 0) { i--; show(); } };
  $("#cnx").onclick = () => { if (i < c.steps.length - 1) { i++; show(); } };
  $("#cpl").onclick = () => { playing = !playing; if (playing && i === c.steps.length - 1 && !TIMER) i = 0; show(); };
  $("#cpg").onclick = e => { const k = e.target.closest("i"); if (k) { i = +k.dataset.k; show(); } };
  let x0 = null; const stg = $("#cst");
  stg.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, {passive: true});
  stg.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) (dx < 0 ? $("#cnx") : $("#cpv")).click(); });
  show();
};
window.addEventListener("hashchange", () => { if (!/^#\/concepts\//.test(location.hash)) clearTimeout(TIMER); });
})();
