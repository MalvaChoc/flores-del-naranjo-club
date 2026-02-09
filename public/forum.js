// forum.js
// ============================
// Lógica para mostrar threads de un foro y crear nuevos temas.
// - Lee el slug del foro desde la querystring (?slug=...).
// - Carga threads del foro.
// - Permite crear nuevos threads con título y contenido inicial.

/**
 * Obtiene el slug del foro desde la querystring.
 * @returns {string|null}
 */
function getForumSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
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
function aplicarPerfilEnForum(user) {
  const avatarEl = document.getElementById("forum-profile-avatar");
  const usernameSpan = document.getElementById("forum-profile-username");
  const statusEl = document.getElementById("forum-profile-status");

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
  const createPanel = document.getElementById("create-thread-panel");
  const loginPrompt = document.getElementById("login-prompt-thread");
  const btnCreate = document.getElementById("btn-create-thread");

  const isLoggedIn = user && user.username;

  if (btnCreate) {
    btnCreate.style.display = isLoggedIn ? "inline-block" : "none";
  }
  if (createPanel) {
    createPanel.style.display = "none"; // Se muestra/oculta con el botón.
  }
  if (loginPrompt) {
    loginPrompt.style.display = isLoggedIn ? "none" : "block";
  }
}

/**
 * Carga la información del foro y sus threads.
 * @param {string} slug
 */
async function cargarForo(slug) {
  try {
    const response = await fetch(`/api/forums/${slug}/threads`, {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({ ok: false }));

    if (!data.ok || !data.forum) {
      const list = document.getElementById("threads-list");
      if (list) {
        list.innerHTML =
          '<div class="message-empty">Error al cargar el foro. ¿Existe?</div>';
      }
      return null;
    }

    const forum = data.forum;

    // Actualizar título.
    const titleEl = document.getElementById("forum-title");
    if (titleEl) {
      titleEl.innerHTML = `${escapeHtml(forum.title)} <span class="text-emote">:D</span>`;
    }

    // Actualizar breadcrumb.
    const breadcrumbEl = document.getElementById("breadcrumb-forum-title");
    if (breadcrumbEl) {
      breadcrumbEl.textContent = forum.title;
    }

    // Renderizar threads.
    if (data.threads && Array.isArray(data.threads)) {
      renderizarThreads(data.threads);
    }

    return forum;
  } catch (err) {
    console.error("Error al cargar foro:", err);
    const list = document.getElementById("threads-list");
    if (list) {
      list.innerHTML =
        '<div class="message-empty">Error de conexión. Verifica tu internet.</div>';
    }
    return null;
  }
}

/**
 * Crea un elemento DOM para un thread.
 * @param {{id: number, title: string, createdAt: string, lastPostAt: string, author: {id: number, username: string, avatarUrl: string}}} thread
 * @returns {HTMLElement}
 */
function crearElementoThread(thread) {
  const card = document.createElement("article");
  card.classList.add("forum-card");
  card.setAttribute("data-thread-id", String(thread.id));

  // Header del thread: título + badge NEW si es reciente.
  const header = document.createElement("div");
  header.classList.add("forum-header-card");

  const titleLink = document.createElement("a");
  titleLink.href = `./thread.html?id=${thread.id}`;
  titleLink.classList.add("forum-title-link");
  titleLink.textContent = thread.title || "Sin título";

  header.appendChild(titleLink);

  // Badge "NEW" si el thread es muy reciente (menos de 1 hora).
  const fechaRef = thread.lastPostAt || thread.createdAt;
  const fechaMsg = new Date(fechaRef);
  const ahora = new Date();
  const diffHours = Math.floor((ahora - fechaMsg) / 3600000);
  if (diffHours < 1) {
    const badge = document.createElement("span");
    badge.classList.add("badge", "badge-new");
    badge.textContent = "NEW";
    header.appendChild(badge);
  }

  card.appendChild(header);

  // Footer con autor, fecha y link.
  const footer = document.createElement("div");
  footer.classList.add("forum-footer-card");

  const info = document.createElement("span");
  info.classList.add("forum-date");
  const fechaTexto = thread.lastPostAt
    ? `Último mensaje ${formatearFechaAmigable(thread.lastPostAt)}`
    : `Creado ${formatearFechaAmigable(thread.createdAt)}`;
  info.textContent = `Por ${thread.author.username} • ${fechaTexto}`;

  const btnEntrar = document.createElement("a");
  btnEntrar.href = `./thread.html?id=${thread.id}`;
  btnEntrar.classList.add("btn-2000", "btn-2000-primary");
  btnEntrar.textContent = "Ver tema";

  footer.appendChild(info);
  footer.appendChild(btnEntrar);

  card.appendChild(footer);

  return card;
}

/**
 * Renderiza todos los threads en la lista.
 * @param {Array} threads
 */
function renderizarThreads(threads) {
  const list = document.getElementById("threads-list");
  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (!threads || threads.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("message-empty");
    empty.textContent = "Aún no hay temas en este foro. ¡Sé el primero en crear uno! :)";
    list.appendChild(empty);
    return;
  }

  threads.forEach((thread) => {
    const card = crearElementoThread(thread);
    list.appendChild(card);
  });
}

/**
 * Muestra un mensaje de estado en el panel de creación.
 * @param {string} texto
 * @param {"success"|"error"} tipo
 */
function mostrarMensajeThread(texto, tipo) {
  const box = document.getElementById("create-thread-status");
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
 * Crea un nuevo thread.
 * @param {string} slug
 * @param {string} title
 * @param {string} content
 */
async function crearThread(slug, title, content) {
  const tituloLimpio = (title || "").trim();
  const contenidoLimpio = (content || "").trim();

  if (!tituloLimpio) {
    mostrarMensajeThread("El título es obligatorio T_T", "error");
    return;
  }

  if (tituloLimpio.length < 3 || tituloLimpio.length > 80) {
    mostrarMensajeThread("El título debe tener entre 3 y 80 caracteres.", "error");
    return;
  }

  if (!contenidoLimpio) {
    mostrarMensajeThread("El contenido inicial es obligatorio.", "error");
    return;
  }

  if (contenidoLimpio.length < 1 || contenidoLimpio.length > 2000) {
    mostrarMensajeThread("El contenido debe tener entre 1 y 2000 caracteres.", "error");
    return;
  }

  try {
    const response = await fetch(`/api/forums/${slug}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: tituloLimpio, content: contenidoLimpio }),
    });

    const data = await response.json().catch(() => ({ ok: false, message: "Error desconocido." }));

    if (data && data.ok && data.thread) {
      // Limpiar el formulario.
      const form = document.getElementById("create-thread-form");
      if (form) {
        form.reset();
        actualizarContadorCaracteres();
      }

      // Ocultar el panel de creación.
      const panel = document.getElementById("create-thread-panel");
      if (panel) {
        panel.style.display = "none";
      }

      mostrarMensajeThread("Tema creado (2006 vibes) ☆", "success");

      // Redirigir al thread recién creado.
      setTimeout(() => {
        window.location.href = `./thread.html?id=${data.thread.id}`;
      }, 1000);
    } else {
      const mensajeError =
        data && data.message ? data.message : "Error al crear tema.";
      mostrarMensajeThread(mensajeError, "error");
    }
  } catch (err) {
    console.error("Error de red al crear thread:", err);
    mostrarMensajeThread("Error de conexión. Intenta de nuevo.", "error");
  }
}

/**
 * Actualiza el contador de caracteres del textarea.
 */
function actualizarContadorCaracteres() {
  const textarea = document.getElementById("thread-content");
  const counter = document.getElementById("thread-char-count");
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
  const slug = getForumSlugFromQuery();

  if (!slug) {
    const list = document.getElementById("threads-list");
    if (list) {
      list.innerHTML =
        '<div class="message-empty">Error: No se especificó un slug de foro válido en la URL.</div>';
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
        aplicarPerfilEnForum(null);
        configurarUIUsuario(null);
      } else {
        aplicarPerfilEnForum(data.user);
        configurarUIUsuario(data.user);
      }
    })
    .catch(() => {
      aplicarPerfilEnForum(null);
      configurarUIUsuario(null);
    });

  // Cargar foro y threads.
  cargarForo(slug);

  // Configurar el botón "Crear tema" para mostrar/ocultar el panel.
  const btnCreate = document.getElementById("btn-create-thread");
  const createPanel = document.getElementById("create-thread-panel");
  const btnCancel = document.getElementById("btn-cancel-create-thread");

  if (btnCreate && createPanel) {
    btnCreate.addEventListener("click", () => {
      createPanel.style.display = createPanel.style.display === "none" ? "block" : "none";
      if (createPanel.style.display === "block") {
        const titleInput = document.getElementById("thread-title");
        if (titleInput) {
          titleInput.focus();
        }
      }
    });
  }

  if (btnCancel && createPanel) {
    btnCancel.addEventListener("click", () => {
      createPanel.style.display = "none";
      const form = document.getElementById("create-thread-form");
      if (form) {
        form.reset();
        actualizarContadorCaracteres();
      }
      mostrarMensajeThread("", "");
    });
  }

  // Configurar el formulario de creación de thread.
  const form = document.getElementById("create-thread-form");
  const textarea = document.getElementById("thread-content");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const titleInput = document.getElementById("thread-title");
      if (titleInput && textarea) {
        crearThread(slug, titleInput.value, textarea.value);
      }
    });
  }

  // Contador de caracteres en tiempo real.
  if (textarea) {
    textarea.addEventListener("input", actualizarContadorCaracteres);
    actualizarContadorCaracteres(); // Inicializar contador.
  }
});

