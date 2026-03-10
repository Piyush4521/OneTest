import { Link } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import type { UserRole } from "@/types/exam";

interface HomePageProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  appMode: "demo" | "firebase";
}

export function HomePage({ role, onRoleChange, appMode }: HomePageProps) {
  return (
    <div className="page-shell">
      <section className="hero-grid">
        <div className="hero-card hero-card-primary">
          <div className="eyebrow-row">
            <StatusPill tone="accent" label="OneTest Secure Portal" />
            <StatusPill
              tone={appMode === "firebase" ? "success" : "warning"}
              label={appMode === "firebase" ? "Firebase Mode" : "Demo Mode"}
            />
          </div>
          <h1 className="hero-title">
            A mobile-first exam system built around real Firebase limits, not wishful architecture.
          </h1>
          <p className="hero-copy">
            This build is opinionated: local-first exam delivery, sparse writes, offline resilience,
            and a student experience that feels deliberate on small screens.
          </p>
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
          <div className="hero-actions">
            <Link
              className="button button-primary"
              to={role === "faculty" ? "/faculty" : "/student"}
            >
              Open {role === "faculty" ? "Faculty Console" : "Student Desk"}
            </Link>
            <Link className="button button-secondary" to="/student/exam/onetest-demo-2026">
              Enter Demo Exam
            </Link>
          </div>
        </div>
        <div className="hero-card hero-card-secondary">
          <p className="panel-label">Delivery posture</p>
          <ul className="signal-list">
            <li>Encrypted bundle prefetch before start time</li>
            <li>IndexedDB cache for low-bandwidth recovery</li>
            <li>Rules-first submission locking</li>
            <li>React exam shell with anti-cheat deterrence</li>
          </ul>
          <div className="hero-note">
            <span className="hero-note-kicker">Constraint-driven</span>
            <p>
              Realtime monitoring for all 5,000 students and Cloud Functions grading stay as
              upgrade-path features, not fake promises inside the MVP.
            </p>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          eyebrow="Spark Reads"
          value="15k-20k"
          detail="Target range for a 5,000 student exam day when delivery stays bundle-based."
        />
        <MetricCard
          eyebrow="Spark Writes"
          value="3 / student"
          detail="Start, one checkpoint, final submit. Anything noisier breaks the write budget fast."
        />
        <MetricCard
          eyebrow="Student UX"
          value="Bottom-first"
          detail="Tap-optimized navigation, palette sheet, high contrast, and low distraction flow."
        />
      </section>
    </div>
  );
}
