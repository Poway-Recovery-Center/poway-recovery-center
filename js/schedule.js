import { getCalendar, getMyBookings, bookSession, updateSession, cancelSession } from './api/schedule.js';

// Meeting schedule: a FullCalendar month / week / day view, set up like the Open Coding Society pages
// calendar (navigation/calendar-v2.md). Every meeting, spot count and reservation comes from the backend API;
// the page only keeps track of which day is selected (?date=YYYY-MM-DD opens a day).
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const calendarEl = $("calendar"), heading = $("day-heading"), table = $("day-table"), status = $("schedule-status");
  const mineList = $("my-bookings-list"), source = $("schedule-source");
  const REFRESH_MS = 5 * 60 * 1000;
  const MAX_DAYS = 42;  // the backend sends at most six weeks, one full month grid
  let today = null, selected = null, focusSession = null, data = null, myBookings = [];
  const daysByDate = {};

  // "YYYY-MM-DD" date math in UTC so the browser's time zone never shifts a day
  const toDate = iso => new Date(iso + "T00:00:00Z");
  const fmt = (iso, opts) => toDate(iso).toLocaleDateString(undefined, { timeZone: "UTC", ...opts });
  const plural = n => `${n} spot${n === 1 ? "" : "s"}`;
  // FullCalendar hands back local Date objects (same helper as the OCS calendar's formatDate)
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

  const asked = new URLSearchParams(location.search).get("date");
  if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)) selected = asked;
  const narrow = matchMedia("(max-width: 480px)").matches;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: narrow ? "dayGridDay" : "dayGridMonth",
    initialDate: selected || undefined,
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek,dayGridDay" },
    views: {
      dayGridMonth: { buttonText: "Month" },
      dayGridWeek: { buttonText: "Week" },
      dayGridDay: { buttonText: "Day" }
    },
    height: "auto",
    dayMaxEvents: 3,
    eventDisplay: "block",
    eventTimeFormat: { hour: "numeric", minute: "2-digit", meridiem: "short" },
    events: loadEvents,
    dayCellClassNames: arg => ymd(arg.date) === selected ? ["is-selected"] : [],
    eventDidMount: info => {
      const s = info.event.extendedProps.session;
      info.el.title = `${s.start_formatted} ${s.name} · ` + (s.started ? "Started" : `${s.spots_left} of ${s.capacity} spots left`);
    },
    datesSet: ({ view }) => {
      const first = ymd(view.currentStart), last = ymd(new Date(view.currentEnd - 1));
      if (view.type === "dayGridDay") selected = first;
      else if (!selected || selected < first || selected > last) {
        const now = today || ymd(new Date());
        selected = now >= first && now <= last ? now : first;
      }
      renderSelected();
    },
    dateClick: info => select(ymd(info.date)),
    eventClick: info => {
      info.jsEvent.preventDefault();
      select(info.event.extendedProps.session.date, info.event.id);
    }
  });

  // Events for the visible range, from /api/schedule (FullCalendar calls this on every view change and refetch)
  async function loadEvents(info, success, failure) {
    try {
      const start = ymd(info.start);
      const days = Math.min(MAX_DAYS, Math.round((info.end - info.start) / 86400000));
      data = await getCalendar(start, days);
      data.days.forEach(day => { daysByDate[day.date] = day; });
      // A new day in Poway: follow it if the viewer was looking at "today"
      if (today && data.today !== today && selected === today) selected = data.today;
      today = data.today;
      if (!selected) selected = today;
      myBookings = data.logged_in ? await getMyBookings().catch(() => []) : [];
      status.textContent = "";
      success(data.days.flatMap(day => day.sessions.map(toEvent)));
      renderSelected();
      renderMine();
      renderSource();
    } catch (err) {
      status.textContent = err.message;
      table.replaceChildren(el("p", "schedule__empty", "The schedule couldn't be loaded."));
      failure(err);
    }
  }

  function toEvent(s) {
    const classes = ["schedule__event"];
    if (s.booked_by_me) classes.push("is-mine");
    else if (s.started) classes.push("is-past");
    else if (s.spots_left === 0) classes.push("is-full");
    return {
      id: `${s.id}-${s.date}`,
      title: s.name,
      start: `${s.date}T${s.start}`,
      end: s.end > s.start ? `${s.date}T${s.end}` : undefined,
      classNames: classes,
      extendedProps: { session: s }
    };
  }

  // Show one day's meetings under the calendar, moving the calendar there if it's out of view
  function select(date, sessionKey) {
    selected = date;
    focusSession = sessionKey || null;
    renderSelected();
  }

  // The home page shows the schedule on a given day (js/features.js)
  document.addEventListener("schedule:show-date", e => select(e.detail));

  function renderSelected() {
    if (!selected) return;
    heading.textContent = selected === today ? `Today, ${fmt(selected, { month: "long", day: "numeric" })}` : fmt(selected, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    calendarEl.querySelectorAll(".fc-daygrid-day[data-date]").forEach(cell => cell.classList.toggle("is-selected", cell.dataset.date === selected));
    const day = daysByDate[selected];
    if (!day) {
      // Not fetched yet: datesSet and loadEvents render it once the calendar shows that day
      const view = calendar.view;
      if (view && (selected < ymd(view.activeStart) || selected >= ymd(view.activeEnd))) calendar.gotoDate(selected);
      table.replaceChildren(el("p", "schedule__empty", "Loading meetings…"));
      return;
    }
    renderDay(day);
    if (focusSession) {
      const row = table.querySelector(`[data-session="${focusSession}"]`);
      focusSession = null;
      if (row) { row.classList.add("is-focused"); row.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    }
  }

  function renderSource() {
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
    row.dataset.session = `${s.id}-${s.date}`;

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
    calendar.refetchEvents();
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
      jump.addEventListener("click", () => select(b.date, `${b.id}-${b.date}`));
      item.append(jump); list.append(item);
    });
    mineList.replaceChildren(list);
  }

  calendar.render();
  // The schedule panel is hidden until picked, so size the calendar whenever its box changes
  new ResizeObserver(() => calendar.updateSize()).observe(calendarEl);
  // Keep spots current and roll over to the next day without a page reload
  setInterval(() => calendar.refetchEvents(), REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) calendar.refetchEvents(); });
});
