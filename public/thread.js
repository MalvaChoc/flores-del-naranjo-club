// thread.js
// ============================
// Lógica para mostrar un thread y sus posts.
// - Lee el ID del thread desde la querystring (?id=123).
// - Carga información del thread y sus posts.
// - Permite publicar nuevos posts si hay sesión activa.

/**
 * Obtiene el ID del thread desde la querystring.
 * @returns {number|null}
 */
function getThreadIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return null;
  const numId = parseInt(id);
  return isNaN(numId) ? null : numId;
}

/**
 * Formatea una fecha ISO string a un formato amigable estilo 2000s.
 * @param {string} isoString
 * @returns {string}
 */
function formatearFechaAmigable(isoString) {
  try {
    const fecha = new Date(isoString);
    const ahora = new Date();
    const diffMs = ahora - fecha;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "ahora mismo";
    } else if (diffMins < 60) {
      return `hace ${diffMins} min`;
    } else if (diffHours < 24) {
      return `hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
    } else if (diffDays === 1) {
      return "ayer";
    } else if (diffDays < 7) {
      return `hace ${diffDays} días`;
    } else {
      return fecha.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: fecha.getFullYear() !== ahora.getFullYear() ? "numeric" : undefined,
      });
    }
  } catch (err) {
    return "fecha desconocida";
  }
}

/**
 * Aplica el usuario leído (si existe) al bloque "Perfil rápido".
 * @param {{username?: string, avatarUrl?: string}|null} user
 */
function aplicarPerfilEnThread(user) {
  const avatarEl = document.getElementById("thread-profile-avatar");
  const usernameSpan = document.getElementById("thread-profile-username");
  const statusEl = document.getElementById("thread-profile-status");

  if (!avatarEl && !usernameSpan) {
    return;
  }

  if (!user || !user.username) {
    if (usernameSpan) {
      usernameSpan.textContent = "Invitad@";
    }
    if (avatarEl) {
      avatarEl.textContent = "?";
      avatarEl.style.backgroundImage = "";
    }
    if (statusEl) {
      statusEl.textContent = "Inicia sesión para más opciones ;)";
    }
    return;
  }

  const nombreLimpio = typeof user.username === "string" ? user.username.trim() : "";

  if (usernameSpan && nombreLimpio) {
    usernameSpan.textContent = nombreLimpio;
  }

  if (avatarEl) {
    const inicial = nombreLimpio ? nombreLimpio.charAt(0).toUpperCase() : "D";
    avatarEl.textContent = inicial;

    if (user.avatarUrl && user.avatarUrl.trim()) {
      avatarEl.style.backgroundImage = `url("${user.avatarUrl}")`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
    } else {
      avatarEl.style.backgroundImage = "";
    }
  }

  if (statusEl) {
    statusEl.textContent = "En línea ;D";
  }
}

/**
 * Configura la UI según el estado de sesión.
 * @param {{username?: string}|null} user
 */
function configurarUIUsuario(user) {
  const replyPanel = document.getElementById("reply-panel");
  const loginPrompt = document.getElementById("login-prompt-reply");

  const isLoggedIn = user && user.username;

  if (replyPanel) {
        replyPanel.style.display = isLoggedIn ? "block" : "none";
  }
  if (loginPrompt) {
    loginPrompt.style.display = isLoggedIn ? "none" : "block";
  }
}

/**
 * Carga la información del thread y actualiza breadcrumbs y título.
 * @param {number} threadId
 */
async function cargarThread(threadId) {
  try {
    const response = await fetch(`/api/threads/${threadId}`, {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({ ok: false }));

    if (!data.ok || !data.thread) {
      const list = document.getElementById("posts-list");
      if (list) {
        list.innerHTML =
          '<div class="message-empty">Error al cargar el tema. ¿Existe?</div>';
      }
      return null;
    }

    const thread = data.thread;

    // Actualizar título.
    const titleEl = document.getElementById("thread-title");
    if (titleEl) {
      titleEl.innerHTML = `${escapeHtml(thread.title)} <span class="text-emote">:)</span>`;
    }

    // Actualizar breadcrumbs.
    const forumLink = document.getElementById("breadcrumb-forum-link");
    if (forumLink && thread.forum) {
      forumLink.href = `./forum.html?slug=${thread.forum.slug}`;
      forumLink.textContent = thread.forum.title;
    }

    const threadTitleBreadcrumb = document.getElementById("breadcrumb-thread-title");
    if (threadTitleBreadcrumb) {
      threadTitleBreadcrumb.textContent = thread.title;
    }

    return thread;
  } catch (err) {
    console.error("Error al cargar thread:", err);
    const list = document.getElementById("posts-list");
    if (list) {
      list.innerHTML =
        '<div class="message-empty">Error de conexión. Verifica tu internet.</div>';
    }
    return null;
  }
}

/**
 * Crea un elemento DOM para un post.
 * @param {{id: number, content: string, createdAt: string, author: {id: number, username: string, avatarUrl: string}}} post
 * @returns {HTMLElement}
 */
function crearElementoPost(post) {
  const card = document.createElement("article");
  card.classList.add("post-card");
  card.setAttribute("data-post-id", String(post.id));

  // Header del post: avatar + username + fecha.
  const header = document.createElement("div");
  header.classList.add("post-header");

  // Avatar circular (mini).
  const avatar = document.createElement("div");
  avatar.classList.add("avatar-circle", "avatar-mini");
  const inicial = (post.author.username || "").charAt(0).toUpperCase() || "?";
  avatar.textContent = inicial;
  if (post.author.avatarUrl && post.author.avatarUrl.trim()) {
    avatar.style.backgroundImage = `url("${post.author.avatarUrl}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  }

  // Info del usuario y fecha.
  const userInfo = document.createElement("div");
  userInfo.classList.add("post-user-info");

  const username = document.createElement("strong");
  username.classList.add("post-username");
  username.textContent = post.author.username || "Anónimo";

  const fecha = document.createElement("span");
  fecha.classList.add("post-date");
  fecha.textContent = formatearFechaAmigable(post.createdAt);

  userInfo.appendChild(username);
  userInfo.appendChild(document.createTextNode(" • "));
  userInfo.appendChild(fecha);

  header.appendChild(avatar);
  header.appendChild(userInfo);

  // Contenido del post (preserva saltos de línea).
  const content = document.createElement("div");
  content.classList.add("post-content");
  const textoLimpio = (post.content || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const textoConSaltos = textoLimpio.replace(/\n/g, "<br>");
  content.innerHTML = textoConSaltos;

  card.appendChild(header);
  card.appendChild(content);

  return card;
}

/**
 * Renderiza todos los posts en la lista.
 * @param {Array} posts
 */
function renderizarPosts(posts) {
  const list = document.getElementById("posts-list");
  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (!posts || posts.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("message-empty");
    empty.textContent = "Aún no hay mensajes en este tema. ¡Sé el primero en responder! :)";
    list.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const card = crearElementoPost(post);
    list.appendChild(card);
  });
}

/**
 * Carga los posts del thread.
 * @param {number} threadId
 */
async function cargarPosts(threadId) {
  try {
    const response = await fetch(`/api/threads/${threadId}/posts?limit=100`, {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({ ok: false }));

    if (data && data.ok && Array.isArray(data.posts)) {
      renderizarPosts(data.posts);
    } else {
      console.error("Error al cargar posts:", data);
      const list = document.getElementById("posts-list");
      if (list) {
        list.innerHTML =
          '<div class="message-empty">Error al cargar mensajes. Recarga la página.</div>';
      }
    }
  } catch (err) {
    console.error("Error de red al cargar posts:", err);
    const list = document.getElementById("posts-list");
    if (list) {
      list.innerHTML =
        '<div class="message-empty">Error de conexión. Verifica tu internet.</div>';
    }
  }
}

/**
 * Muestra un mensaje de estado en el panel de respuesta.
 * @param {string} texto
 * @param {"success"|"error"} tipo
 */
function mostrarMensajeReply(texto, tipo) {
  const box = document.getElementById("reply-status");
  if (!box) return;

  box.textContent = texto;
  box.classList.remove("message-success", "message-error");

  if (tipo === "success") {
    box.classList.add("message-success");
  } else if (tipo === "error") {
    box.classList.add("message-error");
  }
}

/**
 * Publica un nuevo post en el thread.
 * @param {number} threadId
 * @param {string} content
 */
async function publicarPost(threadId, content) {
  const contenidoLimpio = (content || "").trim();
  if (!contenidoLimpio) {
    mostrarMensajeReply("El mensaje no puede estar vacío T_T", "error");
    return;
  }

  if (contenidoLimpio.length > 2000) {
    mostrarMensajeReply("El mensaje es demasiado largo (máx. 2000 caracteres).", "error");
    return;
  }

  try {
    const response = await fetch(`/api/threads/${threadId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: contenidoLimpio }),
    });

    const data = await response.json().catch(() => ({ ok: false, message: "Error desconocido." }));

    if (data && data.ok && data.post) {
      // Limpiar el textarea y el contador.
      const textarea = document.getElementById("reply-content");
      if (textarea) {
        textarea.value = "";
        actualizarContadorCaracteres();
      }

      mostrarMensajeReply("Mensaje publicado (2006 vibes) ☆", "success");

      // Agregar el nuevo post al final de la lista sin recargar todo.
      const list = document.getElementById("posts-list");
      if (list) {
        const emptyMsg = list.querySelector(".message-empty");
        if (emptyMsg) {
          emptyMsg.remove();
        }
        const nuevaCard = crearElementoPost(data.post);
        list.appendChild(nuevaCard);
        // Scroll suave al nuevo mensaje.
        nuevaCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else {
      const mensajeError =
        data && data.message ? data.message : "Error al publicar mensaje.";
      mostrarMensajeReply(mensajeError, "error");
    }
  } catch (err) {
    console.error("Error de red al publicar:", err);
    mostrarMensajeReply("Error de conexión. Intenta de nuevo.", "error");
  }
}

/**
 * Actualiza el contador de caracteres del textarea.
 */
function actualizarContadorCaracteres() {
  const textarea = document.getElementById("reply-content");
  const counter = document.getElementById("reply-char-count");
  if (!textarea || !counter) return;

  const length = (textarea.value || "").length;
  counter.textContent = String(length);
}

/**
 * Escapa HTML para prevenir XSS.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Ejecutamos la inicialización cuando el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  const threadId = getThreadIdFromQuery();

  if (!threadId) {
    const list = document.getElementById("posts-list");
    if (list) {
      list.innerHTML =
        '<div class="message-empty">Error: No se especificó un ID de tema válido en la URL.</div>';
    }
    return;
  }

  // Consultar sesión actual.
  fetch("/api/me", {
    method: "GET",
    credentials: "include",
  })
    .then((resp) => resp.json().catch(() => ({})))
    .then((data) => {
      if (!data || !data.ok || !data.user) {
        aplicarPerfilEnThread(null);
        configurarUIUsuario(null);
      } else {
        aplicarPerfilEnThread(data.user);
        configurarUIUsuario(data.user);
      }
    })
    .catch(() => {
      aplicarPerfilEnThread(null);
      configurarUIUsuario(null);
    });

  // Cargar información del thread y posts.
  cargarThread(threadId).then(() => {
    cargarPosts(threadId);
  });

  // Configurar el formulario de respuesta.
  const form = document.getElementById("reply-form");
  const textarea = document.getElementById("reply-content");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (textarea) {
        publicarPost(threadId, textarea.value);
      }
    });
  }

  // Contador de caracteres en tiempo real.
  if (textarea) {
    textarea.addEventListener("input", actualizarContadorCaracteres);
    actualizarContadorCaracteres(); // Inicializar contador.
  }
});

