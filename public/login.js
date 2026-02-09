// login.js
// ============================
// Lógica de la página de inicio de sesión:
// - Formulario clásico email + contraseña.
// - Llamadas a POST /api/auth/login.
// - Manejo de mensajes de éxito/error dentro de la página.

/**
 * Muestra un mensaje en la caja principal de login.
 * @param {string} texto
 * @param {"success"|"error"} tipo
 */
function mostrarMensajeLogin(texto, tipo) {
  const box = document.getElementById("login-message");
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
 * Inicializa el formulario de login.
 */
function inicializarLogin() {
  const form = document.getElementById("login-form");
  const inputEmail = document.getElementById("login-email");
  const inputPassword = document.getElementById("login-password");

  if (!form || !inputEmail || !inputPassword) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = (inputEmail.value || "").trim();
    const password = inputPassword.value || "";

    if (!email || !password) {
      mostrarMensajeLogin(
        "Por favor, escribe tu email y contraseña ;)",
        "error"
      );
      return;
    }

    fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
      .then(async (resp) => {
        let data;
        try {
          const text = await resp.text();
          data = text ? JSON.parse(text) : {};
        } catch (err) {
          data = {};
        }
        return { resp, data };
      })
      .then(({ resp, data }) => {
        if (!resp.ok || !data || !data.ok) {
          const msg =
            data && data.message
              ? data.message
              : "Email o contraseña incorrectos.";
          mostrarMensajeLogin(msg, "error");
          return;
        }

        mostrarMensajeLogin(
          "Login correcto. Redirigiendo al foro...",
          "success"
        );

        window.setTimeout(() => {
          window.location.href = "./index.html";
        }, 600);
      })
      .catch(() => {
        mostrarMensajeLogin(
          "Error de conexión. Asegúrate de abrir http://localhost:3000/login.html y de que el servidor esté corriendo.",
          "error"
        );
      });
  });
}

// Iniciar todo cuando el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.protocol === "file:") {
    mostrarMensajeLogin(
      "ERROR: Esta página debe abrirse desde http://localhost:3000/login.html (no desde file://). Asegúrate de iniciar el servidor con 'node server.js'.",
      "error"
    );
    return;
  }
  inicializarLogin();
});


