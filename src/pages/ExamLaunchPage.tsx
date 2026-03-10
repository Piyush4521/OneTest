import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { buildAttemptId, formatExamWindow } from "@/lib/examModel";
import { getAttempt, getExamBundle } from "@/lib/examVault";
import type { Assignment, PortalUser, PublishedExam } from "@/types/exam";

interface ExamLaunchPageProps {
  assignment: Assignment | null;
  currentUid?: string;
  currentUser: PortalUser | null;
  exam: PublishedExam | null;
}

export function ExamLaunchPage({
  assignment,
  currentUid,
  currentUser,
  exam
}: ExamLaunchPageProps) {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [hasAccepted, setHasAccepted] = useState(false);
  const [bundleCached, setBundleCached] = useState(false);
  const [attemptExists, setAttemptExists] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!exam) {
      return;
    }

    void getExamBundle(exam.id).then((bundle) => setBundleCached(Boolean(bundle)));
  }, [exam]);

  useEffect(() => {
    if (!exam) {
      return;
    }

    void getAttempt(buildAttemptId(exam.id, currentUid || "demo-student")).then((attempt) => {
      setAttemptExists(Boolean(attempt));
    });
  }, [currentUid, exam]);

  const launchState = useMemo(() => {
    if (!assignment) {
      return "missing";
    }

    const startMs = new Date(assignment.startAt).getTime();
    const closeMs = new Date(assignment.graceSubmitAt).getTime();

    if (now < startMs) {
      return "scheduled";
    }

    if (now > closeMs) {
      return "closed";
    }

    return "open";
  }, [assignment, now]);

  async function handleLaunch() {
    if (!assignment || !exam || !hasAccepted || launchState !== "open") {
      return;
    }

    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }

    navigate(`/student/exam/${examId || exam.id}/live`);
  }

  if (!assignment || !exam) {
    return (
      <div className="page-shell">
        <article className="completion-card">
          <StatusPill tone="warning" label="No exam loaded" />
          <h1>There is no exam launch packet available.</h1>
          <p>Return to the student desk and wait for an assigned paper.</p>
          <div className="actions-row">
            <Link className="button button-primary" to="/student">
              Return to student desk
            </Link>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="section-header">
        <div>
          <p className="panel-label">Exam Instructions</p>
          <h1 className="section-title">Review the rules before secure launch.</h1>
        </div>
        <StatusPill
          tone={
            launchState === "open" ? "success" : launchState === "scheduled" ? "warning" : "accent"
          }
          label={
            launchState === "open"
              ? "Window open"
              : launchState === "scheduled"
                ? "Starts soon"
                : "Window closed"
          }
        />
      </section>

      <section className="metric-grid">
        <MetricCard
          eyebrow="Exam Window"
          value={formatExamWindow(assignment.startAt, assignment.hardEndAt)}
          detail="The secure session only opens inside the scheduled time window."
        />
        <MetricCard
          eyebrow="Bundle State"
          value={bundleCached ? "Cached" : "Not cached"}
          detail="Cached bundles reduce launch risk if campus Wi-Fi becomes unstable."
        />
        <MetricCard
          eyebrow="Candidate"
          value={currentUser?.name || currentUid || "Student"}
          detail="Identity stays bound to the signed-in Firebase account."
        />
      </section>

      <section className="launch-grid">
        <article className="surface-card">
          <div className="card-header">
            <div>
              <p className="panel-label">Launch Packet</p>
              <h2>{assignment.title}</h2>
            </div>
            <StatusPill tone="accent" label={`${exam.questions.length} questions`} />
          </div>

          <ul className="signal-list">
            <li>Fullscreen is requested before the live paper opens.</li>
            <li>Tab switches, blocked shortcuts, and fullscreen exits trigger warnings.</li>
            <li>The answer key never ships to the student bundle.</li>
            <li>Submissions are locked once finalized.</li>
          </ul>

          <label className="launch-check">
            <input
              checked={hasAccepted}
              type="checkbox"
              onChange={(event) => setHasAccepted(event.target.checked)}
            />
            <span>
              I understand the instructions and want to {attemptExists ? "resume" : "start"} this
              exam under secure mode.
            </span>
          </label>

          <div className="actions-row">
            <button
              className="button button-primary"
              disabled={!hasAccepted || launchState !== "open"}
              onClick={() => void handleLaunch()}
            >
              {attemptExists ? "Resume Secure Session" : "Begin Secure Session"}
            </button>
            <Link className="button button-secondary" to="/student">
              Back to desk
            </Link>
          </div>

          <p className="helper-copy">
            {launchState === "open"
              ? "The launch gate is open. Starting now moves the student into the live runner."
              : launchState === "scheduled"
                ? "The exam is assigned, but the start window has not opened yet."
                : "The exam window has closed. A new live attempt cannot be started from this screen."}
          </p>
        </article>

        <article className="surface-card surface-card-contrast">
          <p className="panel-label">Student Instructions</p>
          <h2>Read once. Then stay inside the paper.</h2>
          <ul className="signal-list">
            {exam.settings.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
          <div className="stacked-pills">
            <StatusPill tone="neutral" label="Declaration gate" />
            <StatusPill tone="neutral" label="Fullscreen launch" />
            <StatusPill tone="neutral" label="Session resume support" />
          </div>
        </article>
      </section>
    </div>
  );
}
