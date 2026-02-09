// app.js
// ============================
// Lógica de la lista de foros para flores del naranjo club.
// - Carga foros desde el backend (/api/forums).
// - Permite crear foros si el usuario es admin.
// - Muestra el usuario actual en el bloque "Perfil rápido".
// - Muestra un mensaje de bienvenida aleatorio al cargar.
// Todo está comentado para que sea fácil de modificar :)

/**
 * Array de mensajes de bienvenida aleatorios.
 * Se muestran uno diferente cada vez que se recarga la página.
 */
const WELCOME_MESSAGES = [
  "BIENVENIDOOO A FLORES DEL NARANJO!!! >:33 el lugar perfecto para hablar de- LO QUE KIERAS!!!",
  "gracias por entrar bro, aora eres parte del club jsjdjudjjd diviertete!",
  "los viejo usan facebook y ig, los vios van a flores del naranjo club",
  "es hora de naranjear, o no lo sé... solo si quieres jeje",
  "MUY bienvenidoo al club FLORES DEL NARANJO!!!, puedes hablar de lo q kieraz :3",
  "Yo, yo, yo! 1-4-8-3 to the 3-to-the-6-to-the-9, representin' the ABQ. What up, biatch? Leave at the tone",
  "YA VIENE LA FUERZA LA VOZ DE LOS OCHENTA :UUU",
  "oigan al admin de esta cuestion le gusta asia menor la cuestionwena",
  "viva lo retro",
];

/**
 * Muestra un mensaje de bienvenida aleatorio en el contenedor #welcomeMessage.
 * Evita repetir el mismo mensaje dos recargas seguidas usando localStorage.
 */
function mostrarMensajeBienvenida() {
  const welcomeEl = document.getElementById("welcomeMessage");
  if (!welcomeEl) {
    return; // Si no existe el contenedor, salir silenciosamente.
  }

  // Obtener el último índice mostrado desde localStorage.
  const lastIndexStr = localStorage.getItem("lastWelcomeIndex");
  let lastIndex = lastIndexStr !== null ? parseInt(lastIndexStr, 10) : -1;

  // Elegir un índice aleatorio, evitando repetir el anterior.
  let newIndex;
  let intentos = 0;
  const maxIntentos = 5;

  do {
    newIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
    intentos++;
  } while (newIndex === lastIndex && intentos < maxIntentos && WELCOME_MESSAGES.length > 1);

  // Guardar el nuevo índice en localStorage.
  localStorage.setItem("lastWelcomeIndex", String(newIndex));

  // Mostrar el mensaje (usando textContent para evitar XSS).
  welcomeEl.textContent = WELCOME_MESSAGES[newIndex];
}

/**
 * Aplica el usuario leído (si existe) al bloque "Perfil rápido"
 * del home: actualiza el nombre de usuario y el mini avatar.
 *
 * Si no hay usuario, se muestra un estado "Invitad@" y se oculta
 * el botón de "Cerrar sesión".
 *
 * @param {{username?: string, avatarUrl?: string, role?: string}|null} user
 */
function aplicarPerfilEnHome(user) {
  const avatarEl = document.getElementById("home-profile-avatar");
  const usernameSpan = document.getElementById("home-profile-username");
  const statusEl = document.getElementById("home-profile-status");
  const logoutBtn = document.getElementById("home-logout-button");

  if (!avatarEl && !usernameSpan) {
    // Si el bloque no existe (otra página), salimos sin hacer nada.
    return;
  }

  // Si no hay usuario logeado, mostramos modo "Invitado".
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
    if (logoutBtn) {
      logoutBtn.style.display = "none";
    }
    return;
  }

  const nombreLimpio =
    typeof user.username === "string" ? user.username.trim() : "";

  if (usernameSpan && nombreLimpio) {
    usernameSpan.textContent = nombreLimpio;
  }

  if (avatarEl) {
    // Mostrar inicial del usuario (o D como fallback) en el círculo.
    const inicial = nombreLimpio ? nombreLimpio.charAt(0).toUpperCase() : "D";
    avatarEl.textContent = inicial;

    // Si hay URL de avatar, la usamos como fondo del círculo.
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

  if (logoutBtn) {
    logoutBtn.style.display = "inline-block";
  }
}

/**
 * Verifica si el usuario es admin y muestra/oculta la UI de creación de foros.
 *
 * @param {{role?: string}|null} user
 */
function configurarUIAdmin(user) {
  const btnCreate = document.getElementById("btn-create-forum");
  const createPanel = document.getElementById("create-forum-panel");

  const isAdmin = user && user.role && user.role.toLowerCase() === "admin";

  if (btnCreate) {
    btnCreate.style.display = isAdmin ? "inline-block" : "none";
  }

  if (createPanel && !isAdmin) {
    createPanel.style.display = "none";
  }
}

/**
 * Formatea una fecha ISO string a un formato amigable estilo 2000s.
 * Ejemplos: "hace 5 min", "hace 2 horas", "ayer", "hace 3 días".
 *
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
      // Para fechas más antiguas, mostrar fecha local simple.
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
 * Muestra un mensaje de estado en el panel del muro.
 *
 * @param {string} texto
 * @param {"success"|"error"|"info"} tipo
 */
function mostrarMensajeMuro(texto, tipo) {
  const box = document.getElementById("message-status");
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
 * Actualiza UI del muro según sesión.
 *
 * @param {{username?: string}|null} user
 */
function configurarUIMuro(user) {
  const form = document.getElementById("message-form");
  const prompt = document.getElementById("login-prompt-panel");

  if (user && user.username) {
    if (form) form.style.display = "block";
    if (prompt) prompt.style.display = "none";
  } else {
    if (form) form.style.display = "none";
    if (prompt) prompt.style.display = "block";
  }
}

/**
 * Actualiza el contador de caracteres del textarea.
 *
 * @param {HTMLTextAreaElement} textarea
 */
function actualizarContador(textarea) {
  const counter = document.getElementById("message-counter");
  if (!counter || !textarea) return;
  const length = (textarea.value || "").length;
  counter.textContent = `${length}/280`;
}

/**
 * Crea y devuelve un elemento DOM para un mensaje del muro.
 *
 * @param {{id:number, content:string, createdAt:string, user:{username:string, avatarUrl?:string}}} msg
 * @returns {HTMLElement}
 */
function crearElementoMensaje(msg) {
  const card = document.createElement("article");
  card.classList.add("message-card");
  card.setAttribute("data-message-id", String(msg.id));

  const header = document.createElement("div");
  header.classList.add("message-header");

  const avatar = document.createElement("div");
  avatar.classList.add("avatar-circle", "avatar-mini");
  const nombre = msg.user && msg.user.username ? msg.user.username.trim() : "Anon";
  avatar.textContent = nombre ? nombre.charAt(0).toUpperCase() : "?";
  if (msg.user && msg.user.avatarUrl && msg.user.avatarUrl.trim()) {
    avatar.style.backgroundImage = `url("${msg.user.avatarUrl}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  }

  const info = document.createElement("div");
  info.classList.add("message-user-info");

  const username = document.createElement("span");
  username.classList.add("message-username");
  username.textContent = nombre || "Anon";

  const date = document.createElement("span");
  date.classList.add("message-date");
  date.textContent = `• ${formatearFechaAmigable(msg.createdAt)}`;

  info.appendChild(username);
  info.appendChild(date);

  header.appendChild(avatar);
  header.appendChild(info);

  const content = document.createElement("div");
  content.classList.add("message-content");
  content.textContent = msg.content || "";

  card.appendChild(header);
  card.appendChild(content);

  return card;
}

/**
 * Renderiza mensajes en el feed.
 *
 * @param {Array} messages
 */
function renderizarMensajes(messages) {
  const feed = document.getElementById("messages-feed");
  if (!feed) return;

  feed.innerHTML = "";

  if (!messages || messages.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("message-empty");
    empty.textContent = "Aún no hay mensajes. ¡Sé el primero en postear! :)";
    feed.appendChild(empty);
    return;
  }

  messages.forEach((msg) => {
    const card = crearElementoMensaje(msg);
    feed.appendChild(card);
  });
}

/**
 * Carga los mensajes del muro desde el backend.
 */
function cargarMensajes() {
  fetch("/api/messages?limit=50", {
    method: "GET",
    credentials: "include",
  })
    .then((resp) => resp.json().catch(() => ({ ok: false })))
    .then((data) => {
      if (data && data.ok && Array.isArray(data.messages)) {
        renderizarMensajes(data.messages);
      } else {
        console.error("Error al cargar mensajes:", data);
        renderizarMensajes([]);
      }
    })
    .catch((err) => {
      console.error("Error de red al cargar mensajes:", err);
      renderizarMensajes([]);
    });
}

/**
 * Publica un mensaje en el muro.
 *
 * @param {string} content
 */
function publicarMensaje(content) {
  const texto = (content || "").trim();

  if (!texto) {
    mostrarMensajeMuro("El mensaje no puede estar vacío.", "error");
    return;
  }

  if (texto.length > 280) {
    mostrarMensajeMuro("El mensaje no puede tener más de 280 caracteres.", "error");
    return;
  }

  fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content: texto }),
  })
    .then((resp) => resp.json().catch(() => ({ ok: false, message: "Error desconocido." })))
    .then((data) => {
      if (data && data.ok && data.message) {
        mostrarMensajeMuro("Mensaje publicado! ^_^", "success");

        const feed = document.getElementById("messages-feed");
        if (feed) {
          const empty = feed.querySelector(".message-empty");
          if (empty) empty.remove();
          const card = crearElementoMensaje(data.message);
          feed.insertBefore(card, feed.firstChild);
        }

        const textarea = document.getElementById("message-content");
        if (textarea) {
          textarea.value = "";
          actualizarContador(textarea);
        }
      } else {
        const msg = data && data.message ? data.message : "Error al publicar mensaje.";
        mostrarMensajeMuro(msg, "error");
      }
    })
    .catch((err) => {
      console.error("Error de red al publicar mensaje:", err);
      mostrarMensajeMuro("Error de conexión. Intenta de nuevo.", "error");
    });
}

/**
 * Crea y devuelve un elemento DOM para un foro en la lista.
 *
 * @param {{id: number, slug: string, title: string, description: string, createdAt: string}} forum
 * @returns {HTMLElement}
 */
function crearElementoForo(forum) {
  const card = document.createElement("article");
  card.classList.add("forum-card");
  card.setAttribute("data-forum-id", String(forum.id));

  // Header del foro: título + badge NEW si es reciente.
  const header = document.createElement("div");
  header.classList.add("forum-header-card");

  const titleLink = document.createElement("a");
  titleLink.href = `./forum.html?slug=${forum.slug}`;
  titleLink.classList.add("forum-title-link");
  titleLink.textContent = forum.title || "Sin título";

  header.appendChild(titleLink);

  // Badge "NEW" si el foro es muy reciente (menos de 1 hora).
  const fechaMsg = new Date(forum.createdAt);
  const ahora = new Date();
  const diffHours = Math.floor((ahora - fechaMsg) / 3600000);
  if (diffHours < 1) {
    const badge = document.createElement("span");
    badge.classList.add("badge", "badge-new");
    badge.textContent = "NEW";
    header.appendChild(badge);
  }

  card.appendChild(header);

  // Descripción del foro.
  if (forum.description && forum.description.trim()) {
    const desc = document.createElement("div");
    desc.classList.add("forum-description");
    desc.textContent = forum.description;
    card.appendChild(desc);
  }

  // Footer con fecha y botón "Entrar".
  const footer = document.createElement("div");
  footer.classList.add("forum-footer-card");

  const fecha = document.createElement("span");
  fecha.classList.add("forum-date");
  fecha.textContent = `Creado ${formatearFechaAmigable(forum.createdAt)}`;

  const btnEntrar = document.createElement("a");
  btnEntrar.href = `./forum.html?slug=${forum.slug}`;
  btnEntrar.classList.add("btn-2000", "btn-2000-primary");
  btnEntrar.textContent = "Entrar";

  footer.appendChild(fecha);
  footer.appendChild(btnEntrar);

  card.appendChild(footer);

  return card;
}

/**
 * Renderiza todos los foros en la lista.
 * Limpia el contenedor y agrega cada foro como una tarjeta.
 *
 * @param {Array} forums - Arreglo de objetos foro.
 */
function renderizarForos(forums) {
  const list = document.getElementById("forums-list");
  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (!forums || forums.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("forum-empty");
    empty.textContent = "Aún no hay foros creados. ¡Sé el primero en crear uno! :)";
    list.appendChild(empty);
    return;
  }

  forums.forEach((forum) => {
    const card = crearElementoForo(forum);
    list.appendChild(card);
  });
}

/**
 * Carga los foros desde el backend.
 */
function cargarForos() {
  fetch("/api/forums", {
    method: "GET",
    credentials: "include",
  })
    .then((resp) => resp.json().catch(() => ({ ok: false })))
    .then((data) => {
      if (data && data.ok && Array.isArray(data.forums)) {
        renderizarForos(data.forums);
      } else {
        console.error("Error al cargar foros:", data);
        const list = document.getElementById("forums-list");
        if (list) {
          list.innerHTML =
            '<div class="forum-empty">Error al cargar foros. Recarga la página.</div>';
        }
      }
    })
    .catch((err) => {
      console.error("Error de red al cargar foros:", err);
      const list = document.getElementById("forums-list");
      if (list) {
        list.innerHTML =
          '<div class="forum-empty">Error de conexión. Verifica tu internet.</div>';
      }
    });
}

/**
 * Muestra un mensaje de estado en el panel de creación de foro.
 *
 * @param {string} texto
 * @param {"success"|"error"} tipo
 */
function mostrarMensajeForo(texto, tipo) {
  const box = document.getElementById("create-forum-status");
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
 * Crea un nuevo foro.
 *
 * @param {string} title
 * @param {string} description
 */
function crearForo(title, description) {
  const tituloLimpio = (title || "").trim();
  const descLimpia = (description || "").trim();

  if (!tituloLimpio) {
    mostrarMensajeForo("El título es obligatorio T_T", "error");
    return;
  }

  if (tituloLimpio.length < 3 || tituloLimpio.length > 40) {
    mostrarMensajeForo("El título debe tener entre 3 y 40 caracteres.", "error");
    return;
  }

  if (descLimpia.length > 140) {
    mostrarMensajeForo("La descripción no puede tener más de 140 caracteres.", "error");
    return;
  }

  fetch("/api/forums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title: tituloLimpio, description: descLimpia }),
  })
    .then((resp) => resp.json().catch(() => ({ ok: false, message: "Error desconocido." })))
    .then((data) => {
      if (data && data.ok && data.forum) {
        // Limpiar el formulario.
        const form = document.getElementById("create-forum-form");
        if (form) {
          form.reset();
        }

        // Ocultar el panel de creación.
        const panel = document.getElementById("create-forum-panel");
        if (panel) {
          panel.style.display = "none";
        }

        mostrarMensajeForo("Foro creado (2006 vibes) ☆", "success");

        // Insertar el nuevo foro al inicio de la lista sin recargar todo.
        const list = document.getElementById("forums-list");
        if (list) {
          const emptyMsg = list.querySelector(".forum-empty");
          if (emptyMsg) {
            emptyMsg.remove();
          }
          const nuevaCard = crearElementoForo(data.forum);
          list.insertBefore(nuevaCard, list.firstChild);
        }
      } else {
        const mensajeError =
          data && data.message ? data.message : "Error al crear foro.";
        mostrarMensajeForo(mensajeError, "error");
      }
    })
    .catch((err) => {
      console.error("Error de red al crear foro:", err);
      mostrarMensajeForo("Error de conexión. Intenta de nuevo.", "error");
    });
}

// Ejecutamos la inicialización cuando el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;

  // Mostrar mensaje de bienvenida aleatorio.
  mostrarMensajeBienvenida();

  // Configuramos el botón de Cerrar sesión si existe.
  const logoutBtn = document.getElementById("home-logout-button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
        .then(() => {
          // Al cerrar sesión, refrescamos la página para actualizar toda la UI.
          window.location.reload();
        })
        .catch(() => {
          window.location.reload();
        });
    });
  }

  // Consultamos al backend quién es el usuario actual para
  // actualizar el bloque "Perfil rápido" y configurar UI de admin.
  fetch("/api/me", {
    method: "GET",
    credentials: "include",
  })
    .then((resp) => resp.json().catch(() => ({})))
    .then((data) => {
      if (!data || !data.ok || !data.user) {
        currentUser = null;
        aplicarPerfilEnHome(null);
        configurarUIAdmin(null);
        configurarUIMuro(null);
      } else {
        currentUser = data.user;
        aplicarPerfilEnHome(data.user);
        configurarUIAdmin(data.user);
        configurarUIMuro(data.user);
      }
    })
    .catch(() => {
      currentUser = null;
      aplicarPerfilEnHome(null);
      configurarUIAdmin(null);
      configurarUIMuro(null);
    });

  // Cargar mensajes del muro.
  cargarMensajes();

  // Configurar el formulario de publicación.
  const messageForm = document.getElementById("message-form");
  const messageTextarea = document.getElementById("message-content");
  if (messageTextarea) {
    actualizarContador(messageTextarea);
    messageTextarea.addEventListener("input", () => actualizarContador(messageTextarea));
  }

  if (messageForm) {
    messageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!currentUser) {
        mostrarMensajeMuro("Debes iniciar sesión para publicar.", "error");
        return;
      }
      const textarea = document.getElementById("message-content");
      if (textarea) {
        publicarMensaje(textarea.value);
      }
    });
  }

  // Cargar foros del club.
  cargarForos();

  // Configurar el botón "Crear foro" para mostrar/ocultar el panel.
  const btnCreate = document.getElementById("btn-create-forum");
  const createPanel = document.getElementById("create-forum-panel");
  const btnCancel = document.getElementById("btn-cancel-create-forum");

  if (btnCreate && createPanel) {
    btnCreate.addEventListener("click", () => {
      createPanel.style.display = createPanel.style.display === "none" ? "block" : "none";
      if (createPanel.style.display === "block") {
        const titleInput = document.getElementById("forum-title");
        if (titleInput) {
          titleInput.focus();
        }
      }
    });
  }

  if (btnCancel && createPanel) {
    btnCancel.addEventListener("click", () => {
      createPanel.style.display = "none";
      const form = document.getElementById("create-forum-form");
      if (form) {
        form.reset();
      }
      mostrarMensajeForo("", "");
    });
  }

  // Configurar el formulario de creación de foro.
  const form = document.getElementById("create-forum-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const titleInput = document.getElementById("forum-title");
      const descInput = document.getElementById("forum-description");

      if (titleInput && descInput) {
        crearForo(titleInput.value, descInput.value);
      }
    });
  }
});
