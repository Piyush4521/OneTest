import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { StatusPill } from "@/components/StatusPill";
import { buildAttemptId, createAttemptFromExam } from "@/lib/examModel";
import { getAttempt, getExamBundle, saveAttempt } from "@/lib/examVault";
import {
  createRemoteAttempt,
  finalizeRemoteAttempt,
  loadRemoteAttempt,
  syncRemoteAttempt
} from "@/lib/portalGateway";
import { nowMs } from "@/lib/time";
import { useExamLockdown } from "@/hooks/useExamLockdown";
import type {
  Assignment,
  AttemptAnswer,
  ExamQuestion,
  PublishedExam,
  StoredAttempt
} from "@/types/exam";

interface ExamSessionPageProps {
  appMode: "demo" | "firebase";
  assignment: Assignment | null;
  currentUid?: string;
  exam: PublishedExam | null;
}

interface ExamWorkspaceProps {
  appMode: "demo" | "firebase";
  assignment: Assignment;
  currentUid?: string;
  exam: PublishedExam;
  storedAttempt: StoredAttempt;
}

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function ExamWorkspace({
  appMode,
  assignment,
  currentUid,
  exam,
  storedAttempt
}: ExamWorkspaceProps) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [attempt, setAttempt] = useState(storedAttempt);
  const [serverNowMs] = useState(() => storedAttempt.updatedAtMs || nowMs());
  const [submittedAt, setSubmittedAt] = useState<number | null>(storedAttempt.finalizedAtMs ?? null);

  useEffect(() => {
    void saveAttempt(attempt);
  }, [attempt]);

  const markedForReview = exam.questions
    .filter((question) => attempt.answers[question.id]?.markedForReview)
    .map((question) => question.id);
  const answeredCount = exam.questions.filter(
    (question) => (attempt.answers[question.id]?.value.length || 0) > 0
  ).length;
  const reviewCount = markedForReview.length;
  const unansweredCount = Math.max(0, exam.questions.length - answeredCount);

  const lockdown = useExamLockdown({
    examId: exam.id,
    attemptId: attempt.attemptId,
    serverNowMs,
    startedAtMs: attempt.startedAtMs,
    durationMs: assignment.durationMinutes * 60 * 1000,
    maxWarnings: assignment.maxWarnings,
    initialWarningCount: attempt.warningCount,
    autoSaveIntervalMs: 8 * 60 * 1000,
    lockToFullscreen: true,
    getSnapshot: () => ({
      answers: Object.fromEntries(
        Object.entries(attempt.answers).map(([questionId, answer]) => [questionId, answer.value])
      ),
      markedForReview
    }),
    persistSnapshot: async () => {
      const nextAttempt: StoredAttempt = {
        ...attempt,
        updatedAtMs: nowMs()
      };

      setAttempt(nextAttempt);

      if (appMode === "firebase" && currentUid) {
        await syncRemoteAttempt(currentUid, exam, nextAttempt);
      }
    },
    onWarning: async (warning) => {
      const nextAttempt: StoredAttempt = {
        ...attempt,
        warningCount: attempt.warningCount + 1,
        lastWarningCode: warning.code,
        updatedAtMs: nowMs()
      };

      setAttempt(nextAttempt);

      if (appMode === "firebase" && currentUid) {
        await syncRemoteAttempt(currentUid, exam, nextAttempt);
      }
    },
    onAutoSubmit: async (_, reason) => {
      const finalizedAtMs = nowMs();
      const nextAttempt: StoredAttempt = {
        ...attempt,
        warningCount: lockdown.warningCount,
        lastWarningCode: reason === "warning_limit" ? "warning_limit" : attempt.lastWarningCode,
        status: reason === "manual" ? "submitted" : "auto_submitted",
        updatedAtMs: finalizedAtMs,
        finalizedAtMs
      };

      setAttempt(nextAttempt);
      setSubmittedAt(finalizedAtMs);

      if (appMode === "firebase" && currentUid) {
        await finalizeRemoteAttempt(currentUid, exam, nextAttempt);
      }
    }
  });

  const activeQuestion = exam.questions[activeQuestionIndex];
  const progressPercent = Math.round(((activeQuestionIndex + 1) / exam.questions.length) * 100);
  const remainingTimeLabel = formatRemainingTime(lockdown.remainingMs);

  function updateAnswer(question: ExamQuestion, nextValue: string[]) {
    const nextAttempt: StoredAttempt = {
      ...attempt,
      answers: {
        ...attempt.answers,
        [question.id]: {
          ...(attempt.answers[question.id] as AttemptAnswer),
          value: nextValue,
          updatedAt: new Date().toISOString()
        }
      },
      updatedAtMs: nowMs()
    };

    setAttempt(nextAttempt);
  }

  function toggleReview(questionId: string) {
    const current = attempt.answers[questionId];
    const nextAttempt: StoredAttempt = {
      ...attempt,
      answers: {
        ...attempt.answers,
        [questionId]: {
          ...current,
          markedForReview: !current.markedForReview,
          updatedAt: new Date().toISOString()
        }
      },
      updatedAtMs: nowMs()
    };

    setAttempt(nextAttempt);
  }

  function goToQuestion(index: number) {
    setActiveQuestionIndex(index);
    setPaletteOpen(false);
  }

  function getQuestionState(questionId: string) {
    const answer = attempt.answers[questionId];

    if (!answer) {
      return "idle";
    }

    if (answer.markedForReview) {
      return "review";
    }

    return answer.value.length > 0 ? "answered" : "idle";
  }

  if (submittedAt) {
    return (
      <div className="page-shell">
        <article className="completion-card">
          <StatusPill
            tone="success"
            label={attempt.status === "submitted" ? "Submitted" : "Auto-submitted"}
          />
          <h1>Exam session locked.</h1>
          <p>
            Your attempt was finalized at{" "}
            {new Intl.DateTimeFormat("en-IN", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit"
            }).format(submittedAt)}
            .
          </p>
          <div className="actions-row">
            <button className="button button-primary" onClick={() => navigate("/student")}>
              Return to student desk
            </button>
            <Link className="button button-secondary" to="/">
              View home
            </Link>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="exam-page">
      <header className="exam-header">
        <div className="exam-header-primary">
          <p className="panel-label">Live Session</p>
          <h1>{exam.settings.title}</h1>
          <div className="stacked-pills">
            <StatusPill tone="neutral" label={exam.settings.code} />
            <StatusPill tone="neutral" label={exam.settings.subject} />
            <StatusPill tone="neutral" label={`${exam.questions.length} questions`} />
          </div>
        </div>
        <div className="exam-timer-card">
          <span className="exam-timer-label">Time Remaining</span>
          <strong className="exam-timer-value">{remainingTimeLabel}</strong>
          <div className="exam-header-actions">
            <StatusPill
              tone="warning"
              label={`${lockdown.warningCount}/${assignment.maxWarnings} warnings`}
            />
            <StatusPill tone="accent" label={`Q ${activeQuestionIndex + 1}/${exam.questions.length}`} />
          </div>
        </div>
      </header>

      <main className="exam-grid exam-grid-enhanced">
        <section className="question-panel question-panel-enhanced">
          <div className="question-progress-row">
            <div>
              <span className="question-index">
                Question {activeQuestionIndex + 1} of {exam.questions.length}
              </span>
              <p className="helper-copy">
                {answeredCount} answered, {reviewCount} marked for review, {unansweredCount} remaining
              </p>
            </div>
            <button className="ghost-button" onClick={() => setPaletteOpen(true)}>
              Open palette
            </button>
          </div>

          <div className="progress-track">
            <span style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="question-meta">
            <span>{activeQuestion.section}</span>
            <div className="question-chip-row">
              <span className="question-chip">Marks {activeQuestion.marks}</span>
              <span className="question-chip">Negative {activeQuestion.negativeMarks}</span>
            </div>
          </div>

          <h2 className="question-prompt">{activeQuestion.prompt}</h2>

          {activeQuestion.type === "numeric" ? (
            <label className="field">
              <span>Numeric answer</span>
              <input
                inputMode="numeric"
                value={attempt.answers[activeQuestion.id]?.value[0] || ""}
                onChange={(event) => updateAnswer(activeQuestion, [event.target.value])}
              />
            </label>
          ) : (
            <div className="choice-grid">
              {activeQuestion.options.map((option) => {
                const selected = attempt.answers[activeQuestion.id]?.value.includes(option.id);

                return (
                  <button
                    className={selected ? "choice-card selected" : "choice-card"}
                    key={option.id}
                    onClick={() => updateAnswer(activeQuestion, [option.id])}
                  >
                    <span>{option.id}</span>
                    <p>{option.label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="exam-sidebar">
          <article className="surface-card surface-card-contrast exam-sidebar-card">
            <p className="panel-label">Attempt Summary</p>
            <div className="review-detail-grid exam-summary-grid">
              <div className="review-detail">
                <span>Answered</span>
                <strong>{answeredCount}</strong>
              </div>
              <div className="review-detail">
                <span>Review</span>
                <strong>{reviewCount}</strong>
              </div>
              <div className="review-detail">
                <span>Remaining</span>
                <strong>{unansweredCount}</strong>
              </div>
              <div className="review-detail">
                <span>Warnings</span>
                <strong>{lockdown.warningCount}</strong>
              </div>
            </div>

            <div className="exam-legend">
              <div className="exam-legend-row">
                <span className="legend-dot answered" />
                <small>Answered</small>
              </div>
              <div className="exam-legend-row">
                <span className="legend-dot review" />
                <small>Review</small>
              </div>
              <div className="exam-legend-row">
                <span className="legend-dot idle" />
                <small>Not answered</small>
              </div>
            </div>

            <ul className="signal-list">
              <li>{lockdown.isOffline ? "Offline mode active" : "Online and checkpoint-ready"}</li>
              <li>{lockdown.isHidden ? "Tab hidden: warning issued" : "Tab in focus"}</li>
              <li>Checkpoint interval: 8 minutes</li>
              <li>Fullscreen lock requested for the live session.</li>
            </ul>
          </article>
        </aside>
      </main>

      <button
        className={paletteOpen ? "palette-backdrop active" : "palette-backdrop"}
        onClick={() => setPaletteOpen(false)}
      />

      <section className={paletteOpen ? "palette-sheet active" : "palette-sheet"}>
        <div className="palette-header">
          <div>
            <p className="panel-label">Question Palette</p>
            <h2>Jump across the paper without leaving the live shell.</h2>
          </div>
          <button className="ghost-button" onClick={() => setPaletteOpen(false)}>
            Close
          </button>
        </div>
        <div className="palette-grid">
          {exam.questions.map((question, index) => (
            <button
              className={`palette-tile ${getQuestionState(question.id)} ${
                index === activeQuestionIndex ? "active" : ""
              }`}
              key={question.id}
              onClick={() => goToQuestion(index)}
            >
              <span>{index + 1}</span>
              <small>{question.section}</small>
            </button>
          ))}
        </div>
      </section>

      <nav className="bottom-bar">
        <button
          className="bottom-action"
          disabled={activeQuestionIndex === 0}
          onClick={() => setActiveQuestionIndex((current) => Math.max(0, current - 1))}
        >
          Previous
        </button>
        <button className="bottom-action emphasis" onClick={() => toggleReview(activeQuestion.id)}>
          {attempt.answers[activeQuestion.id]?.markedForReview ? "Review Marked" : "Mark for Review"}
        </button>
        {activeQuestionIndex < exam.questions.length - 1 ? (
          <button
            className="bottom-action"
            onClick={() =>
              setActiveQuestionIndex((current) => Math.min(exam.questions.length - 1, current + 1))
            }
          >
            Next
          </button>
        ) : (
          <button className="bottom-action submit" onClick={() => void lockdown.submitNow()}>
            Submit
          </button>
        )}
      </nav>
    </div>
  );
}

export function ExamSessionPage({ appMode, assignment, currentUid, exam }: ExamSessionPageProps) {
  const { examId } = useParams();
  const [bundle, setBundle] = useState<PublishedExam | null>(null);
  const [storedAttempt, setStoredAttempt] = useState<StoredAttempt | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const startTime = assignment ? new Date(assignment.startAt).getTime() : 0;
  const closeTime = assignment ? new Date(assignment.graceSubmitAt).getTime() : 0;
  const sessionWindowState =
    !assignment || !exam
      ? "missing"
      : currentTime < startTime
        ? "scheduled"
        : currentTime > closeTime
          ? "closed"
          : "open";

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sessionWindowState !== "open" || !assignment || !exam) {
      return;
    }

    const activeExam = exam;
    const targetId = examId || activeExam.id;

    async function hydrateSession() {
      const cachedBundle = (await getExamBundle(targetId)) || activeExam;
      const localAttempt =
        (await getAttempt(buildAttemptId(targetId, currentUid || "demo-student"))) ||
        createAttemptFromExam(cachedBundle, currentUid || "demo-student");

      let currentAttempt = localAttempt;

      if (appMode === "firebase" && currentUid) {
        const remoteAttempt = await loadRemoteAttempt(targetId, currentUid);

        if (remoteAttempt) {
          currentAttempt = remoteAttempt;
        } else {
          currentAttempt = (await createRemoteAttempt(currentUid, cachedBundle, localAttempt)) || localAttempt;
        }
      }

      setBundle(cachedBundle);
      setStoredAttempt(currentAttempt);
      await saveAttempt(currentAttempt);
    }

    void hydrateSession();
  }, [appMode, assignment, currentUid, exam, examId, sessionWindowState]);

  if (sessionWindowState === "missing") {
    return (
      <div className="page-shell">
        <article className="completion-card">
          <StatusPill tone="warning" label="No exam loaded" />
          <h1>There is no active exam session to open.</h1>
          <p>Return to the student desk and wait for a valid assignment to appear.</p>
        </article>
      </div>
    );
  }

  if (sessionWindowState === "scheduled") {
    return (
      <div className="page-shell">
        <article className="completion-card">
          <StatusPill tone="warning" label="Exam not open yet" />
          <h1>The live paper is still locked.</h1>
          <p>Wait for the official start time, then launch the secure session from the instruction page.</p>
          <div className="actions-row">
            <Link className="button button-primary" to={`/student/exam/${exam?.id || examId}`}>
              Return to instructions
            </Link>
          </div>
        </article>
      </div>
    );
  }

  if (sessionWindowState === "closed") {
    return (
      <div className="page-shell">
        <article className="completion-card">
          <StatusPill tone="accent" label="Exam window closed" />
          <h1>The live paper can no longer be launched.</h1>
          <p>The grace submission deadline has already passed for this assignment.</p>
          <div className="actions-row">
            <Link className="button button-primary" to="/student">
              Return to student desk
            </Link>
          </div>
        </article>
      </div>
    );
  }

  const activeAssignment = assignment!;

  if (!bundle || !storedAttempt) {
    return (
      <div className="page-shell">
        <article className="completion-card">
          <StatusPill tone="accent" label="Hydrating session" />
          <h1>Preparing secure workspace...</h1>
          <p>The exam bundle and latest attempt checkpoint are loading from local storage.</p>
        </article>
      </div>
    );
  }

  return (
    <ExamWorkspace
      appMode={appMode}
      assignment={activeAssignment}
      currentUid={currentUid}
      exam={bundle}
      storedAttempt={storedAttempt}
    />
  );
}
