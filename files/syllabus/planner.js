// Study & exam planner: turns the official syllabus (window.SYLLABUS) and the student's exam timetable into a
// phased, day-by-day plan (first reading -> revision + practice -> mock tests -> exam period), tracked against
// the syllabus ticks. Uses helpers from index.html ($, $$, store, kpi, icon) and syllabus-ui.js.
const PHASES = {learn: "First reading", revise: "Revision & practice", mock: "Mock tests", exam: "Exam period"};
const CONF = {weak: ["Weak", 1.4], avg: ["Average", 1], strong: ["Strong", 0.7]};
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const diffD = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const nice = s => parseD(s).toLocaleDateString("en-IN", {weekday: "short", day: "numeric", month: "short", year: "numeric"});
const half = h => Math.round(h * 2) / 2;
const fmtH = h => (Math.round(h * 10) / 10).toString().replace(/\.0$/, "") + " h";
const todayISO = () => iso(new Date());

function planCfg() { return store.get("plan.cfg", null); }
function planData() { return store.get("plan.data", null); }

// Papers in the chosen groups that count (core papers + the elective the student picked in the syllabus).
function planPapers(cfg) {
  const c = SYL()[cfg.cid]; if (!c) return [];
  return c.stages.filter(s => cfg.stages.includes(s.id)).flatMap(st => countedPapers(cfg.cid, st).map(p => {
    const pk = `${st.id}|${p.code}`, ex = (cfg.exams || {})[pk] || {};
    return {pk, st, p, pi: st.papers.indexOf(p), conf: (cfg.conf || {})[pk] || "avg", date: ex.date || "", time: ex.time || ""};
  }));
}
const pname = x => `${x.p.code}: ${x.p.title}`;
const shortName = x => `${x.p.code.replace("Paper ", "P")} ${x.p.abbr || x.p.title.split(" ").slice(0, 2).join(" ")}`;

// ------------------------------------------------------------------ plan builder
function buildPlan(cfg, from) {
  const papers = planPapers(cfg).sort((a, b) => a.date.localeCompare(b.date));
  const done = sylDone();
  const firstExam = papers[0].date, lastStudy = addD(firstExam, -2);
  const hoursOn = d => { const wd = parseD(d).getDay(); return (cfg.off || []).includes(wd) ? 0 : (wd === 0 || wd === 6 ? +cfg.hWeekend : +cfg.hWeek); };
  const days = [];
  for (let d = from; d <= lastStudy; d = addD(d, 1)) days.push({d, h: hoursOn(d), phase: "learn", items: []});
  const totalH = days.reduce((s, x) => s + x.h, 0);

  // Every paper carries the same marks, so each gets an equal base share scaled by confidence. Within a paper, chapters
  // share it by the institute's weightage where every chapter has one, otherwise by their number of topics.
  // 'left' is the part not yet ticked in the syllabus (first reading); 'all' is the whole chapter (revision).
  const units = papers.map(x => {
    const mult = CONF[x.conf][1], lv = paperLeaves(cfg.cid, x.st, x.p);
    const useW = lv.every(({ci}) => x.p.chapters[ci].weight);
    const raw = lv.map(({ci, leaves}) => useW ? x.p.chapters[ci].weight : Math.max(1, leaves.length));
    const sum = raw.reduce((s, v) => s + v, 0) || 1;
    return lv.map(({ci, leaves}, k) => {
      const share = mult * raw[k] / sum, left = leaves.filter(id => !done[id]).length;
      return {x, ci, all: share, left: share * left / Math.max(1, leaves.length)};
    });
  });
  const effAll = units.flat().reduce((s, u) => s + u.all, 0), effLeft = units.flat().reduce((s, u) => s + u.left, 0);
  let learnShare = 0.6 * (effAll ? effLeft / effAll : 0);
  let mockH = Math.max(totalH * 0.15, Math.min(totalH * 0.3, papers.length * 4));
  let learnH = totalH * learnShare, reviseH = Math.max(0, totalH - learnH - mockH);
  // phases by cumulative hours
  let cum = 0;
  days.forEach(x => { x.phase = cum < learnH ? "learn" : cum < learnH + reviseH ? "revise" : "mock"; cum += x.h; });

  // generic filler: each day takes the two papers that are furthest behind, 60/40 split
  const fill = (dayList, queues, type) => {
    const tot = queues.map(q => q.reduce((s, u) => s + u.h, 0));
    const rem = [...tot];
    const take = (day, i, hours) => {            // returns the hours this paper could not use
      let block = hours;
      while (block > 0.01 && queues[i].length) {
        const u = queues[i][0], h = Math.min(block, u.h);
        const prev = day.items.find(it => it.pk === u.pk && it.ci === u.ci && it.type === (u.type || type));
        if (prev) prev.h += h; else day.items.push({type: u.type || type, pk: u.pk, ci: u.ci, label: u.label, h});
        u.h -= h; block -= h; rem[i] -= h;
        if (u.h <= 0.01) queues[i].shift();
      }
      return block;
    };
    dayList.forEach(day => {
      const spare = day.h - day.items.reduce((a, it) => a + it.h, 0);
      if (spare <= 0.01) return;
      const order = queues.map((q, i) => i).filter(i => rem[i] > 0.01).sort((a, b) => rem[b] / (tot[b] || 1) - rem[a] / (tot[a] || 1));
      if (!order.length) return;
      const pick = spare >= 3 ? order.slice(0, 2) : order.slice(0, 1);      // two papers a day when there is time for both
      const first = pick.length > 1 ? half(spare * 0.6) : spare;
      let unused = take(day, pick[0], first);
      if (pick.length > 1) unused = take(day, pick[1], spare - first + unused);
      for (const i of order.slice(pick.length)) { if (unused <= 0.01) break; unused = take(day, i, unused); }
    });
    return queues;
  };

  // 1) first reading
  const learnDays = days.filter(x => x.phase === "learn");
  let lq = units.map(us => us.filter(u => u.left > 0).map(u => ({pk: u.x.pk, ci: u.ci, h: learnH * u.left / (effLeft || 1)})));
  lq = fill(learnDays, lq, "learn");
  // anything left over (rounding) spills into the first revision days as reading
  const reviseDays = days.filter(x => x.phase === "revise");
  if (lq.some(q => q.length)) fill(reviseDays, lq, "learn");
  // 2) revision: 70% chapter revision, 30% practice questions / MTPs, per paper in proportion to its size
  const revBudget = reviseDays.reduce((s, x) => s + x.h, 0) - reviseDays.reduce((s, x) => s + x.items.reduce((a, it) => a + it.h, 0), 0);
  const rq = units.filter(us => us.length).map(us => {
    const pe = us.reduce((s, u) => s + u.all, 0), ph = revBudget * pe / (effAll || 1);
    const chunks = Math.ceil(us.length / 3), q = [];
    us.forEach((u, k) => {
      q.push({pk: u.x.pk, ci: u.ci, h: ph * 0.7 * u.all / (pe || 1)});
      if (k % 3 === 2 || k === us.length - 1) q.push({pk: u.x.pk, ci: null, type: "practice", h: ph * 0.3 / chunks});   // practise after every 3 chapters
    });
    return q;
  });
  fill(reviseDays, rq, "revise");
  // 3) mock tests: per paper, a timed full paper, a review, then final revision — in exam order
  const mockDays = days.filter(x => x.phase === "mock"), perPaper = mockDays.reduce((s, x) => s + x.h, 0) / (papers.length || 1);
  const two = perPaper >= 12;                     // room for a second full mock
  const mq = papers.map(x => [{pk: x.pk, ci: null, type: "mock", label: `Full mock test${two ? " 1" : ""}, timed (3 h)`, h: Math.min(3, perPaper)},
                              {pk: x.pk, ci: null, type: "mock", label: "Check the mock against solutions; list weak areas", h: Math.min(1, Math.max(0, perPaper - 3))},
                              {pk: x.pk, ci: null, type: "final", label: "Final revision: summary notes, formulas, amendments", h: Math.max(0, perPaper - (two ? 8 : 4))},
                              ...(two ? [{pk: x.pk, ci: null, type: "mock", label: "Full mock test 2, timed (3 h)", h: 3},
                                         {pk: x.pk, ci: null, type: "mock", label: "Check mock 2; revise the gaps it shows", h: 1}] : [])]
    .filter(u => u.h > 0.05));
  // one paper at a time in exam order
  let qi = 0;
  mockDays.forEach(day => {
    let left = day.h;
    while (left > 0.01 && qi < mq.length) {
      let u = mq[qi][0]; if (!u) { qi++; continue; }
      if (/timed/.test(u.label) && left < u.h && day.h >= u.h) {
        // a timed mock needs one sitting: use the spare time for this paper's final revision, sit the mock tomorrow
        const alt = mq[qi].find(v => !/timed|Check/.test(v.label) && v.h > 0.01);
        if (!alt) break;
        u = alt;
      }
      const take = Math.min(left, u.h);
      day.items.push({type: u.type, pk: u.pk, ci: null, label: u.label, h: take});
      u.h -= take; left -= take;
      if (u.h <= 0.01) mq[qi].splice(mq[qi].indexOf(u), 1);
      if (!mq[qi].length) qi++;
    }
  });
  // 4) exam period
  const examDays = [];
  papers.forEach((x, i) => {
    const prev = i === 0 ? addD(firstExam, -2) : papers[i - 1].date;
    for (let d = addD(prev, 1); d < x.date; d = addD(d, 1)) {
      const isEve = d === addD(x.date, -1);
      if (examDays.some(e => e.d === d)) continue;
      examDays.push({d, h: isEve ? Math.min(4, hoursOn(d) || 4) : (hoursOn(d) || +cfg.hWeekend), phase: "exam",
        items: [{type: isEve ? "eve" : "final", pk: x.pk, ci: null, label: isEve ? "Light revision only: summary notes and formulas. Pack your bag, sleep early." : "Final revision for the next paper: summary notes, formulas, past MTPs", h: isEve ? Math.min(4, hoursOn(d) || 4) : (hoursOn(d) || +cfg.hWeekend)}]});
    }
    examDays.push({d: x.date, h: 0, phase: "exam", items: [{type: "exam", pk: x.pk, ci: null, label: `Exam${x.time ? " at " + x.time : ""}`, h: 3}]});
  });
  const all = [...days, ...examDays].filter(x => x.d >= from).sort((a, b) => a.d.localeCompare(b.d));
  // tidy each study day: fold slivers into the same paper's main item, then round to quarter-hours keeping the day's total
  all.forEach(day => {
    if (day.items.some(i => i.type === "exam")) return;
    day.items = day.items.filter(it => {
      if (it.h >= 0.25) return true;
      const o = day.items.find(j => j !== it && j.pk === it.pk && j.h >= 0.25);
      if (o) { o.h += it.h; return false; }
      return true;
    });
    const q = day.items.map(i => ({i, f: Math.floor(i.h * 4 + 1e-9), r: i.h * 4 - Math.floor(i.h * 4 + 1e-9)}));
    let left = Math.round(day.items.reduce((s, i) => s + i.h, 0) * 4) - q.reduce((s, x) => s + x.f, 0);
    [...q].sort((a, b) => b.r - a.r).forEach(x => { if (left > 0) { x.f++; left--; } });
    q.forEach(x => { x.i.h = x.f / 4; });
    day.items = day.items.filter(i => i.h > 0);
  });
  const plan = {from, built: todayISO(), firstExam, lastExam: papers[papers.length - 1].date, totalH,
                split: {learn: learnH, revise: reviseH, mock: mockH}, days: all, done: {}};
  allocateTopics(cfg, plan);
  return plan;
}

// The tickable topics of one chapter, in the same order (and with the same ids) as the syllabus screens use.
function chapterLeafList(cid, st, p, ci) {
  const ch = p.chapters[ci], ck = `${cid}|${st.id}|${p.code}|${ch.title}`;
  if (!ch.topics.length) return [{id: sylHash(ck), text: "Whole chapter: " + ch.title}];
  const out = [];
  ch.topics.forEach(t => {
    if (typeof t === "string") out.push({id: sylHash(`${ck}|${t}`), text: t});
    else if (t.sub && t.sub.length) t.sub.forEach(s => out.push({id: sylHash(`${ck}|${t.t}|${s}`), text: s, parent: t.t}));
    else out.push({id: sylHash(`${ck}|${t.t}`), text: t.t});
  });
  return out;
}

// Split each chapter's topics across the days it is scheduled, in proportion to the hours of each day.
// Reading covers only topics not yet ticked; revision covers the whole chapter. Stored as indexes into chapterLeafList.
function allocateTopics(cfg, plan, onlyFrom) {
  const papers = planPapers(cfg), done = sylDone(), groups = {};
  plan.days.forEach(d => {
    if (onlyFrom && d.d < onlyFrom) return;
    d.items.forEach(it => { if ((it.type === "learn" || it.type === "revise") && it.ci != null) (groups[`${it.type}#${it.pk}#${it.ci}`] = groups[`${it.type}#${it.pk}#${it.ci}`] || []).push(it); });
  });
  Object.entries(groups).forEach(([k, items]) => {
    const [type, pk, ci] = k.split("#"), x = papers.find(p => p.pk === pk);
    if (!x) return;
    const leaves = chapterLeafList(cfg.cid, x.st, x.p, +ci).map((l, i) => ({...l, i}));
    const pool = type === "learn" ? leaves.filter(l => !done[l.id]) : leaves;
    if (!pool.length) { items.forEach(it => { it.t = []; }); return; }
    const H = items.reduce((s, it) => s + it.h, 0) || 1;
    let cum = 0, start = 0;
    items.forEach((it, j) => {
      cum += it.h;
      const end = j === items.length - 1 ? pool.length : Math.round(pool.length * cum / H);
      if (end > start) { it.t = pool.slice(start, end).map(l => l.i); delete it.cont; start = end; }
      else { it.t = [pool[Math.min(start, pool.length - 1)].i]; it.cont = true; }   // a long topic carried over to this day
    });
  });
}

// ------------------------------------------------------------------ helpers for display
function planItemLink(cfg, it) {
  const x = planPapers(cfg).find(p => p.pk === it.pk); if (!x) return "";
  if (it.type === "practice") {
    const pr = typeof pracFor === "function" ? pracFor(cfg.cid, x.st, x.p) : null;
    return pr ? `#/practice/${pr.key}/${pslug(x.p.code)}` : `#/syllabus/${cfg.cid}/${x.st.id}/${x.pi}`;
  }
  return `#/syllabus/${cfg.cid}/${x.st.id}/${x.pi}${it.ci != null ? "/" + it.ci : ""}`;
}
function planItemText(cfg, it) {
  const x = planPapers(cfg).find(p => p.pk === it.pk); if (!x) return esc(it.label || "");
  const ch = it.ci != null ? x.p.chapters[it.ci] : null;
  const verb = {learn: "Read", revise: "Revise", practice: "Practise", mock: "Mock", final: "Final revision", eve: "Day before exam", exam: "EXAM"}[it.type] || "";
  const what = ch ? esc(ch.title) : it.type === "practice" ? "Practice questions, MTPs and past papers" : esc(it.label || "");
  return `<span class="pv pv-${it.type}">${verb}</span> <b>${esc(shortName(x))}</b> · ${what}`;
}
function chapterComplete(cfg, pk, ci) {
  const x = planPapers(cfg).find(p => p.pk === pk); if (!x || ci == null) return false;
  const lv = paperLeaves(cfg.cid, x.st, x.p).find(l => l.ci === ci);
  const d = sylDone();
  return lv ? lv.leaves.every(id => d[id]) : false;
}
// Topics whose (last) reading day has passed but which are not ticked in the syllabus.
function planBehind(cfg, plan) {
  const t = todayISO(), dn = sylDone(), papers = planPapers(cfg), last = {};
  plan.days.forEach(d => d.items.forEach(it => {
    if (it.type !== "learn" || !it.t) return;
    const x = papers.find(p => p.pk === it.pk); if (!x) return;
    const lv = chapterLeafList(cfg.cid, x.st, x.p, it.ci);
    it.t.forEach(i => { if (lv[i]) last[lv[i].id] = d.d; });
  }));
  return Object.entries(last).filter(([id, d]) => d < t && !dn[id]).length;
}
// "P5 ×3, P6 ×2" style summary of the topics in a set of plan items
function topicTarget(cfg, items) {
  const papers = planPapers(cfg), by = {};
  items.filter(it => it.t && it.t.length).forEach(it => { const x = papers.find(p => p.pk === it.pk); if (x) by[shortName(x).split(" ")[0]] = (by[shortName(x).split(" ")[0]] || 0) + it.t.length; });
  const n = Object.values(by).reduce((s, v) => s + v, 0);
  return n ? `${n} topic${n === 1 ? "" : "s"}: ${Object.entries(by).map(([k, v]) => `${k} ×${v}`).join(", ")}` : "";
}

// ------------------------------------------------------------------ screen
function renderPlanner(rest = []) {
  const cfg = planCfg(), plan = planData();
  if (!cfg || !plan || rest[0] === "setup") return plannerSetup(cfg);
  if (plan.days.some(d => d.items.some(i => (i.type === "learn" || i.type === "revise") && i.ci != null && !i.t))) {
    allocateTopics(cfg, plan); store.set("plan.data", plan);       // plans made before daily topics existed
  }
  const papers = planPapers(cfg), t = todayISO(), dn = sylDone();
  const tday = plan.days.find(d => d.d === t);
  const next = papers.filter(x => x.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const behind = planBehind(cfg, plan);
  const studyLeft = plan.days.filter(d => d.d >= t && d.phase !== "exam").reduce((s, d) => s + d.h, 0);
  const phaseOf = d => d ? PHASES[d.phase] : "";
  const curPhase = tday ? tday.phase : (t < plan.from ? "learn" : "exam");
  const weeks = {};
  plan.days.forEach(d => { const k = addD(d.d, -((parseD(d.d).getDay() + 6) % 7)); (weeks[k] = weeks[k] || []).push(d); });
  const c = SYL()[cfg.cid];
  const perPaper = papers.map(x => {
    const hrs = plan.days.reduce((s, d) => s + d.items.filter(i => i.pk === x.pk && i.type !== "exam").reduce((a, i) => a + i.h, 0), 0);
    const r = paperProgress(cfg.cid, x.st, x.p);
    return {x, hrs, r};
  });
  // the day's topics for a reading / revision item: reading topics tick straight into the syllabus
  const topicsBlock = (it, open) => {
    if (!it.t || !it.t.length) return "";
    const x = papers.find(p => p.pk === it.pk); if (!x) return "";
    const lv = chapterLeafList(cfg.cid, x.st, x.p, it.ci), list = it.t.map(i => lv[i]).filter(Boolean);
    const learn = it.type === "learn", got = list.filter(l => dn[l.id]).length;
    const name = l => `${l.parent ? `<small>${esc(l.parent)} › </small>` : ""}${esc(l.text)}`;
    return `<details class="ptopics"${open ? " open" : ""}><summary>${it.cont ? "Continue " : ""}${list.length} topic${list.length === 1 ? "" : "s"} ${learn ? `to cover · ${got}/${list.length} done` : "to revise"}</summary>
      ${learn ? `<div class="tlist2">${list.map(l => `<label class="tick ttick"><input type="checkbox" data-leaf="${l.id}" ${dn[l.id] ? "checked" : ""}><span>${name(l)}</span></label>`).join("")}</div>`
              : `<ul class="rlist">${list.map(l => `<li>${name(l)}</li>`).join("")}</ul>`}</details>`;
  };
  const itemRow = (d, it, idx, open) => {
    const key = `${d.d}|${idx}`, on = !!plan.done[key], href = planItemLink(cfg, it);
    return `<li class="pitem${on ? " on" : ""}"><div class="prow"><label class="tick"><input type="checkbox" data-k="${esc(key)}" ${on ? "checked" : ""}><span>${planItemText(cfg, it)}</span></label>
      <span class="ph">${it.type === "exam" ? "" : fmtH(it.h)}</span>${href ? `<a class="go" href="${href}" title="Open">Open ›</a>` : ""}</div>${topicsBlock(it, open)}</li>`;
  };
  const target = tday ? topicTarget(cfg, tday.items) : "";
  if (!plan.totalH) {
    $("#app").innerHTML = `<div class="head"><h1>Study & exam planner</h1></div><div class="card"><div class="behind" style="margin:0"><b>This plan has no study time.</b>
      ${cfg.off && cfg.off.length === 7 ? "Every day of the week is marked as a day off." : "No study hours fall before your first exam."}
      Open the settings, tick the days you study and enter your hours, then build the plan again.</div>
      <div class="pbtns"><button class="btn" onclick="location.hash='#/planner/setup'">Fix settings</button></div></div>`;
    return;
  }
  $("#app").innerHTML = `<div class="head"><h1>Study & exam planner</h1><p>${esc(c.short)} ${esc(cfg.stages.map(id => stageName(c.stages.find(s => s.id === id))).join(" + "))} · built ${nice(plan.built)} · ${fmtH(plan.totalH)} of study planned</p></div>
    <div class="grid g2">
      <div class="card today ph-${curPhase}">
        <div class="mhead"><h2>Today · ${nice(t)}</h2><span class="tag">${phaseOf(tday) || (t < plan.from ? "Plan starts " + nice(plan.from) : "Plan finished")}</span></div>
        ${target ? `<p class="target"><b>Today's target:</b> ${esc(target)} · ${fmtH(tday.items.filter(i => i.type !== "exam").reduce((s, i) => s + i.h, 0))}</p>` : ""}
        ${tday ? (tday.items.length ? `<ul class="plist2">${tday.items.map((it, i) => itemRow(tday, it, i, true)).join("")}</ul>` : `<p class="note">Rest day. Take a walk, sleep well, come back fresh.</p>`)
               : `<p class="note">${t < plan.from ? "Your plan has not started yet." : "No study scheduled today."}</p>`}
        ${tday && tday.items.some(i => i.type === "exam") ? examDayTimeline(papers.find(p => p.pk === tday.items.find(i => i.type === "exam").pk)) : ""}
      </div>
      <div class="card">
        <div class="kpis" style="margin:0">${kpi("Next exam", next ? `${diffD(t, next.date)} days` : "—")}${kpi("Study hours left", fmtH(studyLeft))}${kpi("Current phase", PHASES[curPhase])}</div>
        ${next ? `<p class="note" style="margin:8px 0 0">${esc(pname(next))} on ${nice(next.date)}${next.time ? " at " + esc(next.time) : ""}</p>` : ""}
        ${cfg.placeholder ? `<p class="snote"><b>Exam dates are placeholders</b> (one paper a day from ${nice(PRESET_FIRST_EXAM)}). When ICMAI publishes the timetable, open <a href="#/planner/setup">Change settings</a>, enter the dates and build the plan again.</p>` : ""}
        ${behind ? `<div class="behind"><b>Behind schedule:</b> ${behind} topic${behind === 1 ? " is" : "s are"} past their reading day but not ticked yet.
          Catch up, or re-plan to spread them over the days left.
          <button class="btn" onclick="replanFromToday()">Re-plan from today</button></div>` : `<p class="ontrack">On track: every topic due so far is ticked.</p>`}
        <div class="pbtns"><button class="btn ghost" onclick="location.hash='#/planner/setup'">Change settings</button><button class="btn ghost" onclick="replanFromToday()">Re-plan from today</button><button class="btn ghost" onclick="downloadPlanICS()">Add to calendar (.ics)</button></div>
      </div>
    </div>
    <div class="eyebrow">Phases</div>
    <div class="phasebar">${["learn", "revise", "mock", "exam"].map(ph => { const ds = plan.days.filter(d => d.phase === ph); if (!ds.length) return "";
      const span = diffD(plan.days[0].d, plan.days[plan.days.length - 1].d) + 1;
      return `<div class="pseg ph-${ph}" style="flex:${ds.length / span}"><b>${PHASES[ph]}</b><small>${nice(ds[0].d).replace(/, \d{4}$/, "")} – ${nice(ds[ds.length - 1].d).replace(/, \d{4}$/, "")}</small></div>`; }).join("")}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>Exam timetable</h3><div class="scroll"><table><tr><th>Paper</th><th>Date</th><th class="n">Days left</th></tr>
        ${papers.sort((a, b) => a.date.localeCompare(b.date)).map(x => `<tr><td>${esc(pname(x))}</td><td>${nice(x.date)}${x.time ? "<br><small class='note'>" + esc(x.time) + "</small>" : ""}</td><td class="n">${x.date < t ? "done" : diffD(t, x.date)}</td></tr>`).join("")}</table></div>
        <p class="note">Confirm dates and reporting time on your institute's final timetable and admit card.</p></div>
      <div class="card"><h3>Time and progress by paper</h3><div class="scroll"><table><tr><th>Paper</th><th class="n">Planned</th><th class="n">Syllabus done</th></tr>
        ${perPaper.map(({x, hrs, r}) => `<tr><td>${esc(shortName(x))} <small class="note">(${CONF[x.conf][0]})</small></td><td class="n">${fmtH(hrs)}</td><td class="n">${pctOf(r)}%</td></tr>`).join("")}</table></div>
        <p class="note">Weak papers get 40% more time, strong papers 30% less. Chapters you have ticked in the syllabus are not scheduled for first reading.</p></div>
    </div>
    <div class="eyebrow">Day-by-day plan</div>
    ${Object.entries(weeks).map(([wk, ds]) => {
      const cur = ds.some(d => d.d === t) || (t < plan.days[0].d && wk === Object.keys(weeks)[0]);
      const hrs = ds.reduce((s, d) => s + d.items.filter(i => i.type !== "exam").reduce((a, i) => a + i.h, 0), 0);
      return `<details class="card week" ${cur ? "open" : ""}><summary>Week of ${nice(wk).replace(/^\w+, /, "")}<span class="cprog">${fmtH(hrs)}${ds.some(d => d.items.some(i => i.type === "exam")) ? " · exams" : ""}</span></summary>
        ${ds.map(d => { const tg = topicTarget(cfg, d.items); return `<div class="pday ph-${d.phase}${d.d === t ? " now" : ""}"><div class="pdate"><b>${nice(d.d).split(",")[0]}</b><small>${parseD(d.d).getDate()} ${parseD(d.d).toLocaleString("en-IN", {month: "short"})}</small></div>
          <div class="pdaybody">${tg ? `<div class="dtarget">Target: ${esc(tg)}</div>` : ""}<ul class="plist2">${d.items.length ? d.items.map((it, i) => itemRow(d, it, i, false)).join("") : `<li class="pitem rest">Rest day</li>`}</ul></div></div>`; }).join("")}</details>`;
    }).join("")}
    <details class="card tips"><summary>How this plan helps you clear the exam</summary><div class="body">
      <ul><li><b>Three passes, not one.</b> First reading builds understanding; revision with practice questions fixes it; timed mock tests build speed and exam temperament.</li>
      <li><b>Two subjects a day.</b> Alternating papers keeps every subject moving, so nothing is left for the last month.</li>
      <li><b>A daily topic target.</b> Each day lists the exact syllabus topics to cover. Ticking one here ticks it in the syllabus too, so your progress and the behind-schedule check stay accurate.</li>
      <li><b>Active recall.</b> After each topic, close the book and write the key points or solve one practical. Tick it only when you can.</li>
      <li><b>Practice is part of the plan.</b> Revision days include practice questions, ICMAI/ICAI/ICSI MTPs and past papers.</li>
      <li><b>Write answers under time.</b> Do every mock in exam conditions: full duration, no breaks, no notes. Then compare with the solution and list weak areas for the final revision.</li>
      <li><b>Exam days.</b> Between papers, revise only the next paper from your summary notes. The day before is light; sleep matters more than one more chapter.</li></ul></div></details>`;
  $$(".plist2 input[data-k]").forEach(el => el.addEventListener("change", () => {
    const p = planData(); if (el.checked) p.done[el.dataset.k] = 1; else delete p.done[el.dataset.k];
    store.set("plan.data", p); el.closest(".pitem").classList.toggle("on", el.checked);
  }));
  $$(".plist2 input[data-leaf]").forEach(el => el.addEventListener("change", () => {
    setDone([el.dataset.leaf], el.checked);                         // same tick as on the syllabus screen
    const open = $$("#app details").map(x => x.open), y = scrollY;
    renderPlanner(rest);
    $$("#app details").forEach((x, i) => { if (open[i] != null) x.open = open[i]; });
    scrollTo(0, y);
  }));
}

function examDayTimeline(x) {
  if (!x) return "";
  const t0 = x.time && /^\d{1,2}:\d{2}$/.test(x.time) ? x.time : null;
  const at = m => { if (!t0) return ""; const [h, mm] = t0.split(":").map(Number); const d = new Date(2000, 0, 1, h, mm + m); return d.toTimeString().slice(0, 5); };
  const rows = [[-240, "Wake up, light breakfast. No new topics today."], [-150, "Glance at your one-page summary of formulas and key sections only."],
                [-75, "Reach the exam centre (check the reporting time printed on your admit card)."], [0, "Exam starts. Read the paper, plan time per question by marks."],
                [180, "After the exam: rest, don't discuss answers, then start light revision of the next paper."]];
  return `<div class="examday"><h3>Exam-day plan: ${esc(shortName(x))}</h3><ul>${rows.map(([m, txt]) => `<li>${t0 ? `<b>${at(m)}</b> ` : ""}${txt}</li>`).join("")}</ul>
    <p class="note"><b>Carry:</b> admit card, a valid photo ID, pens, and only the calculator and items your institute permits. Read the admit card instructions the night before.</p></div>`;
}

function replanFromToday() {
  const cfg = planCfg(); if (!cfg) return;
  const papers = planPapers(cfg), first = papers.map(p => p.date).sort()[0], t = todayISO();
  if (diffD(t, first) < 3) { alert("Your first exam is less than 3 days away. Follow the exam-period plan: revise only the next paper."); return; }
  const old = planData(), plan = buildPlan(cfg, t);
  if (old) plan.done = Object.fromEntries(Object.entries(old.done || {}).filter(([k]) => k.split("|")[0] < t));
  if (old) plan.days = [...old.days.filter(d => d.d < t), ...plan.days];
  store.set("plan.data", plan); renderPlanner([]);
}

function downloadPlanICS() {
  const cfg = planCfg(), plan = planData(); if (!cfg || !plan) return;
  const papers = planPapers(cfg), stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc2 = s => String(s).replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const text = it => { const x = papers.find(p => p.pk === it.pk); const ch = x && it.ci != null ? x.p.chapters[it.ci].title : it.label || "Practice";
    const lv = x && it.ci != null && it.t ? chapterLeafList(cfg.cid, x.st, x.p, it.ci) : [];
    const topics = it.t ? it.t.map(i => lv[i] && lv[i].text).filter(Boolean) : [];
    return `${x ? shortName(x) : ""}: ${ch}${it.type === "exam" ? "" : " (" + fmtH(it.h) + ")"}${topics.length ? "\n  - " + topics.join("\n  - ") : ""}`; };
  const ev = [];
  plan.days.filter(d => d.items.length).forEach(d => {
    const study = d.items.filter(i => i.type !== "exam");
    if (study.length) ev.push(["BEGIN:VEVENT", `UID:study-${d.d}@semi-tools`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d.d.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addD(d.d, 1).replace(/-/g, "")}`,
      `SUMMARY:${esc2(PHASES[d.phase] + ": " + study.map(i => { const x = papers.find(p => p.pk === i.pk); return x ? shortName(x) : ""; }).filter((v, k, s) => v && s.indexOf(v) === k).join(" + "))}`,
      `DESCRIPTION:${esc2(study.map(text).join("\n"))}`, "END:VEVENT"].join("\r\n"));
    d.items.filter(i => i.type === "exam").forEach(i => {
      const x = papers.find(p => p.pk === i.pk), tm = x && /^\d{1,2}:\d{2}$/.test(x.time) ? x.time : null;
      const start = tm ? `${d.d.replace(/-/g, "")}T${tm.replace(":", "").padStart(4, "0")}00` : null;
      const endH = tm ? String((+tm.split(":")[0] + 3) % 24).padStart(2, "0") + tm.split(":")[1] : null;
      ev.push(["BEGIN:VEVENT", `UID:exam-${d.d}-${i.pk.replace(/\W/g, "")}@semi-tools`, `DTSTAMP:${stamp}`,
        start ? `DTSTART:${start}` : `DTSTART;VALUE=DATE:${d.d.replace(/-/g, "")}`, start ? `DTEND:${d.d.replace(/-/g, "")}T${endH}00` : `DTEND;VALUE=DATE:${addD(d.d, 1).replace(/-/g, "")}`,
        `SUMMARY:${esc2("EXAM – " + (x ? pname(x) : ""))}`, "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Exam tomorrow", "END:VALARM", "END:VEVENT"].join("\r\n"));
    });
  });
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TaxSphere//Study Planner//EN", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
  const fname = `study-plan-${cfg.cid}-${todayISO()}.ics`;
  if (window.AndroidBridge && AndroidBridge.saveFile) { AndroidBridge.saveFile(fname, "text/calendar", ics); return; }   // Android app
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], {type: "text/calendar"}));
  a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
}

// ------------------------------------------------------------------ setup form
function plannerSetup(cfg) {
  const data = SYL(), cid = (cfg && cfg.cid) || store.get("syl.course", "cma");
  const c = data[cid] || data.cma;
  const lastStage = store.get("syl.stage", {})[c.id];
  const stages = (cfg && cfg.cid === c.id && cfg.stages) || [lastStage || c.stages[0].id];
  const draft = Object.assign({cid: c.id, stages, start: todayISO(), hWeek: 4, hWeekend: 8, off: [], conf: {}, exams: {}}, cfg && cfg.cid === c.id ? cfg : {}, {stages});
  const papers = planPapers(draft);
  const hidden = c.stages.filter(s => draft.stages.includes(s.id)).some(s => s.papers.some(p => p.elective) && !s.papers.some(p => p.elective && myElective(c.id, s, p.elective) === p.code));
  $("#app").innerHTML = `<div class="head"><h1>Build your study plan</h1><p>Enter your exam timetable and the time you can give. The plan is built from the official syllabus of your papers.</p></div>
    <form class="card" id="pform" onsubmit="return false">
      <div class="form">
        <label class="fld"><span>Course</span><select id="pcid">${SYL_ORDER.filter(k => data[k]).map(k => `<option value="${k}" ${k === c.id ? "selected" : ""}>${esc(data[k].short)} – ${esc(data[k].name)}</option>`).join("")}</select></label>
        <div class="fld"><span>Level and group(s) you are writing</span><div class="chkgrid">${c.stages.map(s => `<label class="check"><input type="checkbox" name="pst" value="${s.id}" ${draft.stages.includes(s.id) ? "checked" : ""}>${esc(stageName(s))}</label>`).join("")}</div></div>
        <label class="fld"><span>Start studying from</span><input id="pstart" type="date" value="${draft.start}"></label>
        <label class="fld"><span>Study hours on weekdays (Mon–Fri)</span><input id="phw" type="number" min="1" max="14" step="0.5" value="${draft.hWeek}"></label>
        <label class="fld"><span>Study hours on Sat & Sun</span><input id="phe" type="number" min="0" max="14" step="0.5" value="${draft.hWeekend}"></label>
        <div class="fld"><span>Study days (untick a day you want off)</span><div class="chkgrid">${WD.map((d, i) => `<label class="check"><input type="checkbox" name="pday" value="${i}" ${(draft.off || []).includes(i) ? "" : "checked"}>${d}</label>`).join("")}</div></div>
      </div>
      ${hidden ? `<p class="snote">Your elective is not included yet. Choose it on the group's syllabus page, then come back.</p>` : ""}
      <h3 style="margin-top:16px">Exam timetable and confidence</h3>
      <div class="qfill"><span class="note">Quick fill:</span> first exam <input id="qf1" type="date"> one paper every <input id="qfn" type="number" min="1" max="7" value="2" style="width:64px"> days
        <button class="btn ghost" type="button" onclick="planQuickFill()">Fill dates</button></div>
      <div class="scroll"><table class="ptab"><tr><th>Paper</th><th>Exam date</th><th>Start time</th><th>Your confidence</th></tr>
        ${papers.map(x => `<tr data-pk="${esc(x.pk)}"><td>${esc(pname(x))}<br><small class="note">${esc(stageName(x.st))}</small></td>
          <td><input type="date" class="pdate-in" value="${esc(x.date)}"></td><td><input type="time" class="ptime-in" value="${esc(x.time)}"></td>
          <td><select class="pconf-in">${Object.entries(CONF).map(([k, [l]]) => `<option value="${k}" ${x.conf === k ? "selected" : ""}>${l}</option>`).join("")}</select></td></tr>`).join("")}</table></div>
      <p class="note">Use your institute's official timetable when it is announced; until then, enter expected dates and re-plan later. Start time is optional and only used for the exam-day schedule.</p>
      <p id="perr" class="behind" hidden></p>
      <div class="pbtns"><button class="btn" type="button" onclick="savePlanner()">Build my plan</button>${planData() ? `<button class="btn ghost" type="button" onclick="location.hash='#/planner'">Cancel</button>` : ""}</div>
    </form>`;
  const redraw = () => plannerSetup(Object.assign(readPlanForm(), {cid: $("#pcid").value, stages: $("#pcid").value === c.id ? readPlanForm().stages : [data[$("#pcid").value].stages[0].id]}));
  $("#pcid").addEventListener("change", redraw);
  $$("input[name=pst]").forEach(el => el.addEventListener("change", redraw));
}
function readPlanForm() {
  const exams = {}, conf = {};
  $$(".ptab tr[data-pk]").forEach(tr => { exams[tr.dataset.pk] = {date: $(".pdate-in", tr).value, time: $(".ptime-in", tr).value}; conf[tr.dataset.pk] = $(".pconf-in", tr).value; });
  return {cid: $("#pcid").value, stages: $$("input[name=pst]:checked").map(e => e.value), start: $("#pstart").value || todayISO(),
          hWeek: +$("#phw").value || 4, hWeekend: +$("#phe").value || 0, off: $$("input[name=pday]:not(:checked)").map(e => +e.value), exams, conf};
}
function planQuickFill() {
  const d0 = $("#qf1").value, n = +$("#qfn").value || 2; if (!d0) { $("#qf1").focus(); return; }
  $$(".ptab tr[data-pk] .pdate-in").forEach((el, i) => { el.value = addD(d0, i * n); });
}
function savePlanner() {
  const cfg = readPlanForm(), err = $("#perr");
  const fail = m => { err.textContent = m; err.hidden = false; };
  if (!cfg.stages.length) return fail("Choose at least one level and group.");
  const papers = planPapers(cfg);
  if (!papers.length) return fail("No papers found for these groups.");
  if (papers.some(p => !p.date)) return fail("Enter an exam date for every paper (or use Quick fill).");
  const first = papers.map(p => p.date).sort()[0];
  if (diffD(cfg.start, first) < 14) return fail("Your first exam should be at least 14 days after the start date to build a phased plan.");
  if (new Set(papers.map(p => p.date)).size < papers.length) return fail("Two papers have the same exam date. Check the timetable.");
  if (cfg.off.length === 7) return fail("Tick at least one study day.");
  let avail = 0;                                           // study hours before the first exam
  for (let d = cfg.start; d <= addD(first, -2); d = addD(d, 1)) {
    const wd = parseD(d).getDay();
    if (!cfg.off.includes(wd)) avail += wd === 0 || wd === 6 ? cfg.hWeekend : cfg.hWeek;
  }
  if (avail < papers.length * 10) return fail(`Only ${fmtH(avail)} of study fit before your first exam; a phased plan needs at least ${papers.length * 10} h for ${papers.length} papers. Add study days or hours, or start earlier.`);
  store.set("plan.cfg", cfg);
  store.set("plan.data", buildPlan(cfg, cfg.start));
  store.set("exam", first);                                // keeps the Home countdown in step
  if (location.hash === "#/planner") renderPlanner([]); else location.hash = "#/planner";
  scrollTo(0, 0);
}

// First-launch preset for the CMA Intermediate edition (Android build): both groups, 4 h weekdays / 8 h weekends,
// every day a study day, placeholder exam dates one paper a day from PRESET_FIRST_EXAM until the student enters ICMAI's.
const PRESET_FIRST_EXAM = "2027-06-11";
function presetCmaInterPlan() {
  const cfg = {cid: "cma", stages: ["int1", "int2"], start: todayISO(), hWeek: 4, hWeekend: 8, off: [], conf: {}, exams: {}, placeholder: true};
  planPapers(cfg).forEach((x, i) => { cfg.exams[x.pk] = {date: addD(PRESET_FIRST_EXAM, i), time: ""}; cfg.conf[x.pk] = "avg"; });
  if (diffD(cfg.start, PRESET_FIRST_EXAM) < 14) return;    // too close to the exams for a phased plan: leave setup to the student
  store.set("plan.cfg", cfg);
  store.set("plan.data", buildPlan(cfg, cfg.start));
  store.set("exam", PRESET_FIRST_EXAM);
}

// Home card
function planHomeCard() {
  const cfg = planCfg(), plan = planData();
  if (!cfg || !plan) return `<a class="card mysyl" href="#/planner"><div class="ic">${icon("clock")}</div><div><h3>Make a study plan</h3><p class="note">Enter your exam dates and hours; get a day-by-day plan to the exam.</p></div></a>`;
  const t = todayISO(), d = plan.days.find(x => x.d === t);
  const first = d && d.items[0], more = d ? d.items.length - 1 : 0, tg = d ? topicTarget(cfg, d.items) : "";
  return `<a class="card mysyl" href="#/planner"><div class="ic">${icon("clock")}</div><div style="flex:1;min-width:0"><h3>Today's plan</h3>
    <p class="note">${first ? planItemText(cfg, first).replace(/<[^>]+>/g, "") + (more > 0 ? ` + ${more} more` : "") : "Rest day or plan not started"}</p>
    ${tg ? `<p class="note" style="margin:2px 0 0"><b>Target:</b> ${esc(tg)}</p>` : ""}</div></a>`;
}
