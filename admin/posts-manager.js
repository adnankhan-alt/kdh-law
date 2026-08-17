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
const pCover = document.querySelector('#post-cover');
const pCoverUpload = document.querySelector('#post-cover-upload');
const pCoverPreview = document.querySelector('#post-cover-preview');

const btnSaveSettings = document.querySelector('#btn-save-settings');
const geminiKeyInput = document.querySelector('#gemini-key');

const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

let currentPosts = [];
let editingSha = null;
let quill;

// Initialize Quill Editor (Bubble theme for medium-style distraction free)
try {
  if (document.getElementById('post-editor-quill') && typeof Quill !== 'undefined') {
    quill = new Quill('#post-editor-quill', {
      theme: 'bubble',
      placeholder: 'Highlight text to see formatting options. Drag and drop images here...',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'header': 1 }, { 'header': 2 }],
          ['blockquote', 'code-block'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link', 'image', 'video'],
          ['clean']
        ]
      }
    });

    // Handle inline image uploads in Quill
    quill.getModule('toolbar').addHandler('image', () => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();

      input.onchange = async () => {
        const file = input.files[0];
        if (file) {
          document.getElementById('status').textContent = 'Uploading image...';
          const url = await uploadFile(file);
          if (url) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', url);
            document.getElementById('status').textContent = '';
          } else {
            document.getElementById('status').textContent = 'Image upload failed';
          }
        }
      };
    });
  }
} catch (err) {
  console.error("Failed to initialize Quill editor:", err);
}

// Cover image upload handler
if (pCoverUpload) {
  pCoverUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('status').textContent = 'Uploading cover image...';
    pCoverUpload.disabled = true;
    
    const url = await uploadFile(file);
    if (url) {
      pCover.value = url;
      pCoverPreview.src = url;
      pCoverPreview.style.display = 'block';
      document.getElementById('status').textContent = 'Cover uploaded!';
    } else {
      document.getElementById('status').textContent = 'Upload failed';
    }
    pCoverUpload.disabled = false;
  });
}

async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const res = await fetch('/api/cms/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            content: reader.result
          })
        });
        const data = await res.json();
        resolve(data.url);
      } catch {
        resolve(null);
      }
    };
  });
}

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
    postsList.innerHTML = 'No articles found. Click \'+ Open Posting Tools\' above to create one.';
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
    const res = await fetch('/api/posts');
    const allPosts = await res.json();
    const post = allPosts.find(p => p.slug === slug);
    if (!post) throw new Error('Post not found');
    
    pTitle.value = post.title || '';
    pSlug.value = post.slug || '';
    pSummary.value = post.summary || '';
    pCover.value = post.coverImage || '';
    if (post.coverImage) {
      pCoverPreview.src = post.coverImage;
      pCoverPreview.style.display = 'block';
    } else {
      pCoverPreview.style.display = 'none';
      pCoverUpload.value = '';
    }
    if (quill) quill.root.innerHTML = post.content || '';
    
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
  pCover.value = '';
  pCoverUpload.value = '';
  pCoverPreview.style.display = 'none';
  if (quill) quill.root.innerHTML = '';
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
    const content = quill ? quill.root.innerHTML : '';
    const res = await fetch('/api/cms/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: pSlug.value.trim(),
        title: pTitle.value.trim(),
        summary: pSummary.value.trim(),
        coverImage: pCover.value.trim(),
        content: content,
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
    if (quill) {
      quill.root.innerHTML = data.content || '';
    }
    document.getElementById('status').textContent = 'AI generation complete!';
  } catch (e) {
    document.getElementById('status').textContent = e.message;
  }
  btnAiGenerate.disabled = false;
});

