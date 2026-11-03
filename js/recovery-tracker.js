import { getCredentials } from './api/login.js';
import { getCheckIns, saveCheckIn } from './api/checkin.js';

// Recovery tracker: four quick weekly sliders plus a short "this week I…" checklist, saved to the logged-in user's
// account (/api/checkins), with patterns (overall wellbeing, streak, area to watch, habits that line up with better weeks)
// and trend charts. The backend alerts the center's counselors when a week drops dangerously low.
document.addEventListener("DOMContentLoaded", async () => {
  // invert: a high rating is the harder one (more stress), so wellbeing flips it.
  // levels: what each slider position 1-5 means
  const METRICS = [
    {key:"mood", label:"Mood", ask:"How was your mood?", levels:["Very low", "Low", "Okay", "Good", "Great"]},
    {key:"sleep", label:"Sleep", ask:"How did you sleep?", levels:["Barely slept", "Poorly", "Okay", "Well", "Very well"]},
    {key:"connection", label:"Connection", ask:"How connected did you feel to others?", levels:["Isolated", "Distant", "Somewhat", "Connected", "Very connected"]},
    {key:"stress", label:"Stress", ask:"How stressed did you feel?", invert:true, levels:["Calm", "A little", "Somewhat", "Quite stressed", "Very stressed"]}
  ];
  // Keys match ACTIONS in the API's model/checkin.py; label finishes "This week I…", did finishes "In weeks you…"
  const ACTIONS = [
    {key:"meeting", label:"went to a meeting", did:"went to a meeting"},
    {key:"support", label:"talked to my support", did:"talked to someone who supports you"},
    {key:"exercise", label:"got some exercise", did:"got some exercise"},
    {key:"selfcare", label:"took time for myself", did:"took time for yourself"}
  ];
  const SHOWN = 8, RECENT = 4;
  const $ = s => document.querySelector(s);
  const form = $("#tracker-form"), status = $("#tracker-status"), alertBox = $("#tracker-alert");
  const say = (msg, isError) => { status.textContent = msg; status.classList.toggle("is-error", !!isError); };
  const well = (m, v) => m.invert ? 6 - v : v;
  const weekLabel = week => new Date(week + "T00:00").toLocaleDateString(undefined, {month:"short", day:"numeric"});
  const weekBefore = week => {
    const d = new Date(week + "T00:00");
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const average = list => list.reduce((a, b) => a + b, 0) / list.length;
  // Overall wellbeing 0-100: the average of the four areas, with stress flipped
  const score = c => Math.round((average(METRICS.map(m => well(m, c[m.key]))) - 1) / 4 * 100);

  // Logged out: keep the log in prompt
  const user = await getCredentials();
  if (!user) return;
  let data;
  try { data = await getCheckIns(); }
  catch (err) { $("#tracker-gate-text").textContent = `The tracker couldn't be loaded right now. ${err.message}`; return; }
  $("#tracker-gate").hidden = true;
  $("#tracker-app").hidden = false;
  $("#tracker-week").textContent = `Week of ${weekLabel(data.week)}`;

  // One 1-5 slider per metric, showing what the current position means
  const setSlider = (m, input) => {
    const v = Number(input.value);
    input.style.setProperty("--fill", `${(v - 1) * 25}%`);
    input.setAttribute("aria-valuetext", `${v} of 5, ${m.levels[v - 1]}`);
    input.closest(".tracker__metric").querySelector("output").textContent = m.levels[v - 1];
  };
  $("#tracker-metrics").replaceChildren(...METRICS.map(m => {
    const box = document.createElement("div");
    box.className = "tracker__metric";
    box.innerHTML = `<div class="tracker__metric-head"><label for="tracker-${m.key}"></label><output for="tracker-${m.key}" class="tracker__value"></output></div><input class="tracker__range" type="range" id="tracker-${m.key}" name="${m.key}" min="1" max="5" step="1" value="3">`;
    box.querySelector("label").textContent = m.ask;
    const input = box.querySelector("input");
    input.addEventListener("input", () => setSlider(m, input));
    setSlider(m, input);
    return box;
  }));

  $("#tracker-actions").replaceChildren(...ACTIONS.map(a => {
    const chip = document.createElement("label");
    chip.className = "chip";
    chip.innerHTML = `<input type="checkbox" name="actions" value="${a.key}"><span></span>`;
    chip.querySelector("span").textContent = a.label;
    return chip;
  }));

  // Start the form on this week's answers if there are any
  const thisWeek = () => data.checkins.find(c => c.week === data.week);
  if (thisWeek()) {
    METRICS.forEach(m => { form.elements[m.key].value = thisWeek()[m.key]; setSlider(m, form.elements[m.key]); });
    form.querySelectorAll("input[name=actions]").forEach(box => box.checked = thisWeek().actions.includes(box.value));
    form.note.value = thisWeek().note;
  }

  // The form stays tucked away until the check-in button opens it; it grows out of the button and shrinks back into it.
  // Two animations run in lockstep on the same timing: the drawer's height makes room in the page (so the content
  // below moves with it), while the form's clip and offset make the visible box grow from the button's exact spot.
  const openButton = $("#tracker-open"), startRow = $(".tracker__start"), drawer = $("#tracker-drawer");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const openLabel = () => thisWeek() ? "+ Update this week's check-in" : "+ Add check-in";
  const TIMING = {duration: 420, easing: "cubic-bezier(.33, 1, .68, 1)", fill: "both"};
  let running = [];

  function animateDrawer(opening, done) {
    // Clicked again mid-way: play the same motion backwards from where it is, so there's no jump
    if (running.length) {
      running.forEach(a => a.reverse());
      running[0].onfinish = () => { running.forEach(a => a.cancel()); running = []; if (done) done(); };
      return;
    }
    const gap = parseFloat(getComputedStyle(drawer.parentElement).rowGap) || 0;
    const row = startRow.getBoundingClientRect(), b = openButton.getBoundingClientRect();
    const full = form.getBoundingClientRect();
    const shut = {
      left: b.left - full.left,
      right: Math.max(full.width - (b.left - full.left) - b.width, 0),
      bottom: Math.max(full.height - row.height, 0),
    };
    const drawerFrames = [{height: "0px", marginTop: `${-gap}px`}, {height: `${full.height}px`, marginTop: "0px"}];
    const formFrames = [
      {transform: `translateY(${-row.height}px)`, clipPath: `inset(0px ${shut.right}px ${shut.bottom}px ${shut.left}px round 10px)`},
      {transform: "translateY(0px)", clipPath: "inset(0px 0px 0px 0px round 10px)"},
    ];
    // The fade runs on its own, faster than the size change: in over the first third when opening,
    // and gone by just past halfway when closing, so the box has faded out before it reaches the button
    const fadeFrames = opening
      ? [{opacity: 0}, {opacity: 1, offset: .35}, {opacity: 1}]
      : [{opacity: 1}, {opacity: 0, offset: .55}, {opacity: 0}];
    if (!opening) { drawerFrames.reverse(); formFrames.reverse(); }
    running = [drawer.animate(drawerFrames, TIMING), form.animate(formFrames, TIMING),
      form.animate(fadeFrames, {...TIMING, easing: "linear"})];
    running[0].onfinish = () => { running.forEach(a => a.cancel()); running = []; if (done) done(); };
  }

  function openForm(open) {
    openButton.setAttribute("aria-expanded", String(open));
    openButton.textContent = openLabel();
    if (open) {
      say("");
      drawer.hidden = false;
      if (!reduceMotion.matches) animateDrawer(true);
      form.querySelector("input").focus({preventScroll: true});
    } else if (drawer.hidden || reduceMotion.matches) {
      drawer.hidden = true;
    } else {
      animateDrawer(false, () => { drawer.hidden = true; });
    }
  }
  openButton.textContent = openLabel();
  openButton.addEventListener("click", () => openForm(openButton.getAttribute("aria-expanded") !== "true"));
  $("#tracker-cancel").addEventListener("click", () => { openForm(false); openButton.focus(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const body = {note:form.note.value.trim(), actions:[...form.querySelectorAll("input[name=actions]:checked")].map(box => box.value)};
    METRICS.forEach(m => body[m.key] = Number(form.elements[m.key].value));
    const send = form.querySelector("button[type=submit]");
    send.disabled = true;
    say("Saving…");
    try {
      const result = await saveCheckIn(body);
      data.checkins = data.checkins.filter(c => c.week !== result.checkin.week).concat(result.checkin).sort((a, b) => a.week.localeCompare(b.week));
      openForm(false);
      say(result.message);
      render(result.concerns);
    } catch (err) { say(err.message, true); }
    send.disabled = false;
  });

  // Concerns come from the backend right after saving; on a later visit, an alerted week still shows the box
  function showAlert(concerns) {
    const week = thisWeek();
    alertBox.hidden = !(concerns?.length || week?.alerted);
    if (alertBox.hidden) return;
    const what = concerns?.length ? `This week ${concerns.join(", ")}. ` : "";
    $("#tracker-alert-text").textContent = `${what}The center's counselors have been alerted so someone can reach out. You don't have to wait for it to pass on your own.`;
  }

  // Weeks in a row with a check-in, counting back from this week (or last week, if this one isn't in yet)
  function streak() {
    const weeks = new Set(data.checkins.map(c => c.week));
    let week = weeks.has(data.week) ? data.week : weekBefore(data.week), count = 0;
    while (weeks.has(week)) { count++; week = weekBefore(week); }
    return count;
  }

  function stat(title, value, detail) {
    const card = document.createElement("article");
    card.className = "tracker__stat";
    card.innerHTML = `<span class="tracker__label"></span><strong></strong><p class="small"></p>`;
    card.querySelector(".tracker__label").textContent = title;
    card.querySelector("strong").textContent = value;
    card.querySelector("p").textContent = detail;
    return card;
  }

  // The habit that lines up most with better weeks: average wellbeing in weeks with vs without it
  function whatHelps(checkins) {
    const best = ACTIONS.map(a => {
      const withIt = checkins.filter(c => c.actions.includes(a.key)).map(score);
      const without = checkins.filter(c => !c.actions.includes(a.key)).map(score);
      if (withIt.length < 2 || without.length < 2) return null;
      return {a, withIt:Math.round(average(withIt)), without:Math.round(average(without))};
    }).filter(f => f && f.withIt - f.without >= 5).sort((x, y) => (y.withIt - y.without) - (x.withIt - x.without))[0];
    if (best) return `What seems to help: in weeks you ${best.a.did}, your wellbeing averaged ${best.withIt} vs ${best.without} in weeks you didn't.`;
    return checkins.length < 4 ? "After a few more check-ins, you'll see which habits line up with your better weeks." : "";
  }

  function insights(checkins) {
    const latest = checkins.at(-1);
    const before = checkins.slice(-RECENT - 1, -1);
    const now = score(latest), usual = before.length ? Math.round(average(before.map(score))) : null;
    const change = usual == null ? "All four areas combined." :
      Math.abs(now - usual) < 5 ? `About your usual (${usual}).` :
        `${now > usual ? "▲" : "▼"} ${Math.abs(now - usual)} from your recent average.`;

    const weeks = streak();
    const streakText = !weeks ? "Check in this week to start one." : thisWeek() ? "This week is in." : "Check in this week to keep it going.";

    // The hardest area over the last few check-ins, by average wellbeing
    const recent = checkins.slice(-RECENT);
    const worst = METRICS.map(m => ({m, wellbeing:average(recent.map(c => well(m, c[m.key]))), typical:m.levels[Math.round(average(recent.map(c => c[m.key]))) - 1]}))
      .sort((a, b) => a.wellbeing - b.wellbeing)[0];
    const watch = worst.wellbeing < 3.5 ? stat("Keep an eye on", worst.m.label, `Mostly “${worst.typical.toLowerCase()}” lately.`)
      : stat("Keep an eye on", "Nothing", "Every area has been okay or better.");

    $("#tracker-insights").replaceChildren(
      stat("Wellbeing", `${now}/100`, change),
      stat("Streak", `${weeks} week${weeks === 1 ? "" : "s"}`, streakText),
      watch
    );
    const helps = $("#tracker-helps");
    helps.textContent = whatHelps(checkins);
    helps.hidden = !helps.textContent;
  }

  const SVG = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => { const n = document.createElementNS(SVG, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; };

  // One line chart: {label, get, min, max, ticks, unit, invert, wide}
  function chart(spec, checkins) {
    const {min = 1, max = 5, ticks = [1, 3, 5], unit = "/5"} = spec;
    const card = document.createElement("article");
    card.className = "tracker__chart" + (spec.wide ? " tracker__chart--wide" : "");
    const value = spec.get;
    const latest = checkins.at(-1), previous = checkins.at(-2);
    const diff = previous ? value(latest) - value(previous) : 0;
    const better = spec.invert ? diff < 0 : diff > 0;
    card.innerHTML = `<header><h4></h4><div class="tracker__now"><strong></strong><span class="small"></span></div></header>`;
    card.querySelector("h4").textContent = spec.label;
    card.querySelector("strong").textContent = `${value(latest)}${unit}`;
    const change = card.querySelector(".tracker__now span");
    change.textContent = !previous ? "first week" : diff === 0 ? "no change" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}`;
    if (diff) change.classList.add(better ? "is-better" : "is-worse");

    const W = spec.wide ? 600 : 230, H = spec.wide ? 130 : 100, L = 28, R = 10, T = 10, B = 22;
    const x = i => checkins.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (checkins.length - 1);
    const y = v => T + (max - v) * (H - T - B) / (max - min);
    const svg = svgEl("svg", {viewBox:`0 0 ${W} ${H}`, class:"tracker__svg", role:"img", "aria-label":`${spec.label} over the last ${checkins.length} check-ins: ${checkins.map(value).join(", ")}`});
    ticks.forEach(v => {
      svg.append(svgEl("line", {x1:L, x2:W - R, y1:y(v), y2:y(v), class:"tracker__grid"}));
      const label = svgEl("text", {x:L - 8, y:y(v) + 4, class:"tracker__axis", "text-anchor":"end"}); label.textContent = v; svg.append(label);
    });
    [...new Set([0, checkins.length - 1])].forEach(i => {
      const label = svgEl("text", {x:x(i), y:H - 6, class:"tracker__axis", "text-anchor":checkins.length === 1 ? "middle" : i ? "end" : "start"});
      label.textContent = weekLabel(checkins[i].week); svg.append(label);
    });
    if (checkins.length > 1) svg.append(svgEl("polyline", {points:checkins.map((c, i) => `${x(i)},${y(value(c))}`).join(" "), class:"tracker__line"}));
    // Overall wellbeing: hovering or focusing a dot shows that week's full check-in in a pop-up
    const popup = spec.details ? Object.assign(document.createElement("div"), {className: "tracker__tip", hidden: true}) : null;
    checkins.forEach((c, i) => {
      const dot = svgEl("g", {class:"tracker__dot", tabindex:"0"});
      if (popup) {
        dot.setAttribute("aria-label", `Week of ${weekLabel(c.week)}: wellbeing ${value(c)}${unit}`);
        const showTip = () => {
          popup.replaceChildren(weekDetails(c));
          popup.hidden = false;
          const d = dot.querySelector(".tracker__point").getBoundingClientRect(), box = card.getBoundingClientRect();
          const left = Math.min(Math.max(d.left + d.width / 2 - box.left, 110), box.width - 110);
          popup.style.left = `${left}px`;
          popup.style.top = `${d.top - box.top}px`;
        };
        dot.addEventListener("mouseenter", showTip);
        dot.addEventListener("focus", showTip);
        dot.addEventListener("mouseleave", () => popup.hidden = true);
        dot.addEventListener("blur", () => popup.hidden = true);
      } else {
        const tip = svgEl("title", {}); tip.textContent = `Week of ${weekLabel(c.week)}: ${value(c)}${unit}`;
        dot.append(tip);
      }
      dot.append(svgEl("circle", {cx:x(i), cy:y(value(c)), r:12, class:"tracker__hit"}), svgEl("circle", {cx:x(i), cy:y(value(c)), r:4.5, class:"tracker__point"}));
      svg.append(dot);
    });
    card.append(svg);
    if (popup) card.append(popup);
    return card;
  }

  // One week's check-in for the wellbeing pop-up: score, each area, what they did and their note
  function weekDetails(c) {
    const box = document.createDocumentFragment();
    const add = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; n.textContent = text; box.append(n); return n; };
    add("strong", "tracker__tip-week", `Week of ${weekLabel(c.week)}`);
    add("span", "tracker__tip-score", `Wellbeing ${score(c)}/100`);
    const list = add("dl", "tracker__tip-list", "");
    METRICS.forEach(m => {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = m.label; dd.textContent = `${m.levels[c[m.key] - 1]} (${c[m.key]}/5)`;
      list.append(dt, dd);
    });
    const did = ACTIONS.filter(a => c.actions.includes(a.key)).map(a => a.label);
    if (did.length) add("p", "tracker__tip-did", `I ${did.join(", ")}`);
    if (c.note) add("p", "tracker__tip-note", `“${c.note}”`);
    return box;
  }

  function render(concerns) {
    const checkins = data.checkins, latest = checkins.at(-1);
    $("#tracker-history").hidden = !latest;
    showAlert(concerns);
    if (!latest) {
      $("#tracker-insights").replaceChildren();
      $("#tracker-helps").hidden = true;
      $("#tracker-charts").innerHTML = `<div class="reflection-empty"><strong>No check-ins yet.</strong>Add your first check-in above and your patterns will show up here.</div>`;
      return;
    }
    insights(checkins);
    const shown = checkins.slice(-SHOWN);
    const specs = [{label:"Overall wellbeing", get:score, min:0, max:100, ticks:[0, 50, 100], unit:"/100", wide:true, details:true},
      ...METRICS.map(m => ({label:m.label, get:c => c[m.key], invert:m.invert}))];
    $("#tracker-charts").replaceChildren(...specs.map(spec => chart(spec, shown)));

    const table = $("#tracker-table");
    table.innerHTML = `<thead><tr><th>Week of</th>${METRICS.map(m => `<th>${m.label}</th>`).join("")}<th>I…</th><th>Note</th></tr></thead><tbody></tbody>`;
    table.tBodies[0].append(...[...checkins].reverse().map(c => {
      const row = document.createElement("tr");
      const did = ACTIONS.filter(a => c.actions.includes(a.key)).map(a => a.label).join(", ");
      [weekLabel(c.week), ...METRICS.map(m => c[m.key]), did || "–", c.note].forEach(v => { const td = document.createElement("td"); td.textContent = v; row.append(td); });
      return row;
    }));
  }
  render();
});
