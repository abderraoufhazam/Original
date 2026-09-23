// chat.js — Interface du chatbot

(function() {
  const fab = document.getElementById("chatFab");
  const win = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("chatClose");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const send = document.getElementById("chatSend");
  const messages = document.getElementById("chatMessages");

  if (!fab || !win) return;

  // Historique de conversation
  let history = [];
  let isProcessing = false;

  // Récupérer le contexte produit (si vérification réussie)
  function getProductContext() {
    if (window.__lastVerifiedProduct) {
      return window.__lastVerifiedProduct;
    }
    return null;
  }

  // Ajouter un message dans l'interface
  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = "chat-msg chat-msg-" + (role === "user" ? "user" : "bot");
    div.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function escapeHtml(v = "") {
    return String(v).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
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

  // Ouvrir / fermer la fenêtre
  fab.addEventListener("click", () => {
    win.classList.toggle("hidden");
    if (!win.classList.contains("hidden")) {
      setTimeout(() => input.focus(), 100);
    }
  });

  closeBtn.addEventListener("click", () => {
    win.classList.add("hidden");
  });

  // Envoyer un message
  form.addEventListener("submit", async (e) => {
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
      const res = await fetch("/api/chat", {
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
      } else {
        addMessage("Désolé, une erreur est survenue. Réessayez.", "bot");
      }
    } catch (err) {
      hideTyping();
      addMessage("Problème de connexion. Vérifiez votre réseau.", "bot");
    } finally {
      isProcessing = false;
      send.disabled = false;
      input.focus();
    }
  });
})();
