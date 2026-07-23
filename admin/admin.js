const signin = document.querySelector("#signin");
const workspace = document.querySelector("#workspace");
const frame = document.querySelector("#site-frame");
const logout = document.querySelector("#logout");
const save = document.querySelector("#save");
const identity = document.querySelector("#identity");
const status = document.querySelector("#status");
const assetPanel = document.querySelector("#asset-panel");
const assetKind = document.querySelector("#asset-kind");
const assetTitle = document.querySelector("#asset-title");
const imageFields = document.querySelector("#image-fields");
const imageSrc = document.querySelector("#image-src");
const imageAlt = document.querySelector("#image-alt");
const linkFields = document.querySelector("#link-fields");
const linkHref = document.querySelector("#link-href");
let publishedContent = null;
let visualReady = false;
let selectedAsset = null;

async function request(url, options) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "The request could not be completed.");
  return data;
}

function applyPublishedContent() {
  if (!visualReady || !publishedContent) return;
  frame.contentWindow.KDHVisualEditor?.applyContent(publishedContent);
}

async function initialise() {
  try {
    const auth = await request("/api/cms/auth");
    signin.hidden = true;
    workspace.hidden = false;
    identity.textContent = `Signed in as ${auth.login}`;
    const result = await request("/api/cms/content");
    publishedContent = result.content;
    applyPublishedContent();
  } catch {
    signin.hidden = false;
    workspace.hidden = true;
  }
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === "kdh:visual-ready") {
    visualReady = true;
    applyPublishedContent();
    status.textContent = "Ready to edit";
  }
  if (event.data?.type === "kdh:image-selected") {
    selectedAsset = { type: "image", key: event.data.key };
    assetKind.textContent = "Image";
    assetTitle.textContent = "Edit image";
    imageSrc.value = event.data.src || "";
    imageAlt.value = event.data.alt || "";
    imageFields.hidden = false;
    linkFields.hidden = true;
    assetPanel.hidden = false;
  }
  if (event.data?.type === "kdh:link-selected") {
    selectedAsset = { type: "link", key: event.data.key };
    assetKind.textContent = "Link";
    assetTitle.textContent = "Edit destination";
    linkHref.value = event.data.href || "";
    imageFields.hidden = true;
    linkFields.hidden = false;
    assetPanel.hidden = false;
  }
});

save.addEventListener("click", async () => {
  const editor = frame.contentWindow.KDHVisualEditor;
  if (!visualReady || !editor) {
    status.textContent = "The visual editor is still loading.";
    return;
  }
  save.disabled = true;
  status.textContent = "Saving…";
  try {
    const content = editor.exportContent();
    const result = await request("/api/cms/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    publishedContent = content;
    status.textContent = result.message;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    save.disabled = false;
  }
});

document.querySelector("#image-apply").addEventListener("click", () => {
  if (selectedAsset?.type !== "image") return;
  frame.contentWindow.KDHVisualEditor?.updateImage(selectedAsset.key, {
    src: imageSrc.value.trim(),
    alt: imageAlt.value.trim()
  });
  status.textContent = "Image updated locally. Save to publish.";
  assetPanel.hidden = true;
});

document.querySelector("#link-apply").addEventListener("click", () => {
  if (selectedAsset?.type !== "link") return;
  frame.contentWindow.KDHVisualEditor?.updateLink(
    selectedAsset.key,
    linkHref.value.trim()
  );
  status.textContent = "Link updated locally. Save to publish.";
  assetPanel.hidden = true;
});

document.querySelector("#asset-close").addEventListener("click", () => {
  assetPanel.hidden = true;
});

logout.addEventListener("click", async () => {
  await request("/api/cms/logout", { method: "POST" });
  window.location.reload();
});

initialise();
