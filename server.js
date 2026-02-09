// server.js
// ============================
// Backend mínimo para el foro 2000s:
// - Express para servir la carpeta /public y exponer API JSON.
// - better-sqlite3 para SQLite (archivo foro.db).
// - bcrypt para hashear contraseñas.
// - cookie-parser para manejar una cookie httpOnly "uid" como pseudo-sesión.
//
// INSTALACIÓN Y EJECUCIÓN:
//   1. npm install
//   2. npm start  (o: node server.js)
//   3. Abrir http://localhost:3000
//
// ENDPOINTS DE AUTENTICACIÓN:
//   POST /api/auth/register  - Registrar nuevo usuario (username + email + password)
//   POST /api/auth/login     - Iniciar sesión (email + password)
//   POST /api/auth/logout    - Cerrar sesión
//   GET  /api/me             - Obtener usuario actual si hay sesión

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

// --- Inicializar base de datos SQLite ---

// Archivo de base de datos en la raíz del proyecto.
const dbFile = path.join(__dirname, "foro.db");
const db = new Database(dbFile);

// Configuración básica recomendable para SQLite en apps pequeñas.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Crear tabla de usuarios si no existe todavía.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    email_verified INTEGER NOT NULL DEFAULT 0,
    email_verification_token TEXT,
    email_verification_expires TEXT,
    created_at TEXT NOT NULL
  );
`);

// Agregar columna role si no existe (migración para bases de datos existentes).
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
} catch (err) {
  // La columna ya existe, ignorar error.
}
try {
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
} catch (err) {
  // La columna ya existe, ignorar error.
}
try {
  db.exec("ALTER TABLE users ADD COLUMN email_verification_token TEXT");
} catch (err) {
  // La columna ya existe, ignorar error.
}
try {
  db.exec("ALTER TABLE users ADD COLUMN email_verification_expires TEXT");
} catch (err) {
  // La columna ya existe, ignorar error.
}

// Crear tabla de mensajes (muro del club).
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Crear tabla de foros.
db.exec(`
  CREATE TABLE IF NOT EXISTS forums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );
`);

// Crear tabla de threads (temas dentro de foros).
db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forum_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    last_post_at TEXT,
    FOREIGN KEY(forum_id) REFERENCES forums(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );
`);

// Crear tabla de posts (mensajes dentro de threads).
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(thread_id) REFERENCES threads(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Índices básicos para mejorar rendimiento en lecturas frecuentes.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
  CREATE INDEX IF NOT EXISTS idx_forums_slug ON forums(slug);
  CREATE INDEX IF NOT EXISTS idx_threads_forum_id ON threads(forum_id);
  CREATE INDEX IF NOT EXISTS idx_threads_last_post_at ON threads(last_post_at);
  CREATE INDEX IF NOT EXISTS idx_posts_thread_id ON posts(thread_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
`);

// Helper para mapear fila de SQLite a objeto JSON para el cliente.
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url || "",
    role: row.role || "user",
    emailVerified: Boolean(row.email_verified),
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidUsername(username) {
  // 3-20 chars, letras/numeros/._- sin espacios
  return /^[a-zA-Z0-9._-]{3,20}$/.test(username);
}

function validatePassword(pwd) {
  const errors = [];
  if (pwd.length < 6) errors.push("Debe tener al menos 6 caracteres.");
  return errors;
}

const RATE_LIMITS = {
  register: { windowMs: 10 * 60 * 1000, max: 5 }, // 5 intentos / 10 min
};

const rateLimitBuckets = new Map();

function rateLimit(key, windowMs, max) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    rateLimitBuckets.set(key, { start: now, count: 1 });
    return { ok: true, remaining: max - 1 };
  }
  if (bucket.count >= max) {
    return { ok: false, retryAfterMs: windowMs - (now - bucket.start) };
  }
  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count };
}

function getUserById(id) {
  return db
    .prepare(
      "SELECT id, username, email, avatar_url, role, email_verified, email_verification_token, email_verification_expires, created_at FROM users WHERE id = ?"
    )
    .get(id);
}

function getUserByEmail(email) {
  return db
    .prepare(
      "SELECT id, username, email, password_hash, avatar_url, role, email_verified, email_verification_token, email_verification_expires, created_at FROM users WHERE lower(email) = lower(?)"
    )
    .get(email);
}

// Helper para obtener usuario por username (para auth simplificado).
function getUserByUsername(username) {
  return db
    .prepare(
      "SELECT id, username, password_hash, avatar_url, role, email_verified, email_verification_token, email_verification_expires, created_at FROM users WHERE lower(username) = lower(?)"
    )
    .get(username);
}

function createEmailVerification() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  return { token, expiresAt };
}

function getBaseUrl(req) {
  const envUrl = process.env.BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const host = req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

function sendVerificationEmailStub(email, verifyUrl) {
  console.log(`[email] Verifica tu cuenta: ${email}`);
  console.log(`[email] Link de verificación: ${verifyUrl}`);
}

// Helper para obtener usuario desde cookie (para /api/auth/me y otras rutas).
function getUserFromCookie(req) {
  const uid = req.cookies.uid;
  if (!uid) return null;
  return getUserById(Number(uid));
}

// Helper para obtener usuario desde request (alias de getUserFromCookie para claridad).
function getUserFromRequest(req) {
  return getUserFromCookie(req);
}

// --- Middlewares globales ---

app.use(express.json());
app.use(cookieParser());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ ok: false, message: "JSON inválido." });
  }
  return next(err);
});

// --- Endpoints de autenticación / usuario ---
// IMPORTANTE: Las rutas de API deben ir ANTES de express.static()
// para evitar que express.static() capture las peticiones a /api/*

// Registro de usuario
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    const rawName = typeof username === "string" ? username : "";
    const trimmedName = rawName.trim();
    const rawEmail = typeof email === "string" ? email : "";
    const trimmedEmail = rawEmail.trim();
    const normalizedEmail = normalizeEmail(trimmedEmail);
    const pwd = typeof password === "string" ? password : "";

    const ip = req.ip || "unknown";
    const rl = rateLimit(`register:${ip}`, RATE_LIMITS.register.windowMs, RATE_LIMITS.register.max);
    if (!rl.ok) {
      return res.status(429).json({
        ok: false,
        message: "Demasiados intentos. Intenta más tarde.",
      });
    }

    // Validaciones básicas (servidor es la fuente de verdad).
    if (!trimmedName) {
      return res.status(400).json({ ok: false, message: "El nombre de usuario es obligatorio." });
    }
    if (!isValidUsername(trimmedName)) {
      return res
        .status(400)
        .json({ ok: false, message: "El nombre debe tener 3-20 caracteres y solo usar letras, números, punto, guión o guión bajo." });
    }
    if (trimmedName !== rawName) {
      return res
        .status(400)
        .json({ ok: false, message: "El nombre no puede tener espacios al inicio/fin." });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ ok: false, message: "El email es obligatorio." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, message: "El email no parece válido." });
    }
    if (!pwd) {
      return res
        .status(400)
        .json({ ok: false, message: "La contraseña es obligatoria." });
    }
    const pwdErrors = validatePassword(pwd);
    if (pwdErrors.length) {
      return res
        .status(400)
        .json({ ok: false, message: `Contraseña débil. ${pwdErrors.join(" ")}` });
    }

    // Comprobar duplicados antes de insertar para devolver 409 claros.
    const existingByUsername = db
      .prepare("SELECT id FROM users WHERE lower(username) = lower(?)")
      .get(trimmedName);
    if (existingByUsername) {
      return res
        .status(409)
        .json({ ok: false, message: "Ese nombre de usuario ya está en uso." });
    }

    const existingByEmail = db
      .prepare("SELECT id FROM users WHERE lower(email) = lower(?)")
      .get(normalizedEmail);
    if (existingByEmail) {
      return res
        .status(409)
        .json({ ok: false, message: "Ya existe una cuenta con ese email." });
    }

    const passwordHash = await bcrypt.hash(pwd, 10);
    const createdAt = new Date().toISOString();
    const { token, expiresAt } = createEmailVerification();

    // Insertar usuario con todos los campos requeridos (role tiene DEFAULT 'user').
    const insert = db.prepare(
      "INSERT INTO users (username, email, password_hash, avatar_url, role, email_verified, email_verification_token, email_verification_expires, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const result = insert.run(
      trimmedName,
      normalizedEmail,
      passwordHash,
      "",
      "user",
      1,
      token,
      expiresAt,
      createdAt
    );

    const userRow = getUserById(result.lastInsertRowid);
    const user = mapUserRow(userRow);

    const verifyUrl = `${getBaseUrl(req)}/api/auth/verify?token=${token}`;
    sendVerificationEmailStub(normalizedEmail, verifyUrl);

    // Seteamos cookie httpOnly simple con el id del usuario.
    res.cookie("uid", String(user.id), {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // activar si sirves sobre HTTPS
    });

    return res.status(201).json({
      ok: true,
      user,
      message: "Registro exitoso. Ya puedes iniciar sesión.",
    });
  } catch (err) {
    console.error("Error en /api/auth/register:", err);
    return res.status(500).json({ ok: false, message: "Error interno al registrar usuario." });
  }
});

// Login de usuario
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const rawEmail = typeof email === "string" ? email : "";
    const trimmedEmail = rawEmail.trim();
    const normalizedEmail = normalizeEmail(trimmedEmail);
    const pwd = typeof password === "string" ? password : "";

    if (!trimmedEmail || !pwd) {
      return res
        .status(400)
        .json({ ok: false, message: "Email y contraseña son obligatorios." });
    }

    const userRow = getUserByEmail(normalizedEmail);
    if (!userRow) {
      return res
        .status(401)
        .json({ ok: false, message: "Email o contraseña incorrectos." });
    }

    const valid = await bcrypt.compare(pwd, userRow.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ ok: false, message: "Email o contraseña incorrectos." });
    }

    const user = mapUserRow(userRow);

    res.cookie("uid", String(user.id), {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // activar si sirves sobre HTTPS
    });

    // Asegurar que no quede ningún contador de login activo en el MVP.
    const ip = req.ip || "unknown";
    rateLimitBuckets.delete(`login:${ip}`);

    return res.json({ ok: true, user });
  } catch (err) {
    console.error("Error en /api/auth/login:", err);
    return res.status(500).json({ ok: false, message: "Error interno al iniciar sesión." });
  }
});

// Verificar cuenta por token (link de email).
app.get("/api/auth/verify", (req, res) => {
  try {
    const token = String(req.query.token || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, message: "Token inválido." });
    }

    const row = db
      .prepare(
        "SELECT id, email_verification_expires FROM users WHERE email_verification_token = ?"
      )
      .get(token);

    if (!row) {
      return res.status(400).json({ ok: false, message: "Token inválido o expirado." });
    }

    if (row.email_verification_expires && new Date(row.email_verification_expires).getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: "Token expirado." });
    }

    db.prepare(
      "UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?"
    ).run(row.id);

    return res.json({ ok: true, message: "Cuenta verificada. Ya puedes iniciar sesión." });
  } catch (err) {
    console.error("Error en GET /api/auth/verify:", err);
    return res.status(500).json({ ok: false, message: "Error interno al verificar cuenta." });
  }
});

// Reenviar verificación (si no está verificada).
app.post("/api/auth/resend-verification", authRequired, (req, res) => {
  try {
    const userRow = getUserById(req.user.id);
    if (!userRow) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
    }
    if (userRow.email_verified) {
      return res.status(400).json({ ok: false, message: "La cuenta ya está verificada." });
    }

    const { token, expiresAt } = createEmailVerification();
    db.prepare(
      "UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?"
    ).run(token, expiresAt, userRow.id);

    const verifyUrl = `${getBaseUrl(req)}/api/auth/verify?token=${token}`;
    sendVerificationEmailStub(userRow.email, verifyUrl);

    return res.json({ ok: true, message: "Se envió un nuevo email de verificación." });
  } catch (err) {
    console.error("Error en POST /api/auth/resend-verification:", err);
    return res.status(500).json({ ok: false, message: "Error interno al reenviar verificación." });
  }
});

// Logout (borra cookie de sesión)
app.post("/api/auth/logout", (req, res) => {
  // Limpieza de cookie de sesión.
  res.clearCookie("uid", { httpOnly: true, sameSite: "lax" });
  return res.json({ ok: true });
});

// Devuelve el usuario actual si hay cookie válida.
app.get("/api/me", (req, res) => {
  try {
    const uid = req.cookies.uid;
    if (!uid) {
      return res.json({ ok: false });
    }

    const userRow = getUserById(Number(uid));
    if (!userRow) {
      // Si la cookie apunta a un usuario inexistente, la limpiamos.
      // Cookie huérfana: limpiar para evitar loops.
      res.clearCookie("uid", { httpOnly: true, sameSite: "lax" });
      return res.json({ ok: false });
    }

    const user = mapUserRow(userRow);
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("Error en /api/me:", err);
    return res.status(500).json({ ok: false });
  }
});

// Middleware de autenticación para rutas que requieren usuario logeado.
function authRequired(req, res, next) {
  const uid = req.cookies.uid;
  if (!uid) {
    return res.status(401).json({ ok: false, message: "No autenticado." });
  }

  const userRow = getUserById(Number(uid));
  if (!userRow) {
    res.clearCookie("uid", { httpOnly: true, sameSite: "lax" });
    return res.status(401).json({ ok: false, message: "Sesión inválida." });
  }

  req.user = userRow;
  next();
}

// Middleware para verificar que el usuario es admin.
// Si ADMIN_EMAIL está definido, también verifica que el email coincida.
function adminRequired(req, res, next) {
  const user = req.user; // Debe venir de authRequired primero.
  if (!user) {
    return res.status(401).json({ ok: false, message: "No autenticado." });
  }

  const role = (user.role || "user").toLowerCase();
  if (role !== "admin") {
    return res.status(403).json({ ok: false, message: "Solo administradores pueden realizar esta acción." });
  }

  // Si ADMIN_EMAIL está definido, verificar que el email coincida.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email && user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).json({ ok: false, message: "Acceso denegado." });
  }

  next();
}

// Actualizar datos del usuario logeado (solo username y avatarUrl).
app.put("/api/me", authRequired, (req, res) => {
  try {
    const { username, avatarUrl } = req.body || {};

    const rawName = typeof username === "string" ? username : "";
    const trimmedName = rawName.trim();
    const rawAvatar = typeof avatarUrl === "string" ? avatarUrl : "";
    const trimmedAvatar = rawAvatar.trim();

    if (!trimmedName) {
      return res.status(400).json({ ok: false, message: "El nombre de usuario es obligatorio." });
    }
    if (trimmedName.length < 3 || trimmedName.length > 20) {
      return res
        .status(400)
        .json({ ok: false, message: "El nombre debe tener entre 3 y 20 caracteres." });
    }
    if (trimmedName !== rawName) {
      return res
        .status(400)
        .json({ ok: false, message: "El nombre no puede tener espacios al inicio/fin." });
    }

    // Validación muy ligera de URL (solo tamaño general); el frontend ya hace más checks.
    if (trimmedAvatar && trimmedAvatar.length > 500) {
      return res
        .status(400)
        .json({ ok: false, message: "La URL del avatar es demasiado larga." });
    }

    // Comprobar que el nuevo username no choque con otro usuario.
    const existingByUsername = db
      .prepare("SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?")
      .get(trimmedName, req.user.id);
    if (existingByUsername) {
      return res
        .status(409)
        .json({ ok: false, message: "Ya existe otro usuario con ese nombre." });
    }

    db.prepare("UPDATE users SET username = ?, avatar_url = ? WHERE id = ?").run(
      trimmedName,
      trimmedAvatar,
      req.user.id
    );

    const updatedRow = getUserById(req.user.id);
    const user = mapUserRow(updatedRow);

    return res.json({ ok: true, user });
  } catch (err) {
    console.error("Error en PUT /api/me:", err);
    return res.status(500).json({ ok: false, message: "Error interno al actualizar perfil." });
  }
});

// --- Endpoints del muro de mensajes ---

// Health check rápido.
app.get("/api/health", (req, res) => {
  return res.json({ ok: true, status: "up", time: new Date().toISOString() });
});

// Obtener mensajes del muro (más nuevos primero).
app.get("/api/messages", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Máximo 100 por request.

    const rows = db
      .prepare(
        `
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.id as user_id,
        u.username,
        u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
      LIMIT ?
    `
      )
      .all(limit);

    const messages = rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url || "",
      },
    }));

    return res.json({ ok: true, messages });
  } catch (err) {
    console.error("Error en GET /api/messages:", err);
    return res.status(500).json({ ok: false, message: "Error al cargar mensajes." });
  }
});

// Publicar un nuevo mensaje (requiere sesión).
app.post("/api/messages", authRequired, (req, res) => {
  try {
    const { content } = req.body || {};
    const rawContent = typeof content === "string" ? content : "";
    const trimmedContent = rawContent.trim();

    // Validaciones: mínimo 1 carácter, máximo 280 (microblog estilo 2000s).
    if (!trimmedContent) {
      return res.status(400).json({ ok: false, message: "El mensaje no puede estar vacío." });
    }
    if (trimmedContent.length > 280) {
      return res
        .status(400)
        .json({ ok: false, message: "El mensaje no puede tener más de 280 caracteres." });
    }

    const createdAt = new Date().toISOString();

    const insert = db
      .prepare("INSERT INTO messages (user_id, content, created_at) VALUES (?, ?, ?)")
      .run(req.user.id, trimmedContent, createdAt);

    // Recuperamos el mensaje completo con datos del usuario para devolverlo.
    const messageRow = db
      .prepare(
        `
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.id as user_id,
        u.username,
        u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `
      )
      .get(insert.lastInsertRowid);

    const message = {
      id: messageRow.id,
      content: messageRow.content,
      createdAt: messageRow.created_at,
      user: {
        id: messageRow.user_id,
        username: messageRow.username,
        avatarUrl: messageRow.avatar_url || "",
      },
    };

    return res.status(201).json({ ok: true, message });
  } catch (err) {
    console.error("Error en POST /api/messages:", err);
    return res.status(500).json({ ok: false, message: "Error interno al publicar mensaje." });
  }
});

// --- Endpoints de foros ---

// Listar todos los foros.
app.get("/api/forums", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
      SELECT 
        id,
        slug,
        title,
        description,
        created_at
      FROM forums
      ORDER BY created_at DESC
    `
      )
      .all();

    const forums = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description || "",
      createdAt: row.created_at,
    }));

    return res.json({ ok: true, forums });
  } catch (err) {
    console.error("Error en GET /api/forums:", err);
    return res.status(500).json({ ok: false, message: "Error al cargar foros." });
  }
});

// Crear un nuevo foro (solo admin).
app.post("/api/forums", authRequired, adminRequired, (req, res) => {
  try {
    const { title, description } = req.body || {};

    const rawTitle = typeof title === "string" ? title : "";
    const trimmedTitle = rawTitle.trim();
    const rawDesc = typeof description === "string" ? description : "";
    const trimmedDesc = rawDesc.trim();

    // Validaciones.
    if (!trimmedTitle) {
      return res.status(400).json({ ok: false, message: "El título es obligatorio." });
    }
    if (trimmedTitle.length < 3 || trimmedTitle.length > 40) {
      return res
        .status(400)
        .json({ ok: false, message: "El título debe tener entre 3 y 40 caracteres." });
    }
    if (trimmedDesc.length > 140) {
      return res
        .status(400)
        .json({ ok: false, message: "La descripción no puede tener más de 140 caracteres." });
    }

    // Generar slug desde el título:
    // - minúsculas
    // - espacios -> guiones
    // - quitar caracteres raros (solo letras, números, guiones)
    // - máximo 40 caracteres
    let slug = trimmedTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quitar acentos
      .replace(/[^a-z0-9\s-]/g, "") // solo letras, números, espacios y guiones
      .replace(/\s+/g, "-") // espacios a guiones
      .replace(/-+/g, "-") // múltiples guiones a uno solo
      .replace(/^-|-$/g, ""); // quitar guiones al inicio/fin

    if (slug.length > 40) {
      slug = slug.substring(0, 40);
      // Asegurar que no termine en guión.
      slug = slug.replace(/-$/, "");
    }

    if (!slug) {
      return res
        .status(400)
        .json({ ok: false, message: "No se pudo generar un slug válido desde el título." });
    }

    // Verificar que el slug no esté duplicado.
    const existingSlug = db.prepare("SELECT id FROM forums WHERE slug = ?").get(slug);
    if (existingSlug) {
      return res.status(409).json({ ok: false, message: "Ya existe un foro con ese título (slug duplicado)." });
    }

    const createdAt = new Date().toISOString();

    const insert = db
      .prepare("INSERT INTO forums (slug, title, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(slug, trimmedTitle, trimmedDesc, req.user.id, createdAt);

    const forumRow = db
      .prepare("SELECT id, slug, title, description, created_at FROM forums WHERE id = ?")
      .get(insert.lastInsertRowid);

    const forum = {
      id: forumRow.id,
      slug: forumRow.slug,
      title: forumRow.title,
      description: forumRow.description || "",
      createdAt: forumRow.created_at,
    };

    return res.status(201).json({ ok: true, forum });
  } catch (err) {
    console.error("Error en POST /api/forums:", err);
    return res.status(500).json({ ok: false, message: "Error interno al crear foro." });
  }
});

// --- Endpoints de threads y posts ---

// Listar threads de un foro.
app.get("/api/forums/:slug/threads", (req, res) => {
  try {
    const { slug } = req.params;

    // Verificar que el foro existe.
    const forum = db.prepare("SELECT id, slug, title FROM forums WHERE slug = ?").get(slug);
    if (!forum) {
      return res.status(404).json({ ok: false, message: "Foro no encontrado." });
    }

    const rows = db
      .prepare(
        `
      SELECT 
        t.id,
        t.title,
        t.created_at,
        t.last_post_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url
      FROM threads t
      INNER JOIN users u ON t.created_by = u.id
      WHERE t.forum_id = ?
      ORDER BY COALESCE(t.last_post_at, t.created_at) DESC
    `
      )
      .all(forum.id);

    const threads = rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      lastPostAt: row.last_post_at,
      author: {
        id: row.author_id,
        username: row.author_username,
        avatarUrl: row.author_avatar_url || "",
      },
    }));

    return res.json({ ok: true, forum: { id: forum.id, slug: forum.slug, title: forum.title }, threads });
  } catch (err) {
    console.error("Error en GET /api/forums/:slug/threads:", err);
    return res.status(500).json({ ok: false, message: "Error al obtener threads." });
  }
});

// Crear un nuevo thread en un foro (con su primer post).
app.post("/api/forums/:slug/threads", authRequired, (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content } = req.body || {};

    const rawTitle = typeof title === "string" ? title : "";
    const trimmedTitle = rawTitle.trim();
    const rawContent = typeof content === "string" ? content : "";
    const trimmedContent = rawContent.trim();

    // Validaciones.
    if (!trimmedTitle) {
      return res.status(400).json({ ok: false, message: "El título es obligatorio." });
    }
    if (trimmedTitle.length < 3 || trimmedTitle.length > 80) {
      return res
        .status(400)
        .json({ ok: false, message: "El título debe tener entre 3 y 80 caracteres." });
    }
    if (!trimmedContent) {
      return res.status(400).json({ ok: false, message: "El contenido inicial es obligatorio." });
    }
    if (trimmedContent.length < 1 || trimmedContent.length > 2000) {
      return res
        .status(400)
        .json({ ok: false, message: "El contenido debe tener entre 1 y 2000 caracteres." });
    }

    // Verificar que el foro existe.
    const forum = db.prepare("SELECT id FROM forums WHERE slug = ?").get(slug);
    if (!forum) {
      return res.status(404).json({ ok: false, message: "Foro no encontrado." });
    }

    const createdAt = new Date().toISOString();

    // Transacción real: si falla algo, no quedan registros a medias.
    const createThreadWithPost = db.transaction((forumId, title, userId, content, at) => {
      const insertThread = db
        .prepare("INSERT INTO threads (forum_id, title, created_by, created_at, last_post_at) VALUES (?, ?, ?, ?, ?)")
        .run(forumId, title, userId, at, at);

      const threadId = insertThread.lastInsertRowid;

      const insertPost = db
        .prepare("INSERT INTO posts (thread_id, user_id, content, created_at) VALUES (?, ?, ?, ?)")
        .run(threadId, userId, content, at);

      return { threadId, postId: insertPost.lastInsertRowid };
    });

    const { threadId, postId } = createThreadWithPost(
      forum.id,
      trimmedTitle,
      req.user.id,
      trimmedContent,
      createdAt
    );

    // Si llegamos aquí, todo salió bien. Obtener datos completos.
    const threadRow = db
      .prepare(
        `
      SELECT 
        t.id,
        t.title,
        t.created_at,
        t.last_post_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url
      FROM threads t
      INNER JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `
      )
      .get(threadId);

    const postRow = db
      .prepare(
        `
      SELECT 
        p.id,
        p.content,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `
      )
      .get(postId);

    const thread = {
      id: threadRow.id,
      title: threadRow.title,
      createdAt: threadRow.created_at,
      lastPostAt: threadRow.last_post_at,
      author: {
        id: threadRow.author_id,
        username: threadRow.author_username,
        avatarUrl: threadRow.author_avatar_url || "",
      },
    };

    const firstPost = {
      id: postRow.id,
      content: postRow.content,
      createdAt: postRow.created_at,
      author: {
        id: postRow.author_id,
        username: postRow.author_username,
        avatarUrl: postRow.author_avatar_url || "",
      },
    };

    return res.status(201).json({ ok: true, thread, firstPost });
  } catch (err) {
    console.error("Error en POST /api/forums/:slug/threads:", err);
    return res.status(500).json({ ok: false, message: "Error interno al crear tema." });
  }
});

// Obtener información de un thread (con datos del foro para breadcrumbs).
app.get("/api/threads/:id", (req, res) => {
  try {
    const threadId = parseInt(req.params.id);
    if (!threadId || isNaN(threadId)) {
      return res.status(400).json({ ok: false, message: "ID de thread inválido." });
    }

    const row = db
      .prepare(
        `
      SELECT 
        t.id,
        t.title,
        t.created_at,
        t.last_post_at,
        f.id as forum_id,
        f.slug as forum_slug,
        f.title as forum_title,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url
      FROM threads t
      INNER JOIN forums f ON t.forum_id = f.id
      INNER JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `
      )
      .get(threadId);

    if (!row) {
      return res.status(404).json({ ok: false, message: "Thread no encontrado." });
    }

    const thread = {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      lastPostAt: row.last_post_at,
      forum: {
        id: row.forum_id,
        slug: row.forum_slug,
        title: row.forum_title,
      },
      author: {
        id: row.author_id,
        username: row.author_username,
        avatarUrl: row.author_avatar_url || "",
      },
    };

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("Error en GET /api/threads/:id:", err);
    return res.status(500).json({ ok: false, message: "Error al obtener thread." });
  }
});

// Listar posts de un thread (orden ASC, del más antiguo al más nuevo).
app.get("/api/threads/:id/posts", (req, res) => {
  try {
    const threadId = parseInt(req.params.id);
    if (!threadId || isNaN(threadId)) {
      return res.status(400).json({ ok: false, message: "ID de thread inválido." });
    }

    // Verificar que el thread existe.
    const thread = db.prepare("SELECT id FROM threads WHERE id = ?").get(threadId);
    if (!thread) {
      return res.status(404).json({ ok: false, message: "Thread no encontrado." });
    }

    const limit = Math.min(parseInt(req.query.limit) || 100, 200); // Máximo 200 por request.

    const rows = db
      .prepare(
        `
      SELECT 
        p.id,
        p.content,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      WHERE p.thread_id = ?
      ORDER BY p.created_at ASC
      LIMIT ?
    `
      )
      .all(threadId, limit);

    const posts = rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        username: row.author_username,
        avatarUrl: row.author_avatar_url || "",
      },
    }));

    return res.json({ ok: true, posts });
  } catch (err) {
    console.error("Error en GET /api/threads/:id/posts:", err);
    return res.status(500).json({ ok: false, message: "Error al obtener posts." });
  }
});

// Crear un nuevo post en un thread.
app.post("/api/threads/:id/posts", authRequired, (req, res) => {
  try {
    const threadId = parseInt(req.params.id);
    if (!threadId || isNaN(threadId)) {
      return res.status(400).json({ ok: false, message: "ID de thread inválido." });
    }

    const { content } = req.body || {};
    const rawContent = typeof content === "string" ? content : "";
    const trimmedContent = rawContent.trim();

    // Validaciones.
    if (!trimmedContent) {
      return res.status(400).json({ ok: false, message: "El contenido es obligatorio." });
    }
    if (trimmedContent.length < 1 || trimmedContent.length > 2000) {
      return res
        .status(400)
        .json({ ok: false, message: "El contenido debe tener entre 1 y 2000 caracteres." });
    }

    // Verificar que el thread existe.
    const thread = db.prepare("SELECT id FROM threads WHERE id = ?").get(threadId);
    if (!thread) {
      return res.status(404).json({ ok: false, message: "Thread no encontrado." });
    }

    const createdAt = new Date().toISOString();

    // Insertar post.
    const insertPost = db
      .prepare("INSERT INTO posts (thread_id, user_id, content, created_at) VALUES (?, ?, ?, ?)")
      .run(threadId, req.user.id, trimmedContent, createdAt);

    // Actualizar last_post_at del thread.
    db.prepare("UPDATE threads SET last_post_at = ? WHERE id = ?").run(createdAt, threadId);

    // Obtener el post creado con datos del autor.
    const postRow = db
      .prepare(
        `
      SELECT 
        p.id,
        p.content,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `
      )
      .get(insertPost.lastInsertRowid);

    const post = {
      id: postRow.id,
      content: postRow.content,
      createdAt: postRow.created_at,
      author: {
        id: postRow.author_id,
        username: postRow.author_username,
        avatarUrl: postRow.author_avatar_url || "",
      },
    };

    return res.status(201).json({ ok: true, post });
  } catch (err) {
    console.error("Error en POST /api/threads/:id/posts:", err);
    return res.status(500).json({ ok: false, message: "Error interno al publicar mensaje." });
  }
});

// --- Servir archivos estáticos (DESPUÉS de todas las rutas de API) ---
// IMPORTANTE: Esto debe ir al final para que las rutas /api/* se procesen primero.
// Servir frontend desde /public (solo HTTP, no file://).
app.use(express.static(path.join(__dirname, "public")));

// --- Arrancar servidor ---

app.listen(PORT, HOST, () => {
  console.log(`flores del naranjo club backend escuchando en http://${HOST}:${PORT}`);
  console.log(`Instalación: npm install`);
  console.log(`Ejecución: npm start o node server.js`);
  console.log(`Abre en tu navegador: http://localhost:${PORT}`);
});
