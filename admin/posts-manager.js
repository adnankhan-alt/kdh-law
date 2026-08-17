const menuItems = document.querySelectorAll('.menu-item');
const viewSections = document.querySelectorAll('.view-section');

const postEditor = document.querySelector('#view-post-editor');
const viewInsights = document.querySelector('#view-insights');
const postsList = document.querySelector('#posts-list');

const btnNewPost = document.querySelector('#btn-new-post');
const btnCancelPost = document.querySelector('#btn-cancel-post');
const btnSavePost = document.querySelector('#btn-save-post');
const btnDeletePost = document.querySelector('#btn-delete-post');
const btnAiGenerate = document.querySelector('#btn-ai-generate');

const pTitle = document.querySelector('#post-title');
const pSlug = document.querySelector('#post-slug');
const pSummary = document.querySelector('#post-summary');
const pContent = document.querySelector('#post-content');

const btnSaveSettings = document.querySelector('#btn-save-settings');
const geminiKeyInput = document.querySelector('#gemini-key');

const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

let currentPosts = [];
let editingSha = null;

// Sidebar toggle logic
function toggleSidebar() {
  sidebar?.classList.toggle('open');
  sidebarOverlay?.classList.toggle('open');
}

if (hamburger) hamburger.addEventListener('click', toggleSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

// Initialize settings
if (geminiKeyInput) {
  geminiKeyInput.value = localStorage.getItem('kdh_gemini_key') || '';
}
if (btnSaveSettings) {
  btnSaveSettings.addEventListener('click', () => {
    localStorage.setItem('kdh_gemini_key', geminiKeyInput.value.trim());
    const originalText = btnSaveSettings.textContent;
    btnSaveSettings.textContent = 'Saved!';
    setTimeout(() => { btnSaveSettings.textContent = originalText; }, 2000);
  });
}

// Sidebar Navigation
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    menuItems.forEach(m => m.classList.remove('active'));
    item.classList.add('active');
    
    const targetId = item.getAttribute('data-target');
    viewSections.forEach(section => {
      section.classList.remove('active');
    });
    
    document.getElementById(targetId).classList.add('active');
    
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) {
      topbarTitle.textContent = item.textContent.replace(/[^\w\s]/g, '').trim();
    }
    
    // Auto-close on mobile
    if (window.innerWidth <= 850 && sidebar.classList.contains('open')) {
      toggleSidebar();
    }
    
    if (targetId === 'view-insights') {
      loadPosts();
    }
  });
});

async function loadPosts() {
  postsList.innerHTML = 'Loading articles...';
  try {
    const res = await fetch('/api/cms/posts');
    currentPosts = await res.json();
    renderPosts();
  } catch (e) {
    postsList.innerHTML = 'Failed to load posts.';
  }
}

function renderPosts() {
  if (currentPosts.length === 0) {
    postsList.innerHTML = 'No articles found.';
    return;
  }
  postsList.innerHTML = currentPosts.map(p => {
    const slug = p.name.replace('.json', '');
    return `
    <div class="post-item">
      <div>
        <strong>${slug}</strong>
      </div>
      <button onclick="editPost('${slug}', '${p.sha}')">Edit</button>
    </div>
    `;
  }).join('');
}

window.editPost = async (slug, sha) => {
  document.getElementById('status').textContent = 'Loading post...';
  try {
    const res = await fetch(`/api/posts`);
    const allPosts = await res.json();
    const post = allPosts.find(p => p.slug === slug);
    if (!post) throw new Error('Post not found');
    
    pTitle.value = post.title;
    pSlug.value = post.slug;
    pSummary.value = post.summary;
    pContent.value = post.content;
    editingSha = sha;
    
    viewSections.forEach(s => s.classList.remove('active'));
    postEditor.classList.add('active');
    btnDeletePost.hidden = false;
    document.getElementById('status').textContent = '';
  } catch (e) {
    document.getElementById('status').textContent = 'Error loading post';
  }
};

btnNewPost?.addEventListener('click', () => {
  pTitle.value = '';
  pSlug.value = '';
  pSummary.value = '';
  pContent.value = '';
  editingSha = null;
  viewSections.forEach(s => s.classList.remove('active'));
  postEditor.classList.add('active');
  btnDeletePost.hidden = true;
});

btnCancelPost?.addEventListener('click', () => {
  postEditor.classList.remove('active');
  viewInsights.classList.add('active');
});

btnSavePost?.addEventListener('click', async () => {
  btnSavePost.disabled = true;
  document.getElementById('status').textContent = 'Saving post...';
  try {
    const res = await fetch('/api/cms/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: pSlug.value.trim(),
        title: pTitle.value.trim(),
        summary: pSummary.value.trim(),
        content: pContent.value.trim(),
        sha: editingSha
      })
    });
    if (!res.ok) throw new Error('Failed to save');
    const data = await res.json();
    editingSha = data.sha;
    document.getElementById('status').textContent = 'Post published!';
    setTimeout(() => {
      postEditor.classList.remove('active');
      viewInsights.classList.add('active');
      loadPosts();
      document.getElementById('status').textContent = '';
    }, 1500);
  } catch (e) {
    document.getElementById('status').textContent = e.message;
  }
  btnSavePost.disabled = false;
});

btnDeletePost?.addEventListener('click', async () => {
  if (!confirm('Delete this post?')) return;
  btnDeletePost.disabled = true;
  document.getElementById('status').textContent = 'Deleting post...';
  try {
    const res = await fetch('/api/cms/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: pSlug.value.trim(),
        sha: editingSha
      })
    });
    if (!res.ok) throw new Error('Failed to delete');
    document.getElementById('status').textContent = 'Post deleted!';
    setTimeout(() => {
      postEditor.classList.remove('active');
      viewInsights.classList.add('active');
      loadPosts();
      document.getElementById('status').textContent = '';
    }, 1500);
  } catch (e) {
    document.getElementById('status').textContent = e.message;
  }
  btnDeletePost.disabled = false;
});

btnAiGenerate?.addEventListener('click', async () => {
  const prompt = window.prompt('Enter a topic for the AI to write about:');
  if (!prompt) return;
  
  const apiKey = localStorage.getItem('kdh_gemini_key');
  if (!apiKey) {
    alert('Please go to Settings and enter your Gemini API Key first.');
    return;
  }
  
  btnAiGenerate.disabled = true;
  document.getElementById('status').textContent = 'AI is writing...';
  try {
    const res = await fetch('/api/cms/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, apiKey })
    });
    if (!res.ok) throw new Error('AI generation failed. Check API key.');
    const data = await res.json();
    
    pTitle.value = data.title || '';
    pSlug.value = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    pSummary.value = data.summary || '';
    pContent.value = data.content || '';
    document.getElementById('status').textContent = 'AI generation complete!';
  } catch (e) {
    document.getElementById('status').textContent = e.message;
  }
  btnAiGenerate.disabled = false;
});
