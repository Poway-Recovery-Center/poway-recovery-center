// Home page support tools: [data-feature="<dialog id>"] buttons open that tool as a popup over the page.
// The URL hash follows the open popup (index.html#mood-room), so links from other pages open it directly.
document.addEventListener("DOMContentLoaded", () => {
  const dialogs = [...document.querySelectorAll("dialog.feature")];
  const byHash = () => dialogs.find(d => "#" + d.id === location.hash);

  function open(dialog, date) {
    dialogs.forEach(d => { if (d !== dialog && d.open) d.close(); });
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".feature__body").scrollTop = 0;
    if (location.hash !== "#" + dialog.id) history.replaceState(null, "", "#" + dialog.id);
    // Today's meeting rows open the schedule on their day
    if (date) document.dispatchEvent(new CustomEvent("schedule:show-date", { detail: date }));
  }

  dialogs.forEach(dialog => {
    dialog.querySelector(".feature__close").addEventListener("click", () => dialog.close());
    // Clicking the dimmed backdrop (outside the panel) closes it
    dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => {
      if (location.hash === "#" + dialog.id) history.replaceState(null, "", location.pathname + location.search);
    });
  });

  document.addEventListener("click", e => {
    const trigger = e.target.closest("[data-feature]");
    if (trigger) {
      const dialog = document.getElementById(trigger.dataset.feature);
      if (dialog) { e.preventDefault(); open(dialog, trigger.dataset.date); }
      return;
    }
    // Links such as the footer's index.html#mood-room open the popup without reloading
    const link = e.target.closest("a[href*='#']");
    const linked = link && link.hash && dialogs.find(d => "#" + d.id === link.hash);
    if (linked) { e.preventDefault(); open(linked); return; }
    // The support assistant sits under the popup, so close the popup first
    const chat = e.target.closest("[data-open-chat]");
    if (chat) chat.closest("dialog.feature")?.close();
  });

  window.addEventListener("hashchange", () => { const d = byHash(); if (d) open(d); });
  // schedule.js reads ?date= itself when the page opens on #schedule
  const initial = byHash();
  if (initial) open(initial);
});
