import { getCalendar, getMyBookings, bookSession, updateSession, cancelSession } from './api/schedule.js';

// Meeting calendar: every meeting, spot count and reservation comes from the backend API.
// The page only keeps track of which week and day are being viewed.
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("#schedule");
  const REFRESH_MS = 5 * 60 * 1000;
  let today = null, weekStart = null, selected = null, data = null, myBookings = [];

  // "YYYY-MM-DD" date math in UTC so the browser's time zone never shifts a day
  const toDate = iso => new Date(iso + "T00:00:00Z");
  const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const sundayOf = iso => addDays(iso, -toDate(iso).getUTCDay());
  const fmt = (iso, opts) => toDate(iso).toLocaleDateString(undefined, { timeZone: "UTC", ...opts });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  root.innerHTML = "";
  const mine = el("div", "my-bookings"); mine.hidden = true;
  const toolbar = el("div", "calendar-toolbar");
  const prev = el("button", "button button-secondary", "‹ Previous week");
  const title = el("h3", "calendar-title");
  const next = el("button", "button button-secondary", "Next week ›");
  const todayBtn = el("button", "text-button", "Jump to today");
  toolbar.append(prev, title, next);
  const week = el("div", "calendar-week");
  const dayPanel = el("div", "calendar-day");
  const status = el("p", "calendar-status"); status.setAttribute("role", "status");
  const source = el("p", "calendar-source");
  root.append(mine, toolbar, todayBtn, week, status, dayPanel, source);

  prev.addEventListener("click", () => show(addDays(weekStart, -7)));
  next.addEventListener("click", () => show(addDays(weekStart, 7)));
  todayBtn.addEventListener("click", () => { selected = today; show(sundayOf(today)); });

  async function load() {
    try {
      if (!today) { today = (await getCalendar(undefined, 1)).today; weekStart = sundayOf(today); selected = today; }
      data = await getCalendar(weekStart, 7);
      // A new day in Poway: follow it if the viewer was looking at "today"
      if (data.today !== today) {
        const following = selected === today;
        today = data.today;
        if (following) {
          selected = today;
          if (sundayOf(today) !== weekStart) { weekStart = sundayOf(today); data = await getCalendar(weekStart, 7); }
        }
      }
      myBookings = data.logged_in ? await getMyBookings().catch(() => []) : [];
      status.textContent = "";
      render();
    } catch (err) {
      status.textContent = err.message;
    }
  }

  function show(start) {
    weekStart = start;
    if (!selected || selected < weekStart || selected > addDays(weekStart, 6)) {
      selected = today >= weekStart && today <= addDays(weekStart, 6) ? today : weekStart;
    }
    load();
  }

  function render() {
    const end = addDays(weekStart, 6);
    title.textContent = `${fmt(weekStart, { month: "short", day: "numeric" })} – ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
    prev.disabled = weekStart <= sundayOf(today);
    next.disabled = weekStart > data.booking_window_end;
    todayBtn.hidden = weekStart === sundayOf(today) && selected === today;

    week.innerHTML = "";
    data.days.forEach(day => {
      const btn = el("button", "calendar-date");
      btn.classList.toggle("is-today", day.is_today);
      btn.classList.toggle("is-past", day.is_past);
      btn.classList.toggle("is-selected", day.date === selected);
      btn.setAttribute("aria-pressed", day.date === selected);
      btn.append(el("span", "calendar-weekday", day.day_name.slice(0, 3)), el("strong", null, fmt(day.date, { day: "numeric" })),
        el("span", "calendar-count", `${day.sessions.length} meeting${day.sessions.length === 1 ? "" : "s"}`));
      if (day.sessions.some(s => s.booked_by_me)) btn.append(el("span", "calendar-dot", "Reserved"));
      btn.addEventListener("click", () => { selected = day.date; render(); });
      week.appendChild(btn);
    });

    renderDay(data.days.find(d => d.date === selected) || data.days[0]);
    renderMine();
    const synced = data.last_synced ? new Date(data.last_synced).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "not yet";
    source.innerHTML = "";
    const link = el("a", null, data.source); link.href = data.source_url; link.target = "_blank"; link.rel = "noopener";
    source.append("Live schedule from ", link, ` · last updated ${synced}.`);
    if (data.sync_error) source.append(" Showing the last saved schedule while the source is unreachable.");
  }

  function renderDay(day) {
    dayPanel.innerHTML = "";
    dayPanel.append(el("h3", "calendar-day-title", `${day.day_name}, ${fmt(day.date, { month: "long", day: "numeric" })}${day.is_today ? " · Today" : ""}`));
    if (!day.sessions.length) { dayPanel.append(el("p", "calendar-empty", "No meetings are scheduled at the center this day.")); return; }
    day.sessions.forEach(s => dayPanel.append(sessionCard(s, day)));
  }

  function sessionCard(s, day) {
    const card = el("article", "meeting");
    const info = el("div");
    info.append(el("div", "meeting-meta", `${s.start_formatted} – ${s.end_formatted}${s.attendance ? " · " + s.attendance : ""}`), el("h3", null, s.name));
    if (s.types.length) {
      const tags = el("div", "meeting-tags");
      s.types.forEach(t => tags.append(el("span", "meeting-tag", t)));
      info.append(tags);
    }
    info.append(el("p", null, s.location));
    if (s.notes) {
      const notes = el("details", "meeting-notes");
      notes.append(el("summary", null, "Meeting details"), el("p", null, s.notes));
      info.append(notes);
    }

    const action = el("div", "meeting-action");
    const plural = n => `${n} spot${n === 1 ? "" : "s"}`;
    action.append(el("span", "spots", s.started ? "Already started" : `${s.spots_left} of ${s.capacity} spots available`));
    card.append(info, action);

    if (!data.logged_in) {
      const login = el("a", "button button-primary", "Log in to reserve"); login.href = "login.html";
      if (!s.started && day.bookable) action.append(login);
      return card;
    }
    // Most spots this person can hold here: the per-person limit, or what's left plus what they already have
    const most = Math.min(s.max_spots_per_user, s.my_spots + s.spots_left);

    if (s.booked_by_me) {
      if (s.started) { action.append(el("span", "meeting-reserved", `You reserved ${plural(s.my_spots)}`)); return card; }
      action.append(stepper(s.my_spots, most, "Your spots", n => act(null, () => updateSession(s.id, s.date, n))));
      const cancel = el("button", "button button-secondary", "Cancel reservation");
      cancel.addEventListener("click", () => act(cancel, () => cancelSession(s.id, s.date)));
      action.append(cancel);
      return card;
    }

    const btn = el("button", "button button-primary");
    if (s.started || !day.bookable || s.spots_left === 0) {
      btn.textContent = s.started ? "Started" : !day.bookable ? "Not open yet" : "Full";
      btn.disabled = true;
      action.append(btn);
      return card;
    }
    let count = 1;
    btn.textContent = "Reserve 1 spot";
    action.append(stepper(count, most, "Spots", n => { count = n; btn.textContent = `Reserve ${plural(n)}`; }), btn);
    btn.addEventListener("click", () => act(btn, () => bookSession(s.id, s.date, count)));
    return card;
  }

  // − n + control for a spot count between 1 and max
  function stepper(value, max, label, onChange) {
    const wrap = el("div", "spot-stepper");
    const minus = el("button", "spot-step", "−"), plus = el("button", "spot-step", "+"), count = el("output", null, value);
    minus.setAttribute("aria-label", "One fewer spot"); plus.setAttribute("aria-label", "One more spot");
    const update = () => { count.textContent = value; minus.disabled = value <= 1; plus.disabled = value >= max; };
    minus.addEventListener("click", () => { value--; update(); onChange(value); });
    plus.addEventListener("click", () => { value++; update(); onChange(value); });
    update();
    wrap.append(el("span", "spot-label", label), minus, count, plus);
    return wrap;
  }

  async function act(btn, request) {
    if (btn) btn.disabled = true;
    try { await request(); } catch (err) { status.textContent = err.message; }
    await load();
  }

  function renderMine() {
    mine.innerHTML = "";
    mine.hidden = !data.logged_in;
    if (!data.logged_in) return;
    mine.append(el("h3", null, "Your reservations"));
    if (!myBookings.length) { mine.append(el("p", "calendar-empty", "You haven't reserved any spots yet.")); return; }
    const list = el("ul");
    myBookings.forEach(b => {
      const item = el("li"), jump = el("button", "text-button", `${fmt(b.date, { weekday: "short", month: "short", day: "numeric" })} · ${b.start_formatted} · ${b.name}${b.my_spots > 1 ? ` · ${b.my_spots} spots` : ""}`);
      jump.addEventListener("click", () => { selected = b.date; show(sundayOf(b.date)); });
      item.append(jump); list.append(item);
    });
    mine.append(list);
  }

  load();
  // Keep spots current and roll over to the next day without a page reload
  setInterval(load, REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
});
