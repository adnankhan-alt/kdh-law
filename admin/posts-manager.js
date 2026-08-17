const tabHome = document.querySelector("#tab-home");
const tabInsights = document.querySelector("#tab-insights");
const viewHome = document.querySelector("#view-home");
const viewInsights = document.querySelector("#view-insights");
const postEditor = document.querySelector("#post-editor");
const postsList = document.querySelector("#posts-list");

const btnNewPost = document.querySelector("#btn-new-post");
const btnCancelPost = document.querySelector("#btn-cancel-post");
const btnSavePost = document.querySelector("#btn-save-post");
const btnDeletePost = document.querySelector("#btn-delete-post");
const btnAiGenerate = document.querySelector("#btn-ai-generate");

const pTitle = document.querySelector("#post-title");
const pSlug = document.querySelector("#post-slug");
const pSummary = document.querySelector("#post-summary");
const pContent = document.querySelector("#post-content");

let currentPosts = [];
let editingSha = null;

if (tabHome && tabInsights) {
  tabHome.addEventListener("click", () => {
    tabHome.classList.add("active");
    tabInsights.classList.remove("active");
    viewHome.hidden = false;
    viewInsights.hidden = true;
    postEditor.hidden = true;
  });

  tabInsights.addEventListener("click", () => {
    tabInsights.classList.add("active");
    tabHome.classList.remove("active");
    viewHome.hidden = true;
    viewInsights.hidden = false;
    postEditor.hidden = true;
    loadPosts();
  });
}

async function loadPosts() {
  postsList.innerHTML = "Loading articles...";
  try {
    const res = await fetch("/api/cms/posts");
    currentPosts = await res.json();
    renderPosts();
  } catch (e) {
    postsList.innerHTML = "Failed to load posts.";
  }
}

function renderPosts() {
  if (currentPosts.length === 0) {
    postsList.innerHTML = "No articles found.";
    return;
  }
  postsList.innerHTML = currentPosts.map(p => `
    <div class="post-item">
      <div>
        <strong>${p.name.replace(".json", "")}</strong>
      </div>
      <button onclick="editPost('${p.name.replace(".json", "")}', '${p.sha}')">Edit</button>
    </div>
  `).join("");
}

window.editPost = async (slug, sha) => {
  status.textContent = "Loading post...";
  try {
    const res = await fetch(`/api/posts`);
    const allPosts = await res.json();
    const post = allPosts.find(p => p.slug === slug);
    if (!post) throw new Error("Post not found");
    
    pTitle.value = post.title;
    pSlug.value = post.slug;
    pSummary.value = post.summary;
    pContent.value = post.content;
    editingSha = sha;
    
    viewInsights.hidden = true;
    postEditor.hidden = false;
    btnDeletePost.hidden = false;
    status.textContent = "";
  } catch (e) {
    status.textContent = "Error loading post";
  }
};

btnNewPost?.addEventListener("click", () => {
  pTitle.value = "";
  pSlug.value = "";
  pSummary.value = "";
  pContent.value = "";
  editingSha = null;
  viewInsights.hidden = true;
  postEditor.hidden = false;
  btnDeletePost.hidden = true;
});

btnCancelPost?.addEventListener("click", () => {
  postEditor.hidden = true;
  viewInsights.hidden = false;
});

btnSavePost?.addEventListener("click", async () => {
  btnSavePost.disabled = true;
  status.textContent = "Saving post...";
  try {
    const res = await fetch("/api/cms/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: pSlug.value.trim(),
        title: pTitle.value.trim(),
        summary: pSummary.value.trim(),
        content: pContent.value.trim(),
        sha: editingSha
      })
    });
    if (!res.ok) throw new Error("Failed to save");
    const data = await res.json();
    editingSha = data.sha;
    status.textContent = "Post published!";
    setTimeout(() => {
      postEditor.hidden = true;
      viewInsights.hidden = false;
      loadPosts();
    }, 1500);
  } catch (e) {
    status.textContent = e.message;
  }
  btnSavePost.disabled = false;
});

btnDeletePost?.addEventListener("click", async () => {
  if (!confirm("Delete this post?")) return;
  btnDeletePost.disabled = true;
  status.textContent = "Deleting post...";
  try {
    const res = await fetch("/api/cms/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: pSlug.value.trim(),
        sha: editingSha
      })
    });
    if (!res.ok) throw new Error("Failed to delete");
    status.textContent = "Post deleted!";
    setTimeout(() => {
      postEditor.hidden = true;
      viewInsights.hidden = false;
      loadPosts();
    }, 1500);
  } catch (e) {
    status.textContent = e.message;
  }
  btnDeletePost.disabled = false;
});

btnAiGenerate?.addEventListener("click", async () => {
  const prompt = prompt("Enter a topic for the AI to write about:");
  if (!prompt) return;
  btnAiGenerate.disabled = true;
  status.textContent = "AI is writing...";
  try {
    const res = await fetch("/api/cms/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error("AI generation failed");
    const data = await res.json();
    
    pTitle.value = data.title || "";
    pSlug.value = (data.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    pSummary.value = data.summary || "";
    pContent.value = data.content || "";
    status.textContent = "AI generation complete! Review and save.";
  } catch (e) {
    status.textContent = e.message;
  }
  btnAiGenerate.disabled = false;
});
