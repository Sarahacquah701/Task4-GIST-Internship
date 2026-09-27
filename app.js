const $ = (selector) => document.querySelector(selector);
const questionInput = $("#question");
const askForm = $("#ask-form");
const sendButton = $("#send-button");
const API_BASE = window.location.port === "3000" ? "http://127.0.0.1:5000" : "";
let lastAnswer = "";
let healthTimer;

function showOnly(id) {
  ["welcome-state", "loading-state", "conversation", "error-state"].forEach((name) => $("#" + name).classList.toggle("hidden", name !== id));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  sendButton.querySelector("span:first-child").textContent = isLoading ? "Working" : "Send";
  if (isLoading) showOnly("loading-state");
}
function renderSources(sources) {
  const list = $("#sources-list");
  const safeSources = Array.isArray(sources) ? sources : [];
  $("#source-count").textContent = `${safeSources.length} source${safeSources.length === 1 ? "" : "s"}`;
  if (!safeSources.length) {
    list.innerHTML = '<div class="sources-empty"><span class="evidence-icon">⌁</span><p>No relevant information was found in the knowledge base.</p></div>';
    return;
  }
  list.innerHTML = safeSources.map((source, index) => `<article class="source-item"><div class="source-top"><span class="source-number">SOURCE ${String(index + 1).padStart(2, "0")}</span><span class="source-distance">Distance: ${escapeHtml(source.distance ?? "N/A")}</span></div><p>${escapeHtml(source.text ?? "No source text returned.")}</p><span class="retrieved-badge">Retrieved</span></article>`).join("");
}
function showError(title, message) {
  showOnly("error-state");
  $("#error-title").textContent = title;
  $("#error-message").textContent = message;
}
function setPipelineState(active) {
  document.querySelectorAll(".pipeline-node").forEach((node, index) => node.classList.toggle("active", index === active));
}
async function askQuestion(question) {
  const trimmed = question.trim();
  if (!trimmed) {
    showError("A question is required.", "Enter a cybersecurity question to search the knowledge base.");
    questionInput.focus();
    return;
  }
  setLoading(true);
  setPipelineState(3);
  $("#loading-label").textContent = "Searching knowledge base...";
  $("#loading-subtext").textContent = "Retrieving relevant security context";
  try {
    const response = await fetch(`${API_BASE}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: trimmed }) });
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    const data = await response.json();
    $("#loading-label").textContent = "Generating response...";
    $("#loading-subtext").textContent = "Synthesizing an answer from retrieved context";
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!data.answer) {
      renderSources(data.sources);
      showError("No relevant information found.", "Try asking your question in a different way or choose one of the examples.");
      return;
    }
    lastAnswer = String(data.answer);
    $("#question-output").textContent = trimmed;
    $("#answer-text").textContent = lastAnswer;
    $("#answer-meta").textContent = `Grounded in ${Array.isArray(data.sources) ? data.sources.length : 0} retrieved source${Array.isArray(data.sources) && data.sources.length === 1 ? "" : "s"}`;
    renderSources(data.sources);
    showOnly("conversation");
  } catch (error) {
    console.error("CyberRAG request failed", error);
    showError("Unable to connect to the RAG service.", "Please make sure the Flask server is running.");
  } finally {
    sendButton.disabled = false;
    sendButton.querySelector("span:first-child").textContent = "Send";
  }
}
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Health check failed");
    const data = await response.json().catch(() => ({}));
    const online = data.status === undefined || data.status === "ok" || data.status === "healthy" || data.status === "online";
    updateHealth(online, data);
  } catch (error) {
    console.warn("CyberRAG health check failed", error);
    updateHealth(false);
  }
}
function updateHealth(online, data = {}) {
  const state = online ? "Online" : "Offline";
  ["#rag-status", "#vector-status", "#kb-status"].forEach((selector) => $(selector).textContent = state);
  $("#generation-status").textContent = online ? "Ready" : "Unavailable";
  $("#health-detail").textContent = online ? `Flask /health responded${data.status ? `: ${data.status}` : " successfully"}.` : "Flask /health is unavailable.";
  $("#status-pill").classList.toggle("offline", !online);
  $("#status-pill").innerHTML = `<span class="status-dot"></span>${online ? "Online" : "Offline"}`;
  $("#header-status").classList.toggle("offline", !online);
  $("#header-status").innerHTML = `<span class="status-dot"></span>RAG ${online ? "Online" : "Offline"}`;
  $("#sidebar-status-dot").style.background = online ? "var(--green)" : "var(--red)";
  $("#sidebar-status-text").textContent = online ? "System Online" : "System Offline";
}
function autoGrow() { questionInput.style.height = "auto"; questionInput.style.height = `${Math.min(questionInput.scrollHeight, 145)}px`; }

askForm.addEventListener("submit", (event) => { event.preventDefault(); askQuestion(questionInput.value); });
questionInput.addEventListener("input", autoGrow);
questionInput.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askForm.requestSubmit(); } });
document.querySelectorAll(".example-card").forEach((button) => button.addEventListener("click", () => { questionInput.value = button.dataset.question; autoGrow(); questionInput.focus(); }));
$("#retry-button").addEventListener("click", () => askQuestion(questionInput.value));
$("#copy-answer").addEventListener("click", async () => { try { await navigator.clipboard.writeText(lastAnswer); $("#copy-answer").textContent = "Copied"; setTimeout(() => { $("#copy-answer").innerHTML = "Copy answer <span>⌘</span>"; }, 1500); } catch (error) { console.warn("Could not copy answer", error); } });
const sidebar = $("#sidebar"); const overlay = $("#sidebar-overlay");
function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("open"); }
$("#menu-button").addEventListener("click", () => { sidebar.classList.add("open"); overlay.classList.add("open"); }); $("#sidebar-close").addEventListener("click", closeSidebar); overlay.addEventListener("click", closeSidebar);
document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => { document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active")); item.classList.add("active"); closeSidebar(); }));
checkHealth(); healthTimer = setInterval(checkHealth, 30000);
window.addEventListener("beforeunload", () => clearInterval(healthTimer));
