// Home page support tools: [data-feature="<panel id>"] buttons show that tool in the panel beside the tools menu,
// in place of today's meetings. The URL hash follows the shown tool (index.html#mood-room), so links from other pages open it directly.
document.addEventListener("DOMContentLoaded", () => {
  const panels = [...document.querySelectorAll(".feature")];
  const todayPanel = document.getElementById("today-panel");
  const hero = document.querySelector(".hero");
  const header = document.querySelector(".site-header");
  const menu = [...document.querySelectorAll(".tools__menu [data-feature]")];
  const byHash = () => panels.find(p => "#" + p.id === location.hash);

  // Scroll so the bottom of the hero sits right under the sticky header
  function alignToHero() {
    const top = hero.getBoundingClientRect().bottom + scrollY - header.offsetHeight;
    scrollTo({ top, behavior: "smooth" });
  }

  // Show one tool (or today's meetings when panel is null) and bring the tools section into view
  function show(panel, date) {
    panels.forEach(p => { p.hidden = p !== panel; });
    todayPanel.hidden = Boolean(panel);
    menu.forEach(b => b.setAttribute("aria-pressed", String(Boolean(panel) && b.dataset.feature === panel.id)));
    const hash = panel ? "#" + panel.id : "";
    if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname + location.search);
    // Today's meeting rows open the schedule on their day
    if (date) document.dispatchEvent(new CustomEvent("schedule:show-date", { detail: date }));
    alignToHero();
  }

  document.addEventListener("click", e => {
    if (e.target.closest("[data-feature-close]")) { show(null); return; }
    const trigger = e.target.closest("[data-feature]");
    if (trigger) {
      const panel = document.getElementById(trigger.dataset.feature);
      if (panel) { e.preventDefault(); show(panel, trigger.dataset.date); }
      return;
    }
    // Links such as the footer's index.html#mood-room show the tool without reloading
    const link = e.target.closest("a[href*='#']");
    const linked = link && link.hash && panels.find(p => "#" + p.id === link.hash);
    if (linked) { e.preventDefault(); show(linked); }
  });

  window.addEventListener("hashchange", () => { const p = byHash(); if (p) show(p); });
  // schedule.js reads ?date= itself when the page opens on #schedule
  const initial = byHash();
  if (initial) show(initial);
});
