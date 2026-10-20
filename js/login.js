import { login } from './api/config.js';

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#login-form"), message = document.querySelector("#login-message");
  form.addEventListener("submit", e => {
    e.preventDefault();
    message.textContent = "Logging in…";
    login({
      body: { uid: form.uid.value, password: form.password.value },
      message: "login-message",
      callback: () => { window.location.href = "profile.html"; }
    });
  });
});
