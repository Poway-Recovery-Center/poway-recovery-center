import { getCalendar, getMyBookings, bookSession, updateSession, cancelSession } from './api/schedule.js';

// Meeting schedule: every meeting, spot count and reservation comes from the backend API.
// The page only keeps track of which week and day are being viewed (?date=YYYY-MM-DD opens a day).
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const range = $("week-range"), dayTabs = $("day-tabs"), table = $("day-table"), status = $("schedule-status");
  const prev = $("prev-week"), thisWeek = $("this-week"), next = $("next-week");
  const mineList = $("my-bookings-list"), source = $("schedule-source");
  const REFRESH_MS = 5 * 60 * 1000;
  let today = null, weekStart = null, selected = null, data = null, myBookings = [];

  // "YYYY-MM-DD" date math in UTC so the browser's time zone never shifts a day
  const toDate = iso => new Date(iso + "T00:00:00Z");
  const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const sundayOf = iso => addDays(iso, -toDate(iso).getUTCDay());
  const fmt = (iso, opts) => toDate(iso).toLocaleDateString(undefined, { timeZone: "UTC", ...opts });
  const plural = n => `${n} spot${n === 1 ? "" : "s"}`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, classes, onClick) {
    const b = el("button", "prc__btn " + classes, text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  prev.addEventListener("click", () => show(addDays(weekStart, -7)));
  next.addEventListener("click", () => show(addDays(weekStart, 7)));
  thisWeek.addEventListener("click", () => { selected = today; show(sundayOf(today)); });

  async function load() {
    try {
      if (!today) {
        today = (await getCalendar(undefined, 1)).today;
        const asked = new URLSearchParams(location.search).get("date");
        selected = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked >= today ? asked : today;
        weekStart = sundayOf(selected);
      }
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
      table.replaceChildren(el("p", "schedule__empty", "The schedule couldn't be loaded."));
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
    const sameMonth = weekStart.slice(5, 7) === end.slice(5, 7);
    range.textContent = `${fmt(weekStart, { month: "long", day: "numeric" })} – ${sameMonth ? fmt(end, { day: "numeric" }) : fmt(end, { month: "long", day: "numeric" })}, ${end.slice(0, 4)}`;
    prev.disabled = weekStart <= sundayOf(today);
    next.disabled = weekStart > data.booking_window_end;
    thisWeek.disabled = weekStart === sundayOf(today);

    // Day tabs
    dayTabs.replaceChildren(...data.days.map(day => {
      const tab = el("button", "tabs__tab schedule__tab");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", day.date === selected);
      tab.setAttribute("aria-controls", "day-panel");
      tab.tabIndex = day.date === selected ? 0 : -1;
      tab.classList.toggle("is-past", day.is_past);
      tab.append(el("span", "schedule__tab-day", day.is_today ? "Today" : day.day_name.slice(0, 3)),
        el("span", "schedule__tab-date", fmt(day.date, { month: "short", day: "numeric" })));
      if (day.sessions.some(s => s.booked_by_me)) tab.append(el("span", "schedule__tab-dot", "Reserved"));
      tab.addEventListener("click", () => { selected = day.date; render(); });
      tab.addEventListener("keydown", e => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        const i = data.days.indexOf(day) + (step || 0);
        if (step && data.days[i]) { e.preventDefault(); selected = data.days[i].date; render(); dayTabs.children[i].focus(); }
      });
      return tab;
    }));

    renderDay(data.days.find(d => d.date === selected) || data.days[0]);
    renderMine();

    const synced = data.last_synced ? new Date(data.last_synced).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "not yet";
    const link = el("a", null, "North County San Diego AA"); link.href = data.source_url; link.target = "_blank"; link.rel = "noopener";
    source.replaceChildren("Meeting times come from ", link, `. Last updated ${synced}.`);
    if (data.sync_error) source.append(" The directory can't be reached right now, so this is the last saved schedule.");
  }

  function renderDay(day) {
    const rows = [];
    const head = el("div", "schedule__row schedule__row--head");
    ["Time", "Meeting", "Spots", ""].forEach(h => head.append(el("span", null, h)));
    rows.push(head);
    if (!day.sessions.length) rows.push(el("p", "schedule__empty", "No meetings at the center this day."));
    day.sessions.forEach(s => rows.push(sessionRow(s, day)));
    table.replaceChildren(...rows);
  }

  function sessionRow(s, day) {
    const row = el("div", "schedule__row" + (s.started ? " is-past" : "") + (s.booked_by_me ? " is-mine" : ""));

    const time = el("div", "schedule__time");
    time.append(el("strong", null, s.start_formatted), el("span", null, `to ${s.end_formatted}`));

    const info = el("div", "schedule__info");
    info.append(el("h3", null, s.name));
    const meta = el("div", "tags");
    if (s.attendance) meta.append(el("span", "tag", s.attendance));
    s.types.forEach(t => meta.append(el("span", "tag", t)));
    info.append(meta, el("p", "schedule__where", s.location));
    if (s.notes) {
      const notes = el("details", "schedule__notes");
      notes.append(el("summary", null, "Location & Zoom details"), el("p", null, s.notes));
      info.append(notes);
    }

    const spots = el("div", "schedule__spots");
    if (s.started) spots.append(el("span", null, "Started"));
    else {
      spots.append(el("strong", null, s.spots_left), el("span", null, ` of ${s.capacity} left`));
      const bar = el("meter", "schedule__meter"); bar.max = s.capacity; bar.value = s.capacity - s.spots_left;
      spots.append(bar);
    }

    const actions = el("div", "schedule__actions");
    row.append(time, info, spots, actions);

    if (!data.logged_in) {
      if (!s.started && day.bookable) {
        const login = el("a", "prc__btn accent", "Log in to reserve"); login.href = "login.html";
        actions.append(login);
      }
      return row;
    }
    // Most spots this person can hold here: the per-person limit, or what's left plus what they already have
    const most = Math.min(s.max_spots_per_user, s.my_spots + s.spots_left);

    if (s.booked_by_me) {
      if (s.started) { actions.append(el("span", "schedule__mine", `You reserved ${plural(s.my_spots)}`)); return row; }
      actions.append(el("span", "schedule__mine", "You're going"),
        stepper(s.my_spots, most, n => act(null, () => updateSession(s.id, s.date, n))),
        button("Cancel", "small alert-red", e => act(e.currentTarget, () => cancelSession(s.id, s.date))));
      return row;
    }

    if (s.started || !day.bookable || s.spots_left === 0) {
      const reason = s.started ? "" : !day.bookable ? "Opens later" : "Full";
      if (reason) { const b = button(reason, "", null); b.disabled = true; actions.append(b); }
      return row;
    }
    let count = 1;
    const reserve = button("Reserve", "accent fill", e => act(e.currentTarget, () => bookSession(s.id, s.date, count)));
    actions.append(stepper(count, most, n => { count = n; reserve.textContent = n === 1 ? "Reserve" : `Reserve ${n}`; }), reserve);
    return row;
  }

  // − n + control for a spot count between 1 and max
  function stepper(value, max, onChange) {
    const wrap = el("div", "stepper");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Number of spots");
    const minus = button("−", "small", null), plus = button("+", "small", null), count = el("output", null, value);
    minus.setAttribute("aria-label", "One fewer spot"); plus.setAttribute("aria-label", "One more spot");
    const update = () => { count.textContent = value; minus.disabled = value <= 1; plus.disabled = value >= max; };
    minus.addEventListener("click", () => { value--; update(); onChange(value); });
    plus.addEventListener("click", () => { value++; update(); onChange(value); });
    update();
    wrap.append(minus, count, plus);
    return wrap;
  }

  async function act(btn, request) {
    if (btn) btn.disabled = true;
    try { await request(); } catch (err) { status.textContent = err.message; }
    await load();
  }

  function renderMine() {
    if (!data.logged_in) {
      const login = el("a", "prc__btn accent fill", "Log in"); login.href = "login.html";
      const signup = el("a", "prc__btn", "Create an account"); signup.href = "signup.html";
      const links = el("div", "prc__links"); links.append(login, signup);
      mineList.replaceChildren(el("p", "small", "Log in to reserve spots and see them here."), links);
      return;
    }
    if (!myBookings.length) { mineList.replaceChildren(el("p", "small muted", "No upcoming reservations yet.")); return; }
    const list = el("ul", "mine");
    myBookings.forEach(b => {
      const item = el("li"), jump = el("button", "mine__item");
      jump.type = "button";
      jump.append(el("strong", null, `${fmt(b.date, { weekday: "short", month: "short", day: "numeric" })} · ${b.start_formatted}`),
        el("span", null, b.name + (b.my_spots > 1 ? ` · ${plural(b.my_spots)}` : "")));
      jump.addEventListener("click", () => { selected = b.date; show(sundayOf(b.date)); });
      item.append(jump); list.append(item);
    });
    mineList.replaceChildren(list);
  }

  load();
  // Keep spots current and roll over to the next day without a page reload
  setInterval(load, REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
});
