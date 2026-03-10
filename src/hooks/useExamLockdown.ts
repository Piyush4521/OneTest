import { useCallback, useEffect, useRef, useState } from "react";

export type SubmitReason =
  | "manual"
  | "time_expired"
  | "warning_limit"
  | "visibility_violation"
  | "page_exit";

export type WarningCode =
  | "tab_switch"
  | "copy_attempt"
  | "paste_attempt"
  | "cut_attempt"
  | "context_menu"
  | "print_shortcut"
  | "fullscreen_exit"
  | "manual";

export interface ExamWarning {
  code: WarningCode;
  occurredAtMs: number;
  details?: string;
}

export interface AttemptSnapshot {
  examId: string;
  attemptId: string;
  answers: Record<string, unknown>;
  markedForReview: string[];
  warningCount: number;
  status: "in_progress" | "submitted" | "auto_submitted";
  authoritativeNowMs: number;
  finalizedAtMs?: number;
  submitReason?: SubmitReason;
}

interface AttemptSnapshotBase {
  answers: Record<string, unknown>;
  markedForReview: string[];
}

export interface UseExamLockdownOptions {
  examId: string;
  attemptId: string;
  serverNowMs: number;
  startedAtMs: number;
  durationMs: number;
  maxWarnings: number;
  initialWarningCount?: number;
  autoSaveIntervalMs?: number;
  lockToFullscreen?: boolean;
  getSnapshot: () => AttemptSnapshotBase;
  persistSnapshot?: (snapshot: AttemptSnapshot, reason: "interval" | "warning" | "pagehide") => Promise<void> | void;
  onWarning?: (warning: ExamWarning, snapshot: AttemptSnapshot) => Promise<void> | void;
  onAutoSubmit: (snapshot: AttemptSnapshot, reason: SubmitReason) => Promise<void> | void;
}

export interface UseExamLockdownResult {
  remainingMs: number;
  warningCount: number;
  isOffline: boolean;
  isHidden: boolean;
  hasSubmitted: boolean;
  forceCheckpoint: () => Promise<void>;
  issueManualWarning: (details?: string) => Promise<void>;
  submitNow: () => Promise<void>;
}

export function useExamLockdown(options: UseExamLockdownOptions): UseExamLockdownResult {
  const {
    examId,
    attemptId,
    serverNowMs,
    startedAtMs,
    durationMs,
    maxWarnings,
    initialWarningCount = 0,
    autoSaveIntervalMs = 15 * 60 * 1000,
    lockToFullscreen = false,
    getSnapshot,
    persistSnapshot,
    onWarning,
    onAutoSubmit
  } = options;

  const serverOffsetRef = useRef(serverNowMs - Date.now());
  const getSnapshotRef = useRef(getSnapshot);
  const persistSnapshotRef = useRef(persistSnapshot);
  const onWarningRef = useRef(onWarning);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  const maxWarningsRef = useRef(maxWarnings);
  const submittedRef = useRef(false);
  const warningCountRef = useRef(initialWarningCount);

  const [warningCount, setWarningCount] = useState(initialWarningCount);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [isHidden, setIsHidden] = useState(typeof document !== "undefined" ? document.hidden : false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => {
    const now = Date.now() + serverOffsetRef.current;
    return Math.max(0, startedAtMs + durationMs - now);
  });

  useEffect(() => {
    getSnapshotRef.current = getSnapshot;
    persistSnapshotRef.current = persistSnapshot;
    onWarningRef.current = onWarning;
    onAutoSubmitRef.current = onAutoSubmit;
    maxWarningsRef.current = maxWarnings;
  }, [getSnapshot, persistSnapshot, onWarning, onAutoSubmit, maxWarnings]);

  const authoritativeNowMs = useCallback(() => {
    return Date.now() + serverOffsetRef.current;
  }, []);

  const buildSnapshot = useCallback((
    status: "in_progress" | "submitted" | "auto_submitted",
    submitReason?: SubmitReason,
    finalizedAtMs?: number,
    nextWarningCount?: number
  ): AttemptSnapshot => {
    const base = getSnapshotRef.current();
    return {
      examId,
      attemptId,
      answers: base.answers,
      markedForReview: base.markedForReview,
      warningCount: nextWarningCount ?? warningCountRef.current,
      status,
      authoritativeNowMs: authoritativeNowMs(),
      finalizedAtMs,
      submitReason
    };
  }, [attemptId, authoritativeNowMs, examId]);

  const checkpoint = useCallback(async (reason: "interval" | "warning" | "pagehide") => {
    if (submittedRef.current || !persistSnapshotRef.current) {
      return;
    }

    const snapshot = buildSnapshot("in_progress");
    await persistSnapshotRef.current(snapshot, reason);
  }, [buildSnapshot]);

  const submit = useCallback(async (reason: SubmitReason) => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    const finalizedAtMs = authoritativeNowMs();
    const status = reason === "manual" ? "submitted" : "auto_submitted";
    const snapshot = buildSnapshot(status, reason, finalizedAtMs);
    await onAutoSubmitRef.current(snapshot, reason);
    setHasSubmitted(true);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [authoritativeNowMs, buildSnapshot]);

  const addWarning = useCallback(async (code: WarningCode, details?: string) => {
    if (submittedRef.current) {
      return;
    }

    const nextWarningCount = warningCountRef.current + 1;
    warningCountRef.current = nextWarningCount;
    setWarningCount(nextWarningCount);

    const warning: ExamWarning = {
      code,
      occurredAtMs: authoritativeNowMs(),
      details
    };

    const snapshot = buildSnapshot("in_progress", undefined, undefined, nextWarningCount);

    if (onWarningRef.current) {
      await onWarningRef.current(warning, snapshot);
    }

    if (persistSnapshotRef.current) {
      await persistSnapshotRef.current(snapshot, "warning");
    }

    if (nextWarningCount >= maxWarningsRef.current) {
      await submit("warning_limit");
    }
  }, [authoritativeNowMs, buildSnapshot, submit]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(0, startedAtMs + durationMs - authoritativeNowMs());
      setRemainingMs(nextRemaining);

      if (nextRemaining === 0) {
        void submit("time_expired");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [authoritativeNowMs, durationMs, startedAtMs, submit]);

  useEffect(() => {
    if (!autoSaveIntervalMs || autoSaveIntervalMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void checkpoint("interval");
    }, autoSaveIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [autoSaveIntervalMs, checkpoint]);

  useEffect(() => {
    function onVisibilityChange() {
      const hidden = document.hidden;
      setIsHidden(hidden);
      if (hidden) {
        void addWarning("tab_switch", "Document became hidden");
      }
    }

    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
      void addWarning("context_menu", "Context menu blocked");
    }

    function onCopy(event: ClipboardEvent) {
      event.preventDefault();
      void addWarning("copy_attempt", "Copy blocked");
    }

    function onCut(event: ClipboardEvent) {
      event.preventDefault();
      void addWarning("cut_attempt", "Cut blocked");
    }

    function onPaste(event: ClipboardEvent) {
      event.preventDefault();
      void addWarning("paste_attempt", "Paste blocked");
    }

    function onKeyDown(event: KeyboardEvent) {
      const lowered = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;
      const blockedCombo = modifierPressed && ["a", "c", "p", "s", "v", "x"].includes(lowered);

      const printScreenPressed = event.key === "PrintScreen";

      if (blockedCombo || printScreenPressed) {
        event.preventDefault();
      }

      if (modifierPressed && lowered === "c") {
        void addWarning("copy_attempt", "Copy shortcut blocked");
      } else if (modifierPressed && lowered === "v") {
        void addWarning("paste_attempt", "Paste shortcut blocked");
      } else if (modifierPressed && lowered === "x") {
        void addWarning("cut_attempt", "Cut shortcut blocked");
      } else if (blockedCombo) {
        void addWarning("print_shortcut", `Blocked shortcut: ${event.key}`);
      } else if (printScreenPressed) {
        void addWarning("print_shortcut", "Print screen key pressed");
      }
    }

    function onOffline() {
      setIsOffline(true);
    }

    function onOnline() {
      setIsOffline(false);
      void checkpoint("interval");
    }

    function onPageHide() {
      void checkpoint("pagehide");
    }

    async function onFullscreenChange() {
      if (!lockToFullscreen || submittedRef.current) {
        return;
      }

      if (!document.fullscreenElement) {
        await addWarning("fullscreen_exit", "Fullscreen exited");
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);

    if (lockToFullscreen && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [addWarning, checkpoint, lockToFullscreen]);

  return {
    remainingMs,
    warningCount,
    isOffline,
    isHidden,
    hasSubmitted,
    forceCheckpoint: () => checkpoint("interval"),
    issueManualWarning: (details?: string) => addWarning("manual", details),
    submitNow: () => submit("manual")
  };
}
