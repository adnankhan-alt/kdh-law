const signin = document.querySelector('#signin');
const workspace = document.querySelector('#workspace');
const frame = document.querySelector('#site-frame');
const logout = document.querySelector('#logout');
const saveHomepage = document.querySelector('#save-homepage');
const identity = document.querySelector('#identity');
const roleLabel = document.querySelector('#role-label');
const status = document.querySelector('#status');
const signinError = document.querySelector('#signin-error');
const keywordForm = document.querySelector('#keyword-form');
const keywordInput = document.querySelector('#keyword-input');
const assetPanel = document.querySelector('#asset-panel');
const assetKind = document.querySelector('#asset-kind');
const assetTitle = document.querySelector('#asset-title');
const imageFields = document.querySelector('#image-fields');
const imageSrc = document.querySelector('#image-src');
const imageAlt = document.querySelector('#image-alt');
const imageUpload = document.querySelector('#image-upload');
const linkFields = document.querySelector('#link-fields');
const linkHref = document.querySelector('#link-href');

window.KDHCMS = window.KDHCMS || { auth: null };

let visualReady = false;
let selectedAsset = null;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  let data = null;
  if (response.status !== 204) {
    const type = response.headers.get('content-type') || '';
    data = type.includes('application/json') ? await response.json() : await response.text();
  }
  if (!response.ok) {
    const message = typeof data === 'object' ? data?.error : data;
    throw new Error(message || 'The request could not be completed.');
  }
  return data;
}

window.KDHCMS.request = request;
let statusTimer = null;
window.KDHCMS.setStatus = (message, { persist = false } = {}) => {
  if (!status) return;
  window.clearTimeout(statusTimer);
  status.textContent = message || '';
  if (message && !persist) {
    statusTimer = window.setTimeout(() => {
      status.textContent = '';
    }, 3200);
  }
};

function showImageEditor(image) {
  selectedAsset = { type: 'image', key: image.dataset.visualKey };
  assetKind.textContent = 'Image';
  assetTitle.textContent = 'Edit image';
  imageSrc.value = image.getAttribute('src') || '';
  imageAlt.value = image.alt || '';
  if (imageUpload) imageUpload.value = '';
  imageFields.hidden = false;
  linkFields.hidden = true;
  assetPanel.hidden = false;
}

function showLinkEditor(link) {
  selectedAsset = { type: 'link', key: link.dataset.visualKey };
  assetKind.textContent = 'Link';
  assetTitle.textContent = 'Edit destination';
  linkHref.value = link.getAttribute('href') || '';
  imageFields.hidden = true;
  linkFields.hidden = false;
  assetPanel.hidden = false;
}

function bindFrameAssetSelection() {
  const documentElement = frame?.contentDocument?.documentElement;
  if (!documentElement || documentElement.dataset.assetEditorBound) return;
  documentElement.dataset.assetEditorBound = 'true';
  frame.contentDocument.addEventListener('click', (event) => {
    const image = event.target.closest?.('img[data-visual-key]');
    const link = event.target.closest?.('a[data-visual-key]');
    if (image) showImageEditor(image);
    if (link && (event.shiftKey || !event.target.closest?.("[contenteditable='true']"))) {
      event.preventDefault();
      showLinkEditor(link);
    }
  }, true);
}

function applyRoleUi(auth) {
  document.querySelectorAll('.admin-only').forEach((element) => {
    element.hidden = auth.role !== 'admin';
  });
  identity.textContent = auth.login || 'CMS user';
  roleLabel.textContent = `${auth.role || 'viewer'} · ${auth.provider || 'session'} login`;
}

async function exchangeKeyword(key) {
  if (!key) throw new Error('Enter the admin access keyword.');
  await request('/api/cms?route=keyword-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });
}

async function handleUrlGateway() {
  const rawHash = window.location.hash.replace(/^#/, '');
  if (!rawHash) return false;
  const params = new URLSearchParams(rawHash);
  const key = params.get('access');
  if (!key) return false;

  // Remove the secret from the visible URL immediately, before any other navigation.
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  try {
    await exchangeKeyword(key);
    return true;
  } catch (error) {
    signinError.textContent = error.message;
    return false;
  }
}

async function initialise() {
  await handleUrlGateway();
  try {
    const auth = await request('/api/cms?route=auth', { cache: 'no-store' });
    window.KDHCMS.auth = auth;
    signin.hidden = true;
    workspace.hidden = false;
    applyRoleUi(auth);

    window.dispatchEvent(new CustomEvent('kdh:cms-authenticated', { detail: auth }));
  } catch {
    signin.hidden = false;
    workspace.hidden = true;
  }
}

keywordForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  signinError.textContent = '';
  const button = keywordForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await exchangeKeyword(keywordInput.value.trim());
    keywordInput.value = '';
    await initialise();
  } catch (error) {
    signinError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === 'kdh:visual-ready') {
    visualReady = true;
    bindFrameAssetSelection();
  }
  if (event.data?.type === 'kdh:image-selected') {
    const image = [...(frame?.contentDocument?.querySelectorAll('img[data-visual-key]') || [])]
      .find((item) => item.dataset.visualKey === event.data.key);
    if (image) showImageEditor(image);
  }
  if (event.data?.type === 'kdh:link-selected') {
    const link = [...(frame?.contentDocument?.querySelectorAll('a[data-visual-key]') || [])]
      .find((item) => item.dataset.visualKey === event.data.key);
    if (link) showLinkEditor(link);
  }
});

saveHomepage?.addEventListener('click', async () => {
  const editor = frame?.contentWindow?.KDHVisualEditor;
  if (!visualReady || !editor) {
    window.KDHCMS.setStatus('The visual editor is still loading.');
    return;
  }
  saveHomepage.disabled = true;
  window.KDHCMS.setStatus('Saving homepage…');
  try {
    const content = editor.exportContent();
    const result = await request('/api/cms?route=content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    window.KDHCMS.setStatus(result.message || 'Homepage saved.');
  } catch (error) {
    window.KDHCMS.setStatus(error.message);
  } finally {
    saveHomepage.disabled = false;
  }
});

async function uploadImage(file) {
  if (!file) return null;
  if (file.size > 3 * 1024 * 1024) throw new Error('Images must be 3 MB or smaller.');
  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  const result = await request('/api/cms?route=upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, content })
  });
  return result?.url || null;
}

imageUpload?.addEventListener('change', async () => {
  const file = imageUpload.files?.[0];
  if (!file) return;
  imageUpload.disabled = true;
  window.KDHCMS.setStatus('Uploading replacement image…');
  try {
    const url = await uploadImage(file);
    if (url) {
      imageSrc.value = url;
      window.KDHCMS.setStatus('Image uploaded. Apply it, then Save Homepage.');
    }
  } catch (error) {
    window.KDHCMS.setStatus(error.message);
  } finally {
    imageUpload.disabled = false;
  }
});

document.querySelector('#image-apply')?.addEventListener('click', () => {
  if (selectedAsset?.type !== 'image') return;
  frame?.contentWindow?.KDHVisualEditor?.updateImage(selectedAsset.key, {
    src: imageSrc.value.trim(),
    alt: imageAlt.value.trim()
  });
  window.KDHCMS.setStatus('Image updated locally. Save Homepage to publish.');
  assetPanel.hidden = true;
});

document.querySelector('#link-apply')?.addEventListener('click', () => {
  if (selectedAsset?.type !== 'link') return;
  frame?.contentWindow?.KDHVisualEditor?.updateLink(selectedAsset.key, linkHref.value.trim());
  window.KDHCMS.setStatus('Link updated locally. Save Homepage to publish.');
  assetPanel.hidden = true;
});

document.querySelector('#asset-close')?.addEventListener('click', () => {
  assetPanel.hidden = true;
});

logout?.addEventListener('click', async () => {
  try {
    await request('/api/cms?route=logout', { method: 'POST' });
  } finally {
    window.location.replace('/admin/');
  }
});

initialise();
