import { apiRequest } from './api/config.js';

// Mood Room: sends what the person types to the backend (/api/mood), which picks the matching room
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#mood-form"), input = document.querySelector("#mood-input"), result = document.querySelector("#mood-result");
  const label = document.querySelector("#mood-label"), title = document.querySelector("#mood-title"), description = document.querySelector("#mood-description");
  const musicTitle = document.querySelector("#music-title"), musicDescription = document.querySelector("#music-description"), musicLink = document.querySelector("#music-link");
  const promptButton = document.querySelector("#grounding-prompt"), groundingText = document.querySelector("#grounding-text");
  const enterButton = document.querySelector("#enter-room");
  const picks = document.querySelector("#mood-picks"), pickList = document.querySelector("#mood-pick-list");

  // Quick music picks shown beside the text box before a room opens
  apiRequest("/api/mood/music").then(list => {
    pickList.replaceChildren(...list.map(m => {
      const a = document.createElement("a");
      Object.assign(a, {className: "mood__pick", href: m.url, target: "_blank", rel: "noopener"});
      a.innerHTML = `<span><strong></strong><span class="small muted"></span></span><span class="mood__pick-arrow" aria-hidden="true">↗</span>`;
      a.querySelector("strong").textContent = m.title;
      a.querySelector(".muted").textContent = m.description;
      return a;
    }));
  }).catch(() => { picks.hidden = true; });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    enterButton.disabled = true;
    try {
      const room = await apiRequest("/api/mood", "POST", { text: input.value.trim() });
      label.textContent = room.label; title.textContent = room.title; description.textContent = room.description;
      musicTitle.textContent = room.music; musicDescription.textContent = room.music_description; musicLink.href = room.music_url;
      groundingText.textContent = "";
      promptButton.hidden = false;
      promptButton.onclick = () => groundingText.textContent = room.prompt;
    } catch (err) {
      label.textContent = "Can't open a room right now"; title.textContent = "We couldn't reach the Mood Room."; description.textContent = err.message;
      musicTitle.textContent = ""; musicDescription.textContent = ""; musicLink.removeAttribute("href");
      groundingText.textContent = ""; promptButton.hidden = true;
    }
    enterButton.disabled = false;
    picks.hidden = true;
    result.hidden = false;
    result.scrollIntoView({behavior:"smooth", block:"center"});
  });
  // Enter opens the room; Shift+Enter adds a new line (skipped while an IME is composing text)
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  document.querySelector("#reset-room").addEventListener("click", () => { result.hidden = true; picks.hidden = !pickList.children.length; input.focus(); });
});
