// profile.js
// ============================
// Lógica de la página de perfil:
// - Cargar datos del usuario real desde el backend (/api/me).
// - Permitir editar nombre de usuario y URL de avatar (PUT /api/me).
// - Previsualizar el avatar.
// - Mostrar mensajes estilo 2006 en la cajita de estado.

/**
 * Muestra un mensaje en la cajita de estado del formulario.
 * @param {string} texto
 * @param {"ok"|"error"} tipo
 */
function mostrarMensajePerfil(texto, tipo) {
  const box = document.getElementById("profile-status-message");
  if (!box) return;

  box.textContent = texto;
  box.classList.remove("status-ok", "status-error");

  if (tipo === "ok") {
    box.classList.add("status-ok");
  } else if (tipo === "error") {
    box.classList.add("status-error");
  }
}

/**
 * Actualiza el avatar circular principal de la vista previa
 * (texto/inicial y fondo retro). Si se proporciona una URL válida,
 * se intenta mostrar una imagen encima del círculo.
 *
 * @param {string} nombre
 * @param {string} avatarUrl
 */
function actualizarVistaPreviaAvatar(nombre, avatarUrl) {
  const circle = document.getElementById("profile-avatar-circle");
  const img = document.getElementById("profile-avatar-image");

  if (!circle || !img) {
    return;
  }

  const inicial = (nombre || "").trim().charAt(0).toUpperCase() || "D";
  circle.textContent = inicial;

  // Siempre restauramos el círculo base y escondemos la imagen al inicio.
  circle.style.backgroundImage = "";
  img.classList.remove("avatar-image-visible");
  img.classList.add("avatar-image-hidden");
  img.removeAttribute("src");

  const urlLimpia = (avatarUrl || "").trim();
  if (!urlLimpia) {
    // Sin URL: dejamos solo el círculo retro.
    return;
  }

  // Validación ligera de URL: si es obviamente inválida, no cargamos.
  try {
    // new URL lanza si la URL no es válida.
    const posible = new URL(urlLimpia);
    if (!/^https?:/i.test(posible.protocol)) {
      // Solo aceptamos http/https como URLs de avatar.
      return;
    }
  } catch (err) {
    // URL inválida: nos quedamos con el círculo por defecto.
    return;
  }

  // Intentamos cargar la imagen; si falla, el círculo se mantiene.
  img.onload = function onLoad() {
    img.classList.remove("avatar-image-hidden");
    img.classList.add("avatar-image-visible");
  };

  img.onerror = function onError() {
    img.classList.remove("avatar-image-visible");
    img.classList.add("avatar-image-hidden");
  };

  img.src = urlLimpia;
}

/**
 * Aplica el perfil a la barra lateral de perfil (avatar + nombre).
 * Espera un objeto { username, avatarUrl }.
 */
function aplicarPerfilEnSidebar(perfil) {
  const avatarEl = document.getElementById("profile-sidebar-avatar");
  const usernameSpan = document.getElementById("profile-sidebar-username");

  if (!avatarEl && !usernameSpan) return;
  if (!perfil) return;

  const nombreLimpio =
    typeof perfil.username === "string" ? perfil.username.trim() : "";

  if (usernameSpan && nombreLimpio) {
    usernameSpan.textContent = nombreLimpio;
  }

  if (avatarEl) {
    const inicial = nombreLimpio ? nombreLimpio.charAt(0).toUpperCase() : "D";
    avatarEl.textContent = inicial;

    // Fondo retro por defecto; si hay URL válida, se aplica como fondo.
    avatarEl.style.backgroundImage = "";

    const urlLimpia = (perfil.avatarUrl || "").trim();
    if (!urlLimpia) return;

    try {
      const posible = new URL(urlLimpia);
      if (!/^https?:/i.test(posible.protocol)) return;
      avatarEl.style.backgroundImage = `url("${urlLimpia}")`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
    } catch (err) {
      // Si la URL es inválida, ignoramos y dejamos el fondo retro.
    }
  }
}

/**
 * Carga el usuario actual desde /api/me.
 * Si no hay sesión válida, redirige a login.html.
 * @returns {Promise<{id:number, username:string, email:string, avatarUrl:string}|null>}
 */
function cargarPerfilDesdeBackend() {
  return fetch("/api/me", {
    method: "GET",
    credentials: "include",
  })
    .then((resp) => resp.json().catch(() => ({})))
    .then((data) => {
      if (!data || !data.ok || !data.user) {
        // No logeado: mandamos al login.
        window.location.href = "./login.html";
        return null;
      }
      return data.user;
    })
    .catch(() => {
      window.location.href = "./login.html";
      return null;
    });
}

/**
 * Inicializa el formulario de perfil:
 * - Carga datos del usuario desde el backend.
 * - Conecta botones de Vista previa y Guardar.
 */
function inicializarFormularioPerfil() {
  const form = document.getElementById("profile-form");
  const inputNombre = document.getElementById("profile-username");
  const inputAvatar = document.getElementById("profile-avatar-url");
  const btnPreview = document.getElementById("btn-preview-avatar");

  if (!form || !inputNombre || !inputAvatar) return;

  // Primero consultamos al backend quién es el usuario actual.
  cargarPerfilDesdeBackend().then((user) => {
    if (!user) return;

    // Precargar valores en el formulario.
    inputNombre.value = user.username || "";
    inputAvatar.value = user.avatarUrl || "";

    // Actualizar preview y sidebar.
    actualizarVistaPreviaAvatar(user.username || "", user.avatarUrl || "");
    aplicarPerfilEnSidebar(user);
  });

  // Botón de Vista previa: solo actualiza la vista previa sin guardar.
  if (btnPreview) {
    btnPreview.addEventListener("click", () => {
      actualizarVistaPreviaAvatar(inputNombre.value, inputAvatar.value);
      mostrarMensajePerfil("Vista previa actualizada ;)", "ok");
    });
  }

  // Enviar formulario = Guardar cambios vía PUT /api/me.
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nombreOriginal = inputNombre.value || "";
    const nombre = nombreOriginal.trim();
    const urlCruda = inputAvatar.value || "";
    const urlLimpia = urlCruda.trim();

    // Validación de nombre: 3-20 caracteres, sin espacios al inicio/fin.
    if (nombre.length < 3 || nombre.length > 20) {
      mostrarMensajePerfil(
        "El nombre debe tener entre 3 y 20 caracteres (2006 rules).",
        "error"
      );
      return;
    }
    if (nombre !== nombreOriginal) {
      mostrarMensajePerfil(
        "Sin espacios al inicio/fin, plz :) Ajusta tu nombre.",
        "error"
      );
      return;
    }

    // Validación opcional de URL: se permite vacía.
    if (urlLimpia) {
      try {
        const posible = new URL(urlLimpia);
        if (!/^https?:/i.test(posible.protocol)) {
          mostrarMensajePerfil(
            "Solo se aceptan URLs http/https para el avatar :O",
            "error"
          );
          return;
        }
      } catch (err) {
        mostrarMensajePerfil("La URL del avatar no parece válida T_T", "error");
        return;
      }
    }

    // Enviar cambios al backend.
    fetch("/api/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        username: nombre,
        avatarUrl: urlLimpia,
      }),
    })
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data || !data.ok) {
          const msg =
            data && data.message
              ? data.message
              : "No se pudieron guardar los cambios. Intenta de nuevo.";
          mostrarMensajePerfil(msg, "error");
          return;
        }

        // Actualizar preview y sidebar con los datos actualizados.
        if (data.user) {
          actualizarVistaPreviaAvatar(data.user.username || "", data.user.avatarUrl || "");
          aplicarPerfilEnSidebar(data.user);
        }

        mostrarMensajePerfil("Guardado (2006 vibes) ☆", "ok");
      })
      .catch(() => {
        mostrarMensajePerfil(
          "Error de red al guardar. ¿Se cayó el servidor? T_T",
          "error"
        );
      });
  });
}

// Inicializamos la lógica de perfil cuando el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  inicializarFormularioPerfil();
});
