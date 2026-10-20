import { getCredentials } from './api/login.js';
import { putUpdate, getAllUsers, getContactMessages, setMessageHandled, logoutUser } from './api/profile.js';
import { getMyBookings } from './api/schedule.js';
import { initTabs } from './tabs.js';

document.addEventListener("DOMContentLoaded", async () => {
  const user = await getCredentials();
  if (!user) { window.location.href = "login.html"; return; }

  const form = document.querySelector("#profile-form"), message = document.querySelector("#profile-message");
  const passwordForm = document.querySelector("#password-form"), passwordMessage = document.querySelector("#password-message");
  const say = (node, text, isError) => { node.textContent = text; node.classList.toggle("is-error", !!isError); };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function show(u) {
    document.querySelector("#profile-name").textContent = u.name.split(" ")[0];
    document.querySelector("#member-since").textContent = new Date(u.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    form.uid.value = u.uid; form.name.value = u.name; form.email.value = u.email; form.phone.value = u.phone;
  }
  show(user);
  document.querySelector(".profile-page").hidden = false;

  // Upcoming reservations from the schedule API
  const bookings = document.querySelector("#profile-bookings");
  getMyBookings().then(list => {
    if (!list.length) { bookings.replaceChildren(el("p", "small muted", "No upcoming reservations. Find a meeting on the schedule.")); return; }
    const ul = el("ul", "booking-list");
    list.forEach(b => {
      const li = el("li"), link = el("a");
      link.href = `schedule.html?date=${b.date}`;
      const date = new Date(b.date + "T00:00:00Z").toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
      link.append(el("strong", null, `${date} · ${b.start_formatted}`), el("span", null, b.name + (b.my_spots > 1 ? ` · ${b.my_spots} spots` : "")));
      li.append(link); ul.append(li);
    });
    bookings.replaceChildren(ul);
  }).catch(err => bookings.replaceChildren(el("p", "small muted", err.message)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    say(message, "Saving…");
    try {
      show(await putUpdate({ name: form.name.value, email: form.email.value, phone: form.phone.value }));
      say(message, "Saved.");
      if (user.is_admin) loadMembers();
    } catch (err) { say(message, err.message, true); }
  });

  passwordForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (passwordForm.new_password.value !== passwordForm.confirm.value) { say(passwordMessage, "New passwords do not match.", true); return; }
    say(passwordMessage, "Updating…");
    try {
      await putUpdate({ current_password: passwordForm.current_password.value, new_password: passwordForm.new_password.value });
      passwordForm.reset(); say(passwordMessage, "Password updated.");
    } catch (err) { say(passwordMessage, err.message, true); }
  });

  document.querySelector("#logout").addEventListener("click", logoutUser);

  if (!user.is_admin) return;

  // Admins: contact messages and everyone registered in the database
  document.querySelector("#admin").hidden = false;
  initTabs(document.querySelector("#admin [data-tabs]"));

  async function loadMembers() {
    const rows = document.querySelector("#members-table tbody");
    const members = await getAllUsers();
    document.querySelector("#members-count").textContent = members.length;
    rows.replaceChildren(...members.map(m => {
      const tr = el("tr");
      [m.name, m.uid, m.email || "—", m.phone || "—", m.role].forEach(value => tr.append(el("td", null, value)));
      return tr;
    }));
  }

  async function loadMessages() {
    const list = document.querySelector("#messages-list");
    const messages = await getContactMessages();
    document.querySelector("#messages-count").textContent = messages.filter(m => !m.handled).length;
    if (!messages.length) { list.replaceChildren(el("p", "muted", "No messages yet.")); return; }
    list.replaceChildren(...messages.map(m => {
      const card = el("article", "message" + (m.handled ? " is-handled" : ""));
      const head = el("div", "message__head");
      head.append(el("strong", null, m.name), el("span", "tag", m.topic_label),
        el("span", "small muted", new Date(m.created_at + "Z").toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })));
      const reply = el("p", "small muted", [m.email, m.phone].filter(Boolean).join(" · ") || "No contact details left");
      const toggle = el("button", "prc__btn small " + (m.handled ? "" : "accent fill"), m.handled ? "Mark as new" : "Mark handled");
      toggle.type = "button";
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        await setMessageHandled(m.id, !m.handled).catch(err => { document.querySelector("#messages-status").textContent = err.message; });
        loadMessages();
      });
      card.append(head, el("p", "message__body", m.message), reply, toggle);
      return card;
    }));
  }

  loadMembers().catch(err => { document.querySelector("#members-message").textContent = err.message; });
  loadMessages().catch(err => { document.querySelector("#messages-status").textContent = err.message; });
});
