// auth.js
// ============================
// Sistema de autenticación frontend para flores del naranjo club.
// Maneja registro, login, logout y actualización del header según sesión.
// Endpoints: /api/auth/register, /api/auth/login, /api/auth/logout, /api/me

/**
 * Muestra un mensaje de error o éxito en un contenedor.
 * @param {HTMLElement} container - Contenedor donde mostrar el mensaje.
 * @param {string} message - Texto del mensaje.
 * @param {"success"|"error"} type - Tipo de mensaje.
 */
function showMessage(container, message, type) {
  if (!container) return;

  container.textContent = message;
  container.classList.remove("message-success", "message-error");

  if (type === "success") {
    container.classList.add("message-success");
  } else if (type === "error") {
    container.classList.add("message-error");
  }
}

/**
 * Limpia el mensaje de un contenedor.
 * @param {HTMLElement} container
 */
function clearMessage(container) {
  if (container) {
    container.textContent = "";
    container.classList.remove("message-success", "message-error");
  }
}

// ============================
// REGISTRO
// ============================

const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const messageBox = document.getElementById("register-message");
    const usernameInput = document.getElementById("reg-username");
    const passwordInput = document.getElementById("reg-password");
    const passwordConfirmInput = document.getElementById("reg-password-confirm");

    if (!usernameInput || !passwordInput || !passwordConfirmInput) {
      return;
    }

    const username = (usernameInput.value || "").trim();
    const emailInput = document.getElementById("reg-email");
    const email = emailInput ? (emailInput.value || "").trim() : "";
    const password = passwordInput.value || "";
    const passwordConfirm = passwordConfirmInput.value || "";

    // Validación frontend básica.
    if (!username) {
      showMessage(messageBox, "El nombre de usuario es obligatorio.", "error");
      return;
    }

    if (username.length < 3 || username.length > 20) {
      showMessage(
        messageBox,
        "El nombre de usuario debe tener entre 3 y 20 caracteres.",
        "error"
      );
      return;
    }

    if (username !== usernameInput.value.trim()) {
      showMessage(
        messageBox,
        "El nombre de usuario no puede tener espacios al inicio/fin.",
        "error"
      );
      return;
    }

    if (!email) {
      showMessage(messageBox, "El email es obligatorio.", "error");
      return;
    }

    if (!password || password.length < 6) {
      showMessage(messageBox, "La contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }

    if (password !== passwordConfirm) {
      showMessage(messageBox, "Las contraseñas no coinciden.", "error");
      return;
    }

    // Enviar registro al backend.
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json().catch(() => ({ ok: false, message: "Error desconocido." }));

      if (data.ok && data.user) {
        showMessage(messageBox, "¡Cuenta creada con éxito! Redirigiendo...", "success");
        // Redirigir al inicio después de un breve delay.
        setTimeout(() => {
          window.location.href = "./index.html";
        }, 1000);
      } else {
        const errorMsg = data.message || "Error al registrar usuario.";
        showMessage(messageBox, errorMsg, "error");
      }
    } catch (err) {
      console.error("Error de red al registrar:", err);
      showMessage(messageBox, "Error de conexión. Intenta de nuevo.", "error");
    }
  });
}

// ============================
// LOGIN
// ============================

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const messageBox = document.getElementById("login-message");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    if (!emailInput || !passwordInput) {
      return;
    }

    const email = (emailInput.value || "").trim();
    const password = passwordInput.value || "";

    // Validación frontend básica.
    if (!email || !password) {
      showMessage(messageBox, "Email y contraseña son obligatorios.", "error");
      return;
    }

    // Enviar login al backend.
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({ ok: false, message: "Error desconocido." }));

      if (data.ok && data.user) {
        showMessage(messageBox, "¡Login exitoso! Redirigiendo...", "success");
        // Redirigir al inicio después de un breve delay.
        setTimeout(() => {
          window.location.href = "./index.html";
        }, 1000);
      } else {
        const errorMsg = data.message || "Usuario o contraseña incorrectos.";
        showMessage(messageBox, errorMsg, "error");
      }
    } catch (err) {
      console.error("Error de red al hacer login:", err);
      showMessage(messageBox, "Error de conexión. Intenta de nuevo.", "error");
    }
  });
}

// ============================
// ACTUALIZAR HEADER (index.html)
// ============================

/**
 * Actualiza el header/nav según el estado de sesión del usuario.
 * Si hay sesión, muestra "Hola, <username>" + botón "Cerrar sesión".
 * Si no hay sesión, muestra links "Iniciar sesión" y "Registrarse".
 */
async function updateAuthHeader() {
  const authSlot = document.getElementById("authSlot");
  if (!authSlot) return; // Si no existe el slot, salir silenciosamente.

  try {
    const response = await fetch("/api/me", {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({ ok: false }));

    if (data.ok && data.user) {
      // Usuario logeado: mostrar saludo + botón cerrar sesión.
      authSlot.innerHTML = `
        <span class="nav-link">Hola, <strong>${escapeHtml(data.user.username)}</strong></span>
        <span class="nav-separator">|</span>
        <button class="nav-link nav-button-2000" id="btn-logout" style="border: none; background: none; cursor: pointer; font-family: inherit; font-size: inherit;">
          Cerrar sesión
        </button>
      `;

      // Configurar botón de logout.
      const logoutBtn = document.getElementById("btn-logout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            });
            // Recargar la página para actualizar el header.
            window.location.reload();
          } catch (err) {
            console.error("Error al cerrar sesión:", err);
            window.location.reload();
          }
        });
      }
    } else {
      // Usuario no logeado: mostrar links de login y registro.
      authSlot.innerHTML = `
        <a href="./register.html" class="nav-link">Registrarse</a>
        <span class="nav-separator">|</span>
        <a href="./login.html" class="nav-link nav-button-2000">Iniciar sesión</a>
      `;
    }
  } catch (err) {
    console.error("Error al verificar sesión:", err);
    // En caso de error, mostrar estado de invitado.
    authSlot.innerHTML = `
      <a href="./register.html" class="nav-link">Registrarse</a>
      <span class="nav-separator">|</span>
      <a href="./login.html" class="nav-link nav-button-2000">Iniciar sesión</a>
    `;
  }
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

// Ejecutar actualización del header cuando el DOM esté listo.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", updateAuthHeader);
} else {
  updateAuthHeader();
}
