// Reflection wall: posts and "held" notes are kept in this browser's localStorage
document.addEventListener("DOMContentLoaded", () => {
  const TAGS = {win:"Small win", truth:"Gentle truth", thanks:"Gratitude", hope:"Note of hope"}, MAX = 280;
  const form = document.querySelector("#reflection-form"), field = document.querySelector("#reflection-input"), count = document.querySelector("#reflection-count"), status = document.querySelector("#reflection-status");
  const list = document.querySelector("#reflection-list"), empty = document.querySelector("#reflection-empty");
  let filter = "all";
  const load = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const say = (msg, isError) => { status.textContent = msg; status.classList.toggle("is-error", !!isError); };
  const when = ms => { const mins = Math.round((Date.now() - ms) / 60000); if (mins < 1) return "just now"; if (mins < 60) return `${mins} min ago`; const hrs = Math.round(mins / 60); return hrs < 24 ? `${hrs} hr ago` : new Date(ms).toLocaleDateString(undefined, {month:"short", day:"numeric"}); };
  field.addEventListener("input", () => count.textContent = `${field.value.length} / ${MAX}`);
  form.addEventListener("submit", e => {
    e.preventDefault(); const text = field.value.trim();
    if (!text) { say("Write a few words first, then post.", true); field.focus(); return; }
    const posts = load("prc-reflections"); posts.unshift({id:Date.now().toString(36), text:text.slice(0, MAX), tag:form.querySelector("input[name=tag]:checked").value, createdAt:Date.now(), holds:0});
    save("prc-reflections", posts.slice(0, 60)); field.value = ""; count.textContent = `0 / ${MAX}`; say("Posted. Thank you for sharing."); render();
  });
  document.querySelector("#reflection-filters").addEventListener("click", e => {
    const b = e.target.closest("button[data-filter]"); if (!b) return; filter = b.dataset.filter;
    document.querySelectorAll("#reflection-filters button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render();
  });
  // Older posts were saved as {text, date}; give them an id so hearts stay per-note
  save("prc-reflections", load("prc-reflections").filter(p => p && p.text).map((p, i) => p.id ? p : {...p, id:`old-${i}`, tag:"win", createdAt:Date.parse(p.date) || Date.now(), holds:0}));
  function render() {
    const posts = load("prc-reflections"), held = new Set(load("prc-reflections-held"));
    const shown = posts.filter(p => filter === "all" || p.tag === filter);
    empty.hidden = shown.length > 0;
    if (!shown.length && posts.length) empty.innerHTML = "<strong>Nothing in this category yet.</strong>Be the first to add one.";
    list.replaceChildren(...shown.map(p => {
      const tag = TAGS[p.tag] ? p.tag : "win", el = document.createElement("article");
      el.className = "reflection-post"; el.dataset.tag = tag;
      el.innerHTML = `<blockquote></blockquote><footer><span><span class="reflection-post__tag"></span> · <time></time></span><button class="prc__btn small pill hold" type="button" title="Send this person support"></button></footer>`;
      el.querySelector("blockquote").textContent = p.text; el.querySelector(".reflection-post__tag").textContent = TAGS[tag]; el.querySelector("time").textContent = when(Number(p.createdAt) || Date.now());
      const hold = el.querySelector(".hold"), isHeld = held.has(p.id);
      hold.textContent = `♡ ${Number(p.holds) || 0}`; hold.setAttribute("aria-pressed", String(isHeld)); hold.disabled = isHeld;
      hold.addEventListener("click", () => {
        save("prc-reflections", load("prc-reflections").map(x => x.id === p.id ? {...x, holds:(Number(x.holds) || 0) + 1} : x));
        save("prc-reflections-held", [...held, p.id]); render();
      });
      return el;
    }));
  }
  render();
});
