// Accessible tabs for any [data-tabs] container: [role=tab] buttons with aria-controls -> [role=tabpanel]
// Returns select(tab) so pages can open a tab themselves (e.g. from a #link).
export function initTabs(container, { onSelect } = {}) {
  const tabs = [...container.querySelectorAll("[role=tab]")];

  function select(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    if (onSelect) onSelect(tab);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    // Arrow keys move between tabs (WAI-ARIA tabs pattern)
    tab.addEventListener("keydown", e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], true); }
    });
  });
  return select;
}
