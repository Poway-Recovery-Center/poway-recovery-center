// Site-wide support widgets: the 988 crisis tab (bottom left) and the support assistant (bottom right).
// Every page loads this file (styles in _sass/components/_support-widgets.scss), so neither widget lives in the page HTML.
import { pythonURI, fetchOptions } from './api/config.js';

const GREETING = "I’m here with you. What feels most important right now?";

function buildCrisisBanner() {
  const banner = document.createElement("aside");
  banner.className = "crisis-banner";
  banner.setAttribute("aria-label", "Crisis support");
  banner.innerHTML = `
    <button class="crisis-toggle" type="button" aria-expanded="false" aria-label="Need help now? Show crisis support">
      <span class="pulse"></span>
      <span class="crisis-text"><strong>Need help now?</strong><small>Call or text 988</small></span>
    </button>
    <a class="crisis-call" href="tel:988" aria-label="Show crisis support">988</a>`;
  const toggle = banner.querySelector(".crisis-toggle");
  const call = banner.querySelector(".crisis-call");
  const setOpen = (open) => {
    banner.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    call.setAttribute("aria-label", open ? "Call 988" : "Show crisis support");
  };
  toggle.addEventListener("click", () => setOpen(!banner.classList.contains("is-open")));
  // While collapsed, tapping 988 opens the tab; once open it calls 988
  call.addEventListener("click", e => {
    if (!banner.classList.contains("is-open")) { e.preventDefault(); setOpen(true); }
  });
  document.body.appendChild(banner);
}

function buildChatbot() {
  const chatbot = document.createElement("div");
  chatbot.className = "chatbot";
  chatbot.innerHTML = `
    <button class="chatbot-toggle" type="button" aria-label="Open confidential support assistant" aria-expanded="false">✦ <span>Support assistant</span></button>
    <div class="chatbot-panel" hidden>
      <div class="chatbot-header"><div><strong>Support assistant</strong><small>AI responses · not a crisis service</small></div><button class="chatbot-close" type="button" aria-label="Close">×</button></div>
      <div class="chatbot-messages" aria-live="polite"></div>
      <form class="chatbot-form"><input aria-label="Message" placeholder="Type what you’re experiencing…" autocomplete="off" maxlength="1000"><button aria-label="Send">↑</button></form>
      <p class="chatbot-disclaimer">If you may be in immediate danger, call 911. For emotional crisis support, call or text 988.</p>
    </div>`;
  document.body.appendChild(chatbot);

  const toggle = chatbot.querySelector(".chatbot-toggle");
  const panel = chatbot.querySelector(".chatbot-panel");
  const close = chatbot.querySelector(".chatbot-close");
  const form = chatbot.querySelector(".chatbot-form");
  const input = form.querySelector("input");
  const send = form.querySelector("button");
  const messages = chatbot.querySelector(".chatbot-messages");
  // Conversation sent to Gemini so replies keep context: [{role: "user" | "model", text}]
  const history = [];

  const add = (text, cls) => {
    const el = document.createElement("div");
    el.className = cls;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  };
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
  };

  add(GREETING, "bot-message");
  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    add(text, "user-message");
    input.value = "";
    history.push({ role: "user", text });
    send.disabled = true;
    const typing = add("Thinking…", "bot-message is-typing");

    try {
      const reply = await askGemini(history);
      history.push({ role: "model", text: reply });
      typing.remove();
      add(reply, "bot-message");
    } catch (error) {
      // Leave failed turns out of the history so the next try starts clean
      history.pop();
      typing.remove();
      add(`Sorry, I couldn’t connect right now (${error.message}). If you need support, call or text 988.`, "bot-message");
    }
    send.disabled = false;
    input.focus();
  });
}

// Gemini is called through the backend (/api/chat) so the API key never reaches the browser
async function askGemini(history) {
  if (!pythonURI) throw new Error("the support server isn’t connected to this site yet");
  let response;
  try {
    response = await fetch(pythonURI + "/api/chat", {
      ...fetchOptions,
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ messages: history.slice(-20) })
    });
  } catch {
    throw new Error(`can’t reach the support server at ${pythonURI}`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.reply) throw new Error(data.message || `Request failed: ${response.status}`);
  return data.reply;
}

const init = () => { buildCrisisBanner(); buildChatbot(); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
