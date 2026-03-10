import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { formatExamWindow } from "@/lib/examModel";
import { getExamBundle, saveExamBundle } from "@/lib/examVault";
import type { Assignment, PortalUser, PublishedExam } from "@/types/exam";

interface StudentDashboardPageProps {
  appMode: "demo" | "firebase";
  assignment: Assignment | null;
  currentUser: PortalUser | null;
  exam: PublishedExam | null;
}

export function StudentDashboardPage({
  appMode,
  assignment,
  currentUser,
  exam
}: StudentDashboardPageProps) {
  const [bundleCached, setBundleCached] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Bundle not cached on this device yet.");

  useEffect(() => {
    if (!exam) {
      return;
    }

    void getExamBundle(exam.id).then((cachedExam) => {
      if (cachedExam) {
        setBundleCached(true);
        setStatusMessage("Encrypted bundle cached for offline recovery.");
      }
    });
  }, [exam]);

  async function handlePrefetch() {
    if (!exam) {
      return;
    }

    await saveExamBundle(exam);
    setBundleCached(true);
    setStatusMessage("Encrypted bundle cached successfully.");
  }

  if (!assignment || !exam) {
    return (
      <div className="page-shell">
        <section className="section-header">
          <div>
            <p className="panel-label">Student Desk</p>
            <h1 className="section-title">No exam assignment is available yet.</h1>
          </div>
          <StatusPill tone="warning" label={appMode === "firebase" ? "Awaiting assignment" : "Demo seed missing"} />
        </section>

        <article className="surface-card">
          <p className="surface-copy">
            {appMode === "firebase"
              ? `${currentUser?.name || "This account"} is signed in correctly, but no active assignment was found in Firestore under users/${currentUser?.uid || "uid"}/examAssignments.`
              : "Demo mode could not load the seeded exam."}
          </p>
        </article>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="section-header">
        <div>
          <p className="panel-label">Student Desk</p>
          <h1 className="section-title">One controlled launch path from assignment to live paper.</h1>
        </div>
        <div className="status-stack">
          <StatusPill tone="accent" label={assignment.status.replace("_", " ")} />
          <StatusPill
            tone={bundleCached ? "success" : "warning"}
            label={bundleCached ? "Offline bundle ready" : "Prefetch recommended"}
          />
        </div>
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

      <section className="desk-grid">
        <article className="surface-card desk-card-primary">
          <div className="card-header">
            <div>
              <p className="panel-label">Assigned Exam</p>
              <h2>{assignment.title}</h2>
            </div>
            <StatusPill tone="accent" label={assignment.bundleVersion} />
          </div>

          <div className="fact-grid">
            <article className="fact-card">
              <span>Subject</span>
              <strong>{exam.settings.subject}</strong>
            </article>
            <article className="fact-card">
              <span>Course Code</span>
              <strong>{exam.settings.code}</strong>
            </article>
            <article className="fact-card">
              <span>Questions</span>
              <strong>{exam.questions.length}</strong>
            </article>
            <article className="fact-card">
              <span>Candidate</span>
              <strong>{currentUser?.name || "Student"}</strong>
            </article>
          </div>

          <ul className="signal-list">
            {exam.settings.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>

          <div className="actions-row">
            <button className="button button-secondary" onClick={() => void handlePrefetch()}>
              {bundleCached ? "Refresh Cached Bundle" : "Prefetch Secure Bundle"}
            </button>
            <Link className="button button-primary" to={`/student/exam/${exam.id}`}>
              Review Instructions
            </Link>
          </div>

          <p className="helper-copy">{statusMessage}</p>
        </article>

        <aside className="desk-side-stack">
          <article className="surface-card surface-card-contrast">
            <p className="panel-label">Candidate Readiness</p>
            <h2>Launch only after the device and student are ready.</h2>
            <div className="readiness-list">
              <div className="readiness-row">
                <span>Identity</span>
                <strong>{currentUser?.email || "demo@student.local"}</strong>
              </div>
              <div className="readiness-row">
                <span>Bundle</span>
                <strong>{bundleCached ? "Stored locally" : "Prefetch pending"}</strong>
              </div>
              <div className="readiness-row">
                <span>Security gate</span>
                <strong>Instructions + declaration</strong>
              </div>
              <div className="readiness-row">
                <span>Live shell</span>
                <strong>Fullscreen request on launch</strong>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <p className="panel-label">Session Posture</p>
            <h2>Zero-distraction mode</h2>
            <p className="surface-copy">
              The exam runner uses a fixed bottom action bar, a quick-jump palette, sparse background
              checkpoints, and warning-driven auto-submit logic.
            </p>
            <div className="stacked-pills">
              <StatusPill tone="neutral" label="Bottom navigation" />
              <StatusPill tone="neutral" label="Question palette sheet" />
              <StatusPill tone="neutral" label="Offline-first attempt state" />
            </div>
          </article>
        </aside>
      </section>

      <section className="workflow-strip">
        <article className="workflow-card">
          <span>1</span>
          <strong>Prefetch</strong>
          <p>Store the bundle locally before the lab gets crowded.</p>
        </article>
        <article className="workflow-card">
          <span>2</span>
          <strong>Review rules</strong>
          <p>Launch happens only after the candidate accepts the declaration.</p>
        </article>
        <article className="workflow-card">
          <span>3</span>
          <strong>Attempt</strong>
          <p>Warnings, timing, progress, and submission stay visible all the way through.</p>
        </article>
      </section>
    </div>
  );
}
