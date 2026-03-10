import type { Assignment, PublishedExam } from "@/types/exam";
import { createAssignmentFromExam, createBundleHash } from "@/lib/examModel";

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
