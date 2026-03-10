import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { createBundleHash, formatExamWindow, toLocalDateTimeValue } from "@/lib/examModel";
import { importQuestionsFromFile } from "@/lib/importQuestions";
import { loadSubmissionReviews, publishObjectiveResults } from "@/lib/portalGateway";
import { createMockSubmissionReviews } from "@/data/mockData";
import type {
  FacultyImportPreview,
  PortalUser,
  PublishedExam,
  SubmissionReview
} from "@/types/exam";

interface FacultyPageProps {
  appMode: "demo" | "firebase";
  currentUser: PortalUser | null;
  publishedExam: PublishedExam;
  onPublishExam: (exam: PublishedExam, targetUids: string[]) => Promise<{ assignedCount: number }>;
  statusMessage: string | null;
}

export function FacultyPage({
  appMode,
  currentUser,
  publishedExam,
  onPublishExam,
  statusMessage: externalStatusMessage
}: FacultyPageProps) {
  const [importPreview, setImportPreview] = useState<FacultyImportPreview | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting for a new question file.");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRefreshingReviews, setIsRefreshingReviews] = useState(false);
  const [isPublishingResults, setIsPublishingResults] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("Loading review workspace.");
  const [submissionReviews, setSubmissionReviews] = useState<SubmissionReview[]>([]);
  const [targetUids, setTargetUids] = useState("");
  const [title, setTitle] = useState(publishedExam.settings.title);
  const [subject, setSubject] = useState(publishedExam.settings.subject);
  const [code, setCode] = useState(publishedExam.settings.code);
  const [durationMinutes, setDurationMinutes] = useState(String(publishedExam.settings.durationMinutes));
  const [maxWarnings, setMaxWarnings] = useState(String(publishedExam.settings.maxWarnings));
  const [startAt, setStartAt] = useState(toLocalDateTimeValue(new Date(publishedExam.settings.startAt)));
  const [hardEndAt, setHardEndAt] = useState(toLocalDateTimeValue(new Date(publishedExam.settings.hardEndAt)));
  const [graceSubmitAt, setGraceSubmitAt] = useState(
    toLocalDateTimeValue(new Date(publishedExam.settings.graceSubmitAt))
  );
  const [instructionsText, setInstructionsText] = useState(
    publishedExam.settings.instructions.join("\n")
  );

  useEffect(() => {
    setTitle(publishedExam.settings.title);
    setSubject(publishedExam.settings.subject);
    setCode(publishedExam.settings.code);
    setDurationMinutes(String(publishedExam.settings.durationMinutes));
    setMaxWarnings(String(publishedExam.settings.maxWarnings));
    setStartAt(toLocalDateTimeValue(new Date(publishedExam.settings.startAt)));
    setHardEndAt(toLocalDateTimeValue(new Date(publishedExam.settings.hardEndAt)));
    setGraceSubmitAt(toLocalDateTimeValue(new Date(publishedExam.settings.graceSubmitAt)));
    setInstructionsText(publishedExam.settings.instructions.join("\n"));
  }, [publishedExam]);

  const finalizedReviews = useMemo(
    () => submissionReviews.filter((review) => Boolean(review.finalizedAt)),
    [submissionReviews]
  );
  const publishedResultsCount = useMemo(
    () => submissionReviews.filter((review) => review.score.published).length,
    [submissionReviews]
  );
  const averageScore = useMemo(() => {
    if (finalizedReviews.length === 0) {
      return "0.0";
    }

    const total = finalizedReviews.reduce((sum, review) => sum + review.score.total, 0);
    return (total / finalizedReviews.length).toFixed(1);
  }, [finalizedReviews]);

  const possibleScore = useMemo(
    () => publishedExam.questions.reduce((sum, question) => sum + question.marks, 0),
    [publishedExam.questions]
  );

  const hydrateReviews = useCallback(async () => {
    setIsRefreshingReviews(true);

    try {
      const reviews =
        appMode === "firebase"
          ? await loadSubmissionReviews(publishedExam)
          : createMockSubmissionReviews(publishedExam);

      setSubmissionReviews(reviews);
      setReviewMessage(
        reviews.length > 0
          ? `Loaded ${reviews.length} submission record(s) for ${publishedExam.settings.title}.`
          : "No submissions are available yet."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load the faculty review workspace.";
      setReviewMessage(message);
    } finally {
      setIsRefreshingReviews(false);
    }
  }, [appMode, publishedExam]);

  useEffect(() => {
    void hydrateReviews();
  }, [hydrateReviews]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const preview = await importQuestionsFromFile(file);
      setImportPreview(preview);
      setStatusMessage(`Parsed ${preview.questions.length} questions from ${preview.sourceName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse question file.";
      setStatusMessage(message);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    const nextQuestions = importPreview?.questions.length ? importPreview.questions : publishedExam.questions;
    const bundleHash = await createBundleHash(nextQuestions);

    const nextExam: PublishedExam = {
      ...publishedExam,
      bundleHash,
      bundleVersion: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      status: "published",
      createdBy: currentUser?.uid,
      questions: nextQuestions,
      settings: {
        title,
        subject,
        code,
        durationMinutes: Number(durationMinutes),
        maxWarnings: Number(maxWarnings),
        startAt: new Date(startAt).toISOString(),
        hardEndAt: new Date(hardEndAt).toISOString(),
        graceSubmitAt: new Date(graceSubmitAt).toISOString(),
        instructions: instructionsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      }
    };

    try {
      const publishResult = await onPublishExam(nextExam, targetUids.split(/[\s,]+/).filter(Boolean));
      setStatusMessage(
        publishResult.assignedCount > 0
          ? `Published ${nextExam.settings.title} and assigned ${publishResult.assignedCount} student account(s).`
          : `Published ${nextExam.settings.title} with ${nextExam.questions.length} questions.`
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePublishResults() {
    setIsPublishingResults(true);

    try {
      if (appMode === "firebase") {
        const result = await publishObjectiveResults(publishedExam);
        setReviewMessage(`Published ${result.publishedCount} finalized result(s) to Firestore.`);
        await hydrateReviews();
        return;
      }

      const nextReviews: SubmissionReview[] = submissionReviews.map((review): SubmissionReview => {
        if (!review.finalizedAt) {
          return review;
        }

        const objective = review.objectiveScore;
        const manual = review.score.manual;

        return {
          ...review,
          status: "graded",
          score: {
            objective,
            manual,
            total: Number((objective + manual).toFixed(2)),
            published: true
          }
        };
      });

      setSubmissionReviews(nextReviews);
      setReviewMessage(
        `Published ${nextReviews.filter((review) => review.score.published).length} demo result(s).`
      );
    } finally {
      setIsPublishingResults(false);
    }
  }

  function formatReviewTime(value?: string) {
    if (!value) {
      return "Not finalized";
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function statusTone(review: SubmissionReview) {
    if (review.status === "graded") {
      return "success";
    }

    if (review.status === "submitted" || review.status === "auto_submitted") {
      return "accent";
    }

    return "warning";
  }

  return (
    <div className="page-shell">
      <section className="section-header">
        <div>
          <p className="panel-label">Faculty Console</p>
          <h1 className="section-title">Publish secure bundles, not fragile document trees.</h1>
        </div>
        <StatusPill
          tone="success"
          label={`Live window: ${formatExamWindow(
            publishedExam.settings.startAt,
            publishedExam.settings.hardEndAt
          )}`}
        />
      </section>

      <section className="metric-grid">
        <MetricCard
          eyebrow="Published Questions"
          value={String(importPreview?.questions.length || publishedExam.questions.length)}
          detail="Student bundle content is generated from this set."
        />
        <MetricCard
          eyebrow="Warning Limit"
          value={maxWarnings}
          detail="Auto-submit threshold enforced in the exam runner."
        />
        <MetricCard
          eyebrow="Bundle Hash"
          value={publishedExam.bundleHash || "Pending"}
          detail="Short SHA-256 fingerprint for integrity checks."
        />
      </section>

      <section className="page-grid">
        <article className="surface-card">
          <div className="card-header">
            <div>
              <p className="panel-label">Exam Settings</p>
              <h2>Session controls</h2>
            </div>
            <StatusPill tone="neutral" label="Spark-safe delivery" />
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Exam title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field">
              <span>Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label className="field">
              <span>Course code</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <label className="field">
              <span>Duration (minutes)</span>
              <input
                min="15"
                step="5"
                type="number"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Max warnings</span>
              <input
                max="10"
                min="1"
                type="number"
                value={maxWarnings}
                onChange={(event) => setMaxWarnings(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Start time</span>
              <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
            </label>
            <label className="field">
              <span>Hard end time</span>
              <input
                type="datetime-local"
                value={hardEndAt}
                onChange={(event) => setHardEndAt(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Grace submit deadline</span>
              <input
                type="datetime-local"
                value={graceSubmitAt}
                onChange={(event) => setGraceSubmitAt(event.target.value)}
              />
            </label>
          </div>

          <label className="field field-full">
            <span>Student instructions</span>
            <textarea rows={6} value={instructionsText} onChange={(event) => setInstructionsText(event.target.value)} />
          </label>

          {appMode === "firebase" ? (
            <label className="field field-full">
              <span>Assign to student UIDs</span>
              <textarea
                placeholder="uid-1, uid-2, uid-3"
                rows={4}
                value={targetUids}
                onChange={(event) => setTargetUids(event.target.value)}
              />
            </label>
          ) : null}
        </article>

        <article className="surface-card">
          <div className="card-header">
            <div>
              <p className="panel-label">Question Intake</p>
              <h2>CSV or Excel import</h2>
            </div>
            <StatusPill
              tone="warning"
              label="Columns: question, optionA, optionB, optionC, optionD, correctAnswer"
            />
          </div>

          <label className="uploader">
            <input accept=".csv,.xls,.xlsx" type="file" onChange={handleFileChange} />
            <span>Drop a CSV/XLSX file here or tap to select one.</span>
          </label>

          <p className="helper-copy">{statusMessage}</p>

          <div className="question-preview">
            {(importPreview?.questions || publishedExam.questions).slice(0, 4).map((question) => (
              <article className="question-preview-card" key={question.id}>
                <span className="question-index">{question.section}</span>
                <p>{question.prompt}</p>
                <small>{question.type.replace("_", " ")} - {question.marks} mark</small>
              </article>
            ))}
          </div>

          <div className="actions-row">
            <button
              className="button button-primary"
              disabled={isPublishing}
              onClick={() => void handlePublish()}
            >
              {isPublishing ? "Publishing..." : "Publish Secure Bundle"}
            </button>
            <span className="helper-copy">
              {appMode === "firebase"
                ? `Publishing as ${currentUser?.name || "faculty"} writes exam, answer key, bundle, and assignments into Firestore.`
                : "Publishing updates the local demo student assignment immediately."}
            </span>
          </div>

          {externalStatusMessage ? <p className="helper-copy">{externalStatusMessage}</p> : null}
        </article>
      </section>

      <section className="surface-card">
        <div className="review-toolbar">
          <div>
            <p className="panel-label">Submission Review</p>
            <h2>Grade finalized attempts and publish results.</h2>
          </div>
          <div className="actions-row">
            <button
              className="button button-secondary"
              disabled={isRefreshingReviews}
              onClick={() => void hydrateReviews()}
            >
              {isRefreshingReviews ? "Refreshing..." : "Refresh Submissions"}
            </button>
            <button
              className="button button-primary"
              disabled={isPublishingResults || finalizedReviews.length === 0}
              onClick={() => void handlePublishResults()}
            >
              {isPublishingResults ? "Publishing..." : "Publish Results"}
            </button>
          </div>
        </div>

        <section className="metric-grid review-summary-grid">
          <MetricCard
            eyebrow="Finalized Attempts"
            value={String(finalizedReviews.length)}
            detail="Only finalized attempts are included when publishing scores."
          />
          <MetricCard
            eyebrow="Published Results"
            value={String(publishedResultsCount)}
            detail="Result cards flip to published once faculty confirms scoring."
          />
          <MetricCard
            eyebrow="Average Score"
            value={`${averageScore}/${possibleScore}`}
            detail="Objective total across finalized attempts."
          />
        </section>

        <p className="helper-copy">{reviewMessage}</p>

        {submissionReviews.length === 0 ? (
          <article className="review-empty">
            <StatusPill tone="warning" label="No submissions yet" />
            <p className="helper-copy">
              Students need to create or finalize attempts before the faculty review queue can be scored.
            </p>
          </article>
        ) : (
          <div className="review-grid">
            {submissionReviews.map((review) => (
              <article className="review-card" key={review.attemptId}>
                <div className="review-card-header">
                  <div>
                    <p className="panel-label">Candidate</p>
                    <h3>{review.studentName}</h3>
                    <p className="helper-copy">
                      {review.studentEmail || review.uid}
                    </p>
                  </div>
                  <div className="status-stack">
                    <StatusPill
                      tone={statusTone(review)}
                      label={review.status.replace("_", " ")}
                    />
                    <StatusPill
                      tone={review.score.published ? "success" : "neutral"}
                      label={review.score.published ? "Result published" : "Draft score"}
                    />
                  </div>
                </div>

                <div className="review-detail-grid">
                  <div className="review-detail">
                    <span>Score</span>
                    <strong className="review-score">
                      {review.score.total}/{review.possibleScore}
                    </strong>
                  </div>
                  <div className="review-detail">
                    <span>Correct</span>
                    <strong>{review.correctCount}</strong>
                  </div>
                  <div className="review-detail">
                    <span>Answered</span>
                    <strong>{review.answeredCount}</strong>
                  </div>
                  <div className="review-detail">
                    <span>Warnings</span>
                    <strong>{review.warningCount}</strong>
                  </div>
                </div>

                <div className="review-meta">
                  <small>Started {formatReviewTime(review.startedAt)}</small>
                  <small>Last sync {formatReviewTime(review.lastSavedAt)}</small>
                  <small>Finalized {formatReviewTime(review.finalizedAt)}</small>
                  <small>
                    Review flags {review.markedForReviewCount}
                    {review.lastWarningCode ? ` - ${review.lastWarningCode}` : ""}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
