import { openDB, type DBSchema } from "idb";

import type { PublishedExam, StoredAttempt } from "@/types/exam";

interface OneTestDatabase extends DBSchema {
  bundles: {
    key: string;
    value: PublishedExam;
  };
  attempts: {
    key: string;
    value: StoredAttempt;
  };
}

const dbPromise = openDB<OneTestDatabase>("onetest-secure-portal", 1, {
  upgrade(database) {
    if (!database.objectStoreNames.contains("bundles")) {
      database.createObjectStore("bundles");
    }

    if (!database.objectStoreNames.contains("attempts")) {
      database.createObjectStore("attempts");
    }
  }
});

export async function saveExamBundle(exam: PublishedExam) {
  const database = await dbPromise;
  await database.put("bundles", exam, exam.id);
}

export async function getExamBundle(examId: string) {
  const database = await dbPromise;
  return database.get("bundles", examId);
}

export async function saveAttempt(attempt: StoredAttempt) {
  const database = await dbPromise;
  await database.put("attempts", attempt, attempt.attemptId);
}

export async function getAttempt(attemptId: string) {
  const database = await dbPromise;
  return database.get("attempts", attemptId);
}
