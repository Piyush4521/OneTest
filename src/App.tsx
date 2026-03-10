import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import { StatusPill } from "@/components/StatusPill";
import { createMockAssignment, createMockExam } from "@/data/mockData";
import { createAssignmentFromExam } from "@/lib/examModel";
import { firebaseConfigured, getFirebaseServices } from "@/lib/firebase";
import {
  loadFacultyWorkspace,
  loadPortalUser,
  loadStudentWorkspace,
  publishExamToFirebase,
  signInWithEmailPassword,
  signOutSession
} from "@/lib/portalGateway";
import { readStoredJson, writeStoredJson } from "@/lib/storage";
import type { Assignment, PortalUser, PublishedExam, UserRole } from "@/types/exam";

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
const ExamLaunchPage = lazy(() =>
  import("@/pages/ExamLaunchPage").then((module) => ({
    default: module.ExamLaunchPage
  }))
);
const AuthPage = lazy(() =>
  import("@/pages/AuthPage").then((module) => ({ default: module.AuthPage }))
);

const ROLE_STORAGE_KEY = "onetest.role";
const EXAM_STORAGE_KEY = "onetest.exam";
const ASSIGNMENT_STORAGE_KEY = "onetest.assignment";

function readRole() {
  return readStoredJson<UserRole>(ROLE_STORAGE_KEY, "student");
}

export default function App() {
  const [role, setRole] = useState<UserRole>(readRole);
  const [publishedExam, setPublishedExam] = useState<PublishedExam | null>(
    firebaseConfigured ? null : readStoredJson<PublishedExam | null>(EXAM_STORAGE_KEY, null)
  );
  const [assignment, setAssignment] = useState<Assignment | null>(
    firebaseConfigured ? null : readStoredJson<Assignment | null>(ASSIGNMENT_STORAGE_KEY, null)
  );
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "signed_out" | "ready">(
    firebaseConfigured ? "loading" : "ready"
  );
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const effectiveRole = useMemo(() => currentUser?.role || role, [currentUser?.role, role]);

  useEffect(() => {
    if (firebaseConfigured || (publishedExam && assignment)) {
      return;
    }

    void createMockExam().then((exam) => {
      setPublishedExam(exam);
      setAssignment(createMockAssignment(exam));
    });
  }, [assignment, publishedExam]);

  useEffect(() => {
    if (firebaseConfigured) {
      return;
    }

    writeStoredJson(ROLE_STORAGE_KEY, role);
  }, [role]);

  useEffect(() => {
    if (firebaseConfigured) {
      return;
    }

    if (publishedExam) {
      writeStoredJson(EXAM_STORAGE_KEY, publishedExam);
    }
  }, [publishedExam]);

  useEffect(() => {
    if (firebaseConfigured) {
      return;
    }

    if (assignment) {
      writeStoredJson(ASSIGNMENT_STORAGE_KEY, assignment);
    }
  }, [assignment]);

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    async function bootstrapSession() {
      const services = await getFirebaseServices();
      if (!services || !isActive) {
        return;
      }

      const { onAuthStateChanged } = await import("firebase/auth");
      unsubscribe = onAuthStateChanged(services.auth, async (authUser) => {
        if (!isActive) {
          return;
        }

        if (!authUser?.email) {
          setCurrentUser(null);
          setPublishedExam(null);
          setAssignment(null);
          setSessionStatus("signed_out");
          setStatusMessage(null);
          return;
        }

        setSessionStatus("loading");
        setStatusMessage(null);

        try {
          const portalUser = await loadPortalUser(authUser.uid, authUser.email);
          if (!portalUser || !isActive) {
            return;
          }

          setCurrentUser(portalUser);

          if (portalUser.role === "faculty" || portalUser.role === "admin") {
            const facultyExam = await loadFacultyWorkspace(portalUser.uid);
            const fallbackExam = facultyExam || (await createMockExam());

            if (!isActive) {
              return;
            }

            setPublishedExam(fallbackExam);
            setAssignment(null);
          } else {
            const workspace = await loadStudentWorkspace(portalUser.uid);

            if (!isActive) {
              return;
            }

            setAssignment(workspace.assignment);
            setPublishedExam(workspace.exam);
          }

          setSessionStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          const message =
            error instanceof Error ? error.message : "Could not load Firebase workspace.";
          setStatusMessage(message);
          setSessionStatus("signed_out");
        }
      });
    }

    void bootstrapSession();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  async function handlePublishExam(nextExam: PublishedExam, targetUids: string[]) {
    if (!firebaseConfigured) {
      setPublishedExam(nextExam);
      setAssignment(createAssignmentFromExam(nextExam));
      return { assignedCount: 0 };
    }

    if (!currentUser) {
      throw new Error("You need to sign in before publishing.");
    }

    const result = await publishExamToFirebase(nextExam, currentUser.uid, targetUids);
    setPublishedExam(nextExam);
    setStatusMessage(
      result.assignedCount > 0
        ? `Published to Firebase and assigned ${result.assignedCount} student account(s).`
        : "Published to Firebase."
    );
    return result;
  }

  async function handleSignIn(email: string, password: string) {
    setAuthSubmitting(true);
    setStatusMessage(null);

    try {
      await signInWithEmailPassword(email, password);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not sign in with Firebase Auth.";
      setStatusMessage(message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    await signOutSession();
  }

  if (firebaseConfigured && sessionStatus === "signed_out") {
    return (
      <Suspense fallback={<div className="app-shell loading-shell">Opening OneTest...</div>}>
        <AuthPage
          errorMessage={statusMessage}
          isSubmitting={authSubmitting}
          onSubmit={handleSignIn}
        />
      </Suspense>
    );
  }

  if (sessionStatus === "loading" || (!publishedExam && effectiveRole !== "student")) {
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

        <div className="topbar-actions">
          {firebaseConfigured && currentUser ? (
            <div className="status-stack">
              <StatusPill tone="neutral" label={currentUser.name} />
              <StatusPill tone="accent" label={currentUser.role} />
            </div>
          ) : null}

          <div className="status-stack">
            <StatusPill
              tone={firebaseConfigured ? "success" : "warning"}
              label={firebaseConfigured ? "Firebase configured" : "Demo data active"}
            />
            {publishedExam ? (
              <StatusPill tone="neutral" label={`${publishedExam.questions.length} questions`} />
            ) : null}
            {firebaseConfigured && currentUser ? (
              <button className="button button-secondary topbar-button" onClick={() => void handleSignOut()}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <Suspense fallback={<div className="route-fallback">Loading workspace...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                appMode={firebaseConfigured ? "firebase" : "demo"}
                currentUser={currentUser}
                role={effectiveRole}
                onRoleChange={setRole}
              />
            }
          />
          <Route
            path="/faculty"
            element={
              publishedExam ? (
                <FacultyPage
                  appMode={firebaseConfigured ? "firebase" : "demo"}
                  currentUser={currentUser}
                  onPublishExam={handlePublishExam}
                  publishedExam={publishedExam}
                  statusMessage={statusMessage}
                />
              ) : (
                <div className="route-fallback">No faculty workspace loaded.</div>
              )
            }
          />
          <Route
            path="/student"
            element={
              <StudentDashboardPage
                appMode={firebaseConfigured ? "firebase" : "demo"}
                assignment={assignment}
                currentUser={currentUser}
                exam={publishedExam}
              />
            }
          />
          <Route
            path="/student/exam/:examId"
            element={
              <ExamLaunchPage
                assignment={assignment}
                currentUid={currentUser?.uid}
                currentUser={currentUser}
                exam={publishedExam}
              />
            }
          />
          <Route
            path="/student/exam/:examId/live"
            element={
              <ExamSessionPage
                appMode={firebaseConfigured ? "firebase" : "demo"}
                assignment={assignment}
                currentUid={currentUser?.uid}
                exam={publishedExam}
              />
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}
