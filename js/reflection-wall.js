import { apiRequest } from './api/config.js';

// Reflection wall: notes, kinds and hearts all live in the backend (/api/reflections), so everyone sees the same wall.
// The wall refreshes every 30 seconds while it's on screen so new notes from others show up.
document.addEventListener("DOMContentLoaded", async () => {
  const MAX = 280, REFRESH_MS = 30000;
  const $ = s => document.querySelector(s);
  const form = $("#reflection-form"), field = $("#reflection-input"), count = $("#reflection-count"), status = $("#reflection-status");
  const tagsBox = $("#reflection-tags"), filters = $("#reflection-filters"), list = $("#reflection-list"), empty = $("#reflection-empty");
  const section = $("#reflection-wall");
  let filter = "all", posts = [];

  const say = (msg, isError) => { status.textContent = msg; status.classList.toggle("is-error", !!isError); };
  const showEmpty = (title, text = "") => { empty.hidden = false; empty.innerHTML = "<strong></strong>"; empty.firstChild.textContent = title; empty.append(text); };
  const when = iso => {
    const ms = Date.parse(iso) || Date.now(), mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return hrs < 24 ? `${hrs} hr ago` : new Date(ms).toLocaleDateString(undefined, {month:"short", day:"numeric"});
  };

  // Kinds of reflection: radio chips on the form and filter buttons above the wall
  try {
    const tags = await apiRequest("/api/reflections/tags");
    tags.forEach((t, i) => {
      const chip = document.createElement("label");
      chip.className = "chip";
      chip.innerHTML = `<input type="radio" name="tag"><span></span>`;
      Object.assign(chip.querySelector("input"), {value: t.value, checked: i === 0});
      chip.querySelector("span").textContent = t.label;
      tagsBox.append(chip);

      const b = document.createElement("button");
      Object.assign(b, {className: "prc__btn small pill", type: "button", textContent: t.filter_label});
      b.dataset.filter = t.value;
      b.setAttribute("aria-pressed", "false");
      filters.append(b);
    });
  } catch (err) { say(err.message, true); }

  field.addEventListener("input", () => count.textContent = `${field.value.length} / ${MAX}`);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const text = field.value.trim(), tag = form.querySelector("input[name=tag]:checked");
    if (!text) { say("Write a few words first, then post.", true); field.focus(); return; }
    const send = form.querySelector("button[type=submit]");
    send.disabled = true;
    say("Posting…");
    try {
      const result = await apiRequest("/api/reflections", "POST", {text, tag: tag && tag.value});
      field.value = ""; count.textContent = `0 / ${MAX}`;
      say(result.message);
      await load();
    } catch (err) { say(err.message, true); }
    send.disabled = false;
  });

  filters.addEventListener("click", e => {
    const b = e.target.closest("button[data-filter]"); if (!b) return;
    filter = b.dataset.filter;
    filters.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    render();
  });

  async function load() {
    try {
      posts = await apiRequest("/api/reflections");
      render();
    } catch (err) {
      if (!posts.length) showEmpty("Couldn't load the wall.", ` ${err.message}`);
    }
  }

  function render() {
    const shown = posts.filter(p => filter === "all" || p.tag === filter);
    empty.hidden = shown.length > 0;
    if (!posts.length) showEmpty("The wall is waiting for its first note.", "Write one above and it will appear here.");
    else if (!shown.length) showEmpty("Nothing in this category yet.", "Be the first to add one.");
    list.replaceChildren(...shown.map(p => {
      const el = document.createElement("article");
      el.className = "reflection-post"; el.dataset.tag = p.tag;
      el.innerHTML = `<blockquote></blockquote><footer><span><span class="reflection-post__tag"></span> · <time></time></span><button class="prc__btn small pill hold" type="button" title="Send this person support"></button></footer>`;
      el.querySelector("blockquote").textContent = p.text;
      el.querySelector(".reflection-post__tag").textContent = p.tag_label;
      const time = el.querySelector("time");
      time.textContent = when(p.created_at); time.dateTime = p.created_at || "";
      const hold = el.querySelector(".hold");
      hold.textContent = `♡ ${p.holds}`;
      hold.setAttribute("aria-pressed", String(p.held)); hold.disabled = p.held;
      hold.addEventListener("click", async () => {
        hold.disabled = true;
        try {
          const updated = await apiRequest(`/api/reflections/${p.id}/hold`, "POST");
          posts = posts.map(x => x.id === p.id ? updated : x);
          render();
        } catch (err) {
          hold.disabled = false;
          if (err.status === 404) await load(); else say(err.message, true);
        }
      });
      return el;
    }));
  }

  await load();
  // Older versions kept the wall in this browser only; clear those leftovers
  try { localStorage.removeItem("prc-reflections"); localStorage.removeItem("prc-reflections-held"); } catch {}

  // Pick up new notes from others while the wall is open
  setInterval(() => { if (!document.hidden && section && !section.hidden) load(); }, REFRESH_MS);
});
