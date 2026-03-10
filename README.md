# OneTest Secure Portal

OneTest is a mobile-first online examination portal built around a Spark-safe architecture: local-first exam delivery, sparse writes, offline bundle caching, and a faculty workflow that publishes secure question bundles instead of serving questions document by document.

## Current state

The repo now contains:

- a React + TypeScript + Vite PWA application
- a mobile-focused student exam runner with `useExamLockdown`
- a faculty publishing console with CSV and Excel intake
- Firestore and Realtime Database rules templates
- architecture and schema docs for the Firebase deployment path

## Run locally

```bash
npm install
npm run dev
```

If Firebase environment variables are not set, the app runs in `demo mode` with seeded data and local IndexedDB storage.

## Firebase mode

Copy `.env.example` into `.env` and fill these values:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

The current frontend already detects whether Firebase is configured. When those values are present, the app switches out of demo labeling and can be wired to real Auth and Firestore flows.

For local admin and provisioning scripts, set one of these before running them:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY=./service-account.json
```

or

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

## Build and deploy

```bash
npm run lint
npm run build
```

Firebase config files already exist:

- `firebase.json`
- `firestore.rules`
- `database.rules.json`
- `firestore.indexes.json`

Typical Hosting deploy flow:

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy --only hosting,firestore:rules,firestore:indexes,database
```

## Provision users

Bootstrap the first admin or faculty account:

```bash
npm run bootstrap:user -- --email admin@college.edu --password ChangeMe123! --role admin
```

Bulk import users from CSV:

```bash
npm run import:users -- --file ./ops/users.sample.csv
```

The scripts create or update Firebase Auth users, apply custom role claims, and sync `users/{uid}` Firestore profile documents.

## Key files

- `src/App.tsx`: app shell and route-level lazy loading
- `src/pages/FacultyPage.tsx`: faculty publishing workflow
- `src/pages/StudentDashboardPage.tsx`: student prefetch and launch flow
- `src/pages/ExamSessionPage.tsx`: exam runner, palette, bottom bar, and submission handling
- `src/hooks/useExamLockdown.ts`: timer, warnings, shortcut blocking, checkpoints, and auto-submit
- `src/lib/examVault.ts`: IndexedDB bundle and attempt storage
- `docs/architecture.md`: Spark-tier strategy and deployment tradeoffs
- `docs/firestore-schema.jsonc`: JSON-like schema reference
- `docs/operations.md`: Firebase setup, user provisioning, and deployment flow
- `scripts/import-users.mjs`: bulk CSV import for Firebase Auth and Firestore profiles
- `scripts/bootstrap-user.mjs`: create the first admin or faculty account

## Reality check

As of March 10, 2026, two requested capabilities are still not Spark-compatible:

- Realtime Database on Spark supports only `100` simultaneous connections
- Cloud Functions production deployment requires `Blaze`

That means this MVP is intentionally built around:

- encrypted bundle prefetch
- local attempt persistence
- sparse Firestore submission writes
- delayed or faculty-side grading until a Blaze upgrade exists

## Sources

- Firebase pricing: https://firebase.google.com/pricing
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Realtime Database limits: https://firebase.google.com/docs/database/usage/limits
- Cloud Functions setup: https://firebase.google.com/docs/functions/get-started
- Auth user import: https://firebase.google.com/docs/auth/admin/import-users
- Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
