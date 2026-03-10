import { readFile } from "node:fs/promises";
import process from "node:process";

import Papa from "papaparse";

import {
  initializeAdminContext,
  normalizeRole,
  parseArgs,
  requireArg,
  upsertPortalUser
} from "./lib/firebaseAdmin.mjs";

async function main() {
  const args = parseArgs();
  const filePath = requireArg(args, "file");
  const defaultRole = normalizeRole(
    typeof args["default-role"] === "string" ? args["default-role"] : "student"
  );
  const context = await initializeAdminContext({
    projectId: typeof args["project-id"] === "string" ? args["project-id"] : undefined,
    serviceAccountPath:
      typeof args.credentials === "string"
        ? args.credentials
        : typeof args["service-account"] === "string"
          ? args["service-account"]
          : undefined
  });

  const source = await readFile(filePath, "utf8");
  const parsed = Papa.parse(source, {
    header: true,
    skipEmptyLines: "greedy"
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((entry) => entry.message).join("; "));
  }

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const [index, row] of parsed.data.entries()) {
    const record = row || {};

    try {
      const result = await upsertPortalUser(context, {
        uid: typeof record.uid === "string" ? record.uid : undefined,
        email: typeof record.email === "string" ? record.email : "",
        password: typeof record.password === "string" ? record.password : undefined,
        name: typeof record.name === "string" ? record.name : undefined,
        role: typeof record.role === "string" && record.role.trim() ? record.role : defaultRole,
        collegeId: typeof record.collegeId === "string" ? record.collegeId : "",
        department: typeof record.department === "string" ? record.department : "",
        semester: typeof record.semester === "string" ? record.semester : "",
        seatNumber: typeof record.seatNumber === "string" ? record.seatNumber : "",
        active: typeof record.active === "string" ? record.active : undefined
      });

      if (result.action === "created") {
        created += 1;
      } else {
        updated += 1;
      }

      console.log(
        `[${index + 1}] ${result.action.toUpperCase()} ${result.email} -> ${result.uid} (${result.role})`
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${index + 1}] FAILED ${record.email || "unknown-email"}: ${message}`);
    }
  }

  console.log(`Completed import. created=${created} updated=${updated} failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
