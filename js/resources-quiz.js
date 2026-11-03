// "What's right for you?" quiz on the Resources page: a few local questions that point to a recovery program.
// Runs entirely in the browser; nothing is saved or sent anywhere.

const PROGRAMS = {
  aa:       { name: "Alcoholics Anonymous (AA)", blurb: "For anyone who wants to stop drinking." },
  na:       { name: "Narcotics Anonymous (NA)", blurb: "For anyone with a drug problem, whatever the drug, including alcohol." },
  ca:       { name: "Cocaine Anonymous (CA)", blurb: "For people recovering from cocaine and other mind-altering substances." },
  ga:       { name: "Gamblers Anonymous (GA)", blurb: "For people who want to stop gambling." },
  sa:       { name: "Sexaholics Anonymous (SA)", blurb: "For people who want to stop compulsive sexual behavior or pornography use." },
  "al-anon": { name: "Al-Anon Family Groups", blurb: "For adults affected by someone else's drinking or addiction." },
  alateen:  { name: "Alateen", blurb: "For teens affected by a parent's, relative's or friend's drinking." },
  aca:      { name: "Adult Children of Alcoholics (ACA)", blurb: "For adults who grew up in a home affected by alcohol or other dysfunction." },
};

// Each question lists answers; an answer either goes to another question (next) or ends with programs (result).
const QUESTIONS = {
  who: {
    title: "What brings you here?",
    hint: "Take your time. Nothing you choose is saved.",
    answers: [
      { label: "I'm looking for something for me", next: "what" },
      { label: "I'm here for someone I care about", next: "age" },
      { label: "I'm still carrying things from growing up", next: "grewUp" },
    ],
  },
  what: {
    title: "What's been on your mind lately?",
    hint: "Whatever feels closest is fine.",
    answers: [
      { label: "Drinking", result: ["aa"] },
      { label: "Stimulants", result: ["ca", "na"] },
      { label: "Other substances", result: ["na"] },
      { label: "Gambling", result: ["ga"] },
      { label: "Intimacy", result: ["sa"] },
      { label: "A little of everything, or I'm not sure", result: ["na", "aa"] },
    ],
  },
  age: {
    title: "Which feels closer to you?",
    hint: "Some groups are made just for younger people.",
    answers: [
      { label: "I'm a teen", result: ["alateen", "al-anon"] },
      { label: "I'm an adult", next: "family" },
    ],
  },
  family: {
    title: "Does any of this feel familiar from growing up?",
    hint: "Only if you'd like to share.",
    answers: [
      { label: "Yes, it does", result: ["al-anon", "aca"] },
      { label: "Not really, or I'd rather not say", result: ["al-anon"] },
    ],
  },
  grewUp: {
    title: "Which feels closer to you?",
    hint: "Some groups are made just for younger people.",
    answers: [
      { label: "I'm a teen", result: ["alateen"] },
      { label: "I'm an adult", result: ["aca", "al-anon"] },
    ],
  },
};

const $ = id => document.getElementById(id);
const dialog = $("quiz"), openBtn = $("quiz-open");

if (dialog && openBtn) {
  const stepEl = $("quiz-step"), titleEl = $("quiz-title"), bodyEl = $("quiz-body"), backBtn = $("quiz-back");
  let history = [];

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  function showQuestion(key) {
    const q = QUESTIONS[key];
    stepEl.textContent = `Question ${history.length + 1}`;
    titleEl.textContent = q.title;
    const hint = el("p", "quiz__hint", q.hint || "");
    const list = el("div", "quiz__answers");
    for (const a of q.answers) {
      const b = el("button", "quiz__answer", a.label);
      b.type = "button";
      b.addEventListener("click", () => {
        history.push(key);
        a.next ? showQuestion(a.next) : showResult(a.result);
      });
      list.append(b);
    }
    bodyEl.replaceChildren(hint, list);
    backBtn.hidden = history.length === 0;
    titleEl.focus();
  }

  function showResult(slugs) {
    stepEl.textContent = "A place to start";
    titleEl.textContent = slugs.length > 1 ? "These groups might feel like a good fit" : "This group might feel like a good fit";
    const list = el("div", "quiz__results");
    slugs.forEach((slug, i) => {
      const p = PROGRAMS[slug];
      const card = el("a", "quiz__result" + (i === 0 ? " is-top" : ""));
      card.href = `/groups/${slug}`;
      const img = el("img", "quiz__result-img");
      img.src = `/images/programs/${slug}.png`;
      img.alt = "";
      const text = el("div");
      text.append(el("strong", null, p.name), el("span", null, p.blurb));
      card.append(img, text);
      list.append(card);
    });

    const actions = el("div", "quiz__actions");
    const schedule = el("a", "prc__btn accent fill", "See when they meet");
    schedule.href = "/#schedule";
    const again = el("button", "prc__btn accent", "Start again");
    again.type = "button";
    again.addEventListener("click", start);
    actions.append(schedule, again);

    const note = el("p", "quiz__note",
      "Reaching out takes courage. This is only a gentle suggestion, not a label. Every group welcomes newcomers, and you're welcome to try more than one until something feels right.");

    bodyEl.replaceChildren(list, actions, note);
    backBtn.hidden = false;
    titleEl.focus();
  }

  function start() {
    history = [];
    showQuestion("who");
  }

  backBtn.addEventListener("click", () => {
    const prev = history.pop();
    if (prev) showQuestion(prev);
  });

  openBtn.addEventListener("click", () => {
    start();
    dialog.showModal();
  });

  // Click on the backdrop closes it
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
}
