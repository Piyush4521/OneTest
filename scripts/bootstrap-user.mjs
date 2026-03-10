import process from "node:process";

import {
  initializeAdminContext,
  normalizeRole,
  parseArgs,
  requireArg,
  toBoolean,
  upsertPortalUser
} from "./lib/firebaseAdmin.mjs";

async function main() {
  const args = parseArgs();
  const context = await initializeAdminContext({
    projectId: typeof args["project-id"] === "string" ? args["project-id"] : undefined,
    serviceAccountPath:
      typeof args.credentials === "string"
        ? args.credentials
        : typeof args["service-account"] === "string"
          ? args["service-account"]
          : undefined
  });

  const result = await upsertPortalUser(context, {
    uid: typeof args.uid === "string" ? args.uid : undefined,
    email: requireArg(args, "email"),
    password: requireArg(args, "password"),
    name: typeof args.name === "string" ? args.name : undefined,
    role: normalizeRole(typeof args.role === "string" ? args.role : "admin"),
    collegeId: typeof args["college-id"] === "string" ? args["college-id"] : "",
    department: typeof args.department === "string" ? args.department : "",
    semester: typeof args.semester === "string" ? args.semester : "",
    seatNumber: typeof args["seat-number"] === "string" ? args["seat-number"] : "",
    active: toBoolean(args.active, true)
  });

  console.log(
    `${result.action.toUpperCase()}: ${result.email} -> ${result.uid} (${result.role})`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
