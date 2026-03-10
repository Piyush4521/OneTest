# OneTest Architecture

## Executive summary

`OneTest` can support a large exam day on Firebase Spark only if it behaves like a mostly local-first application. The backend cannot be chatty.

What works on Spark:

- React PWA with a mobile-first exam shell
- Firebase Auth for sign-in and role-based access
- Firestore for assignment metadata, release control, and sparse submissions
- static encrypted exam bundles prefetched before the exam
- local answer persistence with batched checkpoints

What does not cleanly work on Spark:

- true live monitoring for all 5,000 students with Realtime Database
- production Cloud Functions for grading
- per-question Firestore reads
- frequent autosave writes

## Non-negotiable constraints

As of March 10, 2026, official Firebase docs state:

- Firestore free quota is `50,000` reads/day, `20,000` writes/day, and `10 GiB` outbound/month
- Realtime Database on Spark allows only `100` simultaneous connections
- Cloud Functions production deployment requires the `Blaze` plan

Those three limits drive the entire design.

## Core architecture

### 1. Auth and roles

- Use Firebase Email/Password Auth.
- Import student accounts in bulk with an admin script that reads CSV and sets custom claims such as `role=student`, `collegeId`, `examGroup`, and `department`.
- Use custom claims in security rules to avoid extra Firestore reads on every request.

### 2. Faculty publishing flow

1. Faculty uploads CSV or Excel into the dashboard.
2. The client parses rows into draft question documents under `examDrafts/{examId}/questions/{questionId}`.
3. On publish, the dashboard builds two artifacts:
   - a student-safe encrypted question bundle without answers
   - a faculty-only answer key document
4. The encrypted bundle is uploaded as a static asset and cached aggressively.
5. Each assigned student gets one assignment doc with schedule, bundle metadata, and warning policy.

The important shift is this: Firestore stores metadata and control state, not the live question-by-question delivery path.

### 3. Student exam flow

1. Student signs in and reads only:
   - own user profile
   - own exam assignment
   - one release key doc at start time
2. Before the exam, the app prefetches the encrypted bundle and stores it locally.
3. At exam start, the client reads the release key, decrypts the bundle locally, and creates one submission doc.
4. During the exam, navigation and answer changes remain local.
5. The app writes sparse checkpoints only when needed.
6. Final submit writes once and locks the attempt.

### 4. Why not localStorage

Use `IndexedDB` plus `Web Crypto`, not `localStorage`.

- `localStorage` is synchronous and blocks the UI
- storage size is too small for robust offline bundles
- IndexedDB survives reloads better and works naturally with PWA caching
- encryption keys can be rotated per exam attempt

### 5. Staggered loading strategy

The anti-herd plan is:

- `T-30 to T-5 minutes`: students log in, receive assignment metadata, and prefetch the encrypted bundle
- each client waits a randomized `0-180` second jitter before downloading the bundle
- the bundle is served from Hosting, not Firestore
- `T-0`: the client reads one tiny release-key document and creates one submission document
- during the exam, answers stay local and only checkpoints flush to Firestore

This avoids a thundering herd of `5,000 x 50` question reads.

## Spark-tier scaling math

### Firestore reads

A Spark-safe exam target should stay near `3-4` reads per student:

- `1` read: profile
- `1` read: assignment
- `1` read: release key
- optional `1` read: resume existing submission

For `5,000` students, that is roughly `15,000-20,000` reads, which fits under `50,000` reads/day.

What breaks the quota:

- reading `50` questions individually would cost `250,000` reads for one exam
- live polling dashboards multiply reads quickly

### Firestore writes

A Spark-safe exam target should stay near `3` writes per student:

- `1` write: create submission at start
- `1` write: one checkpoint during the exam
- `1` write: final submit

For `5,000` students, that is `15,000` writes/day. That leaves only `5,000` writes for warnings, faculty operations, and retries.

This is why the app must keep answers local and batch writes aggressively.

### Outbound bandwidth

Firestore outbound is only `10 GiB` per month on Spark. The exam payload therefore cannot be large.

Practical target:

- keep the app shell plus encrypted bundle under about `1-1.5 MiB` per student for large exam days
- compress images hard or avoid them
- keep questions primarily text-based

If you expect image-heavy tests or frequent exams, Spark stops being realistic.

## Live monitoring strategy

The requested Realtime Database monitoring model is not compatible with `5,000` concurrent students on Spark because Spark allows only `100` simultaneous RTDB connections.

Spark-safe replacement:

- write warning counters and last-seen timestamps into each student's submission doc
- show faculty a coarse-grained board: `not started`, `in progress`, `flagged`, `submitted`
- only push high-risk events, not heartbeat streams

Upgrade-path monitoring:

- move invigilation to Realtime Database or Blaze-backed fan-out only after upgrading
- keep RTDB for invigilators and flagged-event streams, not continuous 5,000-user presence on Spark

## Security posture

### Strong protections

- exam release controlled by Firestore rules and `request.time`
- student can only read their own assignment and submission
- answer keys remain in faculty-only documents
- final submissions become immutable
- server-authoritative timestamps come from `serverTimestamp()`

### Deterrents, not guarantees

Web apps cannot fully prevent:

- screenshots
- browser devtools access
- external phone cameras
- OS-level assistive capture tools

You can still deter abuse by:

- blocking right-click, copy, paste, and print shortcuts
- warning on tab switches and fullscreen exits
- watermarking the candidate identity on the screen
- logging suspicious events and auto-submitting after threshold breaches

If this exam is high stakes, add a lab-based kiosk mode or Safe Exam Browser on managed devices. A normal browser alone is not an ironclad lockdown environment.

## Grading model

### Spark-safe model

- student submissions are stored in Firestore
- answer keys are readable only by faculty
- grading runs from a trusted faculty console after the exam closes
- results are published back to Firestore after review

This is workable, but it is not equivalent to server-side grading.

### Hardened model

If you need real server-side grading, signed result publication, or audit-grade anti-tamper workflows, move to `Blaze` and grade in Cloud Functions.

## PWA and mobile UX

Recommended client behavior:

- installable PWA with service worker precache
- exam shell optimized for portrait mobile and small tablets
- sticky bottom navigation with `Previous`, `Mark for Review`, and `Next`
- question palette as a bottom sheet for fast jumps
- large tap targets and high-contrast colors
- offline queue for checkpoints and final submit retry

Important tradeoff:

- if you allow a post-deadline upload grace window for offline recovery, a hostile client can attempt post-deadline edits
- if you disallow grace entirely, a real network outage may cost the student their final sync

On Spark, there is no perfect answer to that tradeoff without adding a trusted backend.

## Best additions

1. Use App Check to reduce scripted abuse against public endpoints.
2. Stamp every exam bundle with `bundleVersion` and `sha256` so the client verifies integrity before opening.
3. Add screen watermarking with student name, UID, and timestamp.
4. Record only capped warning summaries in Firestore, not full event streams.
5. Use Firebase Emulator Suite to test rules and exam timing before production.
6. Add a seat or device binding field in the assignment doc for lab-controlled exams.
7. Keep question assets text-first and image-light to preserve Spark bandwidth.

## Recommended roadmap

### Phase 1: Spark-safe MVP

- auth import
- faculty draft and publish flow
- encrypted bundle prefetch
- local-first exam runner
- sparse Firestore submission writes
- faculty review and manual grade publication

### Phase 2: Hardening

- App Check
- richer invigilator dashboard
- better audit trails
- device binding

### Phase 3: Blaze upgrade

- Cloud Functions grading
- scheduled key release automation
- scalable real-time monitoring

## Sources

- Firebase pricing: https://firebase.google.com/pricing
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Realtime Database limits: https://firebase.google.com/docs/database/usage/limits
- Cloud Functions setup: https://firebase.google.com/docs/functions/get-started
- Auth user import: https://firebase.google.com/docs/auth/admin/import-users
- Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
