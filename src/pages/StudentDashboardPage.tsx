import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { formatExamWindow } from "@/lib/examModel";
import { getExamBundle, saveExamBundle } from "@/lib/examVault";
import type { Assignment, PublishedExam } from "@/types/exam";

interface StudentDashboardPageProps {
  assignment: Assignment;
  exam: PublishedExam;
}

export function StudentDashboardPage({
  assignment,
  exam
}: StudentDashboardPageProps) {
  const [bundleCached, setBundleCached] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Bundle not cached on this device yet."
  );

  useEffect(() => {
    void getExamBundle(exam.id).then((cachedExam) => {
      if (cachedExam) {
        setBundleCached(true);
        setStatusMessage("Encrypted bundle cached for offline recovery.");
      }
    });
  }, [exam.id]);

  async function handlePrefetch() {
    await saveExamBundle(exam);
    setBundleCached(true);
    setStatusMessage("Encrypted bundle cached successfully.");
  }

  return (
    <div className="page-shell">
      <section className="section-header">
        <div>
          <p className="panel-label">Student Desk</p>
          <h1 className="section-title">
            Everything important stays one thumb tap away.
          </h1>
        </div>
        <StatusPill
          tone={bundleCached ? "success" : "warning"}
          label={bundleCached ? "Offline bundle ready" : "Prefetch recommended"}
        />
      </section>

      <section className="metric-grid">
        <MetricCard
          eyebrow="Window"
          value={formatExamWindow(assignment.startAt, assignment.hardEndAt)}
          detail="Release and hard stop are driven by the schedule metadata."
        />
        <MetricCard
          eyebrow="Duration"
          value={`${assignment.durationMinutes} min`}
          detail="Timer stays tied to the attempt start time."
        />
        <MetricCard
          eyebrow="Warnings"
          value={String(assignment.maxWarnings)}
          detail="Tab switches and blocked shortcuts count against this total."
        />
      </section>

      <section className="page-grid">
        <article className="surface-card">
          <div className="card-header">
            <div>
              <p className="panel-label">Assigned Exam</p>
              <h2>{assignment.title}</h2>
            </div>
            <StatusPill tone="accent" label={assignment.bundleVersion} />
          </div>

          <ul className="signal-list">
            {exam.settings.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>

          <div className="actions-row">
            <button
              className="button button-secondary"
              onClick={() => void handlePrefetch()}
            >
              {bundleCached ? "Refresh Cached Bundle" : "Prefetch Secure Bundle"}
            </button>
            <Link className="button button-primary" to={`/student/exam/${exam.id}`}>
              Enter Exam Session
            </Link>
          </div>

          <p className="helper-copy">{statusMessage}</p>
        </article>

        <article className="surface-card surface-card-contrast">
          <p className="panel-label">Session posture</p>
          <h2>Zero-distraction mode</h2>
          <p className="surface-copy">
            The exam runner uses a fixed bottom action bar, a quick-jump palette,
            sparse background checkpoints, and warning-driven auto-submit logic.
          </p>
          <div className="stacked-pills">
            <StatusPill tone="neutral" label="Bottom navigation" />
            <StatusPill tone="neutral" label="Question palette sheet" />
            <StatusPill tone="neutral" label="Offline-first attempt state" />
          </div>
        </article>
      </section>
    </div>
  );
}
