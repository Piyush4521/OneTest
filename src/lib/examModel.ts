import type { Assignment, AttemptAnswer, PublishedExam, StoredAttempt } from "@/types/exam";

export function buildAttemptId(examId: string, uid = "demo-student") {
  return `${examId}_${uid}`;
}

export function createAssignmentFromExam(exam: PublishedExam): Assignment {
  return {
    examId: exam.id,
    title: exam.settings.title,
    startAt: exam.settings.startAt,
    hardEndAt: exam.settings.hardEndAt,
    graceSubmitAt: exam.settings.graceSubmitAt,
    durationMinutes: exam.settings.durationMinutes,
    maxWarnings: exam.settings.maxWarnings,
    bundleUrl: "",
    bundleVersion: exam.bundleVersion,
    bundleHash: exam.bundleHash,
    status: "assigned"
  };
}

export function createEmptyAnswers(exam: PublishedExam) {
  return exam.questions.reduce<Record<string, AttemptAnswer>>((accumulator, question) => {
    accumulator[question.id] = {
      value: [],
      markedForReview: false,
      updatedAt: new Date().toISOString()
    };

    return accumulator;
  }, {});
}

export function createAttemptFromExam(exam: PublishedExam, uid = "demo-student"): StoredAttempt {
  const now = Date.now();

  return {
    attemptId: buildAttemptId(exam.id, uid),
    examId: exam.id,
    answers: createEmptyAnswers(exam),
    warningCount: 0,
    lastWarningCode: null,
    status: "in_progress",
    startedAtMs: now,
    updatedAtMs: now
  };
}

export function createStudentSafeExam(exam: PublishedExam): PublishedExam {
  return {
    ...exam,
    questions: exam.questions.map((question) => ({
      ...question,
      correctOptionIds: []
    }))
  };
}

export async function createBundleHash(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function formatExamWindow(startAt: string, hardEndAt: string) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });

  return `${formatter.format(new Date(startAt))} - ${formatter.format(new Date(hardEndAt))}`;
}

export function toLocalDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
