import { apiRequest } from './api/config.js';

// Recovery group page: fills groups/<slug> from /api/programs/<slug> (content copied from powayrecoverycenter.org).
// Sections: headings, text (trusted HTML from our backend: <p> <strong> <em> <ul> <li> <h3>), and "items" shown as cards.
document.addEventListener("DOMContentLoaded", async () => {
  const page = document.getElementById("group");
  const slug = page.dataset.program;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  let group;
  try { group = await apiRequest(`/api/programs/${encodeURIComponent(slug)}`); }
  catch (err) {
    $("group-intro").replaceChildren(el("p", "status-msg is-error", ""));
    $("group-intro").firstChild.textContent = `This page couldn't be loaded right now. ${err.message}`;
    page.removeAttribute("aria-busy");
    return;
  }

  document.title = `${group.name} | Poway Recovery Center`;
  $("group-name").textContent = group.name;
  $("group-crumb").textContent = group.short;
  // Only the opening paragraph goes in the heading band; any longer intro continues at the top of the page body
  const intro = el("div", null, group.intro);
  const first = intro.firstElementChild;
  $("group-intro").replaceChildren(...(first ? [first] : []));
  const photo = $("group-photo");
  photo.src = "/" + group.image;
  photo.alt = "";

  // Sections: each heading starts a new section; text and cards before the first heading form an opening section
  const body = $("group-body");
  let section = el("section", "group__section");
  if (intro.childElementCount) section.append(el("div", "group__prose", intro.innerHTML));
  const flush = () => { if (section.childElementCount) body.append(section); };
  group.sections.forEach(block => {
    if (block.type === "heading") {
      flush();
      section = el("section", "group__section");
      const h = el("h2", "group__heading"); h.textContent = block.text;
      section.append(h);
    } else if (block.type === "items") {
      const grid = el("div", "group__cards");
      block.items.forEach(item => {
        const card = el("div", "group__card");
        const label = el("h3"); label.textContent = item.label;
        card.append(label, el("p", null, item.html));
        grid.append(card);
      });
      section.append(grid);
    } else {
      section.append(el("div", "group__prose", block.html));
    }
  });
  flush();
  page.removeAttribute("aria-busy");

  // Links to the other groups
  try {
    const others = (await apiRequest("/api/programs")).filter(p => p.slug !== slug);
    $("group-others").replaceChildren(...others.map(p => {
      const a = el("a", "group__other");
      a.href = `/groups/${p.slug}`;
      a.innerHTML = `<img alt="" loading="lazy"><span><strong></strong><small></small></span>`;
      a.querySelector("img").src = "/" + p.image;
      a.querySelector("strong").textContent = p.short;
      // Skip the full name when it's the same as the short one (Al-Anon, Alateen)
      if (p.name !== p.short) a.querySelector("small").textContent = p.name; else a.querySelector("small").remove();
      return a;
    }));
    page.querySelector(".group__others").hidden = false;
  } catch { /* the page itself is already shown */ }
});
