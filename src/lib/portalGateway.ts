import { buildSubmissionReview, createAssignmentFromExam, createStudentSafeExam } from "@/lib/examModel";
import { getFirebaseServices } from "@/lib/firebase";
import { nowMs } from "@/lib/time";
import type {
  Assignment,
  PortalUser,
  PublishedExam,
  StoredAttempt,
  SubmissionReview,
  SubmissionScore,
  UserRole
} from "@/types/exam";

function toIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (typeof value === "string" && value) {
    return value;
  }

  return fallback;
}

function toMillis(value: unknown, fallback = nowMs()) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value) {
    return new Date(value).getTime();
  }

  return fallback;
}

function normalizeQuestions(rawQuestions: unknown[]) {
  return rawQuestions.map((question, index) => {
    const entry = (question as Record<string, unknown>) || {};

    return {
      id: String(entry.id || `q-${index + 1}`),
      section: String(entry.section || "General"),
      type: String(entry.type || "single_choice") as PublishedExam["questions"][number]["type"],
      prompt: String(entry.prompt || entry.promptHtml || ""),
      options: Array.isArray(entry.options)
        ? entry.options.map((option) => {
            const optionEntry = option as Record<string, unknown>;
            return {
              id: String(optionEntry.id || ""),
              label: String(optionEntry.label || optionEntry.labelHtml || "")
            };
          })
        : [],
      correctOptionIds: Array.isArray(entry.correctOptionIds)
        ? entry.correctOptionIds.map((value) => String(value))
        : Array.isArray(entry.answerKey)
          ? entry.answerKey.map((value) => String(value))
          : [],
      marks: Number(entry.marks || 1),
      negativeMarks: Number(entry.negativeMarks || 0)
    };
  });
}

function mapSubmissionScore(value: unknown): SubmissionScore {
  const entry = (value as Record<string, unknown>) || {};

  return {
    objective: typeof entry.objective === "number" ? entry.objective : 0,
    manual: typeof entry.manual === "number" ? entry.manual : 0,
    total: typeof entry.total === "number" ? entry.total : 0,
    published: Boolean(entry.published)
  };
}

function chunkValues<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function mapAssignment(examId: string, data: Record<string, unknown>): Assignment {
  return {
    examId,
    uid: typeof data.uid === "string" ? data.uid : undefined,
    title: String(data.title || "Untitled exam"),
    startAt: toIsoString(data.startAt),
    hardEndAt: toIsoString(data.hardEndAt),
    graceSubmitAt: toIsoString(data.graceSubmitAt),
    durationMinutes: Number(data.durationMinutes || 60),
    maxWarnings: Number(data.maxWarnings || 3),
    bundleUrl: typeof data.bundleUrl === "string" ? data.bundleUrl : "",
    bundleVersion: String(data.bundleVersion || ""),
    bundleHash: String(data.bundleSha256 || data.bundleHash || ""),
    status: String(data.status || "assigned") as Assignment["status"]
  };
}

function mapExamBundle(examId: string, data: Record<string, unknown>): PublishedExam {
  return {
    id: examId,
    bundleVersion: String(data.bundleVersion || data.keyVersion || ""),
    bundleHash: String(data.bundleHash || data.bundleSha256 || ""),
    publishedAt: toIsoString(data.publishedAt),
    status: String(data.status || "published") as PublishedExam["status"],
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
    settings: {
      title: String(data.title || "Untitled exam"),
      subject: String(data.subject || "General"),
      code: String(data.courseCode || data.code || examId),
      durationMinutes: Number(data.durationMinutes || 60),
      maxWarnings: Number(data.maxWarnings || 3),
      startAt: toIsoString(data.startAt),
      hardEndAt: toIsoString(data.hardEndAt),
      graceSubmitAt: toIsoString(data.graceSubmitAt),
      instructions: Array.isArray(data.instructions)
        ? data.instructions.map((value) => String(value))
        : []
    },
    questions: normalizeQuestions(Array.isArray(data.questions) ? data.questions : [])
  };
}

export async function signInWithEmailPassword(email: string, password: string) {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error("Firebase is not configured.");
  }

  const { signInWithEmailAndPassword } = await import("firebase/auth");
  await signInWithEmailAndPassword(services.auth, email, password);
}

export async function signOutSession() {
  const services = await getFirebaseServices();
  if (!services) {
    return;
  }

  const { signOut } = await import("firebase/auth");
  await signOut(services.auth);
}

export async function loadPortalUser(uid: string, email: string) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const [{ doc, getDoc }, { getIdTokenResult }] = await Promise.all([
    import("firebase/firestore"),
    import("firebase/auth")
  ]);

  const userSnapshot = await getDoc(doc(services.firestore, "users", uid));
  const authUser = services.auth.currentUser;
  const tokenClaims = authUser ? await getIdTokenResult(authUser) : null;
  const data = userSnapshot.exists() ? (userSnapshot.data() as Record<string, unknown>) : {};
  const claimRole = tokenClaims?.claims.role as UserRole | undefined;
  const profileRole = typeof data.role === "string" ? (data.role as UserRole) : undefined;

  return {
    uid,
    email,
    name: String(data.name || email || "Portal User"),
    role: claimRole || profileRole || "student",
    collegeId: typeof data.collegeId === "string" ? data.collegeId : undefined,
    department: typeof data.department === "string" ? data.department : undefined,
    active: data.active !== false
  } satisfies PortalUser;
}

export async function loadFacultyWorkspace(uid: string) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { collection, getDocs, limit, orderBy, query, where } = await import("firebase/firestore");
  const draftQuery = query(
    collection(services.firestore, "examDrafts"),
    where("createdBy", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(1)
  );
  const draftSnapshots = await getDocs(draftQuery);

  if (draftSnapshots.empty) {
    return null;
  }

  const draftSnapshot = draftSnapshots.docs[0];
  const questionSnapshots = await getDocs(
    query(
      collection(services.firestore, "examDrafts", draftSnapshot.id, "questions"),
      orderBy("order", "asc")
    )
  );

  const draftData = draftSnapshot.data() as Record<string, unknown>;
  const questions = questionSnapshots.docs.map((questionSnapshot) => {
    const questionData = questionSnapshot.data() as Record<string, unknown>;
    return normalizeQuestions([
      {
        id: questionSnapshot.id,
        ...questionData,
        correctOptionIds: Array.isArray(questionData.answerKey) ? questionData.answerKey : []
      }
    ])[0];
  });

  return {
    id: draftSnapshot.id,
    bundleVersion: String(draftData.bundleVersion || ""),
    bundleHash: String(draftData.bundleSha256 || draftData.bundleHash || ""),
    publishedAt: toIsoString(draftData.updatedAt),
    status: draftData.published ? "published" : "draft",
    createdBy: uid,
    settings: {
      title: String(draftData.title || "Untitled exam"),
      subject: String(draftData.subject || "General"),
      code: String(draftData.courseCode || draftSnapshot.id),
      durationMinutes: Number(draftData.durationMinutes || 60),
      maxWarnings: Number(draftData.maxWarnings || 3),
      startAt: toIsoString(draftData.startAt),
      hardEndAt: toIsoString(draftData.hardEndAt),
      graceSubmitAt: toIsoString(draftData.graceSubmitAt),
      instructions: Array.isArray(draftData.instructions)
        ? draftData.instructions.map((value) => String(value))
        : []
    },
    questions
  } satisfies PublishedExam;
}

export async function loadExamBundle(examId: string) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { doc, getDoc } = await import("firebase/firestore");
  const bundleSnapshot = await getDoc(doc(services.firestore, "examBundles", examId));

  if (!bundleSnapshot.exists()) {
    return null;
  }

  return mapExamBundle(bundleSnapshot.id, bundleSnapshot.data() as Record<string, unknown>);
}

export async function loadStudentWorkspace(uid: string) {
  const services = await getFirebaseServices();
  if (!services) {
    return { assignment: null, exam: null };
  }

  const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
  const assignmentSnapshots = await getDocs(
    query(
      collection(services.firestore, "users", uid, "examAssignments"),
      orderBy("startAt", "desc"),
      limit(12)
    )
  );

  if (assignmentSnapshots.empty) {
    return { assignment: null, exam: null };
  }

  const assignments = assignmentSnapshots.docs
    .map((assignmentSnapshot) =>
      mapAssignment(assignmentSnapshot.id, assignmentSnapshot.data() as Record<string, unknown>)
    )
    .sort((left, right) => {
      const leftTime = new Date(left.startAt).getTime();
      const rightTime = new Date(right.startAt).getTime();
      return rightTime - leftTime;
    });

  const activeAssignment = assignments.find((assignment) => assignment.status !== "submitted") || assignments[0];
  const exam = await loadExamBundle(activeAssignment.examId);

  return {
    assignment: activeAssignment,
    exam
  };
}

export async function publishExamToFirebase(
  exam: PublishedExam,
  facultyUid: string,
  studentUids: string[]
) {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error("Firebase is not configured.");
  }

  const { doc, serverTimestamp, writeBatch } = await import("firebase/firestore");
  const safeExam = createStudentSafeExam(exam);
  const assignmentTemplate = createAssignmentFromExam(exam);
  const sanitizedStudentUids = Array.from(
    new Set(
      studentUids
        .map((uid) => uid.trim())
        .filter(Boolean)
    )
  );

  const batch = writeBatch(services.firestore);
  const examDoc = doc(services.firestore, "examDrafts", exam.id);
  batch.set(
    examDoc,
    {
      examId: exam.id,
      title: exam.settings.title,
      subject: exam.settings.subject,
      courseCode: exam.settings.code,
      durationMinutes: exam.settings.durationMinutes,
      maxWarnings: exam.settings.maxWarnings,
      startAt: new Date(exam.settings.startAt),
      hardEndAt: new Date(exam.settings.hardEndAt),
      graceSubmitAt: new Date(exam.settings.graceSubmitAt),
      questionCount: exam.questions.length,
      instructions: exam.settings.instructions,
      published: true,
      bundleVersion: exam.bundleVersion,
      bundleSha256: exam.bundleHash,
      createdBy: facultyUid,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  exam.questions.forEach((question, index) => {
    batch.set(doc(services.firestore, "examDrafts", exam.id, "questions", question.id), {
      questionId: question.id,
      section: question.section,
      type: question.type,
      promptHtml: question.prompt,
      options: question.options.map((option) => ({
        id: option.id,
        labelHtml: option.label
      })),
      answerKey: question.correctOptionIds,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      order: index + 1,
      updatedAt: serverTimestamp()
    });
  });

  batch.set(
    doc(services.firestore, "answerKeys", exam.id),
    {
      examId: exam.id,
      bundleVersion: exam.bundleVersion,
      questionAnswers: Object.fromEntries(
        exam.questions.map((question) => [question.id, question.correctOptionIds])
      ),
      gradingPolicy: {
        negativeMarking: exam.questions.some((question) => question.negativeMarks > 0),
        partialCredit: false
      },
      createdBy: facultyUid,
      createdAt: serverTimestamp()
    },
    { merge: true }
  );

  batch.set(
    doc(services.firestore, "examBundles", exam.id),
    {
      examId: exam.id,
      title: safeExam.settings.title,
      subject: safeExam.settings.subject,
      courseCode: safeExam.settings.code,
      durationMinutes: safeExam.settings.durationMinutes,
      maxWarnings: safeExam.settings.maxWarnings,
      startAt: new Date(safeExam.settings.startAt),
      hardEndAt: new Date(safeExam.settings.hardEndAt),
      graceSubmitAt: new Date(safeExam.settings.graceSubmitAt),
      instructions: safeExam.settings.instructions,
      bundleVersion: safeExam.bundleVersion,
      bundleHash: safeExam.bundleHash,
      publishedAt: serverTimestamp(),
      createdBy: facultyUid,
      status: "published",
      questions: safeExam.questions
    },
    { merge: true }
  );

  sanitizedStudentUids.forEach((studentUid) => {
    batch.set(
      doc(services.firestore, "users", studentUid, "examAssignments", exam.id),
      {
        ...assignmentTemplate,
        uid: studentUid,
        status: "assigned",
        startAt: new Date(assignmentTemplate.startAt),
        hardEndAt: new Date(assignmentTemplate.hardEndAt),
        graceSubmitAt: new Date(assignmentTemplate.graceSubmitAt),
        bundleUrl: "",
        bundleSha256: exam.bundleHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        releaseKeyRef: `examReleaseKeys/${exam.id}`
      },
      { merge: true }
    );
  });

  await batch.commit();

  return {
    assignedCount: sanitizedStudentUids.length
  };
}

function mapStoredAttempt(data: Record<string, unknown>): StoredAttempt {
  const rawAnswers = (data.answers as Record<string, Record<string, unknown>> | undefined) || {};

  return {
    attemptId: String(data.attemptId || ""),
    examId: String(data.examId || ""),
    answers: Object.fromEntries(
      Object.entries(rawAnswers).map(([questionId, answer]) => [
        questionId,
        {
          value: Array.isArray(answer.value) ? answer.value.map((value) => String(value)) : [],
          markedForReview: Boolean(answer.markedForReview),
          updatedAt: toIsoString(answer.updatedAt)
        }
      ])
    ),
    warningCount: Number(data.warningCount || 0),
    lastWarningCode: typeof data.lastWarningCode === "string" ? data.lastWarningCode : null,
    status: String(data.status || "in_progress") as StoredAttempt["status"],
    startedAtMs: toMillis(data.startedAt),
    updatedAtMs: toMillis(data.lastSavedAt),
    finalizedAtMs: data.finalizedAt ? toMillis(data.finalizedAt) : undefined
  };
}

function buildSubmissionPayload(uid: string, exam: PublishedExam, attempt: StoredAttempt) {
  return {
    attemptId: attempt.attemptId,
    examId: exam.id,
    uid,
    status: attempt.status,
    bundleVersion: exam.bundleVersion,
    warningCount: attempt.warningCount,
    lastWarningCode: attempt.lastWarningCode,
    answers: Object.fromEntries(
      Object.entries(attempt.answers).map(([questionId, answer]) => [
        questionId,
        {
          value: answer.value,
          markedForReview: answer.markedForReview,
          updatedAt: answer.updatedAt
        }
      ])
    ),
    client: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      platform: typeof navigator !== "undefined" ? navigator.platform : "",
      appVersion: "web"
    },
    network: {
      offlineRecoveries: 0,
      lastOnlineAt: typeof navigator !== "undefined" && navigator.onLine ? new Date().toISOString() : null
    },
    proctoring: {
      tabSwitches: 0,
      fullscreenExits: 0,
      shortcutAttempts: 0
    },
    score: {
      objective: 0,
      manual: 0,
      total: 0,
      published: false
    }
  };
}

export async function loadRemoteAttempt(examId: string, uid: string) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { doc, getDoc } = await import("firebase/firestore");
  const submissionSnapshot = await getDoc(doc(services.firestore, "submissions", `${examId}_${uid}`));

  if (!submissionSnapshot.exists()) {
    return null;
  }

  return mapStoredAttempt(submissionSnapshot.data() as Record<string, unknown>);
}

async function loadUserDirectory(uids: string[]) {
  const services = await getFirebaseServices();
  if (!services || uids.length === 0) {
    return new Map<string, { name: string; email: string }>();
  }

  const { collection, documentId, getDocs, query, where } = await import("firebase/firestore");
  const directory = new Map<string, { name: string; email: string }>();

  for (const uidChunk of chunkValues(Array.from(new Set(uids)), 30)) {
    const userSnapshots = await getDocs(
      query(collection(services.firestore, "users"), where(documentId(), "in", uidChunk))
    );

    userSnapshots.docs.forEach((userSnapshot) => {
      const data = userSnapshot.data() as Record<string, unknown>;
      directory.set(userSnapshot.id, {
        name: String(data.name || userSnapshot.id),
        email: String(data.email || "")
      });
    });
  }

  return directory;
}

export async function loadSubmissionReviews(exam: PublishedExam) {
  const services = await getFirebaseServices();
  if (!services) {
    return [] satisfies SubmissionReview[];
  }

  const { collection, getDocs, limit, orderBy, query, where } = await import("firebase/firestore");
  const submissionSnapshots = await getDocs(
    query(
      collection(services.firestore, "submissions"),
      where("examId", "==", exam.id),
      orderBy("lastSavedAt", "desc"),
      limit(250)
    )
  );

  if (submissionSnapshots.empty) {
    return [] satisfies SubmissionReview[];
  }

  const userDirectory = await loadUserDirectory(
    submissionSnapshots.docs.map((submissionSnapshot) => {
      const data = submissionSnapshot.data() as Record<string, unknown>;
      return String(data.uid || "");
    })
  );

  return submissionSnapshots.docs.map((submissionSnapshot) => {
    const data = submissionSnapshot.data() as Record<string, unknown>;
    const uid = String(data.uid || "");
    const directoryEntry = userDirectory.get(uid);

    return buildSubmissionReview({
      exam,
      attempt: mapStoredAttempt(data),
      uid,
      studentName: directoryEntry?.name || uid,
      studentEmail: directoryEntry?.email || "",
      status: String(data.status || "in_progress") as SubmissionReview["status"],
      startedAt: toIsoString(data.startedAt),
      lastSavedAt: toIsoString(data.lastSavedAt),
      finalizedAt: data.finalizedAt ? toIsoString(data.finalizedAt) : undefined,
      score: mapSubmissionScore(data.score)
    });
  });
}

export async function publishObjectiveResults(exam: PublishedExam) {
  const services = await getFirebaseServices();
  if (!services) {
    return { publishedCount: 0 };
  }

  const { collection, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch } =
    await import("firebase/firestore");
  const submissionSnapshots = await getDocs(
    query(
      collection(services.firestore, "submissions"),
      where("examId", "==", exam.id),
      orderBy("lastSavedAt", "desc"),
      limit(250)
    )
  );

  const eligibleSnapshots = submissionSnapshots.docs.filter((submissionSnapshot) => {
    const data = submissionSnapshot.data() as Record<string, unknown>;
    const status = String(data.status || "in_progress");
    return status === "submitted" || status === "auto_submitted" || status === "graded";
  });

  for (const snapshotChunk of chunkValues(eligibleSnapshots, 400)) {
    const batch = writeBatch(services.firestore);

    snapshotChunk.forEach((submissionSnapshot) => {
      const data = submissionSnapshot.data() as Record<string, unknown>;
      const attempt = mapStoredAttempt(data);
      const currentScore = mapSubmissionScore(data.score);
      const review = buildSubmissionReview({
        exam,
        attempt,
        uid: String(data.uid || ""),
        studentName: "",
        studentEmail: "",
        status: "graded",
        startedAt: toIsoString(data.startedAt),
        lastSavedAt: toIsoString(data.lastSavedAt),
        finalizedAt: data.finalizedAt ? toIsoString(data.finalizedAt) : undefined,
        score: {
          ...currentScore,
          published: true
        }
      });

      batch.set(
        submissionSnapshot.ref,
        {
          status: "graded",
          score: {
            objective: review.objectiveScore,
            manual: currentScore.manual,
            total: Number((review.objectiveScore + currentScore.manual).toFixed(2)),
            published: true
          },
          reviewedAt: serverTimestamp()
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  return {
    publishedCount: eligibleSnapshots.length
  };
}

export async function createRemoteAttempt(uid: string, exam: PublishedExam, attempt: StoredAttempt) {
  const services = await getFirebaseServices();
  if (!services) {
    return;
  }

  const { doc, serverTimestamp, setDoc } = await import("firebase/firestore");
  const submissionRef = doc(services.firestore, "submissions", `${exam.id}_${uid}`);
  await setDoc(submissionRef, {
    ...buildSubmissionPayload(uid, exam, attempt),
    status: "in_progress",
    startedAt: serverTimestamp(),
    lastSavedAt: serverTimestamp(),
    finalizedAt: null
  });
}

export async function syncRemoteAttempt(uid: string, exam: PublishedExam, attempt: StoredAttempt) {
  const services = await getFirebaseServices();
  if (!services) {
    return;
  }

  const { doc, serverTimestamp, setDoc } = await import("firebase/firestore");
  const submissionRef = doc(services.firestore, "submissions", `${exam.id}_${uid}`);
  await setDoc(
    submissionRef,
    {
      ...buildSubmissionPayload(uid, exam, attempt),
      lastSavedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function finalizeRemoteAttempt(uid: string, exam: PublishedExam, attempt: StoredAttempt) {
  const services = await getFirebaseServices();
  if (!services) {
    return;
  }

  const { doc, serverTimestamp, setDoc } = await import("firebase/firestore");
  const submissionRef = doc(services.firestore, "submissions", `${exam.id}_${uid}`);
  await setDoc(
    submissionRef,
    {
      ...buildSubmissionPayload(uid, exam, attempt),
      lastSavedAt: serverTimestamp(),
      finalizedAt: serverTimestamp()
    },
    { merge: true }
  );
}
