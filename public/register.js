// register.js
// ============================
// Lógica de la página de registro:
// - Registro clásico con formulario (username + email + password).
// - Botón "Registrarse con Google" (solo demo, sin OAuth real).
// - Usa backend real (Node/Express + SQLite) en lugar de localStorage.
//
// La API se expone en:
//   POST /api/auth/register
//   (el servidor se encarga de validar, hashear y crear la cookie de sesión).
//
// IMPORTANTE: Esta página debe abrirse desde http://localhost:3000/register.html
// NO desde file:// (eso rompe las peticiones fetch a /api/*).

// Verificar que no se esté abriendo desde file://
if (window.location.protocol === "file:") {
  document.addEventListener("DOMContentLoaded", () => {
    const messageBox = document.getElementById("register-message");
    if (messageBox) {
      messageBox.textContent =
        "ERROR: Esta página debe abrirse desde http://localhost:3000/register.html (no desde file://). Asegúrate de que el servidor esté corriendo con 'node server.js'.";
      messageBox.classList.add("message-error");
    }
  });
}

/**
 * Muestra un mensaje de éxito o error en la caja principal.
 * @param {string} texto
 * @param {"success"|"error"} tipo
 */
function mostrarMensajeRegistro(texto, tipo) {
  const box = document.getElementById("register-message");
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
 * Valida los campos básicos del formulario clásico de registro.
 * Devuelve { ok: boolean, mensaje?: string }.
 * (Validación extra al margen de la que hace el backend.)
 */
function validarFormularioRegistro({
  username,
  email,
  password,
  passwordConfirm,
  termsChecked,
}) {
  const nombreOriginal = username || "";
  const nombre = nombreOriginal.trim();

  if (!nombre) {
    return { ok: false, mensaje: "El nombre de usuario es obligatorio :O" };
  }

  if (nombre.length < 3 || nombre.length > 20) {
    return {
      ok: false,
      mensaje: "El nombre debe tener entre 3 y 20 caracteres (modo foro 2004).",
    };
  }

  if (nombre !== nombreOriginal) {
    return {
      ok: false,
      mensaje: "Quita espacios al inicio/fin del nombre, plz ;)",
    };
  }

  if (!email) {
    return { ok: false, mensaje: "El email es obligatorio para el registro." };
  }

  // Validación básica de email (no perfecta, pero suficiente para front).
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { ok: false, mensaje: "Ese email no parece válido T_T" };
  }

  if (!password || password.length < 6) {
    return {
      ok: false,
      mensaje: "La contraseña debe tener al menos 6 caracteres.",
    };
  }

  if (password !== passwordConfirm) {
    return {
      ok: false,
      mensaje: "Las contraseñas no coinciden, revisa bien ;_;",
    };
  }

  if (!termsChecked) {
    return {
      ok: false,
      mensaje: "Debes aceptar las reglas del foro antes de registrarte.",
    };
  }

  return { ok: true };
}

/**
 * Envía el registro clásico al backend.
 */
function enviarRegistroClasico(datos) {
  const payload = {
    username: datos.username.trim(),
    email: datos.email.trim(),
    password: datos.password,
  };

  fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // importante para que se guarde la cookie httpOnly
    body: JSON.stringify(payload),
  })
    .then(async (resp) => {
      // Intentar parsear la respuesta JSON.
      let data;
      try {
        const text = await resp.text();
        if (!text) {
          mostrarMensajeRegistro(
            "Error: El servidor no respondió. ¿Está corriendo en http://localhost:3000?",
            "error"
          );
          return;
        }
        data = JSON.parse(text);
      } catch (err) {
        console.error("Error al parsear respuesta:", err);
        mostrarMensajeRegistro(
          "Error del servidor. Asegúrate de que el servidor esté corriendo en http://localhost:3000",
          "error"
        );
        return;
      }

      if (!resp.ok || !data || !data.ok) {
        const msg =
          data && data.message
            ? data.message
            : "No se pudo crear la cuenta. Intenta de nuevo más tarde.";
        mostrarMensajeRegistro(msg, "error");
        return;
      }

      mostrarMensajeRegistro(
        "Cuenta creada con éxito (2006 vibes). Redirigiendo...",
        "success"
      );

      // Pequeño delay para que el usuario vea el mensaje antes de redirigir.
      window.setTimeout(() => {
        window.location.href = "./index.html";
      }, 600);
    })
    .catch((err) => {
      console.error("Error de red al registrar:", err);
      mostrarMensajeRegistro(
        "Error de conexión. Asegúrate de que el servidor esté corriendo: 'node server.js' y abre http://localhost:3000/register.html",
        "error"
      );
    });
}

/**
 * Simula un registro con Google (demo, sin OAuth real).
 * Genera username/email aleatorios y los manda al mismo endpoint de registro.
 */
function enviarRegistroGoogleDemo() {
  // Generamos un número aleatorio 100-999.
  const numero = 100 + Math.floor(Math.random() * 900);
  const username = `usuario_google_${numero}`;
  const email = `googleuser${numero}@gmail.com`;
  const password = `google_demo_${numero}_${Date.now()}`;

  fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  })
    .then(async (resp) => {
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data || !data.ok) {
        const msg =
          data && data.message
            ? data.message
            : "No se pudo completar el registro Google (demo).";
        mostrarMensajeRegistro(msg, "error");
        return;
      }

      mostrarMensajeRegistro(
        "Registro Google (demo) listo. (Falta OAuth real, obvio).",
        "success"
      );

      window.setTimeout(() => {
        window.location.href = "./index.html";
      }, 600);
    })
    .catch(() => {
      mostrarMensajeRegistro(
        "Error de red al simular Google (demo). Vuelve a intentarlo.",
        "error"
      );
    });
}

/**
 * Inicializa los listeners del formulario y del botón de Google demo.
 */
function inicializarRegistro() {
  const form = document.getElementById("register-form");
  const inputUsername = document.getElementById("reg-username");
  const inputEmail = document.getElementById("reg-email");
  const inputPassword = document.getElementById("reg-password");
  const inputPasswordConfirm = document.getElementById("reg-password-confirm");
  const inputTerms = document.getElementById("reg-terms");
  const btnGoogle = document.getElementById("btn-google-register");

  if (!form || !inputUsername || !inputEmail || !inputPassword || !inputPasswordConfirm) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const datos = {
      username: inputUsername.value || "",
      email: inputEmail.value || "",
      password: inputPassword.value || "",
      passwordConfirm: inputPasswordConfirm.value || "",
      termsChecked: !!(inputTerms && inputTerms.checked),
    };

    const validacion = validarFormularioRegistro(datos);
    if (!validacion.ok) {
      mostrarMensajeRegistro(validacion.mensaje || "Error en el formulario.", "error");
      return;
    }

    enviarRegistroClasico(datos);
  });

  if (btnGoogle) {
    btnGoogle.addEventListener("click", () => {
      enviarRegistroGoogleDemo();
    });
  }
}

// Iniciar todo cuando el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  inicializarRegistro();
});
