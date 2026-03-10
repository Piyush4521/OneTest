import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import { StatusPill } from "@/components/StatusPill";
import { createMockAssignment, createMockExam } from "@/data/mockData";
import { createAssignmentFromExam } from "@/lib/examModel";
import { firebaseConfigured } from "@/lib/firebase";
import { readStoredJson, writeStoredJson } from "@/lib/storage";
import type { Assignment, PublishedExam, UserRole } from "@/types/exam";

const HomePage = lazy(() =>
  import("@/pages/HomePage").then((module) => ({ default: module.HomePage }))
);
const FacultyPage = lazy(() =>
  import("@/pages/FacultyPage").then((module) => ({ default: module.FacultyPage }))
);
const StudentDashboardPage = lazy(() =>
  import("@/pages/StudentDashboardPage").then((module) => ({
    default: module.StudentDashboardPage
  }))
);
const ExamSessionPage = lazy(() =>
  import("@/pages/ExamSessionPage").then((module) => ({
    default: module.ExamSessionPage
  }))
);

const ROLE_STORAGE_KEY = "onetest.role";
const EXAM_STORAGE_KEY = "onetest.exam";
const ASSIGNMENT_STORAGE_KEY = "onetest.assignment";

function readRole() {
  return readStoredJson<UserRole>(ROLE_STORAGE_KEY, "student");
}

export default function App() {
  const [role, setRole] = useState<UserRole>(readRole);
  const [publishedExam, setPublishedExam] = useState<PublishedExam | null>(() =>
    readStoredJson<PublishedExam | null>(EXAM_STORAGE_KEY, null)
  );
  const [assignment, setAssignment] = useState<Assignment | null>(() =>
    readStoredJson<Assignment | null>(ASSIGNMENT_STORAGE_KEY, null)
  );

  useEffect(() => {
    if (publishedExam && assignment) {
      return;
    }

    void createMockExam().then((exam) => {
      setPublishedExam(exam);
      setAssignment(createMockAssignment(exam));
    });
  }, [assignment, publishedExam]);

  useEffect(() => {
    writeStoredJson(ROLE_STORAGE_KEY, role);
  }, [role]);

  useEffect(() => {
    if (publishedExam) {
      writeStoredJson(EXAM_STORAGE_KEY, publishedExam);
    }
  }, [publishedExam]);

  useEffect(() => {
    if (assignment) {
      writeStoredJson(ASSIGNMENT_STORAGE_KEY, assignment);
    }
  }, [assignment]);

  function handlePublishExam(nextExam: PublishedExam) {
    setPublishedExam(nextExam);
    setAssignment(createAssignmentFromExam(nextExam));
  }

  if (!publishedExam || !assignment) {
    return <div className="app-shell loading-shell">Preparing OneTest...</div>;
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-left" />
      <div className="background-orb orb-right" />

      <header className="topbar">
        <NavLink className="brand" to="/">
          <span className="brand-mark">OT</span>
          <div>
            <strong>OneTest</strong>
            <small>Secure Portal</small>
          </div>
        </NavLink>

        <nav className="main-nav">
          <NavLink className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} to="/">
            Overview
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} to="/faculty">
            Faculty
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} to="/student">
            Student
          </NavLink>
        </nav>

        <div className="status-stack">
          <StatusPill
            tone={firebaseConfigured ? "success" : "warning"}
            label={firebaseConfigured ? "Firebase configured" : "Demo data active"}
          />
          <StatusPill tone="neutral" label={`${publishedExam.questions.length} questions`} />
        </div>
      </header>

      <Suspense fallback={<div className="route-fallback">Loading workspace...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                appMode={firebaseConfigured ? "firebase" : "demo"}
                role={role}
                onRoleChange={setRole}
              />
            }
          />
          <Route
            path="/faculty"
            element={<FacultyPage onPublishExam={handlePublishExam} publishedExam={publishedExam} />}
          />
          <Route
            path="/student"
            element={<StudentDashboardPage assignment={assignment} exam={publishedExam} />}
          />
          <Route
            path="/student/exam/:examId"
            element={<ExamSessionPage assignment={assignment} exam={publishedExam} />}
          />
        </Routes>
      </Suspense>
    </div>
  );
}
