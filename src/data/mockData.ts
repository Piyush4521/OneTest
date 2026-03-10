import type { Assignment, PublishedExam, StoredAttempt, SubmissionReview } from "@/types/exam";
import { buildSubmissionReview, createAssignmentFromExam, createAttemptFromExam, createBundleHash } from "@/lib/examModel";

function buildSchedule() {
  const now = Date.now();
  const startAt = new Date(now - 15 * 60 * 1000);
  const hardEndAt = new Date(now + 75 * 60 * 1000);
  const graceSubmitAt = new Date(now + 90 * 60 * 1000);

  return {
    startAt: startAt.toISOString(),
    hardEndAt: hardEndAt.toISOString(),
    graceSubmitAt: graceSubmitAt.toISOString()
  };
}

export async function createMockExam() {
  const schedule = buildSchedule();

  const exam: PublishedExam = {
    id: "onetest-demo-2026",
    bundleVersion: "2026.03.10-demo",
    bundleHash: "",
    publishedAt: new Date().toISOString(),
    status: "published",
    settings: {
      title: "OneTest Demo Aptitude Assessment",
      subject: "Secure Portal Pilot",
      code: "OT-SEC-01",
      durationMinutes: 60,
      maxWarnings: 3,
      startAt: schedule.startAt,
      hardEndAt: schedule.hardEndAt,
      graceSubmitAt: schedule.graceSubmitAt,
      instructions: [
        "Stay on this screen once the exam begins.",
        "Use the question palette to jump quickly between questions.",
        "Each tab switch or blocked shortcut adds a warning.",
        "Answers are stored locally and checkpointed in batches."
      ]
    },
    questions: [
      {
        id: "q-1",
        section: "Quantitative",
        type: "single_choice",
        prompt: "If 18 workers complete a task in 20 days, how many workers are needed to complete the same task in 12 days?",
        options: [
          { id: "A", label: "24" },
          { id: "B", label: "30" },
          { id: "C", label: "36" },
          { id: "D", label: "42" }
        ],
        correctOptionIds: ["B"],
        marks: 1,
        negativeMarks: 0
      },
      {
        id: "q-2",
        section: "Logical Reasoning",
        type: "single_choice",
        prompt: "Choose the next term: 2, 6, 12, 20, 30, ?",
        options: [
          { id: "A", label: "36" },
          { id: "B", label: "40" },
          { id: "C", label: "42" },
          { id: "D", label: "48" }
        ],
        correctOptionIds: ["C"],
        marks: 1,
        negativeMarks: 0
      },
      {
        id: "q-3",
        section: "Verbal",
        type: "single_choice",
        prompt: "Select the word closest in meaning to 'meticulous'.",
        options: [
          { id: "A", label: "Careless" },
          { id: "B", label: "Precise" },
          { id: "C", label: "Quick" },
          { id: "D", label: "Flexible" }
        ],
        correctOptionIds: ["B"],
        marks: 1,
        negativeMarks: 0
      },
      {
        id: "q-4",
        section: "Computer Science",
        type: "single_choice",
        prompt: "Which data structure best supports LIFO behavior?",
        options: [
          { id: "A", label: "Queue" },
          { id: "B", label: "Heap" },
          { id: "C", label: "Stack" },
          { id: "D", label: "Graph" }
        ],
        correctOptionIds: ["C"],
        marks: 1,
        negativeMarks: 0
      },
      {
        id: "q-5",
        section: "Quantitative",
        type: "numeric",
        prompt: "What is 15% of 360?",
        options: [],
        correctOptionIds: ["54"],
        marks: 1,
        negativeMarks: 0
      },
      {
        id: "q-6",
        section: "Logical Reasoning",
        type: "single_choice",
        prompt: "A secure deployment pipeline should first prioritize which property?",
        options: [
          { id: "A", label: "Randomness" },
          { id: "B", label: "Auditability" },
          { id: "C", label: "Brightness" },
          { id: "D", label: "Verbosity" }
        ],
        correctOptionIds: ["B"],
        marks: 1,
        negativeMarks: 0
      }
    ]
  };

  exam.bundleHash = await createBundleHash(exam.questions);

  return exam;
}

export function createMockAssignment(exam: PublishedExam): Assignment {
  return createAssignmentFromExam(exam);
}

function withAnswer(
  attempt: StoredAttempt,
  questionId: string,
  value: string[],
  markedForReview = false
) {
  attempt.answers[questionId] = {
    ...attempt.answers[questionId],
    value,
    markedForReview,
    updatedAt: new Date().toISOString()
  };
}

export function createMockSubmissionReviews(exam: PublishedExam): SubmissionReview[] {
  const now = Date.now();

  const topAttempt = createAttemptFromExam(exam, "student001");
  withAnswer(topAttempt, "q-1", ["B"]);
  withAnswer(topAttempt, "q-2", ["C"]);
  withAnswer(topAttempt, "q-3", ["B"]);
  withAnswer(topAttempt, "q-4", ["C"]);
  withAnswer(topAttempt, "q-5", ["54"]);
  withAnswer(topAttempt, "q-6", ["B"], true);
  topAttempt.status = "submitted";
  topAttempt.warningCount = 1;
  topAttempt.startedAtMs = now - 58 * 60 * 1000;
  topAttempt.updatedAtMs = now - 3 * 60 * 1000;
  topAttempt.finalizedAtMs = now - 2 * 60 * 1000;

  const warningAttempt = createAttemptFromExam(exam, "student002");
  withAnswer(warningAttempt, "q-1", ["A"]);
  withAnswer(warningAttempt, "q-2", ["C"]);
  withAnswer(warningAttempt, "q-3", ["D"]);
  withAnswer(warningAttempt, "q-4", ["C"], true);
  withAnswer(warningAttempt, "q-5", ["45"]);
  warningAttempt.status = "auto_submitted";
  warningAttempt.warningCount = 3;
  warningAttempt.lastWarningCode = "visibility_hidden";
  warningAttempt.startedAtMs = now - 61 * 60 * 1000;
  warningAttempt.updatedAtMs = now - 1 * 60 * 1000;
  warningAttempt.finalizedAtMs = now - 1 * 60 * 1000;

  const inProgressAttempt = createAttemptFromExam(exam, "student003");
  withAnswer(inProgressAttempt, "q-1", ["B"]);
  withAnswer(inProgressAttempt, "q-2", ["A"], true);
  withAnswer(inProgressAttempt, "q-4", ["C"]);
  inProgressAttempt.status = "in_progress";
  inProgressAttempt.warningCount = 2;
  inProgressAttempt.startedAtMs = now - 32 * 60 * 1000;
  inProgressAttempt.updatedAtMs = now - 45 * 1000;

  return [
    buildSubmissionReview({
      exam,
      attempt: topAttempt,
      uid: "student001",
      studentName: "Student One",
      studentEmail: "student001@college.edu",
      status: "graded",
      startedAt: new Date(topAttempt.startedAtMs).toISOString(),
      lastSavedAt: new Date(topAttempt.updatedAtMs).toISOString(),
      finalizedAt: new Date(topAttempt.finalizedAtMs || topAttempt.updatedAtMs).toISOString(),
      score: {
        objective: 6,
        manual: 0,
        total: 6,
        published: true
      }
    }),
    buildSubmissionReview({
      exam,
      attempt: warningAttempt,
      uid: "student002",
      studentName: "Student Two",
      studentEmail: "student002@college.edu",
      status: "auto_submitted",
      startedAt: new Date(warningAttempt.startedAtMs).toISOString(),
      lastSavedAt: new Date(warningAttempt.updatedAtMs).toISOString(),
      finalizedAt: new Date(warningAttempt.finalizedAtMs || warningAttempt.updatedAtMs).toISOString(),
      score: {
        objective: 2,
        manual: 0,
        total: 2,
        published: false
      }
    }),
    buildSubmissionReview({
      exam,
      attempt: inProgressAttempt,
      uid: "student003",
      studentName: "Student Three",
      studentEmail: "student003@college.edu",
      status: "in_progress",
      startedAt: new Date(inProgressAttempt.startedAtMs).toISOString(),
      lastSavedAt: new Date(inProgressAttempt.updatedAtMs).toISOString(),
      score: {
        objective: 2,
        manual: 0,
        total: 2,
        published: false
      }
    })
  ];
}
