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

let anchorSettleTimer = 0;
let anchorScrollEndHandler = null;
const settleLanding = (target) => {
  window.clearTimeout(anchorSettleTimer);
  if (anchorScrollEndHandler) {
    window.removeEventListener("scrollend", anchorScrollEndHandler);
  }

  const settle = () => {
    anchorScrollEndHandler = null;
    const top = landingTop(target);
    if (Math.abs(window.scrollY - top) > 1) {
      window.scrollTo({ top, behavior: "auto" });
    }
  };

  if ("onscrollend" in window) {
    anchorScrollEndHandler = () => {
      window.clearTimeout(anchorSettleTimer);
      settle();
    };
    window.addEventListener("scrollend", anchorScrollEndHandler, { once: true });
    anchorSettleTimer = window.setTimeout(() => {
      window.removeEventListener("scrollend", anchorScrollEndHandler);
      settle();
    }, 2200);
  } else {
    anchorSettleTimer = window.setTimeout(settle, 1100);
  }
};

const scrollToHash = (hash, { behavior, focus = false, historyMode = null } = {}) => {
  const target = targetFromHash(hash);
  if (!target) return false;

  closeMenu();
  prepareLanding(target);

  window.requestAnimationFrame(() => {
    syncAnchorOffset();
    window.scrollTo({
      top: landingTop(target),
      behavior: behavior || (reduceMotion ? "auto" : "smooth")
    });
    settleLanding(target);

    if (historyMode === "push" && window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    } else if (historyMode === "replace") {
      window.history.replaceState(null, "", hash);
    }

    if (focus) focusLanding(target);
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
document.querySelectorAll(".practice-item").forEach((item) => {
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
});

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

// Published copy is kept in Git-backed content files. The visual editor uses
// stable DOM keys so every visible text fragment, image, and link can be edited
// while the public HTML remains a resilient fallback.
const readPath = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);

const visualMode = new URLSearchParams(window.location.search).get("cms") === "visual";

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
  const excluded = "script,style,noscript,textarea,select,option,.scroll-guide,[aria-hidden='true']";

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
    const value = images[elementKey(image)];
    if (!value) return;
    if (typeof value.src === "string" && value.src) image.src = value.src;
    if (typeof value.alt === "string") image.alt = value.alt;
  });

  const links = content.links || {};
  document.querySelectorAll("a[href]").forEach((link) => {
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
    .visual-cms-text { border-radius: 3px; cursor: text; outline: 1px dashed transparent; }
    .visual-cms-text:hover { outline-color: #d7ac27; background: rgba(215,172,39,.14); }
    .visual-cms-text:focus { outline: 2px solid #d7ac27; background: rgba(255,255,255,.94); color: #0c1730; }
    .visual-cms-mode img[data-visual-key],
    .visual-cms-mode a[data-visual-key] { cursor: pointer; }
    .visual-cms-mode img[data-visual-key]:hover { outline: 3px solid #d7ac27; outline-offset: -3px; }
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
    image.dataset.visualKey = elementKey(image);
  });
  document.querySelectorAll("a[href]").forEach((link) => {
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
    } else if (link && !event.target.closest("[contenteditable='true']")) {
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

async function loadManagedContent() {
  try {
    const siteResponse = await fetch("/content/site.json", { cache: "no-store" });
    if (siteResponse.ok) {
      const siteContent = await siteResponse.json();
      document.querySelectorAll("[data-cms]").forEach((element) => {
        const value = readPath(siteContent, element.dataset.cms);
        if (typeof value !== "string") return;
        element.textContent = value;
        if (element.dataset.cms === "contact.email") element.href = `mailto:${value}`;
        if (element.dataset.cms === "contact.phone") {
          element.href = `tel:${value.replace(/[^\d+]/g, "")}`;
        }
      });
    }

    let pageResponse = await fetch("/api/page-content", { cache: "no-store" });
    if (!pageResponse.ok) {
      pageResponse = await fetch("/content/page.json", { cache: "no-store" });
    }
    if (pageResponse.ok) applyVisualContent(await pageResponse.json());
  } catch {
    // The carefully authored HTML remains the fallback if content cannot load.
  }

  if (visualMode) {
    enableVisualEditor();
    window.parent.postMessage({ type: "kdh:visual-ready" }, window.location.origin);
  }
}

loadManagedContent();
