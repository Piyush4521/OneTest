import { useState, type ChangeEvent } from "react";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { createBundleHash, formatExamWindow, toLocalDateTimeValue } from "@/lib/examModel";
import { importQuestionsFromFile } from "@/lib/importQuestions";
import type { FacultyImportPreview, PublishedExam } from "@/types/exam";

interface FacultyPageProps {
  publishedExam: PublishedExam;
  onPublishExam: (exam: PublishedExam) => void;
}

export function FacultyPage({ publishedExam, onPublishExam }: FacultyPageProps) {
  const [importPreview, setImportPreview] = useState<FacultyImportPreview | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting for a new question file.");
  const [isPublishing, setIsPublishing] = useState(false);
  const [title, setTitle] = useState(publishedExam.settings.title);
  const [subject, setSubject] = useState(publishedExam.settings.subject);
  const [code, setCode] = useState(publishedExam.settings.code);
  const [durationMinutes, setDurationMinutes] = useState(
    String(publishedExam.settings.durationMinutes)
  );
  const [maxWarnings, setMaxWarnings] = useState(String(publishedExam.settings.maxWarnings));
  const [startAt, setStartAt] = useState(
    toLocalDateTimeValue(new Date(publishedExam.settings.startAt))
  );
  const [hardEndAt, setHardEndAt] = useState(
    toLocalDateTimeValue(new Date(publishedExam.settings.hardEndAt))
  );
  const [graceSubmitAt, setGraceSubmitAt] = useState(
    toLocalDateTimeValue(new Date(publishedExam.settings.graceSubmitAt))
  );
  const [instructionsText, setInstructionsText] = useState(
    publishedExam.settings.instructions.join("\n")
  );

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
      const message =
        error instanceof Error ? error.message : "Could not parse question file.";
      setStatusMessage(message);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    const nextQuestions = importPreview?.questions.length
      ? importPreview.questions
      : publishedExam.questions;
    const bundleHash = await createBundleHash(nextQuestions);

    const nextExam: PublishedExam = {
      ...publishedExam,
      bundleHash,
      bundleVersion: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      status: "published",
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

    onPublishExam(nextExam);
    setStatusMessage(
      `Published ${nextExam.settings.title} with ${nextExam.questions.length} questions.`
    );
    setIsPublishing(false);
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
                type="number"
                min="15"
                step="5"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Max warnings</span>
              <input
                type="number"
                min="1"
                max="10"
                value={maxWarnings}
                onChange={(event) => setMaxWarnings(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Start time</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
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
            <textarea
              rows={6}
              value={instructionsText}
              onChange={(event) => setInstructionsText(event.target.value)}
            />
          </label>
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
            <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} />
            <span>Drop a CSV/XLSX file here or tap to select one.</span>
          </label>

          <p className="helper-copy">{statusMessage}</p>

          <div className="question-preview">
            {(importPreview?.questions || publishedExam.questions)
              .slice(0, 4)
              .map((question) => (
                <article className="question-preview-card" key={question.id}>
                  <span className="question-index">{question.section}</span>
                  <p>{question.prompt}</p>
                  <small>
                    {question.type.replace("_", " ")} • {question.marks} mark
                  </small>
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
              Publishing updates the demo student assignment immediately.
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
