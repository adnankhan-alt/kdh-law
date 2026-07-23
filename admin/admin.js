const signin = document.querySelector("#signin");
const editor = document.querySelector("#editor");
const logout = document.querySelector("#logout");
const identity = document.querySelector("#identity");
const status = document.querySelector("#status");

const getPath = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);

const setPath = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => (current[key] ||= {}), object);
  target[last] = value;
};

async function request(url, options) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "The request could not be completed.");
  return data;
}

async function initialise() {
  try {
    const auth = await request("/api/cms/auth");
    signin.hidden = true;
    editor.hidden = false;
    logout.hidden = false;
    identity.textContent = `Signed in as ${auth.login}`;

    const result = await request("/api/cms/content");
    editor.querySelectorAll("[name]").forEach((field) => {
      field.value = getPath(result.content, field.name) || "";
    });
  } catch {
    signin.hidden = false;
    editor.hidden = true;
    logout.hidden = true;
  }
}

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editor.checkValidity()) return editor.reportValidity();

  const button = editor.querySelector("[type=submit]");
  button.disabled = true;
  status.textContent = "Saving…";
  const content = {};
  editor.querySelectorAll("[name]").forEach((field) => {
    setPath(content, field.name, field.value.trim());
  });

  try {
    const result = await request("/api/cms/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    status.textContent = result.message;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

logout.addEventListener("click", async () => {
  await request("/api/cms/logout", { method: "POST" });
  window.location.reload();
});

initialise();
