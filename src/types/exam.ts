export type UserRole = "student" | "faculty" | "admin";

export interface PortalUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  collegeId?: string;
  department?: string;
  active: boolean;
}

export type QuestionType = "single_choice" | "multi_choice" | "numeric" | "text";

export interface ExamOption {
  id: string;
  label: string;
}

export interface ExamQuestion {
  id: string;
  section: string;
  type: QuestionType;
  prompt: string;
  options: ExamOption[];
  correctOptionIds: string[];
  marks: number;
  negativeMarks: number;
}

export interface ExamSettings {
  title: string;
  subject: string;
  code: string;
  durationMinutes: number;
  maxWarnings: number;
  startAt: string;
  hardEndAt: string;
  graceSubmitAt: string;
  instructions: string[];
}

export interface PublishedExam {
  id: string;
  settings: ExamSettings;
  bundleVersion: string;
  bundleHash: string;
  publishedAt: string;
  status: "draft" | "published";
  createdBy?: string;
  questions: ExamQuestion[];
}

export interface Assignment {
  examId: string;
  uid?: string;
  title: string;
  startAt: string;
  hardEndAt: string;
  graceSubmitAt: string;
  durationMinutes: number;
  maxWarnings: number;
  bundleUrl?: string;
  bundleVersion: string;
  bundleHash: string;
  status: "assigned" | "active" | "submitted";
}

export interface AttemptAnswer {
  value: string[];
  markedForReview: boolean;
  updatedAt: string;
}

export interface StoredAttempt {
  attemptId: string;
  examId: string;
  answers: Record<string, AttemptAnswer>;
  warningCount: number;
  lastWarningCode: string | null;
  status: "in_progress" | "submitted" | "auto_submitted";
  startedAtMs: number;
  updatedAtMs: number;
  finalizedAtMs?: number;
}

export interface FacultyImportPreview {
  questions: ExamQuestion[];
  skippedRows: number;
  sourceName: string;
}
