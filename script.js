const root = document.documentElement;
const header = document.querySelector("[data-header], .site-header");
const menu = document.querySelector(".menu");
const nav = document.querySelector("#nav");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionPreference.matches;
const headerAlwaysScrolled = header?.classList.contains("scrolled") || false;

root.classList.add("motion-ready", "scroll-enhanced");

motionPreference.addEventListener?.("change", (event) => {
  reduceMotion = event.matches;
});

const anchorGap = () => Math.min(24, Math.max(16, window.innerHeight * 0.02));
const syncAnchorOffset = () => {
  const headerHeight = Math.ceil(header?.getBoundingClientRect().height || 0);
  root.style.setProperty("--anchor-offset", `${headerHeight + anchorGap()}px`);
};

if (header && "ResizeObserver" in window) {
  new ResizeObserver(syncAnchorOffset).observe(header);
}
window.addEventListener("resize", syncAnchorOffset, { passive: true });
syncAnchorOffset();

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
  root.classList.add("scroll-dragging");
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
  root.classList.remove("scroll-dragging");
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
const closeMenu = () => {
  nav?.classList.remove("open");
  menu?.setAttribute("aria-expanded", "false");
};

menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") === "true";
  menu.setAttribute("aria-expanded", String(!open));
  nav?.classList.toggle("open", !open);
});

const targetFromHash = (hash) => {
  if (!hash || hash === "#") return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
};

const prepareLanding = (target) => {
  const section = target.closest("section") || target;
  const candidates = [
    target,
    section.querySelector?.(".hero-copy"),
    section.querySelector?.(".section-label"),
    section.querySelector?.(".section-heading"),
    section.querySelector?.(".contact-copy"),
    section.querySelector?.(".consultation"),
    target.matches?.(".standards-intro") ? target.querySelector(".section-heading") : null,
    target.matches?.(".contact-copy") ? target : null
  ];

  candidates.forEach((item) => item?.classList.add("visible"));
};

const focusLanding = (target) => {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
};

const landingTop = (target) => {
  if (target.id === "top") return 0;
  const headerHeight = Math.ceil(header?.getBoundingClientRect().height || 0);
  return Math.max(
    0,
    target.getBoundingClientRect().top + window.scrollY - headerHeight - anchorGap()
  );
};

let anchorScrollFrame = 0;

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const animateAnchorScroll = (top, { duration = 420, done } = {}) => {
  window.cancelAnimationFrame(anchorScrollFrame);

  if (reduceMotion || duration <= 0) {
    window.scrollTo({ top, behavior: "auto" });
    done?.();
    return;
  }

  const from = window.scrollY;
  const distance = top - from;
  if (Math.abs(distance) < 2) {
    window.scrollTo({ top, behavior: "auto" });
    done?.();
    return;
  }

  const started = performance.now();
  root.classList.add("anchor-easing");

  const step = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = easeInOutCubic(progress);
    window.scrollTo({ top: from + distance * eased, behavior: "auto" });

    if (progress < 1) {
      anchorScrollFrame = window.requestAnimationFrame(step);
      return;
    }

    anchorScrollFrame = 0;
    root.classList.remove("anchor-easing");
    window.scrollTo({ top, behavior: "auto" });
    done?.();
  };

  anchorScrollFrame = window.requestAnimationFrame(step);
};

const scrollToHash = (hash, { behavior, focus = false, historyMode = null } = {}) => {
  const target = targetFromHash(hash);
  if (!target) return false;

  closeMenu();
  prepareLanding(target);

  window.requestAnimationFrame(() => {
    syncAnchorOffset();
    const top = landingTop(target);

    if (historyMode === "push" && window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    } else if (historyMode === "replace") {
      window.history.replaceState(null, "", hash);
    }

    const finish = () => {
      if (focus) focusLanding(target);
    };

    if (behavior === "auto" || reduceMotion) {
      window.scrollTo({ top, behavior: "auto" });
      finish();
    } else {
      animateAnchorScroll(top, { duration: 420, done: finish });
    }
  });

  return true;
};

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const hash = link.getAttribute("href");
    if (!targetFromHash(hash)) return;

    event.preventDefault();
    closeMenu();
    window.requestAnimationFrame(() => {
      scrollToHash(hash, {
        behavior: link.classList.contains("skip") || reduceMotion ? "auto" : "smooth",
        focus: link.classList.contains("skip") || event.detail === 0,
        historyMode: "push"
      });
    });
  });
});

let hashAlignmentFrame = 0;
const queueHashAlignment = () => {
  if (!window.location.hash) return;
  window.cancelAnimationFrame(hashAlignmentFrame);
  hashAlignmentFrame = window.requestAnimationFrame(() => {
    scrollToHash(window.location.hash, { behavior: "auto" });
  });
};

window.addEventListener("popstate", queueHashAlignment);
window.addEventListener("hashchange", queueHashAlignment);
window.addEventListener(
  "load",
  async () => {
    try {
      await document.fonts?.ready;
    } finally {
      queueHashAlignment();
    }
  },
  { once: true }
);

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
    .map((link) => {
      const target = targetFromHash(link.getAttribute("href"));
      return [target?.closest("section") || target, link];
    })
    .filter(([section]) => Boolean(section))
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

// Keep an opened practice heading below the fixed header after layout shifts.
function bindPracticeItem(item) {
  if (!item || item.dataset.practiceBound) return;
  item.dataset.practiceBound = "true";
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    window.requestAnimationFrame(() => {
      const summary = item.querySelector("summary");
      if (!summary) return;
      const safeTop = Math.ceil(header?.getBoundingClientRect().height || 0) + anchorGap();
      const bounds = summary.getBoundingClientRect();
      if (bounds.top >= safeTop) return;
      window.scrollTo({
        top: Math.max(0, window.scrollY + bounds.top - safeTop),
        behavior: reduceMotion ? "auto" : "smooth"
      });
    });
  });
}
document.querySelectorAll(".practice-item").forEach(bindPracticeItem);

// Accessible team-profile dialogs. These binders are reusable because CMS-managed
// team profiles can replace the authored HTML after site.json loads.
function bindProfileButton(button) {
  if (!button || button.dataset.profileBound) return;
  button.dataset.profileBound = "true";
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.dialog);
    if (!(dialog instanceof HTMLDialogElement)) return;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  });
}

function bindProfileDialog(dialog) {
  if (!dialog || dialog.dataset.profileBound) return;
  dialog.dataset.profileBound = "true";
  dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (!document.querySelector(".profile-dialog[open]")) document.body.classList.remove("dialog-open");
  });
}
document.querySelectorAll(".profile-open").forEach(bindProfileButton);
document.querySelectorAll(".profile-dialog").forEach(bindProfileDialog);

const visualMode = new URLSearchParams(window.location.search).get("cms") === "visual";

// Consultation requests are sent to the private CMS enquiry store. If private
// storage is not configured, the existing email workflow remains a safe fallback.
const form = document.querySelector(".consultation");
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = form.querySelector(".form-status");
  if (visualMode) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    if (status) status.textContent = "Please complete all required fields.";
    return;
  }

  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (status) status.textContent = "Sending your enquiry securely…";

  try {
    const response = await fetch("/api/public?route=enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Secure enquiry storage is unavailable.");
    }
    form.reset();
    if (status) status.textContent = "Thank you. Your consultation request has been sent to KDH Advocates.";
  } catch {
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
    if (status) status.textContent = "Secure submission is unavailable, so your email application is being opened instead.";
    window.location.href = `mailto:law@kdhadvocates.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  } finally {
    if (submit) submit.disabled = false;
  }
});

let cookieChoice = null;
let managedAnalyticsEnabled = true;
const cookie = document.querySelector(".cookie");
try {
  cookieChoice = localStorage.getItem("kdh-cookie-choice");
} catch {
  cookieChoice = "essential";
}
if (cookie && !cookieChoice) cookie.hidden = false;
if (cookie) {
  cookie.addEventListener("click", (event) => {
    const choice = event.target.dataset.cookie;
    if (!choice) return;
    cookieChoice = choice;
    try { localStorage.setItem("kdh-cookie-choice", choice); } catch { /* storage may be restricted */ }
    cookie.hidden = true;
    if (choice === "all") trackPageView();
  });
}

function analyticsPath() {
  if (window.location.pathname.endsWith('/article') || window.location.pathname.endsWith('/article.html')) {
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return `/article/${slug}`;
  }
  return window.location.pathname || '/';
}

function trackPageView() {
  if (visualMode || !managedAnalyticsEnabled || cookieChoice !== "all") return;
  const path = analyticsPath();
  const key = `kdh-view:${path}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch { /* continue without de-duplication */ }
  fetch("/api/public?route=analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    keepalive: true
  }).catch(() => {});
}

// Published copy is kept in Git-backed content files. The visual editor uses
// stable DOM keys so every visible text fragment, image, and link can be edited
// while the public HTML remains a resilient fallback.
const readPath = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);

function elementKey(element) {
  if (element.dataset.cms) return `cms:${element.dataset.cms}`;
  if (element.id) return `#${element.id}`;

  const parts = [];
  let current = element;
  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(current) + 1})`);
    if (parent.id) {
      parts.unshift(`#${parent.id}`);
      break;
    }
    current = parent;
  }
  return parts.join(">");
}

function editableTextNodes() {
  const nodes = [];
  const excluded = "script,style,noscript,textarea,select,option,.scroll-guide,[aria-hidden='true'],[data-structured-cms],[data-cms-static]";

  const visit = (element) => {
    if (element.matches?.(excluded)) return;
    let textIndex = 0;
    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue.trim()) {
          nodes.push({
            key: `${elementKey(element)}::text-${textIndex}`,
            node,
            element
          });
        }
        textIndex += 1;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        visit(node);
      }
    });
  };

  visit(document.body);
  return nodes;
}

function relativeAssetUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : url.href;
  } catch {
    return value;
  }
}

function applyVisualContent(content) {
  if (!content || typeof content !== "object") return;
  const text = content.text || {};
  editableTextNodes().forEach(({ key, node }) => {
    if (typeof text[key] === "string") node.nodeValue = text[key];
  });

  const images = content.images || {};
  document.querySelectorAll("img").forEach((image) => {
    if (image.closest("[data-cms-static]")) return;
    const value = images[elementKey(image)];
    if (!value) return;
    if (typeof value.src === "string" && value.src) image.src = value.src;
    if (typeof value.alt === "string") image.alt = value.alt;
  });

  const links = content.links || {};
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.closest("[data-cms-static]")) return;
    const value = links[elementKey(link)];
    if (typeof value === "string" && value) link.setAttribute("href", value);
  });
}

function enableVisualEditor() {
  document.documentElement.classList.add("visual-cms-mode");
  const style = document.createElement("style");
  style.textContent = `
    .visual-cms-mode * { animation-duration: 0s !important; transition-duration: .12s !important; }
    .visual-cms-mode .reveal { opacity: 1 !important; transform: none !important; }
    .visual-cms-text {
      display: inline !important;
      position: static !important;
      inset: auto !important;
      float: none !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      transform: none !important;
      border-radius: 3px;
      cursor: text;
      outline: 1px dashed transparent;
      box-shadow: none !important;
      vertical-align: baseline !important;
    }
    .visual-cms-text:hover { outline-color: #d7ac27; background: rgba(215,172,39,.14); }
    .visual-cms-text:focus { outline: 2px solid #d7ac27; outline-offset: 2px; }
    .visual-cms-mode img[data-visual-key],
    .visual-cms-mode a[data-visual-key] { cursor: pointer; }
    .visual-cms-mode img[data-visual-key]:hover { outline: 3px solid #d7ac27; outline-offset: -3px; }
    .visual-cms-mode .hero-shade,
    .visual-cms-mode .contact-overlay { pointer-events: none !important; }
  `;
  document.head.appendChild(style);

  editableTextNodes().forEach(({ key, node }) => {
    const span = document.createElement("span");
    span.className = "visual-cms-text";
    span.dataset.visualKey = key;
    span.contentEditable = "true";
    span.spellcheck = true;
    span.textContent = node.nodeValue;
    node.replaceWith(span);
  });

  document.querySelectorAll("img").forEach((image) => {
    if (image.closest("[data-structured-cms], [data-cms-static]")) return;
    image.dataset.visualKey = elementKey(image);
  });
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.closest("[data-structured-cms], [data-cms-static]")) return;
    link.dataset.visualKey = elementKey(link);
  });

  document.addEventListener("click", (event) => {
    const image = event.target.closest("img[data-visual-key]");
    const link = event.target.closest("a[data-visual-key]");
    if (link) event.preventDefault();
    if (image) {
      window.parent.postMessage({
        type: "kdh:image-selected",
        key: image.dataset.visualKey,
        src: relativeAssetUrl(image.src),
        alt: image.alt
      }, window.location.origin);
    } else if (link && (event.shiftKey || !event.target.closest("[contenteditable='true']"))) {
      window.parent.postMessage({
        type: "kdh:link-selected",
        key: link.dataset.visualKey,
        href: link.getAttribute("href")
      }, window.location.origin);
    }
  }, true);
  document.querySelectorAll("form").forEach((editableForm) => {
    editableForm.addEventListener("submit", (event) => event.preventDefault());
  });
}

function exportVisualContent() {
  const text = {};
  document.querySelectorAll(".visual-cms-text[data-visual-key]").forEach((span) => {
    text[span.dataset.visualKey] = span.textContent;
  });

  const images = {};
  document.querySelectorAll("img[data-visual-key]").forEach((image) => {
    images[image.dataset.visualKey] = {
      src: relativeAssetUrl(image.src),
      alt: image.alt
    };
  });

  const links = {};
  document.querySelectorAll("a[data-visual-key][href]").forEach((link) => {
    links[link.dataset.visualKey] = link.getAttribute("href");
  });
  return { version: 1, text, images, links };
}

window.KDHVisualEditor = {
  applyContent: applyVisualContent,
  exportContent: exportVisualContent,
  updateImage(key, value) {
    const image = [...document.querySelectorAll("img[data-visual-key]")]
      .find((item) => item.dataset.visualKey === key);
    if (!image) return;
    if (value.src) image.src = value.src;
    image.alt = value.alt || "";
  },
  updateLink(key, href) {
    const link = [...document.querySelectorAll("a[data-visual-key]")]
      .find((item) => item.dataset.visualKey === key);
    if (link && href) link.setAttribute("href", href);
  }
};


function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function applyManagedSeo(seo = {}) {
  if (seo.title) document.title = seo.title;
  if (seo.description) ensureMeta('meta[name="description"]', { name: "description", content: seo.description });
  if (seo.robots) ensureMeta('meta[name="robots"]', { name: "robots", content: seo.robots });
  if (seo.title) ensureMeta('meta[property="og:title"]', { property: "og:title", content: seo.title });
  if (seo.description) ensureMeta('meta[property="og:description"]', { property: "og:description", content: seo.description });
  if (seo.canonical) ensureMeta('meta[property="og:url"]', { property: "og:url", content: seo.canonical });
  if (seo.ogImage) ensureMeta('meta[property="og:image"]', { property: "og:image", content: seo.ogImage });
  ensureMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
  ensureMeta('meta[name="twitter:card"]', { name: "twitter:card", content: seo.ogImage ? "summary_large_image" : "summary" });
  if (seo.title) ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: seo.title });
  if (seo.description) ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: seo.description });
  if (seo.ogImage) ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: seo.ogImage });

  if (seo.canonical) {
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = seo.canonical;
  }
}

function companySocialUrls(siteContent = {}) {
  const social = siteContent.social || {};
  return [social.linkedin, social.facebook, social.x || social.twitter]
    .map((value) => String(value || '').trim())
    .filter((value) => /^https:\/\//i.test(value));
}

function applyCompanySocialLinks(siteContent = {}) {
  const social = siteContent.social || {};
  const links = [
    ['LinkedIn', social.linkedin],
    ['Facebook', social.facebook],
    ['X', social.x || social.twitter]
  ].filter(([, url]) => /^https:\/\//i.test(String(url || '')));
  if (!links.length) return;

  const connectHeading = [...document.querySelectorAll('footer .footer-links > span')]
    .find((node) => node.textContent.trim().toLowerCase() === 'connect');
  const connect = connectHeading?.parentElement;
  if (!connect) return;
  connect.querySelectorAll('[data-company-social]').forEach((node) => node.remove());
  links.forEach(([label, url]) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.dataset.companySocial = label.toLowerCase();
    anchor.textContent = `${label} ↗`;
    connect.appendChild(anchor);
  });
}

function applySiteStructuredData(siteContent = {}) {
  const origin = 'https://www.kdhadvocates.com';
  const contact = siteContent.contact || {};
  const practices = Array.isArray(siteContent.practices) ? siteContent.practices : [];
  const team = Array.isArray(siteContent.team) ? siteContent.team : [];
  const sameAs = companySocialUrls(siteContent);
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      name: 'KDH Advocates LLP',
      alternateName: 'KDH Advocates',
      url: `${origin}/`
    },
    {
      '@type': 'LegalService',
      '@id': `${origin}/#legal-service`,
      name: 'KDH Advocates LLP',
      url: `${origin}/`,
      image: siteContent.seo?.ogImage || `${origin}/assets/kdh-law-logo.jpg`,
      description: siteContent.seo?.description || '',
      ...(sameAs.length ? { sameAs } : {}),
      email: contact.email || undefined,
      telephone: contact.phone || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: contact.office || 'IPS Building, 1st Floor, Kimathi Street',
        addressLocality: 'Nairobi',
        addressCountry: 'KE'
      },
      areaServed: [{ '@type': 'Country', name: 'Kenya' }, { '@type': 'Continent', name: 'Africa' }],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Legal practice areas',
        itemListElement: practices.map((practice) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: practice.title || '',
            url: `${origin}/expertise/${safeId(practice.slug || practice.title, 'practice')}`,
            description: practice.intro || ''
          }
        }))
      },
      employee: team.map((person) => ({
        '@type': 'Person',
        name: person.name || '',
        jobTitle: person.role || '',
        url: `${origin}/team/${safeId(person.id || person.name, 'person')}`,
        ...(person.linkedin ? { sameAs: [person.linkedin] } : {})
      }))
    }
  ];
  let node = document.getElementById('kdh-site-structured-data');
  if (!node) {
    node = document.createElement('script');
    node.type = 'application/ld+json';
    node.id = 'kdh-site-structured-data';
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

function syncPracticeSelect(practices = []) {
  const select = document.querySelector('#area');
  if (!select) return;
  const current = select.value;
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);
  practices.forEach((practice) => {
    const option = document.createElement('option');
    option.textContent = practice.title || '';
    select.appendChild(option);
  });
  const other = document.createElement('option');
  other.textContent = 'Other';
  select.appendChild(other);
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderManagedPractices(practices) {
  if (!Array.isArray(practices) || !practices.length) return;
  const container = document.querySelector('.practice-accordion');
  if (!container) return;
  container.dataset.structuredCms = 'practices';
  container.replaceChildren();

  practices.forEach((practice, index) => {
    const details = document.createElement('details');
    details.className = 'practice-item reveal visible';
    if (index === 0) details.open = true;

    const summary = document.createElement('summary');
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('h3');
    title.textContent = practice.title || '';
    const icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    summary.append(number, title, icon);

    const detail = document.createElement('div');
    detail.className = 'practice-detail';
    const intro = document.createElement('p');
    intro.textContent = practice.intro || '';
    const list = document.createElement('ul');
    (practice.services || []).forEach((service) => {
      const item = document.createElement('li');
      item.textContent = service;
      list.appendChild(item);
    });
    const practiceSlug = safeId(practice.slug || practice.title, `practice-${index + 1}`);
    const practiceLink = document.createElement('a');
    practiceLink.className = 'practice-page-link';
    practiceLink.href = `/expertise/${encodeURIComponent(practiceSlug)}`;
    practiceLink.textContent = `Explore ${practice.title || 'this'} practice`;
    practiceLink.setAttribute('aria-label', `Explore ${practice.title || 'this practice'} legal services`);
    detail.append(intro, list, practiceLink);
    details.append(summary, detail);
    container.appendChild(details);
    bindPracticeItem(details);
  });
  syncPracticeSelect(practices);
}

function safeId(value, fallback) {
  const id = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return id || fallback;
}

function renderManagedTeam(team) {
  if (!Array.isArray(team) || !team.length) return;
  const people = document.querySelector('.people');
  if (!people) return;
  people.dataset.structuredCms = 'team';
  people.replaceChildren();

  document.querySelectorAll('.profile-dialog').forEach((dialog) => dialog.remove());
  const cookieNotice = document.querySelector('.cookie');

  team.forEach((person, index) => {
    const id = `${safeId(person.id || person.name, 'person')}-${index + 1}`;
    const dialogId = `profile-${id}`;
    const article = document.createElement('article');
    article.className = `person ${index === 0 ? 'person-lead ' : ''}reveal visible`;

    const portrait = document.createElement('div');
    portrait.className = 'portrait';
    const image = document.createElement('img');
    image.src = person.image || '';
    image.alt = person.alt || `${person.name || 'KDH attorney'}, ${person.role || ''}`;
    portrait.appendChild(image);

    const copy = document.createElement('div');
    copy.className = 'person-copy';
    const role = document.createElement('p');
    role.textContent = person.role || '';
    const name = document.createElement('h3');
    name.textContent = person.name || '';
    const specialties = document.createElement('span');
    specialties.textContent = person.specialties || '';
    const button = document.createElement('button');
    button.className = 'profile-open';
    button.type = 'button';
    button.dataset.dialog = dialogId;
    button.textContent = 'Read full profile ';
    const arrow = document.createElement('b');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.appendChild(arrow);

    const actions = document.createElement('div');
    actions.className = 'team-card-actions';
    const profileLink = document.createElement('a');
    profileLink.className = 'profile-page-link';
    profileLink.href = `/team/${encodeURIComponent(safeId(person.id || person.name, `person-${index + 1}`))}`;
    profileLink.textContent = 'Profile';
    profileLink.setAttribute('aria-label', `View the full profile of ${person.name || 'this KDH attorney'}`);
    actions.appendChild(profileLink);
    if (person.linkedin) {
      const linkedIn = document.createElement('a');
      linkedIn.className = 'linkedin-profile-link';
      linkedIn.href = person.linkedin;
      linkedIn.target = '_blank';
      linkedIn.rel = 'noopener noreferrer';
      linkedIn.textContent = 'LinkedIn';
      linkedIn.setAttribute('aria-label', `${person.name || 'KDH attorney'} on LinkedIn`);
      actions.appendChild(linkedIn);
    }
    copy.append(role, name, specialties, button, actions);
    article.append(portrait, copy);
    people.appendChild(article);
    bindProfileButton(button);

    const dialog = document.createElement('dialog');
    dialog.className = 'profile-dialog';
    dialog.id = dialogId;
    const headingId = `${id}-name`;
    dialog.setAttribute('aria-labelledby', headingId);
    const close = document.createElement('button');
    close.className = 'dialog-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close profile');
    close.textContent = '×';
    const grid = document.createElement('div');
    grid.className = 'dialog-grid';
    const personColumn = document.createElement('div');
    personColumn.className = 'dialog-person';
    const dialogImage = document.createElement('img');
    dialogImage.src = person.image || '';
    dialogImage.alt = person.name || 'KDH attorney';
    const dialogRole = document.createElement('p');
    dialogRole.textContent = person.role || '';
    const dialogName = document.createElement('h2');
    dialogName.id = headingId;
    dialogName.textContent = person.name || '';
    const qualifications = document.createElement('span');
    (person.qualifications || []).forEach((qualification, qualificationIndex) => {
      if (qualificationIndex) qualifications.appendChild(document.createElement('br'));
      qualifications.appendChild(document.createTextNode(qualification));
    });
    personColumn.append(dialogImage, dialogRole, dialogName, qualifications);
    const dialogActions = document.createElement('div');
    dialogActions.className = 'dialog-profile-actions';
    const fullProfile = document.createElement('a');
    fullProfile.href = `/team/${encodeURIComponent(safeId(person.id || person.name, `person-${index + 1}`))}`;
    fullProfile.className = 'profile-page-link';
    fullProfile.textContent = 'Full profile ↗';
    dialogActions.appendChild(fullProfile);
    if (person.linkedin) {
      const dialogLinkedIn = document.createElement('a');
      dialogLinkedIn.href = person.linkedin;
      dialogLinkedIn.target = '_blank';
      dialogLinkedIn.rel = 'noopener noreferrer';
      dialogLinkedIn.className = 'linkedin-profile-link';
      dialogLinkedIn.textContent = 'LinkedIn ↗';
      dialogActions.appendChild(dialogLinkedIn);
    }
    personColumn.appendChild(dialogActions);

    const bio = document.createElement('div');
    bio.className = 'dialog-bio';
    (person.bio || []).forEach((paragraph) => {
      const p = document.createElement('p');
      p.textContent = paragraph;
      bio.appendChild(p);
    });
    grid.append(personColumn, bio);
    dialog.append(close, grid);
    document.body.insertBefore(dialog, cookieNotice || null);
    bindProfileDialog(dialog);
  });
}

function applyStructuredSiteContent(siteContent) {
  applyManagedSeo(siteContent.seo || {});
  applySiteStructuredData(siteContent);
      applyCompanySocialLinks(siteContent);
  renderManagedPractices(siteContent.practices);
  renderManagedTeam(siteContent.team);
  managedAnalyticsEnabled = siteContent.analytics?.enabled !== false;
  if (cookieChoice === 'all') trackPageView();
}


function formatInsightDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function createLatestInsightCard(post) {
  const article = document.createElement('article');
  article.className = 'latest-insight-card';

  const link = document.createElement('a');
  link.className = 'latest-insight-card-link';
  link.href = `/insights/${encodeURIComponent(post.slug || '')}`;
  link.setAttribute('aria-label', `Read ${post.title || 'KDH insight'}`);

  const media = document.createElement('div');
  media.className = 'latest-insight-media';
  if (post.coverImage) {
    const image = document.createElement('img');
    image.src = post.coverImage;
    image.alt = post.title || 'KDH Advocates insight';
    image.loading = 'lazy';
    image.decoding = 'async';
    media.appendChild(image);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'latest-insight-fallback';
    const mark = document.createElement('span');
    mark.textContent = 'KDH';
    const label = document.createElement('small');
    label.textContent = 'Legal insight';
    fallback.append(mark, label);
    media.appendChild(fallback);
  }

  const body = document.createElement('div');
  body.className = 'latest-insight-body';

  const meta = document.createElement('div');
  meta.className = 'latest-insight-meta';
  const type = document.createElement('span');
  type.textContent = 'Insight';
  const date = document.createElement('time');
  const rawDate = post.date || post.scheduledAt || '';
  if (rawDate) date.dateTime = rawDate;
  date.textContent = formatInsightDate(rawDate);
  meta.append(type, date);

  const title = document.createElement('h3');
  title.textContent = post.title || 'KDH insight';

  const summary = document.createElement('p');
  summary.textContent = post.summary || 'Read the latest legal and commercial perspective from KDH Advocates.';

  const footer = document.createElement('div');
  footer.className = 'latest-insight-footer';
  const author = document.createElement('span');
  author.textContent = post.author || 'KDH Advocates';
  const arrow = document.createElement('b');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  footer.append(author, arrow);

  body.append(meta, title, summary, footer);
  link.append(media, body);
  article.appendChild(link);
  return article;
}

async function loadLatestInsights() {
  const grid = document.querySelector('[data-latest-insights]');
  if (!grid) return;

  try {
    const response = await fetch('/api/public?route=posts', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load insights');
    const payload = await response.json();
    const posts = Array.isArray(payload) ? payload.slice(0, 3) : [];
    grid.replaceChildren();

    if (!posts.length) {
      const empty = document.createElement('div');
      empty.className = 'latest-insights-empty';
      const heading = document.createElement('h3');
      heading.textContent = 'New perspectives are on the way.';
      const copy = document.createElement('p');
      copy.textContent = 'Published articles will appear here automatically.';
      const link = document.createElement('a');
      link.href = 'insights.html';
      link.textContent = 'Explore insights →';
      empty.append(heading, copy, link);
      grid.appendChild(empty);
      return;
    }

    posts.forEach((post) => grid.appendChild(createLatestInsightCard(post)));
  } catch {
    grid.replaceChildren();
    const error = document.createElement('div');
    error.className = 'latest-insights-empty';
    const heading = document.createElement('h3');
    heading.textContent = 'Insights are temporarily unavailable.';
    const link = document.createElement('a');
    link.href = 'insights.html';
    link.textContent = 'Open the Insights page →';
    error.append(heading, link);
    grid.appendChild(error);
  }
}

async function loadManagedContent() {
  let siteContent = null;
  try {
    const siteResponse = await fetch("/content/site.json", { cache: "no-store" });
    if (siteResponse.ok) {
      siteContent = await siteResponse.json();
      document.querySelectorAll("[data-cms]").forEach((element) => {
        const value = readPath(siteContent, element.dataset.cms);
        if (typeof value !== "string") return;
        element.textContent = value;
        if (element.dataset.cms === "contact.email") element.href = `mailto:${value}`;
        if (element.dataset.cms === "contact.phone") element.href = `tel:${value.replace(/[^\d+]/g, "")}`;
      });
    }

    let pageResponse = await fetch("/api/public?route=page-content", { cache: "no-store" });
    if (!pageResponse.ok) pageResponse = await fetch("/content/page.json", { cache: "no-store" });
    if (pageResponse.ok) applyVisualContent(await pageResponse.json());

    // Structured CMS collections intentionally win over old visual-editor keys.
    if (siteContent) applyStructuredSiteContent(siteContent);
  } catch {
    // The carefully authored HTML remains the fallback if managed content cannot load.
  }

  if (visualMode) {
    enableVisualEditor();
    window.parent.postMessage({ type: "kdh:visual-ready" }, window.location.origin);
  } else if (cookieChoice === 'all') {
    trackPageView();
  }
}

loadLatestInsights();
loadManagedContent();
