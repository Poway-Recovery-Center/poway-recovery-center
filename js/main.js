// Site-wide behavior: mobile menu, and [data-open-chat] buttons that open the support assistant
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle"), nav = document.querySelector("#site-nav");
  if (toggle) toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", e => {
    if (!e.target.closest("[data-open-chat]")) return;
    const chatToggle = document.querySelector(".chatbot-toggle");
    if (chatToggle && chatToggle.getAttribute("aria-expanded") !== "true") chatToggle.click();
  });
});
