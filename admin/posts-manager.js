(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const cms = window.KDHCMS || {};
  const setStatus = (message) => cms.setStatus?.(message);

  const menuItems = $$('.menu-item');
  const viewSections = $$('.view-section');
  const hamburger = $('#hamburger');
  const sidebar = $('#sidebar');
  const sidebarOverlay = $('#sidebar-overlay');

  const postsList = $('#posts-list');
  const postEditor = $('#view-post-editor');
  const postStatusFilter = $('#post-status-filter');
  const btnNewPost = $('#btn-new-post');
  const btnCancelPost = $('#btn-cancel-post');
  const btnSavePost = $('#btn-save-post');
  const btnDeletePost = $('#btn-delete-post');
  const btnAiGenerate = $('#btn-ai-generate');
  const pTitle = $('#post-title');
  const pSlug = $('#post-slug');
  const pSummary = $('#post-summary');
  const pAuthor = $('#post-author');
  const pStatus = $('#post-status');
  const pScheduledAt = $('#post-scheduled-at');
  const scheduleField = $('#schedule-field');
  const pCover = $('#post-cover');
  const pCoverUpload = $('#post-cover-upload');
  const pCoverPreview = $('#post-cover-preview');
  const pSeoTitle = $('#post-seo-title');
  const pSeoDescription = $('#post-seo-description');
  const pFallbackContent = $('#post-content-fallback');
  const postEditorHeading = $('#post-editor-heading');

  const teamManager = $('#team-manager');
  const practiceManager = $('#practice-manager');
  const adminsManager = $('#admins-manager');
  const enquiriesList = $('#enquiries-list');

  const geminiKeyInput = $('#gemini-key');
  const btnSaveSettings = $('#btn-save-settings');

  let auth = null;
  let currentPosts = [];
  let editingSha = null;
  let editingSlug = null;
  let editingDate = null;
  let siteState = null;
  let pAuthorSelect = null;
  let quill = null;
  let bootstrapped = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function normaliseLinkedIn(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.replace(/^http:\/\//i, 'https://');
  }

  function ensureAuthorDropdown() {
    if (!pAuthor) return null;
    if (pAuthorSelect?.isConnected) return pAuthorSelect;

    const select = document.createElement('select');
    select.id = 'post-author-select';
    select.className = pAuthor.className || '';
    select.setAttribute('aria-label', 'Article author');
    select.disabled = !canEdit();
    select.addEventListener('change', () => { pAuthor.value = select.value; });

    pAuthor.hidden = true;
    pAuthor.setAttribute('aria-hidden', 'true');
    pAuthor.tabIndex = -1;
    pAuthor.insertAdjacentElement('afterend', select);
    pAuthorSelect = select;
    return select;
  }

  function populateAuthorDropdown(selectedValue = pAuthor?.value || 'KDH Advocates LLP') {
    const select = ensureAuthorDropdown();
    if (!select) return;

    const selected = String(selectedValue || '').trim() || 'KDH Advocates LLP';
    const team = Array.isArray(siteState?.team) ? siteState.team : [];
    const options = [{ value: 'KDH Advocates LLP', label: 'KDH Advocates LLP (Firm)' }];
    team.forEach((person) => {
      const name = String(person?.name || '').trim();
      if (!name) return;
      const role = String(person?.role || '').trim();
      options.push({ value: name, label: role ? `${name} — ${role}` : name });
    });
    if (!options.some((option) => option.value === selected)) options.push({ value: selected, label: `${selected} (existing author)` });

    select.replaceChildren(...options.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    select.value = selected;
    pAuthor.value = select.value;
  }

  function canEdit() {
    return auth && ['editor', 'admin'].includes(auth.role);
  }

  function canAdmin() {
    return auth?.role === 'admin';
  }

  async function api(url, options = {}) {
    if (cms.request) return cms.request(url, options);
    const response = await fetch(url, options);
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(data?.error || 'Request failed.');
    return data;
  }

  function toggleSidebar(force) {
    const shouldOpen = typeof force === 'boolean' ? force : !sidebar?.classList.contains('open');
    sidebar?.classList.toggle('open', shouldOpen);
    sidebarOverlay?.classList.toggle('open', shouldOpen);
    hamburger?.setAttribute('aria-expanded', String(shouldOpen));
  }

  function activateView(targetId) {
    if (targetId === 'view-admins' && !canAdmin()) return;
    viewSections.forEach((section) => section.classList.toggle('active', section.id === targetId));
    menuItems.forEach((item) => item.classList.toggle('active', item.dataset.target === targetId));
    toggleSidebar(false);

    if (targetId === 'view-insights') loadPosts();
    if (targetId === 'view-team' || targetId === 'view-practices' || targetId === 'view-seo') loadSiteData();
    if (targetId === 'view-enquiries') loadEnquiries();
    if (targetId === 'view-analytics') { loadAnalytics(); loadSiteData({ quiet: true }); }
    if (targetId === 'view-admins') loadAdmins();
  }

  hamburger?.addEventListener('click', () => toggleSidebar());
  sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));
  menuItems.forEach((item) => item.addEventListener('click', () => activateView(item.dataset.target)));
  $$('[data-open-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.openView)));

  function initialiseQuill() {
    try {
      const target = $('#post-editor-quill');
      if (!target) return;
      if (typeof window.Quill === 'undefined') {
        target.hidden = true;
        pFallbackContent.hidden = false;
        return;
      }
      quill = new window.Quill('#post-editor-quill', {
        theme: 'bubble',
        placeholder: 'Write the article here. Highlight text to format it…',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ header: 1 }, { header: 2 }],
            ['blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image', 'video'],
            ['clean']
          ]
        }
      });
      quill.getModule('toolbar')?.addHandler('image', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (!file) return;
          setStatus('Uploading inline image…');
          const url = await uploadFile(file);
          if (!url) return setStatus('Image upload failed.');
          const range = quill.getSelection(true) || { index: quill.getLength() };
          quill.insertEmbed(range.index, 'image', url);
          setStatus('Image uploaded.');
        });
        input.click();
      });
    } catch (error) {
      console.error('Failed to initialise Quill:', error);
      $('#post-editor-quill').hidden = true;
      pFallbackContent.hidden = false;
    }
  }

  function articleContent() {
    return quill ? quill.root.innerHTML : pFallbackContent.value;
  }

  function setArticleContent(value) {
    if (quill) quill.root.innerHTML = value || '';
    else pFallbackContent.value = value || '';
  }

  async function uploadFile(file) {
    try {
      if (!file || file.size > 3 * 1024 * 1024) throw new Error('Images must be 3 MB or smaller.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Unable to read the selected file.'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const data = await api('/api/cms?route=upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, content: dataUrl })
      });
      return data?.url || null;
    } catch (error) {
      setStatus(error.message);
      return null;
    }
  }

  pCoverUpload?.addEventListener('change', async () => {
    const file = pCoverUpload.files?.[0];
    if (!file) return;
    pCoverUpload.disabled = true;
    setStatus('Uploading cover image…');
    const url = await uploadFile(file);
    pCoverUpload.disabled = false;
    if (!url) return;
    pCover.value = url;
    pCoverPreview.src = url;
    pCoverPreview.hidden = false;
    setStatus('Cover image uploaded.');
  });

  pStatus?.addEventListener('change', () => {
    scheduleField.hidden = pStatus.value !== 'scheduled';
  });

  async function loadPosts({ quiet = false } = {}) {
    if (!postsList) return [];
    if (!quiet) postsList.textContent = 'Loading articles…';
    try {
      currentPosts = await api('/api/cms?route=posts', { cache: 'no-store' });
      renderPosts();
      $('#metric-posts').textContent = String(currentPosts.length);
      return currentPosts;
    } catch (error) {
      if (!quiet) postsList.textContent = error.message;
      $('#metric-posts').textContent = '—';
      return [];
    }
  }

  function renderPosts() {
    const filter = postStatusFilter?.value || 'all';
    const posts = currentPosts.filter((post) => filter === 'all' || (post.status || 'published') === filter);
    if (!posts.length) {
      postsList.innerHTML = '<div class="post-item"><div><strong>No matching articles</strong><p>Create a new article or change the status filter.</p></div></div>';
      return;
    }
    postsList.innerHTML = posts.map((post) => {
      const statusValue = post.status || 'published';
      const when = statusValue === 'scheduled' && post.scheduledAt
        ? ` · ${new Date(post.scheduledAt).toLocaleString()}`
        : '';
      return `<article class="post-item">
        <div>
          <strong>${escapeHtml(post.title || post.slug)}</strong>
          <p>/${escapeHtml(post.slug)} · ${post.date ? new Date(post.date).toLocaleDateString() : 'No date'}${escapeHtml(when)}</p>
          <span class="status-badge ${escapeAttr(statusValue)}">${escapeHtml(statusValue)}</span>
        </div>
        <button class="secondary edit-post" type="button" data-slug="${escapeAttr(post.slug)}">Edit</button>
      </article>`;
    }).join('');
  }

  postStatusFilter?.addEventListener('change', renderPosts);
  postsList?.addEventListener('click', (event) => {
    const button = event.target.closest('.edit-post');
    if (button) editPost(button.dataset.slug);
  });

  function toLocalDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function resetPostForm() {
    editingSha = null;
    editingSlug = null;
    editingDate = null;
    pTitle.value = '';
    pSlug.value = '';
    pSlug.disabled = false;
    delete pSlug.dataset.manual;
    pSummary.value = '';
    pAuthor.value = 'KDH Advocates LLP';
    populateAuthorDropdown(pAuthor.value);
    pStatus.value = 'draft';
    pScheduledAt.value = '';
    scheduleField.hidden = true;
    pCover.value = '';
    pCoverUpload.value = '';
    pCoverPreview.hidden = true;
    pCoverPreview.removeAttribute('src');
    pSeoTitle.value = '';
    pSeoDescription.value = '';
    setArticleContent('');
    btnDeletePost.hidden = true;
    postEditorHeading.textContent = 'New article';
  }

  btnNewPost?.addEventListener('click', () => {
    if (!canEdit()) return setStatus('Your role is read-only.');
    resetPostForm();
    activateView('view-post-editor');
  });

  async function editPost(slug) {
    setStatus('Loading article…');
    try {
      const data = await api(`/api/cms?route=posts&slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const post = data.post || {};
      editingSha = data.sha;
      editingSlug = post.slug;
      editingDate = post.date || null;
      pTitle.value = post.title || '';
      pSlug.value = post.slug || '';
      pSlug.disabled = true;
      pSummary.value = post.summary || '';
      pAuthor.value = post.author || 'KDH Advocates LLP';
      populateAuthorDropdown(pAuthor.value);
      pStatus.value = post.status || 'published';
      pScheduledAt.value = toLocalDateTime(post.scheduledAt);
      scheduleField.hidden = pStatus.value !== 'scheduled';
      pCover.value = post.coverImage || '';
      if (post.coverImage) {
        pCoverPreview.src = post.coverImage;
        pCoverPreview.hidden = false;
      } else {
        pCoverPreview.hidden = true;
      }
      pSeoTitle.value = post.seoTitle || '';
      pSeoDescription.value = post.seoDescription || '';
      setArticleContent(post.content || '');
      btnDeletePost.hidden = !canEdit();
      postEditorHeading.textContent = 'Edit article';
      activateView('view-post-editor');
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  btnCancelPost?.addEventListener('click', () => activateView('view-insights'));

  btnSavePost?.addEventListener('click', async () => {
    if (!canEdit()) return setStatus('Your role is read-only.');
    const slug = pSlug.value.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return setStatus('Use a lowercase URL slug with letters, numbers and hyphens only.');
    if (!pTitle.value.trim() || !articleContent().trim()) return setStatus('Title and article body are required.');
    if (pStatus.value === 'scheduled' && !pScheduledAt.value) return setStatus('Choose a publication date and time for a scheduled article.');

    btnSavePost.disabled = true;
    setStatus('Saving article to GitHub…');
    try {
      const data = await api('/api/cms?route=posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title: pTitle.value.trim(),
          summary: pSummary.value.trim(),
          author: pAuthor.value.trim(),
          status: pStatus.value,
          scheduledAt: pStatus.value === 'scheduled' ? new Date(pScheduledAt.value).toISOString() : '',
          coverImage: pCover.value.trim(),
          content: articleContent(),
          seoTitle: pSeoTitle.value.trim(),
          seoDescription: pSeoDescription.value.trim(),
          date: editingDate,
          sha: editingSha
        })
      });
      editingSha = data.sha;
      editingSlug = slug;
      editingDate = data.post?.date || editingDate;
      pSlug.disabled = true;
      btnDeletePost.hidden = false;
      setStatus(pStatus.value === 'draft' ? 'Draft saved.' : pStatus.value === 'scheduled' ? 'Article scheduled.' : 'Article published.');
      await loadPosts({ quiet: true });
    } catch (error) {
      setStatus(error.message);
    } finally {
      btnSavePost.disabled = false;
    }
  });

  btnDeletePost?.addEventListener('click', async () => {
    if (!canEdit() || !editingSlug || !editingSha) return;
    if (!window.confirm(`Delete “${pTitle.value || editingSlug}”? This creates a deletion commit in GitHub.`)) return;
    btnDeletePost.disabled = true;
    setStatus('Deleting article…');
    try {
      await api('/api/cms?route=posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: editingSlug, sha: editingSha })
      });
      setStatus('Article deleted.');
      await loadPosts({ quiet: true });
      activateView('view-insights');
    } catch (error) {
      setStatus(error.message);
    } finally {
      btnDeletePost.disabled = false;
    }
  });

  pTitle?.addEventListener('input', () => {
    if (editingSlug || pSlug.dataset.manual === 'true') return;
    pSlug.value = pTitle.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  });
  pSlug?.addEventListener('input', () => { pSlug.dataset.manual = 'true'; });

  btnAiGenerate?.addEventListener('click', async () => {
    if (!canEdit()) return setStatus('Your role is read-only.');
    const prompt = window.prompt('What legal topic should the article cover?');
    if (!prompt) return;
    const apiKey = localStorage.getItem('kdh_gemini_key');
    if (!apiKey) return setStatus('Add your Gemini API key in Settings first.');

    btnAiGenerate.disabled = true;
    setStatus('Gemini is drafting the article…');
    try {
      const data = await api('/api/cms?route=generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, apiKey })
      });
      pTitle.value = data.title || '';
      if (!editingSlug) pSlug.value = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      pSummary.value = data.summary || '';
      setArticleContent(data.content || '');
      pStatus.value = 'draft';
      scheduleField.hidden = true;
      setStatus('AI draft ready. Review it before publishing.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      btnAiGenerate.disabled = false;
    }
  });

  async function loadSiteData({ quiet = false } = {}) {
    try {
      const data = await api('/api/cms?route=site', { cache: 'no-store' });
      siteState = data.content || {};
      populateAuthorDropdown(pAuthor?.value || 'KDH Advocates LLP');
      renderTeamManager();
      renderPracticeManager();
      populateSeo();
      const analyticsToggle = $('#analytics-enabled');
      if (analyticsToggle) analyticsToggle.checked = siteState.analytics?.enabled !== false;
      $('#metric-team').textContent = String(siteState.team?.length || 0);
      $('#metric-practices').textContent = String(siteState.practices?.length || 0);
      return siteState;
    } catch (error) {
      if (!quiet) setStatus(error.message);
      return null;
    }
  }

  async function saveSitePatch(patch, message) {
    if (!canEdit()) throw new Error('Your role is read-only.');
    const latest = await api('/api/cms?route=site', { cache: 'no-store' });
    const content = { ...(latest.content || {}), ...patch };
    const result = await api('/api/cms?route=site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    siteState = content;
    setStatus(message || result.message || 'Site settings saved.');
    return result;
  }

  function repeatButtons(index, length) {
    return `<div class="repeat-actions">
      <button class="mini-button move-up" type="button" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="mini-button move-down" type="button" ${index === length - 1 ? 'disabled' : ''}>↓</button>
      <button class="mini-button remove" type="button">Remove</button>
    </div>`;
  }

  function renderTeamManager() {
    if (!teamManager || !siteState) return;
    const team = Array.isArray(siteState.team) ? siteState.team : [];
    if (!team.length) teamManager.innerHTML = '<p>No attorneys configured.</p>';
    else teamManager.innerHTML = team.map((person, index) => `<article class="repeat-card team-card" data-index="${index}">
      <div class="repeat-head"><h3>${escapeHtml(person.name || `Attorney ${index + 1}`)}</h3>${repeatButtons(index, team.length)}</div>
      <div class="repeat-grid">
        <label>Name<input data-field="name" value="${escapeAttr(person.name)}"></label>
        <label>Role / title<input data-field="role" value="${escapeAttr(person.role)}"></label>
        <label>Profile slug <small>SEO URL</small><input data-field="slug" value="${escapeAttr(person.id || '')}" placeholder="yvonne-kinya-kiruja"></label>
        <label>LinkedIn profile URL<input data-field="linkedin" type="url" value="${escapeAttr(normaliseLinkedIn(person.linkedin || ''))}" placeholder="https://www.linkedin.com/in/..."></label>
        <label class="full">Practice focus<input data-field="specialties" value="${escapeAttr(person.specialties)}"></label>
        <label>Portrait URL<input data-field="image" value="${escapeAttr(person.image)}"></label>
        <label>Upload portrait<input class="team-image-upload" type="file" accept="image/*"></label>
        <label class="full">Image alt text<input data-field="alt" value="${escapeAttr(person.alt || person.name)}"></label>
        <label class="full">SEO title <small>Recommended: ~50–60 characters</small><input data-field="seoTitle" value="${escapeAttr(person.seoTitle || '')}" placeholder="Name | Role | KDH Advocates Kenya"></label>
        <label class="full">SEO description <small>Recommended: ~140–160 characters</small><textarea data-field="seoDescription" rows="3" placeholder="Search description for this lawyer profile">${escapeHtml(person.seoDescription || '')}</textarea></label>
        <label class="full">Qualifications <small>One per line</small><textarea data-field="qualifications" rows="3">${escapeHtml((person.qualifications || []).join('\n'))}</textarea></label>
        <label class="full">Biography <small>Separate paragraphs with a blank line</small><textarea data-field="bio" rows="9">${escapeHtml((person.bio || []).join('\n\n'))}</textarea></label>
      </div>
    </article>`).join('');
    if (!canEdit()) $$('input,textarea,button', teamManager).forEach((el) => { el.disabled = true; });
  }

  function collectTeam() {
    return $$('.team-card', teamManager).map((card, index) => {
      const name = card.querySelector('[data-field="name"]').value.trim();
      const requestedSlug = card.querySelector('[data-field="slug"]').value.trim();
      const id = (requestedSlug || name || `person-${index + 1}`).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return {
        id,
        name,
        role: card.querySelector('[data-field="role"]').value.trim(),
        linkedin: normaliseLinkedIn(card.querySelector('[data-field="linkedin"]').value),
        specialties: card.querySelector('[data-field="specialties"]').value.trim(),
        image: card.querySelector('[data-field="image"]').value.trim(),
        alt: card.querySelector('[data-field="alt"]').value.trim(),
        seoTitle: card.querySelector('[data-field="seoTitle"]').value.trim(),
        seoDescription: card.querySelector('[data-field="seoDescription"]').value.trim(),
        qualifications: card.querySelector('[data-field="qualifications"]').value.split('\n').map((v) => v.trim()).filter(Boolean),
        bio: card.querySelector('[data-field="bio"]').value.split(/\n\s*\n/).map((v) => v.trim()).filter(Boolean)
      };
    });
  }

  $('#btn-add-team')?.addEventListener('click', () => {
    if (!canEdit()) return;
    siteState = siteState || {};
    const currentTeam = teamManager?.querySelector('.team-card') ? collectTeam() : (siteState.team || []);
    siteState.team = [...currentTeam, { id: '', name: 'New Attorney', role: 'Associate', linkedin: '', specialties: '', image: '', alt: '', seoTitle: '', seoDescription: '', qualifications: [], bio: [] }];
    renderTeamManager();
  });

  teamManager?.addEventListener('change', async (event) => {
    const upload = event.target.closest('.team-image-upload');
    if (!upload || !upload.files?.[0]) return;
    const card = upload.closest('.team-card');
    upload.disabled = true;
    setStatus('Uploading attorney portrait…');
    const url = await uploadFile(upload.files[0]);
    upload.disabled = false;
    if (url) {
      card.querySelector('[data-field="image"]').value = url;
      setStatus('Portrait uploaded. Save Attorneys to publish it.');
    }
  });

  $('#btn-save-team')?.addEventListener('click', async () => {
    try {
      const team = collectTeam();
      if (team.some((person) => !person.name || !person.role || !person.id)) throw new Error('Every attorney needs a name, role and profile slug.');
      const badLinkedIn = team.find((person) => person.linkedin && !/^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\//i.test(person.linkedin));
      if (badLinkedIn) throw new Error(`LinkedIn URL for ${badLinkedIn.name} must be a linkedin.com profile URL.`);
      setStatus('Saving attorneys…');
      await saveSitePatch({ team }, 'Attorney profiles, LinkedIn links and SEO metadata saved to GitHub.');
      siteState = { ...(siteState || {}), team };
      populateAuthorDropdown(pAuthor?.value || 'KDH Advocates LLP');
      $('#metric-team').textContent = String(team.length);
    } catch (error) { setStatus(error.message); }
  });

  function renderPracticeManager() {
    if (!practiceManager || !siteState) return;
    const practices = Array.isArray(siteState.practices) ? siteState.practices : [];
    if (!practices.length) practiceManager.innerHTML = '<p>No practice areas configured.</p>';
    else practiceManager.innerHTML = practices.map((practice, index) => `<article class="repeat-card practice-card" data-index="${index}">
      <div class="repeat-head"><h3>${escapeHtml(practice.title || `Practice ${index + 1}`)}</h3>${repeatButtons(index, practices.length)}</div>
      <div class="repeat-grid">
        <label class="full">Practice name<input data-field="title" value="${escapeAttr(practice.title)}"></label>
        <label>Practice slug <small>SEO URL</small><input data-field="slug" value="${escapeAttr(practice.slug || '')}" placeholder="corporate-commercial"></label>
        <label>SEO title <small>Recommended: ~50–60 characters</small><input data-field="seoTitle" value="${escapeAttr(practice.seoTitle || '')}" placeholder="Corporate & Commercial Lawyers in Kenya | KDH"></label>
        <label class="full">SEO description <small>Recommended: ~140–160 characters</small><textarea data-field="seoDescription" rows="3" placeholder="Search description for this practice area">${escapeHtml(practice.seoDescription || '')}</textarea></label>
        <label class="full">Introduction<textarea data-field="intro" rows="3">${escapeHtml(practice.intro)}</textarea></label>
        <label class="full">Services <small>One item per line</small><textarea class="list-editor" data-field="services" rows="7">${escapeHtml((practice.services || []).join('\n'))}</textarea></label>
      </div>
    </article>`).join('');
    if (!canEdit()) $$('input,textarea,button', practiceManager).forEach((el) => { el.disabled = true; });
  }

  function collectPractices() {
    return $$('.practice-card', practiceManager).map((card, index) => {
      const title = card.querySelector('[data-field="title"]').value.trim();
      const requestedSlug = card.querySelector('[data-field="slug"]').value.trim();
      const slug = (requestedSlug || title || `practice-${index + 1}`).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return {
        title,
        slug,
        seoTitle: card.querySelector('[data-field="seoTitle"]').value.trim(),
        seoDescription: card.querySelector('[data-field="seoDescription"]').value.trim(),
        intro: card.querySelector('[data-field="intro"]').value.trim(),
        services: card.querySelector('[data-field="services"]').value.split('\n').map((v) => v.trim()).filter(Boolean)
      };
    });
  }

  $('#btn-add-practice')?.addEventListener('click', () => {
    if (!canEdit()) return;
    siteState = siteState || {};
    const currentPractices = practiceManager?.querySelector('.practice-card') ? collectPractices() : (siteState.practices || []);
    siteState.practices = [...currentPractices, { title: 'New Practice Area', slug: '', seoTitle: '', seoDescription: '', intro: '', services: [] }];
    renderPracticeManager();
  });

  $('#btn-save-practices')?.addEventListener('click', async () => {
    try {
      const practices = collectPractices();
      if (practices.some((practice) => !practice.title || !practice.slug)) throw new Error('Every practice area needs a name and SEO slug.');
      setStatus('Saving practice areas…');
      await saveSitePatch({ practices }, 'Practice areas and SEO metadata saved to GitHub.');
      $('#metric-practices').textContent = String(practices.length);
    } catch (error) { setStatus(error.message); }
  });

  function handleRepeatActions(event, manager, cardSelector, kind) {
    const card = event.target.closest(cardSelector);
    if (!card || !canEdit()) return;
    const action = event.target.closest('.remove,.move-up,.move-down');
    if (!action) return;
    if (action.classList.contains('remove')) card.remove();
    if (action.classList.contains('move-up') && card.previousElementSibling) card.parentNode.insertBefore(card, card.previousElementSibling);
    if (action.classList.contains('move-down') && card.nextElementSibling) card.parentNode.insertBefore(card.nextElementSibling, card);
    if (kind === 'team') {
      siteState.team = collectTeam();
      renderTeamManager();
    } else {
      siteState.practices = collectPractices();
      renderPracticeManager();
    }
  }
  teamManager?.addEventListener('click', (event) => handleRepeatActions(event, teamManager, '.team-card', 'team'));
  practiceManager?.addEventListener('click', (event) => handleRepeatActions(event, practiceManager, '.practice-card', 'practice'));

  function ensureCompanySocialFields() {
    if ($('#company-social-seo')) return;
    const form = document.querySelector('#view-seo .post-form');
    const saveButton = $('#btn-save-seo');
    if (!form || !saveButton) return;
    const section = document.createElement('div');
    section.id = 'company-social-seo';
    section.className = 'panel';
    section.style.gridColumn = '1 / -1';
    section.innerHTML = `
      <h3 style="margin-top:0">Company social profiles</h3>
      <p style="margin-top:0;color:#667085">Used for KDH organisation SEO, structured data and public social links. Profile URLs are enough; no API key is needed for this SEO connection.</p>
      <div class="post-form" style="padding:0;border:0;background:transparent">
        <label>LinkedIn company page URL<input id="social-linkedin" type="url" placeholder="https://www.linkedin.com/company/..." autocomplete="url"></label>
        <label>Facebook page URL<input id="social-facebook" type="url" placeholder="https://www.facebook.com/..." autocomplete="url"></label>
        <label>X / Twitter profile URL<input id="social-x" type="url" placeholder="https://x.com/..." autocomplete="url"></label>
      </div>`;
    form.insertBefore(section, saveButton);
  }

  function populateSeo() {
    ensureCompanySocialFields();
    const seo = siteState?.seo || {};
    const social = siteState?.social || {};
    $('#seo-title').value = seo.title || '';
    $('#seo-description').value = seo.description || '';
    $('#seo-canonical').value = seo.canonical || '';
    $('#seo-og-image').value = seo.ogImage || '';
    $('#seo-robots').value = seo.robots || 'index,follow';
    if ($('#social-linkedin')) $('#social-linkedin').value = social.linkedin || '';
    if ($('#social-facebook')) $('#social-facebook').value = social.facebook || '';
    if ($('#social-x')) $('#social-x').value = social.x || social.twitter || '';
  }

  $('#btn-save-seo')?.addEventListener('click', async () => {
    try {
      const seo = {
        title: $('#seo-title').value.trim(),
        description: $('#seo-description').value.trim(),
        canonical: $('#seo-canonical').value.trim(),
        ogImage: $('#seo-og-image').value.trim(),
        robots: $('#seo-robots').value
      };
      const social = {
        linkedin: $('#social-linkedin')?.value.trim() || '',
        facebook: $('#social-facebook')?.value.trim() || '',
        x: $('#social-x')?.value.trim() || ''
      };
      if (!seo.title || !seo.description) throw new Error('SEO title and description are required.');
      const invalidSocial = Object.entries(social).find(([, value]) => value && !/^https:\/\//i.test(value));
      if (invalidSocial) throw new Error('Company social profile links must use full https:// URLs.');
      setStatus('Saving SEO and company social profiles…');
      await saveSitePatch({ seo, social }, 'SEO settings and company social profiles saved to GitHub.');
    } catch (error) { setStatus(error.message); }
  });

  async function loadEnquiries({ quiet = false } = {}) {
    try {
      if (!quiet) enquiriesList.textContent = 'Loading enquiries…';
      const enquiries = await api('/api/cms?route=enquiries', { cache: 'no-store' });
      const newCount = enquiries.filter((item) => item.status === 'new').length;
      $('#metric-enquiries').textContent = String(newCount);
      if (!quiet) renderEnquiries(enquiries);
      return enquiries;
    } catch (error) {
      $('#metric-enquiries').textContent = 'N/A';
      if (!quiet) enquiriesList.innerHTML = `<div class="enquiry-card"><b>Private enquiry storage is unavailable.</b><p>${escapeHtml(error.message)}</p></div>`;
      return [];
    }
  }

  function renderEnquiries(enquiries) {
    if (!enquiries.length) {
      enquiriesList.innerHTML = '<div class="enquiry-card"><b>No enquiries yet.</b></div>';
      return;
    }
    enquiriesList.innerHTML = enquiries.map((item) => `<article class="enquiry-card ${item.status === 'new' ? 'new' : ''}" data-id="${escapeAttr(item.id)}">
      <div class="enquiry-head"><div><h3>${escapeHtml(item.name)}</h3><p class="enquiry-meta"><a href="mailto:${escapeAttr(item.email)}">${escapeHtml(item.email)}</a>${item.company ? ` · ${escapeHtml(item.company)}` : ''} · ${escapeHtml(item.area)}</p></div><span class="status-badge ${escapeAttr(item.status)}">${escapeHtml(item.status)}</span></div>
      <p class="enquiry-message">${escapeHtml(item.message)}</p>
      <p class="enquiry-meta">Received ${new Date(item.createdAt).toLocaleString()}</p>
      <div class="enquiry-controls">
        <label>Status<select class="enquiry-status"><option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option><option value="in-progress" ${item.status === 'in-progress' ? 'selected' : ''}>In progress</option><option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option><option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Archived</option></select></label>
        <label>Internal notes<textarea class="enquiry-notes" rows="2">${escapeHtml(item.notes || '')}</textarea></label>
        <div class="button-row"><button class="secondary save-enquiry" type="button">Save</button><button class="danger delete-enquiry" type="button">Delete</button></div>
      </div>
    </article>`).join('');
    if (!canEdit()) $$('.enquiry-controls input,.enquiry-controls textarea,.enquiry-controls select,.enquiry-controls button', enquiriesList).forEach((el) => { el.disabled = true; });
  }

  enquiriesList?.addEventListener('click', async (event) => {
    const card = event.target.closest('.enquiry-card[data-id]');
    if (!card || !canEdit()) return;
    const id = card.dataset.id;
    if (event.target.closest('.save-enquiry')) {
      setStatus('Saving enquiry…');
      try {
        await api('/api/cms?route=enquiries', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: $('.enquiry-status', card).value, notes: $('.enquiry-notes', card).value })
        });
        setStatus('Enquiry updated.');
        loadEnquiries();
      } catch (error) { setStatus(error.message); }
    }
    if (event.target.closest('.delete-enquiry')) {
      if (!window.confirm('Permanently delete this enquiry from private storage?')) return;
      try {
        await api('/api/cms?route=enquiries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        setStatus('Enquiry deleted.');
        loadEnquiries();
      } catch (error) { setStatus(error.message); }
    }
  });

  async function loadAnalytics() {
    $('#analytics-total').textContent = '…';
    try {
      const data = await api('/api/cms?route=analytics', { cache: 'no-store' });
      $('#analytics-total').textContent = String(data.total30d || 0);
      $('#analytics-top-page').textContent = data.topPages?.[0]?.path || '—';
      renderBars($('#analytics-days'), data.byDay || [], 'date', 'views');
      renderBars($('#analytics-pages'), data.topPages || [], 'path', 'views');
    } catch (error) {
      $('#analytics-total').textContent = 'N/A';
      $('#analytics-top-page').textContent = 'Private storage not configured';
      $('#analytics-days').textContent = error.message;
      $('#analytics-pages').textContent = '';
    }
  }

  function renderBars(container, rows, labelKey, valueKey) {
    if (!container) return;
    if (!rows.length) return void (container.innerHTML = '<p>No data yet.</p>');
    const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
    container.innerHTML = rows.map((row) => {
      const value = Number(row[valueKey]) || 0;
      return `<div class="bar-row"><span title="${escapeAttr(row[labelKey])}">${escapeHtml(row[labelKey])}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Math.round(value / max * 100))}%"></div></div><strong>${value}</strong></div>`;
    }).join('');
  }

  async function loadAdmins() {
    if (!canAdmin() || !adminsManager) return;
    adminsManager.textContent = 'Loading access roles…';
    try {
      const data = await api('/api/cms?route=admins', { cache: 'no-store' });
      renderAdmins(data.content?.users || []);
    } catch (error) {
      adminsManager.textContent = error.message;
    }
  }

  function renderAdmins(users) {
    adminsManager.innerHTML = users.map((user, index) => `<article class="repeat-card admin-card">
      <div class="repeat-head"><h3>${escapeHtml(user.login || `User ${index + 1}`)}</h3><button class="mini-button remove remove-admin" type="button">Remove</button></div>
      <div class="repeat-grid">
        <label>GitHub username<input data-field="login" value="${escapeAttr(user.login)}"></label>
        <label>Role<select data-field="role"><option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option><option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></label>
        <label class="full"><span><input data-field="enabled" type="checkbox" ${user.enabled !== false ? 'checked' : ''}> Enabled</span></label>
      </div>
    </article>`).join('');
  }

  $('#btn-add-admin')?.addEventListener('click', () => {
    if (!canAdmin()) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<article class="repeat-card admin-card"><div class="repeat-head"><h3>New GitHub user</h3><button class="mini-button remove remove-admin" type="button">Remove</button></div><div class="repeat-grid"><label>GitHub username<input data-field="login"></label><label>Role<select data-field="role"><option value="viewer">Viewer</option><option value="editor" selected>Editor</option><option value="admin">Admin</option></select></label><label class="full"><span><input data-field="enabled" type="checkbox" checked> Enabled</span></label></div></article>`;
    adminsManager.append(wrapper.firstElementChild);
  });
  adminsManager?.addEventListener('click', (event) => {
    if (event.target.closest('.remove-admin') && canAdmin()) event.target.closest('.admin-card').remove();
  });

  $('#btn-save-admins')?.addEventListener('click', async () => {
    if (!canAdmin()) return;
    const users = $$('.admin-card', adminsManager).map((card) => ({
      login: card.querySelector('[data-field="login"]').value.trim(),
      role: card.querySelector('[data-field="role"]').value,
      enabled: card.querySelector('[data-field="enabled"]').checked
    })).filter((user) => user.login);
    setStatus('Saving access roles…');
    try {
      await api('/api/cms?route=admins', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: { users } }) });
      setStatus('CMS access roles saved.');
      loadAdmins();
    } catch (error) { setStatus(error.message); }
  });

  $('#btn-save-analytics-settings')?.addEventListener('click', async () => {
    if (!canEdit()) return setStatus('Your role is read-only.');
    try {
      if (!siteState) await loadSiteData({ quiet: true });
      const analytics = {
        ...(siteState?.analytics || {}),
        enabled: $('#analytics-enabled')?.checked !== false,
        consentRequired: true
      };
      setStatus('Saving analytics settings…');
      await saveSitePatch({ analytics }, 'Analytics settings saved.');
    } catch (error) { setStatus(error.message); }
  });

  if (geminiKeyInput) geminiKeyInput.value = localStorage.getItem('kdh_gemini_key') || '';
  btnSaveSettings?.addEventListener('click', () => {
    localStorage.setItem('kdh_gemini_key', geminiKeyInput.value.trim());
    setStatus('Browser settings saved.');
  });

  function applyPermissions() {
    const editableControls = ['#btn-new-post', '#btn-add-team', '#btn-save-team', '#btn-add-practice', '#btn-save-practices', '#btn-save-seo', '#btn-save-analytics-settings'];
    editableControls.forEach((selector) => {
      const el = $(selector);
      if (el) el.hidden = !canEdit();
    });
    if (pAuthorSelect) pAuthorSelect.disabled = !canEdit();
    if (!canAdmin()) {
      $('#btn-add-admin')?.setAttribute('hidden', '');
      $('#btn-save-admins')?.setAttribute('hidden', '');
    }
  }

  async function bootstrapCms(event) {
    auth = event?.detail || window.KDHCMS?.auth;
    if (!auth || bootstrapped) return;
    bootstrapped = true;
    applyPermissions();
    await Promise.allSettled([
      loadPosts({ quiet: true }),
      loadSiteData({ quiet: true }),
      loadEnquiries({ quiet: true })
    ]);
  }

  initialiseQuill();
  window.addEventListener('kdh:cms-authenticated', bootstrapCms);
  if (window.KDHCMS?.auth) bootstrapCms({ detail: window.KDHCMS.auth });
})();
