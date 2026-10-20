import { getCalendar } from './api/schedule.js';

// Home page: the next meeting (hero) and today's meetings, from the backend schedule API
document.addEventListener("DOMContentLoaded", async () => {
  const next = document.querySelector("#hero-next"), list = document.querySelector("#today-list"), title = document.querySelector("#today-title");

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  try {
    const data = await getCalendar(undefined, 2);
    const [today, tomorrow] = data.days;
    const upcoming = today.sessions.filter(s => !s.started);
    const nextSession = upcoming[0] || tomorrow.sessions[0];
    if (nextSession) {
      const when = upcoming[0] ? "today" : "tomorrow";
      next.textContent = `Next meeting ${when}: ${nextSession.start_formatted} · ${nextSession.name}`;
    }

    // After the last meeting of the day, show tomorrow instead
    const day = upcoming.length ? today : tomorrow;
    title.textContent = upcoming.length ? "Today at the center" : "Tomorrow at the center";
    list.innerHTML = "";
    if (!day.sessions.length) { list.append(el("p", "muted", "No meetings are scheduled.")); return; }
    day.sessions.forEach(s => {
      const row = el("a", "today__row" + (s.started ? " is-past" : ""));
      row.href = `schedule.html?date=${s.date}`;
      row.append(el("span", "today__time", s.start_formatted), el("span", "today__name", s.name),
        el("span", "today__meta", s.started ? "Started" : [s.attendance, ...s.types.slice(0, 2)].filter(Boolean).join(" · ")),
        el("span", "today__spots", s.started ? "" : `${s.spots_left} spots`));
      list.append(row);
    });
  } catch (err) {
    list.innerHTML = "";
    list.append(el("p", "muted", `The schedule couldn't be loaded right now. ${err.message}`));
  }
});
