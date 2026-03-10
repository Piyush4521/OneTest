import type {
  Assignment,
  AttemptAnswer,
  PublishedExam,
  StoredAttempt,
  SubmissionReview,
  SubmissionScore
} from "@/types/exam";

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

function normalizeAnswerValues(question: PublishedExam["questions"][number], values: string[]) {
  if (question.type === "numeric") {
    return values
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? String(numericValue) : value.toLowerCase();
      })
      .sort();
  }

  return values
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .sort();
}

function answersMatch(question: PublishedExam["questions"][number], selectedValues: string[]) {
  const normalizedSelected = normalizeAnswerValues(question, selectedValues);
  const normalizedCorrect = normalizeAnswerValues(question, question.correctOptionIds);

  if (normalizedSelected.length === 0 || normalizedSelected.length !== normalizedCorrect.length) {
    return false;
  }

  return normalizedSelected.every((value, index) => value === normalizedCorrect[index]);
}

export function gradeAttempt(
  exam: PublishedExam,
  answers: StoredAttempt["answers"]
) {
  let objectiveScore = 0;
  let possibleScore = 0;
  let answeredCount = 0;
  let markedForReviewCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  exam.questions.forEach((question) => {
    const answer = answers[question.id];
    possibleScore += question.marks;

    if (!answer) {
      return;
    }

    if (answer.markedForReview) {
      markedForReviewCount += 1;
    }

    if (answer.value.length === 0) {
      return;
    }

    answeredCount += 1;

    if (answersMatch(question, answer.value)) {
      correctCount += 1;
      objectiveScore += question.marks;
      return;
    }

    incorrectCount += 1;
    objectiveScore -= question.negativeMarks;
  });

  return {
    objectiveScore: Number(objectiveScore.toFixed(2)),
    possibleScore,
    answeredCount,
    markedForReviewCount,
    correctCount,
    incorrectCount
  };
}

export function buildSubmissionReview({
  exam,
  attempt,
  uid,
  studentName,
  studentEmail,
  startedAt,
  lastSavedAt,
  finalizedAt,
  status,
  score
}: {
  exam: PublishedExam;
  attempt: StoredAttempt;
  uid: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  lastSavedAt: string;
  finalizedAt?: string;
  status: SubmissionReview["status"];
  score?: Partial<SubmissionScore>;
}): SubmissionReview {
  const grading = gradeAttempt(exam, attempt.answers);
  const objective = typeof score?.objective === "number" ? score.objective : grading.objectiveScore;
  const manual = typeof score?.manual === "number" ? score.manual : 0;
  const total = typeof score?.total === "number" ? score.total : Number((objective + manual).toFixed(2));

  return {
    attemptId: attempt.attemptId,
    examId: attempt.examId,
    uid,
    studentName,
    studentEmail,
    status,
    warningCount: attempt.warningCount,
    lastWarningCode: attempt.lastWarningCode,
    answeredCount: grading.answeredCount,
    markedForReviewCount: grading.markedForReviewCount,
    correctCount: grading.correctCount,
    incorrectCount: grading.incorrectCount,
    objectiveScore: grading.objectiveScore,
    possibleScore: grading.possibleScore,
    startedAt,
    lastSavedAt,
    finalizedAt,
    score: {
      objective,
      manual,
      total,
      published: Boolean(score?.published)
    }
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
