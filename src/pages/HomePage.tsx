import { Link } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import type { PortalUser, UserRole } from "@/types/exam";

interface HomePageProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  appMode: "demo" | "firebase";
  currentUser: PortalUser | null;
}

export function HomePage({ role, onRoleChange, appMode, currentUser }: HomePageProps) {
  const primaryRoute = role === "faculty" ? "/faculty" : "/student";

  return (
    <div className="page-shell">
      <section className="hero-grid">
        <div className="hero-card hero-card-primary portal-hero-card">
          <div className="eyebrow-row">
            <StatusPill tone="accent" label="OneTest Secure Portal" />
            <StatusPill
              tone={appMode === "firebase" ? "success" : "warning"}
              label={appMode === "firebase" ? "Firebase Mode" : "Demo Mode"}
            />
          </div>
          <div className="hero-intro-grid">
            <div>
              <h1 className="hero-title">
                Production-grade online examinations with a workflow that feels controlled end to end.
              </h1>
              <p className="hero-copy">
                OneTest is structured like a real exam portal: assignment desk, instruction gate,
                secure launch, live paper, locked submission, and faculty-side review.
              </p>
            </div>
            <div className="hero-callout">
              <span className="hero-callout-label">Portal Flow</span>
              <strong>Desk - Instructions - Secure Launch - Live Paper - Results</strong>
              <small>Built for mobile-first usage without sacrificing operational control.</small>
            </div>
          </div>
          {appMode === "demo" ? (
            <div className="role-toggle">
              <button
                className={role === "student" ? "segmented active" : "segmented"}
                onClick={() => onRoleChange("student")}
              >
                Student View
              </button>
              <button
                className={role === "faculty" ? "segmented active" : "segmented"}
                onClick={() => onRoleChange("faculty")}
              >
                Faculty View
              </button>
            </div>
          ) : (
            <div className="status-stack">
              <StatusPill tone="neutral" label={currentUser?.name || "Authenticated"} />
              <StatusPill tone="accent" label={`Role: ${role}`} />
            </div>
          )}
          <div className="hero-actions">
            <Link className="button button-primary" to={primaryRoute}>
              Open {role === "faculty" ? "Faculty Console" : "Student Desk"}
            </Link>
            <Link className="button button-secondary" to="/student/exam/onetest-demo-2026">
              Review Exam Workflow
            </Link>
          </div>
          <div className="portal-step-strip">
            <article className="portal-step-card">
              <span>01</span>
              <strong>Authenticate</strong>
              <p>Role-based access keeps students and faculty inside separate operational lanes.</p>
            </article>
            <article className="portal-step-card">
              <span>02</span>
              <strong>Prepare</strong>
              <p>Students prefetch their bundle and review instructions before any paper opens.</p>
            </article>
            <article className="portal-step-card">
              <span>03</span>
              <strong>Attempt</strong>
              <p>Fullscreen launch, sparse checkpoints, warning counters, and locked submission.</p>
            </article>
            <article className="portal-step-card">
              <span>04</span>
              <strong>Review</strong>
              <p>Faculty score finalized submissions and publish results from one control room.</p>
            </article>
          </div>
        </div>
        <div className="hero-card hero-card-secondary portal-side-card">
          <p className="panel-label">Exam Day Posture</p>
          <h2>Designed to feel calm for students and strict for operators.</h2>
          <div className="portal-side-list">
            <div className="portal-side-row">
              <span>Bundle delivery</span>
              <strong>Prefetch + local vault</strong>
            </div>
            <div className="portal-side-row">
              <span>Submission model</span>
              <strong>Sparse writes + final lock</strong>
            </div>
            <div className="portal-side-row">
              <span>Security posture</span>
              <strong>Visibility, fullscreen, shortcut deterrence</strong>
            </div>
            <div className="portal-side-row">
              <span>Operator workflow</span>
              <strong>Publish, assign, score, release</strong>
            </div>
          </div>
          <div className="hero-note">
            <span className="hero-note-kicker">Constraint-driven</span>
            <p>
              The UI is intentionally honest about browser limits while still pushing the exam
              workflow toward a more controlled and production-ready experience.
            </p>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          eyebrow="Delivery Model"
          value="Bundle-first"
          detail="Exam content is delivered as a published packet instead of live question-by-question reads."
        />
        <MetricCard
          eyebrow="Live Runner"
          value="Bottom-first"
          detail="Timer, palette, navigation, and warnings stay immediately accessible on mobile screens."
        />
        <MetricCard
          eyebrow="Faculty Review"
          value="Results-ready"
          detail="Finalized attempts can be scored and published from the faculty console."
        />
      </section>

      <section className="page-grid">
        <article className="surface-card">
          <div className="card-header">
            <div>
              <p className="panel-label">Student Journey</p>
              <h2>Everything critical sits inside a short, controlled path.</h2>
            </div>
            <StatusPill tone="success" label="Candidate-first UX" />
          </div>
          <div className="journey-list">
            <article className="journey-row">
              <span className="journey-index">01</span>
              <div>
                <strong>Assignment desk</strong>
                <p className="helper-copy">Exam, schedule, bundle readiness, and core instructions in one screen.</p>
              </div>
            </article>
            <article className="journey-row">
              <span className="journey-index">02</span>
              <div>
                <strong>Instruction gate</strong>
                <p className="helper-copy">Candidate confirms readiness before launching the paper.</p>
              </div>
            </article>
            <article className="journey-row">
              <span className="journey-index">03</span>
              <div>
                <strong>Live exam shell</strong>
                <p className="helper-copy">High-contrast question space with persistent bottom actions and palette access.</p>
              </div>
            </article>
          </div>
        </article>

        <article className="surface-card">
          <div className="card-header">
            <div>
              <p className="panel-label">Faculty Workflow</p>
              <h2>Operational screens are built around throughput and auditability.</h2>
            </div>
            <StatusPill tone="accent" label="Control room UI" />
          </div>
          <div className="journey-list">
            <article className="journey-row">
              <span className="journey-index">A</span>
              <div>
                <strong>Publish bundles</strong>
                <p className="helper-copy">Import questions, define the schedule, and assign students in one pass.</p>
              </div>
            </article>
            <article className="journey-row">
              <span className="journey-index">B</span>
              <div>
                <strong>Review attempts</strong>
                <p className="helper-copy">Finalized submissions surface score, warnings, timing, and review flags.</p>
              </div>
            </article>
            <article className="journey-row">
              <span className="journey-index">C</span>
              <div>
                <strong>Release results</strong>
                <p className="helper-copy">Objective results move from draft to published inside the same workspace.</p>
              </div>
            </article>
          </div>
        </article>
      </section>
    </div>
  );
}
