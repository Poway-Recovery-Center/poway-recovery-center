import { apiRequest } from './api/config.js';

// Contact Us form: topics come from and messages go to the backend (/api/contact)
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#contact-form"), message = document.querySelector("#contact-message"), topic = document.querySelector("#contact-topic");
  const say = (text, isError) => { message.textContent = text; message.classList.toggle("is-error", !!isError); };

  try {
    const topics = await apiRequest("/api/contact/topics");
    topic.replaceChildren(...topics.map(t => new Option(t.label, t.value)));
  } catch { /* keep the default option; sending will report the problem */ }

  // Fill in name and contact details for logged-in users
  const user = await apiRequest("/api/id").catch(() => null);
  if (user) { form.name.value = user.name; form.email.value = user.email; form.phone.value = user.phone; }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const send = form.querySelector("button");
    send.disabled = true;
    say("Sending…");
    try {
      const result = await apiRequest("/api/contact", "POST", {
        name: form.name.value, topic: form.topic.value, email: form.email.value, phone: form.phone.value, message: form.message.value
      });
      form.message.value = "";
      say(result.message);
    } catch (err) { say(err.message, true); }
    send.disabled = false;
  });
});
