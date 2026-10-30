const USERS_KEY = "travel_users";
const CURRENT_USER_KEY = "travel_current_user";
const PBKDF2_ITERATIONS = 200_000;

const encoder = new TextEncoder();

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function bytesToBase64(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
  );
}

function readStorage(storage, key, fallback) {
  const savedValue = storage.getItem(key);

  if (!savedValue) return fallback;

  try {
    return JSON.parse(savedValue);
  } catch {
    storage.removeItem(key);
    return fallback;
  }
}

function getPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function getUsers() {
  const users = readStorage(localStorage, USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function createPasswordSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(salt);
}

async function hashPassword(password, saltBase64) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(saltBase64),
      iterations: PBKDF2_ITERATIONS,
    },
    passwordKey,
    256,
  );

  return bytesToBase64(new Uint8Array(hashBuffer));
}

export async function registerUser({ name, email, password }) {
  const users = getUsers();
  const normalizedEmail = normalizeEmail(email);

  const emailExists = users.some(
    (user) => user.email === normalizedEmail,
  );

  if (emailExists) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordSalt = createPasswordSalt();
  const passwordHash = await hashPassword(password, passwordSalt);

  const newUser = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordSalt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  return getPublicUser(newUser);
}

export async function authenticateUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  const user = getUsers().find(
    (savedUser) => savedUser.email === normalizedEmail,
  );

  if (!user) return null;

  const inputHash = await hashPassword(
    password,
    user.passwordSalt,
  );

  if (inputHash !== user.passwordHash) {
    return null;
  }

  return getPublicUser(user);
}

export async function resetPassword({ name, email, password }) {
  const users = getUsers();
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name).trim();
  const userIndex = users.findIndex(
    (user) => user.email === normalizedEmail && user.name === normalizedName,
  );

  if (userIndex < 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const passwordSalt = createPasswordSalt();
  const passwordHash = await hashPassword(password, passwordSalt);

  users[userIndex] = {
    ...users[userIndex],
    passwordSalt,
    passwordHash,
    passwordUpdatedAt: new Date().toISOString(),
  };

  saveUsers(users);
  return getPublicUser(users[userIndex]);
}

export function saveCurrentUser(user, rememberLogin) {
  const currentUser = getPublicUser(user);
  const storage = rememberLogin ? localStorage : sessionStorage;

  localStorage.removeItem(CURRENT_USER_KEY);
  sessionStorage.removeItem(CURRENT_USER_KEY);

  storage.setItem(
    CURRENT_USER_KEY,
    JSON.stringify(currentUser),
  );
}

export function getCurrentUser() {
  return (
    readStorage(localStorage, CURRENT_USER_KEY, null) ??
    readStorage(sessionStorage, CURRENT_USER_KEY, null)
  );
}

export function getCurrentUserProfile() {
  const currentUser = getCurrentUser();

  if (!currentUser) return null;

  const savedUser = getUsers().find((user) => user.id === currentUser.id);
  if (!savedUser) {
    clearCurrentUser();
    return null;
  }

  return {
    ...getPublicUser(savedUser),
    createdAt: savedUser.createdAt,
    passwordUpdatedAt: savedUser.passwordUpdatedAt ?? null,
  };
}

export function updateUserName(userId, name) {
  const normalizedName = String(name).trim();
  const users = getUsers();
  const userIndex = users.findIndex((user) => user.id === userId);

  if (userIndex < 0) throw new Error("USER_NOT_FOUND");
  if (normalizedName.length < 2 || normalizedName.length > 20) {
    throw new Error("INVALID_NAME");
  }

  users[userIndex] = {
    ...users[userIndex],
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);

  const publicUser = getPublicUser(users[userIndex]);
  [localStorage, sessionStorage].forEach((storage) => {
    if (storage.getItem(CURRENT_USER_KEY)) {
      storage.setItem(CURRENT_USER_KEY, JSON.stringify(publicUser));
    }
  });

  return publicUser;
}

export function deleteUserAccount(userId) {
  const users = getUsers();
  const userExists = users.some((user) => user.id === userId);

  if (!userExists) throw new Error("USER_NOT_FOUND");

  saveUsers(users.filter((user) => user.id !== userId));
  clearCurrentUser();
}

export function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
  sessionStorage.removeItem(CURRENT_USER_KEY);
}
