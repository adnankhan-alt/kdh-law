const root = document.documentElement;
const header = document.querySelector("[data-header], .site-header");
const menu = document.querySelector(".menu");
const nav = document.querySelector("#nav");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const headerAlwaysScrolled = header?.classList.contains("scrolled") || false;

root.classList.add("motion-ready", "scroll-enhanced");

// Minimal page-position control.
const scrollGuide = document.createElement("div");
scrollGuide.className = "scroll-guide";
scrollGuide.innerHTML = '<span class="scroll-pill"></span>';
document.body.append(scrollGuide);

const scrollPill = scrollGuide.firstElementChild;
scrollPill.setAttribute("role", "scrollbar");
scrollPill.setAttribute("aria-label", "Page scroll position");
scrollPill.setAttribute("aria-orientation", "vertical");
scrollPill.setAttribute("aria-valuemin", "0");
scrollPill.setAttribute("aria-valuemax", "100");
scrollPill.setAttribute("aria-valuenow", "0");
root.id ||= "page-scroll-root";
scrollPill.setAttribute("aria-controls", root.id);
scrollPill.tabIndex = 0;

let scrollFrame = 0;
let dragging = false;
let dragStartY = 0;
let dragStartScroll = 0;

const scrollMetrics = () => {
  const range = Math.max(root.scrollHeight - window.innerHeight, 0);
  const travel = Math.max(scrollGuide.clientHeight - scrollPill.offsetHeight, 0);
  return { range, travel };
};

const syncScroll = () => {
  scrollFrame = 0;
  const top = window.scrollY;
  const { range, travel } = scrollMetrics();
  const progress = range ? Math.min(Math.max(top / range, 0), 1) : 0;

  scrollPill.style.transform = `translate3d(0, ${travel * progress}px, 0)`;
  scrollPill.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  scrollGuide.classList.toggle("active", range > 0);
  scrollGuide.classList.toggle("is-hidden", range < 1);
  header?.classList.toggle("scrolled", headerAlwaysScrolled || top > 36);

  if (!reduceMotion && window.innerWidth > 900) {
    root.style.setProperty("--hero-parallax", `${Math.min(top * 0.035, 24)}px`);
  }
};

const requestScrollSync = () => {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(syncScroll);
};

window.addEventListener("scroll", requestScrollSync, { passive: true });
window.addEventListener("resize", requestScrollSync, { passive: true });
syncScroll();

const scrollToValue = (value, behavior = "auto") => {
  const { range } = scrollMetrics();
  window.scrollTo({
    top: Math.min(range, Math.max(0, value)),
    behavior
  });
};

scrollPill.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  dragging = true;
  dragStartY = event.clientY;
  dragStartScroll = window.scrollY;
  scrollPill.setPointerCapture(event.pointerId);
  scrollPill.classList.add("is-dragging");
  event.preventDefault();
});

scrollPill.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const { range, travel } = scrollMetrics();
  const delta = ((event.clientY - dragStartY) / Math.max(1, travel)) * range;
  scrollToValue(dragStartScroll + delta);
});

const endDrag = (event) => {
  if (!dragging) return;
  dragging = false;
  scrollPill.classList.remove("is-dragging");
  if (scrollPill.hasPointerCapture(event.pointerId)) {
    scrollPill.releasePointerCapture(event.pointerId);
  }
};

scrollPill.addEventListener("pointerup", endDrag);
scrollPill.addEventListener("pointercancel", endDrag);
scrollPill.addEventListener("keydown", (event) => {
  const pageStep = window.innerHeight * 0.82;
  const steps = {
    ArrowUp: -72,
    ArrowDown: 72,
    PageUp: -pageStep,
    PageDown: pageStep,
    Home: -Infinity,
    End: Infinity
  };

  if (!(event.key in steps)) return;
  event.preventDefault();
  const { range } = scrollMetrics();
  const step = steps[event.key];
  const target = step === Infinity ? range : step === -Infinity ? 0 : window.scrollY + step;
  scrollToValue(target, reduceMotion ? "auto" : "smooth");
});

// Mobile navigation.
menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") === "true";
  menu.setAttribute("aria-expanded", String(!open));
  nav?.classList.toggle("open", !open);
});

nav?.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  nav.classList.remove("open");
  menu?.setAttribute("aria-expanded", "false");
});

// Staggered, once-only reveal motion.
const revealGroups = [
  ".value-grid",
  ".industry-grid",
  ".people",
  ".service-times",
  ".client-cloud",
  ".practice-accordion"
];

revealGroups.forEach((selector) => {
  const group = document.querySelector(selector);
  if (!group) return;
  [...group.children].forEach((item, index) => {
    if (item.classList.contains("reveal")) {
      item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 280)}ms`);
    }
  });
});

const revealItems = [...document.querySelectorAll(".reveal")];
if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -5%" }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

// Gentle hero-stat count-up.
const counters = [...document.querySelectorAll("[data-count]")];
const runCounter = (element) => {
  const finalValue = Number(element.dataset.count);
  if (!Number.isFinite(finalValue) || reduceMotion) {
    element.textContent = String(finalValue);
    return;
  }

  const duration = 900;
  const startTime = performance.now();
  const tick = (time) => {
      const progress = Math.min(Math.max((time - startTime) / duration, 0), 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(finalValue * eased));
    if (progress < 1) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
};

if (counters.length) {
  if (!("IntersectionObserver" in window)) {
    counters.forEach(runCounter);
  } else {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          counterObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.7 }
    );
    counters.forEach((counter) => counterObserver.observe(counter));
  }
}

// Keep the current section visible in the navigation.
const navigationLinks = [...document.querySelectorAll('#nav a[href^="#"]')];
const sectionMap = new Map(
  navigationLinks
    .map((link) => [document.querySelector(link.getAttribute("href")), link])
    .filter(([section]) => section)
);

if (sectionMap.size && "IntersectionObserver" in window) {
  const activeObserver = new IntersectionObserver(
    (entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!current) return;
      navigationLinks.forEach((link) => link.classList.remove("active"));
      sectionMap.get(current.target)?.classList.add("active");
    },
    { rootMargin: "-22% 0px -62%", threshold: [0.01, 0.2, 0.5] }
  );
  sectionMap.forEach((_, section) => activeObserver.observe(section));
}

// Accessible team-profile dialogs.
document.querySelectorAll(".profile-open").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.dialog);
    if (!(dialog instanceof HTMLDialogElement)) return;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  });
});

document.querySelectorAll(".profile-dialog").forEach((dialog) => {
  const close = dialog.querySelector(".dialog-close");
  close?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (outside) dialog.close();
  });

  dialog.addEventListener("close", () => {
    if (!document.querySelector(".profile-dialog[open]")) {
      document.body.classList.remove("dialog-open");
    }
  });
});

// Static-site consultation form: validate, then prepare a complete email.
const form = document.querySelector(".consultation");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const status = form.querySelector(".form-status");

  if (!form.checkValidity()) {
    form.reportValidity();
    if (status) status.textContent = "Please complete all required fields.";
    return;
  }

  const data = new FormData(form);
  const subject = `Consultation request - ${data.get("area")}`;
  const body = [
    `Name: ${data.get("name")}`,
    `Email: ${data.get("email")}`,
    `Company: ${data.get("company") || "Not provided"}`,
    `Practice area: ${data.get("area")}`,
    "",
    "How KDH can help:",
    data.get("message")
  ].join("\n");

  if (status) status.textContent = "Opening your email application with the enquiry prepared.";
  window.location.href = `mailto:law@kdhadvocates.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// Cookie preference notice. No analytics are loaded by this site.
const cookie = document.querySelector(".cookie");
if (cookie) {
  let savedChoice = null;
  try {
    savedChoice = localStorage.getItem("kdh-cookie-choice");
  } catch {
    savedChoice = "essential";
  }

  if (!savedChoice) cookie.hidden = false;
  cookie.addEventListener("click", (event) => {
    const choice = event.target.dataset.cookie;
    if (!choice) return;
    try {
      localStorage.setItem("kdh-cookie-choice", choice);
    } catch {
      // The preference cannot be stored in private or restricted contexts.
    }
    cookie.hidden = true;
  });
}
