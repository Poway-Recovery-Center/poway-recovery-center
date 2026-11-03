import { getCalendar, getMyBookings, bookSession, updateSession, cancelSession } from './api/schedule.js';

// Meeting schedule, structured like the Open Coding Society calendar: a FullCalendar day grid (Week by default,
// plus Month and Day) with group buttons in its toolbar (All, AA, Al-Anon, NA...), each meeting showing its time,
// name and group, and clicking a meeting opens its details where you can reserve a spot.
// Every meeting, group, spot count and reservation comes from the backend API (/api/schedule).
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const calendarEl = $("calendar"), status = $("schedule-status"), mineList = $("my-bookings-list"), source = $("schedule-source");
  const modal = $("meeting-modal"), modalStatus = $("meeting-status");
  const REFRESH_MS = 5 * 60 * 1000;
  const MAX_DAYS = 42;  // the backend sends at most six weeks, one full month grid
  let data = null, myBookings = [], group = "all", reuse = false, openKey = null;
  const groups = new Map();  // program slug -> short name, learned from the meetings

  const toDate = iso => new Date(iso + "T00:00:00Z");
  const fmt = (iso, opts) => toDate(iso).toLocaleDateString(undefined, { timeZone: "UTC", ...opts });
  const plural = n => `${n} spot${n === 1 ? "" : "s"}`;
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const keyOf = s => `${s.id}-${s.date}`;

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
  const narrow = matchMedia("(max-width: 640px)").matches;

  // Group buttons live in the calendar's own toolbar (like the OCS calendar's group buttons); "● " marks the active one
  const toolbar = () => ({
    left: ["prev,next today", ["groupAll", ...[...groups.keys()].map(slug => `group-${slug}`)].join(",")].join(" "),
    center: "title",
    right: "dayGridMonth,dayGridWeek,dayGridDay"
  });
  const groupButtons = () => {
    const buttons = { groupAll: { text: group === "all" ? "● All groups" : "All groups", click: () => setGroup("all") } };
    groups.forEach((name, slug) => {
      buttons[`group-${slug}`] = { text: group === slug ? `● ${name}` : name, click: () => setGroup(slug) };
    });
    return buttons;
  };

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: narrow ? "dayGridDay" : "dayGridWeek",
    initialDate: asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : undefined,
    headerToolbar: toolbar(),
    customButtons: groupButtons(),
    views: {
      dayGridMonth: { buttonText: "Month", dayMaxEvents: 4 },
      dayGridWeek: { buttonText: "Week" },
      dayGridDay: { buttonText: "Day" }
    },
    buttonText: { today: "Today" },
    height: "auto",
    eventDisplay: "block",
    eventOrder: "start,title",
    events: loadEvents,
    // Time, meeting name, then its group (same three-line card as the OCS calendar's appointments)
    eventContent: arg => {
      const s = arg.event.extendedProps.session;
      const box = el("div", "meeting-chip");
      box.append(el("span", "meeting-chip__time", `${s.start_formatted} – ${s.end_formatted}`),
        el("span", "meeting-chip__name", s.name),
        el("span", "meeting-chip__meta", [s.program_name, s.booked_by_me ? "You're going" : s.started ? "" : s.spots_left === 0 ? "Full" : ""].filter(Boolean).join(" · ")));
      return { domNodes: [box] };
    },
    eventDidMount: info => {
      const s = info.event.extendedProps.session;
      info.el.setAttribute("aria-label", `${s.name}, ${s.program_name}, ${fmt(s.date, { weekday: "long" })} ${s.start_formatted}`);
    },
    eventClick: info => { info.jsEvent.preventDefault(); openMeeting(info.event.extendedProps.session); },
    // Clicking a day's number in Month view opens that day
    navLinks: true,
    navLinkDayClick: date => calendar.changeView("dayGridDay", date)
  });

  function setGroup(slug) {
    group = slug;
    calendar.setOption("customButtons", groupButtons());
    calendar.setOption("headerToolbar", toolbar());
    reuse = true;
    calendar.refetchEvents();
  }

  // Events for the visible range from /api/schedule; group changes re-filter what's loaded without asking again
  async function loadEvents(info, success, failure) {
    try {
      const start = ymd(info.start);
      const days = Math.min(MAX_DAYS, Math.round((info.end - info.start) / 86400000));
      if (!(reuse && data && data.days[0]?.date === start && data.days.length === days)) {
        data = await getCalendar(start, days);
        myBookings = data.logged_in ? await getMyBookings().catch(() => []) : [];
        learnGroups();
        renderMine();
        renderSource();
      }
      reuse = false;
      status.textContent = "";
      success(data.days.flatMap(day => day.sessions.filter(s => group === "all" || s.program === group).map(toEvent)));
      if (openKey) refreshModal();
    } catch (err) {
      status.textContent = err.message;
      failure(err);
    }
  }

  // Add a toolbar button for any group we haven't seen yet
  function learnGroups() {
    let added = false;
    data.days.forEach(day => day.sessions.forEach(s => {
      if (!groups.has(s.program)) { groups.set(s.program, s.program_name); added = true; }
    }));
    if (!added) return;
    const order = ["aa", "al-anon", "alateen", "aca", "na", "ca", "ga", "sa"];
    const sorted = [...groups].sort((a, b) => ((order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)));
    groups.clear(); sorted.forEach(([k, v]) => groups.set(k, v));
    calendar.setOption("customButtons", groupButtons());
    calendar.setOption("headerToolbar", toolbar());
  }

  function toEvent(s) {
    const classes = ["schedule__event", `program-${s.program}`];
    if (s.booked_by_me) classes.push("is-mine");
    else if (s.started) classes.push("is-past");
    else if (s.spots_left === 0) classes.push("is-full");
    return {
      id: keyOf(s),
      title: s.name,
      start: `${s.date}T${s.start}`,
      end: s.end > s.start ? `${s.date}T${s.end}` : undefined,
      classNames: classes,
      extendedProps: { session: s }
    };
  }

  // ---- Meeting details window ----

  const findSession = key => data?.days.flatMap(d => d.sessions).find(s => keyOf(s) === key);
  const dayOf = date => data?.days.find(d => d.date === date);

  function openMeeting(s) {
    openKey = keyOf(s);
    modalStatus.textContent = "";
    fillModal(s);
    if (!modal.open) modal.showModal();
  }
  modal.addEventListener("close", () => { openKey = null; });
  // Clicking the dimmed backdrop closes it
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });

  function refreshModal() {
    const s = findSession(openKey);
    if (s) fillModal(s); else modal.close();
  }

  function fillModal(s) {
    const day = dayOf(s.date) || { bookable: false };
    modal.dataset.program = s.program;
    $("meeting-group").textContent = s.program_name;
    $("meeting-title").textContent = s.name;
    $("meeting-when").textContent = `${fmt(s.date, { weekday: "long", month: "long", day: "numeric" })} · ${s.start_formatted} – ${s.end_formatted}`;

    const facts = $("meeting-facts");
    facts.replaceChildren();
    const fact = (label, value) => { if (!value) return; const dt = el("dt", null, label), dd = el("dd"); dd.append(value); facts.append(dt, dd); };
    fact("Where", s.location);
    fact("Kind", s.types.join(" · "));
    fact("Attend", s.attendance);
    const zoom = (s.notes || "").match(/https:\/\/\S+/);
    if (zoom) { const a = el("a", null, "Join on Zoom ↗"); a.href = zoom[0]; a.target = "_blank"; a.rel = "noopener"; fact("Online", a); }

    const spots = $("meeting-spots");
    spots.replaceChildren();
    if (s.started) spots.append(el("span", "muted", "This meeting has already started."));
    else {
      spots.append(el("strong", null, `${s.spots_left} of ${s.capacity}`), " spots left");
      const bar = el("meter", "schedule__meter"); bar.max = s.capacity; bar.value = s.capacity - s.spots_left;
      spots.append(bar);
    }

    $("meeting-actions").replaceChildren(...actionsFor(s, day));
    const more = $("meeting-more");
    more.href = `/groups/${s.program}`;
    more.textContent = `About ${s.program_name} →`;
  }

  function actionsFor(s, day) {
    if (!data.logged_in) {
      if (s.started || !day.bookable) return [];
      const login = el("a", "prc__btn accent fill", "Log in to reserve"); login.href = "/login";
      return [login];
    }
    const most = Math.min(s.max_spots_per_user, s.my_spots + s.spots_left);
    if (s.booked_by_me) {
      if (s.started) return [el("span", "schedule__mine", `You reserved ${plural(s.my_spots)}`)];
      return [el("span", "schedule__mine", `You're going · ${plural(s.my_spots)}`),
        stepper(s.my_spots, most, n => act(null, () => updateSession(s.id, s.date, n))),
        button("Cancel reservation", "small alert-red", e => act(e.currentTarget, () => cancelSession(s.id, s.date)))];
    }
    if (s.started || !day.bookable || s.spots_left === 0) {
      if (s.started) return [];
      const b = button(!day.bookable ? "Reservations open later" : "Full", "", null); b.disabled = true;
      return [b];
    }
    let count = 1;
    const reserve = button("Reserve a spot", "accent fill", e => act(e.currentTarget, () => bookSession(s.id, s.date, count)));
    return [stepper(count, most, n => { count = n; reserve.textContent = n === 1 ? "Reserve a spot" : `Reserve ${n} spots`; }), reserve];
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
    modalStatus.textContent = "";
    try { await request(); } catch (err) { modalStatus.textContent = err.message; modalStatus.classList.add("is-error"); }
    calendar.refetchEvents();
  }

  // ---- Below the calendar ----

  function renderMine() {
    if (!data.logged_in) {
      const login = el("a", "prc__btn accent fill", "Log in"); login.href = "/login";
      const signup = el("a", "prc__btn", "Create an account"); signup.href = "/signup";
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
      jump.addEventListener("click", () => showDate(b.date, `${b.id}-${b.date}`));
      item.append(jump); list.append(item);
    });
    mineList.replaceChildren(list);
  }

  function renderSource() {
    const synced = data.last_synced ? new Date(data.last_synced).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "not yet";
    const link = el("a", null, "the center's meeting calendar"); link.href = data.source_url; link.target = "_blank"; link.rel = "noopener";
    source.replaceChildren("Meeting times come from ", link, `. Last updated ${synced}.`);
    if (data.sync_error) source.append(" The calendar can't be reached right now, so this is the last saved schedule.");
  }

  // Jump to a date (and open one of its meetings once loaded): used by reservations and the home page's today list
  function showDate(date, key) {
    calendar.gotoDate(date);
    if (!key) return;
    let tries = 0;
    const tryOpen = () => { const s = findSession(key); if (s) openMeeting(s); else if (++tries < 20) setTimeout(tryOpen, 300); };
    tryOpen();
  }
  document.addEventListener("schedule:show-date", e => showDate(e.detail));

  calendar.render();
  // The schedule panel is hidden until picked, so size the calendar whenever its box changes
  new ResizeObserver(() => calendar.updateSize()).observe(calendarEl);
  // Keep spots current without a page reload
  setInterval(() => calendar.refetchEvents(), REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) calendar.refetchEvents(); });
});
