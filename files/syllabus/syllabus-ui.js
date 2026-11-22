// Course syllabus module: course -> level/group -> subject -> chapters -> topics, with search and progress.
// Data comes from syllabus/ca.js, cma.js and cs.js (window.SYLLABUS). Uses the helpers in index.html ($, $$, store, icon).
const SYL_ORDER = ["ca", "cma", "cs"];
const SYL = () => window.SYLLABUS || {};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

// Stable ids: a short hash of the item's place in the syllabus, so ticks survive data edits that leave the text alone.
function sylHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const stageName = st => st.group ? `${st.level} – ${st.group}` : st.level;
const topicText = t => typeof t === "string" ? t : t.t;   // never test t.sub on a string: String.prototype.sub exists

function sylDone() { return store.get("syl.done", {}); }
function setDone(ids, on) {
  const d = sylDone();
  ids.forEach(id => { if (on) d[id] = 1; else delete d[id]; });
  store.set("syl.done", d);
}

// Every tickable item of a paper. A chapter with no listed topics is ticked as a whole.
function paperLeaves(course, st, p) {
  const key = `${course}|${st.id}|${p.code}`, out = [];
  p.chapters.forEach((c, ci) => {
    if (c.deleted) return;
    const ck = `${key}|${c.title}`;
    const leaves = [];
    if (!c.topics.length) leaves.push(sylHash(ck));
    c.topics.forEach(t => {
      if (typeof t === "string") leaves.push(sylHash(`${ck}|${t}`));
      else if (t.sub && t.sub.length) t.sub.forEach(s => leaves.push(sylHash(`${ck}|${t.t}|${s}`)));
      else leaves.push(sylHash(`${ck}|${t.t}`));
    });
    out.push({ci, leaves});
  });
  return out;
}
function countDone(ids, d) { let n = 0; for (const id of ids) if (d[id]) n++; return n; }
function paperProgress(course, st, p, d = sylDone()) {
  const all = paperLeaves(course, st, p).flatMap(x => x.leaves);
  return {done: countDone(all, d), total: all.length};
}
// Electives: only the paper the student picked counts towards the group's progress.
const electKey = (course, st, label) => `${course}|${st.id}|${label}`;
function myElective(course, st, label) { return store.get("syl.elect", {})[electKey(course, st, label)] || null; }
function setElective(course, sid, label, code) {
  const st = SYL()[course].stages.find(s => s.id === sid), e = store.get("syl.elect", {});
  e[electKey(course, st, label)] = code; store.set("syl.elect", e); renderSyllabus(route.rest);
}
function countedPapers(course, st) {
  return st.papers.filter(p => !p.elective || myElective(course, st, p.elective) === p.code);
}
function stageProgress(course, st, d = sylDone()) {
  let done = 0, total = 0;
  countedPapers(course, st).forEach(p => { const r = paperProgress(course, st, p, d); done += r.done; total += r.total; });
  return {done, total};
}
const pctOf = r => r.total ? Math.round(r.done / r.total * 100) : 0;
const bar = (r, cls = "") => `<div class="sbar ${cls}" role="progressbar" aria-valuenow="${pctOf(r)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pctOf(r)}%"></i></div>`;

// ------------------------------------------------------------------ search
let sylIndex = null;
function buildIndex() {
  sylIndex = [];
  SYL_ORDER.forEach(cid => {
    const c = SYL()[cid]; if (!c) return;
    c.stages.forEach(st => st.papers.forEach((p, pi) => {
      const where = `${c.short} › ${stageName(st)} › ${p.code}`;
      sylIndex.push({kind: "Subject", text: `${p.code} ${p.title} ${p.abbr || ""}`, show: p.title, where, href: `#/syllabus/${cid}/${st.id}/${pi}`});
      p.chapters.forEach((ch, ci) => {
        const href = `#/syllabus/${cid}/${st.id}/${pi}/${ci}`;
        sylIndex.push({kind: "Chapter", text: ch.title, show: ch.title, where: `${where} ${p.title}`, href});
        ch.topics.forEach(t => {
          sylIndex.push({kind: "Topic", text: topicText(t), show: topicText(t), where: `${where} ${p.title} › ${ch.title}`, href});
          if (typeof t !== "string" && t.sub) t.sub.forEach(s => sylIndex.push({kind: "Topic", text: s, show: s, where: `${where} ${p.title} › ${ch.title} › ${t.t}`, href}));
        });
      });
    }));
  });
}
function mark(text, q) {
  const i = text.toLowerCase().indexOf(q);
  return i < 0 ? esc(text) : esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}
function sylSearch(q, course) {
  if (!sylIndex) buildIndex();
  q = q.trim().toLowerCase();
  const box = $("#sylres");
  if (!box) return;
  if (q.length < 2) { box.innerHTML = ""; box.hidden = true; return; }
  const words = q.split(/\s+/);
  const hits = sylIndex.filter(e => (!course || e.href.startsWith(`#/syllabus/${course}/`)) &&
    words.every(w => (e.text + " " + e.where).toLowerCase().includes(w)));
  const order = {Subject: 0, Chapter: 1, Topic: 2};
  hits.sort((a, b) => order[a.kind] - order[b.kind]);
  box.hidden = false;
  box.innerHTML = hits.length ? `<div class="note" style="margin-bottom:6px">${hits.length > 80 ? "First 80 of " : ""}${hits.length} match${hits.length === 1 ? "" : "es"}</div>` +
    hits.slice(0, 80).map(h => `<a class="sres" href="${h.href}"><span class="skind">${h.kind}</span><b>${mark(h.show, words[0])}</b><small>${esc(h.where)}</small></a>`).join("")
    : `<p class="note">Nothing matches “${esc(q)}”.</p>`;
}
const searchBox = (course, placeholder) => `<div class="ssearch"><label class="fld"><span>Search ${course ? esc(SYL()[course].short) + " " : ""}subjects, chapters and topics</span>
  <input id="sylq" inputmode="search" placeholder="${placeholder}" autocomplete="off" oninput="sylSearch(this.value, ${course ? `'${course}'` : "null"})"></label>
  <div id="sylres" class="card sresults" hidden></div></div>`;

// ------------------------------------------------------------------ screens
function renderSyllabus(rest = []) {
  const [cid, sid, pi, ci] = rest;
  const data = SYL();
  if (!data.ca && !data.cma && !data.cs) { $("#app").innerHTML = `<div class="card"><h2>Syllabus data missing</h2><p>The files in the syllabus folder could not be loaded.</p></div>`; return; }
  if (!cid || !data[cid]) return sylCourses();
  store.set("syl.course", cid);
  const course = data[cid];
  const st = course.stages.find(s => s.id === sid);
  if (!st) return sylStages(cid);
  const last = store.get("syl.stage", {}); last[cid] = st.id; store.set("syl.stage", last);
  const p = st.papers[+pi];
  if (pi == null || !p) return sylSubjects(cid, st);
  sylPaper(cid, st, +pi, ci == null ? null : +ci);
}

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([t, h], i) => i < items.length - 1 ? `<a href="${h}">${esc(t)}</a><span>›</span>` : `<b>${esc(t)}</b>`).join("")}</nav>`;
}

function sylCourses() {
  const data = SYL(), d = sylDone(), mine = store.get("syl.course", null);
  $("#app").innerHTML = `<div class="head"><h1>Choose your course</h1><p>Official, paper-wise syllabus for CA, CMA and CS with chapter and topic tracking.</p></div>
    <div class="grid courses">${SYL_ORDER.filter(k => data[k]).map(k => {
      const c = data[k], papers = c.stages.reduce((n, s) => n + s.papers.length, 0);
      const r = c.stages.reduce((a, s) => { const x = stageProgress(k, s, d); return {done: a.done + x.done, total: a.total + x.total}; }, {done: 0, total: 0});
      return `<a class="card ccard c-${k}" href="#/syllabus/${k}">
        <div class="cbadge">${esc(c.short)}</div>${mine === k ? `<span class="pill" style="float:right">My course</span>` : ""}
        <h2>${esc(c.short)} – ${esc(c.name)}</h2><p class="note">${esc(c.body)}</p>
        <div class="cscheme">${esc(c.scheme)}</div>
        <div class="cstats"><span>${c.stages.length} levels & groups</span><span>${papers} papers</span>${r.done ? `<span>${pctOf(r)}% done</span>` : ""}</div></a>`;
    }).join("")}</div>
    ${searchBox(null, "e.g. Ind AS 115, EOQ, Arbitration")}
    <p class="foot">Syllabus content is taken from the official ICAI, ICMAI and ICSI syllabus documents. Each course page names the scheme, its effective attempt and the source documents.</p>`;
}

function sylStages(cid) {
  const c = SYL()[cid], d = sylDone();
  const levels = [...new Set(c.stages.map(s => s.level))];
  $("#app").innerHTML = crumbs([["Courses", "#/syllabus"], [c.short, ""]]) +
    `<div class="card schemecard c-${cid}"><div class="cbadge">${esc(c.short)}</div>
      <div><h1>${esc(c.name)}</h1><p class="note" style="margin:2px 0 8px">${esc(c.body)}</p>
      <div class="kv"><b>Applicable syllabus</b><span>${esc(c.scheme)}</span><b>Effective</b><span>${esc(c.effective)}</span><b>Version</b><span>${esc(c.version)}</span></div>
      ${(c.notes || []).map(n => `<p class="snote">${linkify(n)}</p>`).join("")}
      <div class="refs">${c.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join("")}</div></div></div>
    ${levels.map(lv => `<div class="eyebrow">${esc(lv)}</div><div class="grid g3">${c.stages.filter(s => s.level === lv).map(s => {
      const r = stageProgress(cid, s, d), ch = s.papers.reduce((n, p) => n + p.chapters.length, 0);
      return `<a class="card tile stile" href="#/syllabus/${cid}/${s.id}"><h3>${esc(stageName(s))}</h3>
        <p>${s.papers.length} papers · ${ch} chapters${s.groupNote ? ` · ${esc(s.groupNote)}` : ""}</p>${bar(r)}<small class="note">${r.done}/${r.total} topics done</small></a>`;
    }).join("")}</div>`).join("")}
    ${searchBox(cid, "Search this course")}`;
}

function sylSubjects(cid, st) {
  const c = SYL()[cid], d = sylDone(), r = stageProgress(cid, st, d);
  const card = (p, pi) => {
    const pr = paperProgress(cid, st, p, d), live = p.chapters.filter(x => !x.deleted).length;
    const isMine = p.elective && myElective(cid, st, p.elective) === p.code;
    return `<div class="card subj${isMine ? " mine" : ""}"><a href="#/syllabus/${cid}/${st.id}/${pi}" class="subjlink">
      <span class="scode">${esc(p.code)}${p.abbr ? " · " + esc(p.abbr) : ""}</span><h3>${esc(p.title)}</h3>
      <p class="note">${live} chapters · ${p.marks} marks${p.sections && p.sections.length ? " · " + p.sections.length + " parts" : ""}${p.material ? " · study material" : ""}</p>${bar(pr)}
      <small class="note">${pr.done}/${pr.total} topics · ${pctOf(pr)}%</small></a>
      ${p.elective ? `<label class="check" style="margin-top:8px"><input type="radio" name="el-${esc(p.elective)}" ${isMine ? "checked" : ""} onchange="setElective('${cid}','${st.id}',${esc(JSON.stringify(p.elective))},${esc(JSON.stringify(p.code))})">My elective</label>` : ""}</div>`;
  };
  const core = st.papers.map((p, i) => [p, i]).filter(([p]) => !p.elective);
  const groups = [...new Set(st.papers.filter(p => p.elective).map(p => p.elective))];
  $("#app").innerHTML = crumbs([["Courses", "#/syllabus"], [c.short, `#/syllabus/${cid}`], [stageName(st), ""]]) +
    `<div class="head"><h1>${esc(c.short)} ${esc(stageName(st))}</h1>
      <p>${esc(c.scheme)}${st.groupNote ? " · " + esc(st.groupNote) : ""}</p></div>
    <div class="card"><div class="kpis" style="margin:0">${kpi("Group progress", pctOf(r) + "%")}${kpi("Topics done", `${r.done} / ${r.total}`)}${kpi("Papers", countedPapers(cid, st).length)}</div>${bar(r, "big")}
      ${groups.some(g => !myElective(cid, st, g)) ? `<p class="note" style="margin-bottom:0">Pick your elective below to include it in this progress.</p>` : ""}</div>
    ${(st.notes || []).map(n => `<p class="snote">${linkify(n)}</p>`).join("")}
    <div class="eyebrow">Subjects</div><div class="grid g3">${core.map(([p, i]) => card(p, i)).join("")}</div>
    ${groups.map(g => `<div class="eyebrow">${esc(g)}</div><div class="grid g3">${st.papers.map((p, i) => p.elective === g ? card(p, i) : "").join("")}</div>`).join("")}
    ${searchBox(cid, "Search this course")}`;
}

function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

// ------------------------------------------------------------------ official study material (links to the institutes' own PDFs)
const edKey = (cid, st, p, part) => `${cid}|${st.id}|${p.code}|${part}`;
const MONTHS = {jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11};
// Earliest attempt named in an edition label ("May 2027/ September 2027/ January 2028 Exams" -> May 2027); none = already current.
function editionStart(label) {
  let first = -Infinity;
  for (const m of label.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(20\d\d)/gi)) {
    const t = new Date(+m[2], MONTHS[m[1].toLowerCase()], 1).getTime();
    first = first === -Infinity ? t : Math.min(first, t);
  }
  return first;
}
// Default: the newest edition whose first attempt is within ~3 months, i.e. the book for the student's next exam.
function defaultEd(editions) {
  const soon = Date.now() + 90 * 864e5;
  let best = -1, bestStart = -Infinity;
  editions.forEach((e, i) => { const s = editionStart(e.label); if (s <= soon && (best < 0 || s > bestStart)) { best = i; bestStart = s; } });
  return best < 0 ? 0 : best;
}
function chosenEd(cid, st, p, part) {
  const eds = p.material.parts[part].editions, saved = store.get("syl.ed", {})[edKey(cid, st, p, part)];
  return saved != null && saved < eds.length ? saved : defaultEd(eds);
}
function setEd(cid, sid, pi, part, ei) {
  const st = SYL()[cid].stages.find(s => s.id === sid), p = st.papers[pi], e = store.get("syl.ed", {});
  e[edKey(cid, st, p, part)] = ei; store.set("syl.ed", e);
  const open = $$("details.chap[open]").map(x => +x.dataset.ci), y = scrollY;
  sylPaper(cid, st, pi, null);
  open.forEach(i => { const el = $(`details.chap[data-ci="${i}"]`); if (el) el.open = true; });
  scrollTo(0, y);
}
const pdfLink = f => `<a class="pdf" href="${esc(f.u)}" target="_blank" rel="noopener"><span class="pico">PDF</span><span class="ptitle">${esc(f.t)}</span>${f.mb ? `<small>${f.mb} MB</small>` : ""}</a>`;
function materialCard(cid, st, pi, p) {
  const m = p.material;
  if (!m || !m.parts || !m.parts.length) return "";
  const total = m.parts.reduce((n, part) => n + part.editions.reduce((k, e) => Math.max(k, e.groups.reduce((x, g) => x + g.files.length, 0)), 0), 0);
  if (!total) return "";
  const parts = m.parts.map((part, k) => {
    const ei = chosenEd(cid, st, p, k), ed = part.editions[ei];
    const tabs = part.editions.length > 1 ? `<div class="tabs edtabs" role="tablist">${part.editions.map((e, i) =>
      `<button role="tab" class="${i === ei ? "on" : ""}" onclick="setEd('${cid}','${st.id}',${pi},${k},${i})">${esc(e.label)}</button>`).join("")}</div>` : `<p class="note" style="margin:4px 0 8px">${esc(ed.label)}</p>`;
    const files = ed.groups.reduce((x, g) => x + g.files.length, 0);
    return `${part.name ? `<h3 class="mpart">${esc(part.name)}</h3>` : ""}${tabs}
      ${ed.updates.length ? `<div class="updates"><b>Updates for this edition</b>${ed.updates.map(pdfLink).join("")}</div>` : ""}
      ${ed.groups.map((g, gi) => `<details class="mgroup" ${ed.groups.length === 1 || gi === 0 ? "open" : ""}><summary>${esc(g.name)}<span class="cprog">${g.files.length} PDF${g.files.length === 1 ? "" : "s"}</span></summary>
        <div class="plist">${g.files.map(pdfLink).join("")}</div></details>`).join("")}
      <p class="note" style="margin:6px 0 0">${files} file${files === 1 ? "" : "s"} · <a href="${esc(ed.page || part.page)}" target="_blank" rel="noopener">Open the ${esc(m.by)} page ↗</a></p>`;
  }).join("");
  return `<div class="card material" id="material"><div class="mhead"><h2>Official study material</h2><span class="tag">${esc(m.by)}</span></div>
    <p class="note" style="margin-top:2px">Opens the institute's own PDF. You can read it or save it to your device from the viewer.${m.note ? " " + linkify(m.note) : ""}</p>${parts}</div>`;
}
function chapterReads(cid, st, p, ch) {
  if (!ch.read || !p.material) return "";
  const list = ch.read.filter(r => p.material.parts[r.part] && r.ed === chosenEd(cid, st, p, r.part));
  if (!list.length) return "";
  return `<div class="creads"><b>Study material for this chapter</b>${list.map(pdfLink).join("")}</div>`;
}

function sylPaper(cid, st, pi, openCi) {
  const c = SYL()[cid], p = st.papers[pi], d = sylDone();
  const leaves = Object.fromEntries(paperLeaves(cid, st, p).map(x => [x.ci, x.leaves]));
  const pr = paperProgress(cid, st, p, d);
  const key = `${cid}|${st.id}|${p.code}`;
  let lastSec = null, n = 0;
  const chapters = p.chapters.map((ch, ci) => {
    let head = "";
    if (ch.section && ch.section !== lastSec) {
      const s = (p.sections || []).find(x => x.name === ch.section);
      head = `<h3 class="secth">${esc(ch.section)}${s ? `<span>${s.marks ? s.marks + " marks" : s.weight ? s.weight + "%" : ""}</span>` : ""}</h3>`;
      lastSec = ch.section;
    }
    if (ch.deleted) {
      return head + `<div class="chap deleted"><div class="chead"><span class="cno">Ch ${++n}</span><span class="ctitle"><s>${esc(ch.title)}</s></span><span class="tag">Deleted by ICSI</span></div>${ch.note ? `<p class="snote">${esc(ch.note)}</p>` : ""}</div>`;
    }
    const ids = leaves[ci] || [], done = countDone(ids, d);
    const ck = `${key}|${ch.title}`;
    const box = (id, on, label, extra = "") => `<label class="tick"><input type="checkbox" data-ids="${id}" ${on ? "checked" : ""} ${extra}><span>${label}</span></label>`;
    const body = ch.topics.length ? `<ul class="tlist">${ch.topics.map(t => {
      if (typeof t === "string") { const id = sylHash(`${ck}|${t}`); return `<li>${box(id, d[id], esc(t))}</li>`; }
      if (!t.sub || !t.sub.length) { const id = sylHash(`${ck}|${t.t}`); return `<li>${box(id, d[id], esc(t.t))}</li>`; }
      const sids = t.sub.map(s => sylHash(`${ck}|${t.t}|${s}`)), sd = countDone(sids, d);
      return `<li class="hasub">${box(sids.join(","), sd === sids.length, `<b>${esc(t.t)}</b>`, sd && sd < sids.length ? "data-ind" : "")}
        <ul>${t.sub.map((s, k) => `<li>${box(sids[k], d[sids[k]], esc(s))}</li>`).join("")}</ul></li>`;
    }).join("")}</ul>` : `<p class="note" style="margin:6px 0 0">No separate topics are listed for this chapter in the official syllabus. Tick the chapter when you finish it.</p>`;
    const reads = chapterReads(cid, st, p, ch);
    return head + `<details class="chap" data-ci="${ci}" ${openCi === ci ? "open" : ""}>
      <summary><span class="cno">Ch ${++n}</span><span class="ctitle">${esc(ch.title)}</span>
        ${reads ? `<span class="tag pdftag" title="Study material linked">PDF</span>` : ""}${ch.weight ? `<span class="tag">${ch.weight}%</span>` : ""}<span class="cprog">${done}/${ids.length}</span>
        <input type="checkbox" class="cbox" aria-label="Mark chapter complete" data-ids="${ids.join(",")}" ${done === ids.length && ids.length ? "checked" : ""} ${done && done < ids.length ? "data-ind" : ""}></summary>
      <div class="cbody">${ch.note ? `<p class="snote">${esc(ch.note)}</p>` : ""}${body}${reads}</div></details>`;
  }).join("");
  $("#app").innerHTML = crumbs([["Courses", "#/syllabus"], [c.short, `#/syllabus/${cid}`], [stageName(st), `#/syllabus/${cid}/${st.id}`], [p.code, ""]]) +
    `<div class="card paperhead c-${cid}">
      <span class="scode">${esc(c.short)} · ${esc(stageName(st))} · ${esc(p.code)}${p.abbr ? " (" + esc(p.abbr) + ")" : ""}</span>
      <h1>${esc(p.title)}</h1>
      <div class="chips"><span>${p.marks} marks</span>${p.mode ? `<span>${esc(p.mode)}</span>` : ""}${p.level ? `<span>${esc(p.level)}</span>` : ""}${p.elective ? `<span>${esc(p.elective)}</span>` : ""}</div>
      ${p.objective ? `<p class="obj">${esc(p.objective)}</p>` : ""}
      ${p.sections && p.sections.length ? `<div class="secs">${p.sections.map(s => `<div><b>${esc(s.name)}</b><span>${s.marks ? s.marks + " marks" : s.weight ? s.weight + "%" : ""}</span></div>`).join("")}</div>` : ""}
      <div class="kpis">${kpi("Completed", pctOf(pr) + "%")}${kpi("Topics done", `${pr.done} / ${pr.total}`)}${kpi("Chapters", p.chapters.filter(x => !x.deleted).length)}</div>${bar(pr, "big")}
      <div class="pbtns"><button class="btn ghost" onclick="$$('details.chap').forEach(x => x.open = true)">Expand all</button>
        <button class="btn ghost" onclick="$$('details.chap').forEach(x => x.open = false)">Collapse all</button>
        ${pi > 0 ? `<a class="btn ghost" href="#/syllabus/${cid}/${st.id}/${pi - 1}">← Previous subject</a>` : ""}
        ${pi < st.papers.length - 1 ? `<a class="btn ghost" href="#/syllabus/${cid}/${st.id}/${pi + 1}">Next subject →</a>` : ""}
        ${p.material ? `<a class="btn" href="javascript:void 0" onclick="$('#material').scrollIntoView({behavior:'smooth'})">Study material</a>` : ""}
        ${(() => { const pr = pracFor(cid, st, p); return pr ? `<a class="btn" href="#/practice/${pr.key}/${pslug(p.code)}">Practice questions (${pr.paper.questions.length})</a>` : ""; })()}</div></div>
    ${materialCard(cid, st, pi, p)}
    ${(p.notes || []).length || p.studyMaterial ? `<details class="card notes"><summary>Official notes${p.studyMaterial ? " & study material" : ""}</summary>
      ${p.studyMaterial ? `<p class="snote">${esc(p.studyMaterial)}</p>` : ""}${(p.notes || []).map(x => `<p class="snote">${linkify(x)}</p>`).join("")}</details>` : ""}
    <div id="chaps">${chapters}</div>
    <div class="card refscard"><b>Official references</b><div class="refs">${(p.refs || []).map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ↗</a>`).join("")}</div>
      <p class="note" style="margin-bottom:0">${esc(c.scheme)}. ${esc(c.version)}</p></div>`;
  $$("#chaps input[data-ind]").forEach(x => x.indeterminate = true);
  $("#chaps").addEventListener("click", e => { if (e.target.classList.contains("cbox")) e.stopPropagation(); }, true);
  $("#chaps").addEventListener("change", e => {
    const t = e.target; if (!t.dataset.ids) return;
    setDone(t.dataset.ids.split(","), t.checked);
    const open = $$("details.chap[open]").map(x => +x.dataset.ci), y = scrollY;
    sylPaper(cid, st, pi, null);
    open.forEach(i => { const el = $(`details.chap[data-ci="${i}"]`); if (el) el.open = true; });
    scrollTo(0, y);
  });
  if (openCi != null) {
    const el = $(`details.chap[data-ci="${openCi}"]`);
    if (el) setTimeout(() => { el.scrollIntoView({block: "start", behavior: "smooth"}); el.classList.add("flash"); }, 60);
  }
}

// ------------------------------------------------------------------ practical questions (window.PRACTICE, e.g. syllabus/practice-cma-int.js)
const PRAC = () => window.PRACTICE || {};
const STATUS = {attempted: "Attempted", revise: "Need revision", confident: "Confident"};
const pslug = code => code.toLowerCase().replace(/[^a-z0-9]+/g, "");
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const numCell = s => /^[(−-]?(₹|US\$)?\s?[\d,]+(\.\d+)?%?\)?(\s?[AF])?$/.test(String(s).trim());
function blocks(list) {
  return (list || []).map(b => {
    if (typeof b === "string") return `<p>${rich(b)}</p>`;
    if (b.h) return `<h4 class="qh">${rich(b.h)}</h4>`;
    if (b.l) return `<ul class="ql">${b.l.map(x => `<li>${rich(x)}</li>`).join("")}</ul>`;
    if (b.t) return `<div class="scroll"><table class="qt"><tr>${b.t[0].map(c => `<th>${rich(c)}</th>`).join("")}</tr>${b.t.slice(1).map(r =>
      `<tr${/^(total|net cash|net working|profit as per financial|profit$|balance as per pass|tax payable|tax on the gain|payable in cash|rounded)/i.test(r[0]) ? ' class="tot"' : ""}>${r.map(c => `<td class="${numCell(c) ? "n" : ""}">${rich(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
    return "";
  }).join("");
}
function pracStatus() { return store.get("prac.status", {}); }
function setPracStatus(id, st) {
  const s = pracStatus();
  if (s[id] === st) delete s[id]; else s[id] = st;
  store.set("prac.status", s);
  const y = scrollY; renderPractice(route.rest); scrollTo(0, y);
}
function pracFor(cid, st, p) {
  for (const [key, set] of Object.entries(PRAC())) {
    if (set.course !== cid) continue;
    const pp = set.papers.find(x => x.stage === st.id && x.code === p.code);
    if (pp) return {key, paper: pp};
  }
  return null;
}
function moduleHref(set, pp, q) {
  const c = SYL()[set.course]; if (!c) return null;
  const st = c.stages.find(s => s.id === pp.stage); if (!st) return null;
  const pi = st.papers.findIndex(x => x.code === pp.code); if (pi < 0) return null;
  const ci = st.papers[pi].chapters.findIndex(ch => ch.title.startsWith(q.module));
  return `#/syllabus/${set.course}/${st.id}/${pi}${ci >= 0 ? "/" + ci : ""}`;
}
function renderPractice(rest = []) {
  const sets = PRAC(), key = rest[0] && sets[rest[0]] ? rest[0] : Object.keys(sets)[0];
  if (!key) { $("#app").innerHTML = `<div class="card"><h2>No practice sets</h2><p>The practice data file could not be loaded.</p></div>`; return; }
  const set = sets[key], stat = pracStatus(), filter = store.get("prac.filter", "all");
  const pp = set.papers.find(p => pslug(p.code) === rest[1]) || set.papers[0];
  const all = set.papers.flatMap(p => p.questions), mine = pp.questions;
  const count = (qs, s) => qs.filter(q => stat[q.id] === s).length;
  const shown = mine.filter(q => filter === "all" || (filter === "todo" ? !stat[q.id] : stat[q.id] === filter));
  const done = all.filter(q => stat[q.id]).length;
  $("#app").innerHTML = `<div class="head"><h1>${esc(set.title)}</h1><p>${esc(set.term)} · ${all.length} questions with full solutions</p></div>
    <div class="card"><div class="kpis" style="margin:0">${kpi("Attempted (all papers)", `${done} / ${all.length}`)}${kpi("Confident", count(all, "confident"))}${kpi("Need revision", count(all, "revise"))}</div>
      ${bar({done, total: all.length}, "big")}
      ${set.notes.map(n => `<p class="note" style="margin:6px 0 0">${rich(n)}</p>`).join("")}
      <div class="refs">${set.official.map(o => `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.label)} ↗</a>`).join("")}</div></div>
    <div class="tabs" style="margin-top:14px">${set.papers.map(p => `<button class="${p === pp ? "on" : ""}" onclick="location.hash='#/practice/${key}/${pslug(p.code)}'">${esc(p.code.replace("Paper ", "P"))} ${esc(p.title.split(" ")[0])}${p.questions.every(q => stat[q.id]) ? " ✓" : ""}</button>`).join("")}</div>
    <div class="pfilter">${[["all", "All"], ["todo", "Not attempted"], ["revise", "Need revision"], ["confident", "Confident"]].map(([k, l]) =>
      `<button class="${filter === k ? "on" : ""}" onclick="store.set('prac.filter','${k}');renderPractice(route.rest)">${l}</button>`).join("")}</div>
    <h2 style="margin:6px 0 10px">${esc(pp.code)}: ${esc(pp.title)}</h2>
    ${shown.length ? shown.map(q => {
      const n = mine.indexOf(q) + 1, href = moduleHref(set, pp, q), s = stat[q.id];
      return `<article class="card qcard" id="q-${esc(q.id)}">
        <div class="qmeta"><span class="cno">Q${n}</span><span class="tag">${q.marks} marks · ~${Math.round(q.marks * 1.8)} min</span><span class="tag lvl">${esc(q.level)}</span>${s ? `<span class="tag st-${s}">${STATUS[s]}</span>` : ""}</div>
        <h3>${esc(q.title)}</h3>
        <p class="note" style="margin:2px 0 8px">Module: ${href ? `<a href="${href}">${esc(q.module)}</a>` : esc(q.module)}</p>
        <div class="qbody">${blocks(q.q)}</div>
        <details class="sol"><summary>Show solution</summary><div class="qbody">${blocks(q.s)}</div></details>
        <div class="qbtns">${Object.entries(STATUS).map(([k, l]) => `<button class="btn ${s === k ? "" : "ghost"}" onclick="setPracStatus('${q.id}','${k}')">${l}</button>`).join("")}</div>
      </article>`;
    }).join("") : `<p class="note">No questions match this filter in ${esc(pp.code)}.</p>`}`;
}

// Home screen card: the student's course, last group and progress.
function sylHomeCard() {
  const cid = store.get("syl.course", null), c = cid && SYL()[cid];
  if (!c) return `<a class="card mysyl" href="#/syllabus"><div class="ic">${icon("book")}</div><div><h3>Set up your syllabus</h3><p class="note">Choose CA, CMA or CS to track your syllabus chapter by chapter.</p></div></a>`;
  const st = c.stages.find(s => s.id === (store.get("syl.stage", {})[cid])) || null;
  if (!st) return `<a class="card mysyl c-${cid}" href="#/syllabus/${cid}"><div class="cbadge">${esc(c.short)}</div><div><h3>${esc(c.name)}</h3><p class="note">${esc(c.scheme)} · choose your level and group</p></div></a>`;
  const r = stageProgress(cid, st);
  return `<a class="card mysyl c-${cid}" href="#/syllabus/${cid}/${st.id}"><div class="cbadge">${esc(c.short)}</div>
    <div style="flex:1;min-width:0"><h3>${esc(c.short)} ${esc(stageName(st))}</h3><p class="note">${r.done}/${r.total} topics done · ${pctOf(r)}%</p>${bar(r)}</div></a>`;
}
