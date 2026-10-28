import { apiRequest } from './api/config.js';

// Mood Room: sends what the person types to the backend (/api/mood), which picks the matching room
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#mood-form"), input = document.querySelector("#mood-input"), result = document.querySelector("#mood-result");
  const label = document.querySelector("#mood-label"), title = document.querySelector("#mood-title"), description = document.querySelector("#mood-description");
  const musicTitle = document.querySelector("#music-title"), musicDescription = document.querySelector("#music-description"), musicLink = document.querySelector("#music-link");
  const promptButton = document.querySelector("#grounding-prompt"), groundingText = document.querySelector("#grounding-text");
  const enterButton = document.querySelector("#enter-room");

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
    result.hidden = false;
    result.scrollIntoView({behavior:"smooth", block:"center"});
  });
  // Enter opens the room; Shift+Enter adds a new line (skipped while an IME is composing text)
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  document.querySelector("#reset-room").addEventListener("click", () => { result.hidden = true; input.focus(); });
});
