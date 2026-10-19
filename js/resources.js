document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector("#mood-input"), result = document.querySelector("#mood-result");
  const label = document.querySelector("#mood-label"), title = document.querySelector("#mood-title"), description = document.querySelector("#mood-description");
  const musicTitle = document.querySelector("#music-title"), musicDescription = document.querySelector("#music-description"), musicLink = document.querySelector("#music-link");
  const promptButton = document.querySelector("#grounding-prompt"), groundingText = document.querySelector("#grounding-text");
  const moods = [
    {keys:["panic","anxious","anxiety","racing","overwhelmed","overwhelm"], label:"A room for settling", title:"Let’s make the next minute smaller.", desc:"Your system may be carrying a lot of activation. You do not have to solve everything right now. Try reducing stimulation and orienting to the room around you.", music:"Ambient piano", musicDesc:"Soft instrumental music for a slower pace.", url:"https://music.apple.com/us/search?term=ambient%20piano", prompt:"Look around and name three neutral objects. Let your eyes move slowly rather than forcing a deep breath."},
    {keys:["sad","lonely","alone","grief","empty"], label:"A room for connection", title:"You do not have to carry this in isolation.", desc:"Low mood can make reaching out feel like work. A small connection counts: a text, a shared space, or simply sitting near someone safe.", music:"Acoustic comfort", musicDesc:"Gentle acoustic songs for companionship.", url:"https://music.apple.com/us/search?term=acoustic%20comfort", prompt:"Write one person’s name. You do not have to contact them yet; just consider what you might say if you did."},
    {keys:["angry","anger","trigger","irritated","rage"], label:"A room for creating space", title:"You can pause without dismissing what happened.", desc:"Anger often carries information about boundaries, hurt, or overload. You can honor the feeling while choosing a response that protects you.", music:"Low-tempo focus", musicDesc:"Steady instrumental sound for a reset.", url:"https://music.apple.com/us/search?term=low%20tempo%20instrumental", prompt:"Put one sentence between the feeling and the action: “I am angry, and I can wait ten minutes before deciding.”"},
    {keys:["withdraw","craving","urge","restless","sick"], label:"A room for steadiness", title:"Your body deserves care and attention.", desc:"Physical discomfort and urges can be exhausting. If you are experiencing withdrawal or concerning symptoms, seek medical guidance rather than trying to push through alone.", music:"Nature sounds", musicDesc:"Simple environmental sound with minimal stimulation.", url:"https://music.apple.com/us/search?term=nature%20sounds", prompt:"Check the basics: water, a safe place to sit, a supportive person, and whether you need urgent medical help."}
  ];
  document.querySelector("#enter-room").addEventListener("click", () => {
    const text = input.value.trim().toLowerCase();
    const mood = moods.find(m => m.keys.some(k => text.includes(k))) || {label:"A room for whatever is here", title:"You can begin without having the right words.", desc:"There is no requirement to name your experience perfectly. Start with one thing you can notice: a sensation, a thought, or something you need.", music:"Gentle instrumental", musicDesc:"A flexible starting point for a quieter environment.", url:"https://music.apple.com/us/search?term=gentle%20instrumental", prompt:"Complete this sentence privately: “Right now, the smallest helpful thing might be…”"};
    label.textContent = mood.label; title.textContent = mood.title; description.textContent = mood.desc; musicTitle.textContent = mood.music; musicDescription.textContent = mood.musicDesc; musicLink.href = mood.url; groundingText.textContent = ""; result.hidden = false; result.scrollIntoView({behavior:"smooth", block:"center"});
    promptButton.onclick = () => groundingText.textContent = mood.prompt;
  });
  document.querySelector("#reset-room").addEventListener("click", () => { result.hidden = true; input.focus(); });

  // Reflection wall: posts and "held" notes are kept in this browser's localStorage
  const TAGS = {win:"Small win", truth:"Gentle truth", thanks:"Gratitude", hope:"Note of hope"}, MAX = 280;
  const form = document.querySelector("#reflection-form"), field = document.querySelector("#reflection-input"), count = document.querySelector("#reflection-count"), status = document.querySelector("#reflection-status");
  const list = document.querySelector("#reflection-list"), empty = document.querySelector("#reflection-empty");
  let filter = "all";
  const load = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const say = (msg, isError) => { status.textContent = msg; status.classList.toggle("error", !!isError); };
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
      el.innerHTML = `<blockquote></blockquote><footer><span><span class="tag"></span> · <time></time></span><button class="hold" type="button" title="Send this person support"></button></footer>`;
      el.querySelector("blockquote").textContent = p.text; el.querySelector(".tag").textContent = TAGS[tag]; el.querySelector("time").textContent = when(Number(p.createdAt) || Date.now());
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