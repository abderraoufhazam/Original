// chat.js — Interface du chatbot (côté navigateur)

(function() {
  const fab = document.getElementById("chatFab");
  const win = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("chatClose");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const send = document.getElementById("chatSend");
  const messages = document.getElementById("chatMessages");

  if (!fab || !win) {
    console.warn("Chat elements not found");
    return;
  }

  let history = [];
  let isProcessing = false;

  function getProductContext() {
    return window.__lastVerifiedProduct || null;
  }

  function escapeHtml(v = "") {
    return String(v).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = "chat-msg chat-msg-" + (role === "user" ? "user" : "bot");
    div.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "chat-msg chat-msg-bot";
    div.id = "typingIndicator";
    div.innerHTML = `<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById("typingIndicator");
    if (t) t.remove();
  }

  fab.addEventListener("click", function(e) {
    e.preventDefault();
    win.classList.toggle("hidden");
    if (!win.classList.contains("hidden")) {
      setTimeout(function() { input.focus(); }, 100);
    }
  });

  closeBtn.addEventListener("click", function(e) {
    e.preventDefault();
    win.classList.add("hidden");
  });

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    const message = input.value.trim();
    if (!message || isProcessing) return;

    addMessage(message, "user");
    history.push({ role: "user", text: message });
    input.value = "";
    isProcessing = true;
    send.disabled = true;
    showTyping();

    try {
      const res = await fetch("/api/ai?mode=chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: history.slice(-6),
          context: getProductContext()
        })
      });

      const data = await res.json();
      hideTyping();

      if (data.status === "OK" && data.reply) {
        addMessage(data.reply, "bot");
        history.push({ role: "model", text: data.reply });
      } else if (data.detail) {
        addMessage("Erreur: " + (data.message || "") + " — " + data.detail, "bot");
      } else {
        addMessage("Désolé, une erreur est survenue. Réessayez.", "bot");
      }
    } catch (err) {
      console.error("Chat error:", err);
      hideTyping();
      addMessage("Problème de connexion.", "bot");
    } finally {
      isProcessing = false;
      send.disabled = false;
      input.focus();
    }
  });
})();
