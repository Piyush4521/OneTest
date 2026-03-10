import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { StatusPill } from "@/components/StatusPill";
import { buildAttemptId, createAttemptFromExam } from "@/lib/examModel";
import { getAttempt, getExamBundle, saveAttempt } from "@/lib/examVault";
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
  assignment: Assignment;
  exam: PublishedExam;
}

interface ExamWorkspaceProps {
  assignment: Assignment;
  exam: PublishedExam;
  storedAttempt: StoredAttempt;
}

function ExamWorkspace({
  assignment,
  exam,
  storedAttempt
}: ExamWorkspaceProps) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [attempt, setAttempt] = useState(storedAttempt);
  const [serverNowMs] = useState(() => nowMs());
  const [submittedAt, setSubmittedAt] = useState<number | null>(
    storedAttempt.finalizedAtMs ?? null
  );

  const markedForReview = exam.questions
    .filter((question) => attempt.answers[question.id]?.markedForReview)
    .map((question) => question.id);

  const lockdown = useExamLockdown({
    examId: exam.id,
    attemptId: attempt.attemptId,
    serverNowMs,
    startedAtMs: attempt.startedAtMs,
    durationMs: assignment.durationMinutes * 60 * 1000,
    maxWarnings: assignment.maxWarnings,
    initialWarningCount: attempt.warningCount,
    autoSaveIntervalMs: 8 * 60 * 1000,
    getSnapshot: () => ({
      answers: Object.fromEntries(
        Object.entries(attempt.answers).map(([questionId, answer]) => [
          questionId,
          answer.value
        ])
      ),
      markedForReview
    }),
    persistSnapshot: async () => {
      const nextAttempt: StoredAttempt = {
        ...attempt,
        updatedAtMs: nowMs()
      };

      setAttempt(nextAttempt);
      await saveAttempt(nextAttempt);
    },
    onWarning: async (warning) => {
      const nextAttempt: StoredAttempt = {
        ...attempt,
        warningCount: attempt.warningCount + 1,
        lastWarningCode: warning.code,
        updatedAtMs: nowMs()
      };

      setAttempt(nextAttempt);
      await saveAttempt(nextAttempt);
    },
    onAutoSubmit: async (_, reason) => {
      const finalizedAtMs = nowMs();
      const nextAttempt: StoredAttempt = {
        ...attempt,
        warningCount: lockdown.warningCount,
        lastWarningCode:
          reason === "warning_limit" ? "warning_limit" : attempt.lastWarningCode,
        status: reason === "manual" ? "submitted" : "auto_submitted",
        updatedAtMs: finalizedAtMs,
        finalizedAtMs
      };

      setAttempt(nextAttempt);
      setSubmittedAt(finalizedAtMs);
      await saveAttempt(nextAttempt);
    }
  });

  const activeQuestion = exam.questions[activeQuestionIndex];

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
        <div>
          <p className="panel-label">Live Session</p>
          <h1>{exam.settings.title}</h1>
        </div>
        <div className="exam-header-actions">
          <StatusPill
            tone="warning"
            label={`${lockdown.warningCount}/${assignment.maxWarnings} warnings`}
          />
          <StatusPill
            tone="accent"
            label={`${Math.ceil(lockdown.remainingMs / 60000)} min left`}
          />
        </div>
      </header>

      <main className="exam-grid">
        <section className="question-panel">
          <div className="question-meta">
            <span>{activeQuestion.section}</span>
            <button className="ghost-button" onClick={() => setPaletteOpen(true)}>
              Open palette
            </button>
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
          <article className="surface-card surface-card-contrast">
            <p className="panel-label">Session health</p>
            <ul className="signal-list">
              <li>{lockdown.isOffline ? "Offline mode active" : "Online and checkpoint-ready"}</li>
              <li>{lockdown.isHidden ? "Tab hidden: warning issued" : "Tab in focus"}</li>
              <li>Checkpoint interval: 8 minutes</li>
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
            <h2>Jump across the paper fast.</h2>
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
          onClick={() =>
            setActiveQuestionIndex((current) => Math.max(0, current - 1))
          }
        >
          Previous
        </button>
        <button
          className="bottom-action emphasis"
          onClick={() => toggleReview(activeQuestion.id)}
        >
          {attempt.answers[activeQuestion.id]?.markedForReview
            ? "Review Marked"
            : "Mark for Review"}
        </button>
        {activeQuestionIndex < exam.questions.length - 1 ? (
          <button
            className="bottom-action"
            onClick={() =>
              setActiveQuestionIndex((current) =>
                Math.min(exam.questions.length - 1, current + 1)
              )
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

export function ExamSessionPage({ assignment, exam }: ExamSessionPageProps) {
  const { examId } = useParams();
  const [bundle, setBundle] = useState<PublishedExam | null>(null);
  const [storedAttempt, setStoredAttempt] = useState<StoredAttempt | null>(null);

  useEffect(() => {
    const targetId = examId || exam.id;

    async function hydrateSession() {
      const cachedBundle = (await getExamBundle(targetId)) || exam;
      const currentAttempt =
        (await getAttempt(buildAttemptId(targetId))) || createAttemptFromExam(cachedBundle);

      setBundle(cachedBundle);
      setStoredAttempt(currentAttempt);
      await saveAttempt(currentAttempt);
    }

    void hydrateSession();
  }, [exam, examId]);

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

  return <ExamWorkspace assignment={assignment} exam={bundle} storedAttempt={storedAttempt} />;
}
