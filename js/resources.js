import { initTabs } from './tabs.js';

// Resources hub: category tabs, and jump links (#r-...) that open the right tab and highlight the resource
document.addEventListener("DOMContentLoaded", () => {
  const select = initTabs(document.querySelector("[data-tabs]"), {
    onSelect: tab => history.replaceState(null, "", "#" + tab.id)
  });

  function openHash() {
    const target = location.hash && document.querySelector(location.hash);
    if (!target) return;
    if (target.matches("[role=tab]")) { select(target); target.scrollIntoView({ block: "start" }); return; }
    const panel = target.closest("[role=tabpanel]");
    if (!panel) return;
    select(document.getElementById(panel.getAttribute("aria-labelledby")));
    history.replaceState(null, "", "#" + target.id);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("is-highlighted");
    void target.offsetWidth;  // restart the highlight animation
    target.classList.add("is-highlighted");
  }

  window.addEventListener("hashchange", openHash);
  openHash();
});
