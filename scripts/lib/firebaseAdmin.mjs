import { readFile } from "node:fs/promises";
import process from "node:process";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const VALID_ROLES = new Set(["student", "faculty", "admin"]);

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export function requireArg(args, key) {
  const value = args[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  throw new Error(`Missing required argument: --${key}`);
}

export function normalizeRole(value, fallback = "student") {
  const candidate = typeof value === "string" && value.trim() ? value.trim().toLowerCase() : fallback;
  if (!VALID_ROLES.has(candidate)) {
    throw new Error(`Invalid role "${value}". Expected one of: student, faculty, admin.`);
  }

  return candidate;
}

export function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const candidate = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(candidate)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(candidate)) {
    return false;
  }

  return fallback;
}

export function defaultDisplayName(email) {
  const base = email.split("@")[0] || "Portal User";
  return base
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isUserNotFound(error) {
  return error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found";
}

async function loadCredential(serviceAccountPath) {
  if (serviceAccountPath) {
    const raw = await readFile(serviceAccountPath, "utf8");
    return cert(JSON.parse(raw));
  }

  return applicationDefault();
}

export async function initializeAdminContext(options = {}) {
  const existingApp = getApps()[0];
  if (existingApp) {
    return {
      app: existingApp,
      auth: getAuth(existingApp),
      firestore: getFirestore(existingApp)
    };
  }

  const serviceAccountPath =
    options.serviceAccountPath ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const app = initializeApp({
    credential: await loadCredential(serviceAccountPath),
    projectId: options.projectId || process.env.FIREBASE_PROJECT_ID
  });

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}

async function resolveExistingUser(auth, { uid, email }) {
  if (uid) {
    try {
      return await auth.getUser(uid);
    } catch (error) {
      if (!isUserNotFound(error)) {
        throw error;
      }
    }
  }

  if (email) {
    try {
      return await auth.getUserByEmail(email);
    } catch (error) {
      if (!isUserNotFound(error)) {
        throw error;
      }
    }
  }

  return null;
}

export async function upsertPortalUser(context, input) {
  const email = String(input.email || "").trim().toLowerCase();
  const uid = typeof input.uid === "string" && input.uid.trim() ? input.uid.trim() : undefined;
  const password = typeof input.password === "string" && input.password.trim() ? input.password : undefined;
  const role = normalizeRole(input.role);
  const name = String(input.name || defaultDisplayName(email)).trim();
  const active = toBoolean(input.active, true);

  if (!email) {
    throw new Error("Each user record requires an email address.");
  }

  const existingUser = await resolveExistingUser(context.auth, { uid, email });
  const isCreate = !existingUser;

  if (isCreate && !password) {
    throw new Error(`A password is required to create a new Firebase Auth user for ${email}.`);
  }

  const authPayload = {
    email,
    displayName: name,
    disabled: !active,
    ...(password ? { password } : {})
  };

  const authUser = existingUser
    ? await context.auth.updateUser(existingUser.uid, authPayload)
    : await context.auth.createUser({
        uid,
        ...authPayload,
        password
      });

  await context.auth.setCustomUserClaims(authUser.uid, { role });

  const profileRef = context.firestore.doc(`users/${authUser.uid}`);
  const profileSnapshot = await profileRef.get();
  await profileRef.set(
    {
      uid: authUser.uid,
      email,
      name,
      role,
      collegeId: typeof input.collegeId === "string" ? input.collegeId.trim() : "",
      department: typeof input.department === "string" ? input.department.trim() : "",
      semester: typeof input.semester === "string" ? input.semester.trim() : "",
      seatNumber: typeof input.seatNumber === "string" ? input.seatNumber.trim() : "",
      active,
      updatedAt: FieldValue.serverTimestamp(),
      ...(profileSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
    },
    { merge: true }
  );

  return {
    action: isCreate ? "created" : "updated",
    uid: authUser.uid,
    email,
    role
  };
}
