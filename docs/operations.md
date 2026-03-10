# OneTest Operations

This project now includes the minimum operator tooling required to move from local demo mode to a Firebase-backed staging deployment.

## 1. Firebase project setup

1. Create a Firebase project.
2. Enable `Authentication -> Email/Password`.
3. Create a Web App and copy the config into `.env`.
4. Generate a service account key for local admin scripts, then set either:
   - `FIREBASE_SERVICE_ACCOUNT_KEY=./service-account.json`
   - or `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`

## 2. Frontend environment

Create `.env` from `.env.example`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## 3. Deploy rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,database
```

## 4. Bootstrap the first admin or faculty user

```bash
npm run bootstrap:user -- \
  --email admin@college.edu \
  --password ChangeMe123! \
  --name "Portal Admin" \
  --role admin
```

This script creates or updates:

- Firebase Auth email/password account
- custom role claim
- `users/{uid}` Firestore profile

## 5. Bulk import faculty or students

Use `ops/users.sample.csv` as the template:

```bash
npm run import:users -- --file ./ops/users.sample.csv
```

Supported CSV columns:

- `email`
- `password`
- `uid`
- `name`
- `role`
- `collegeId`
- `department`
- `semester`
- `seatNumber`
- `active`

Notes:

- `email` is required for every row.
- `password` is required only when creating a new Firebase Auth user.
- `role` defaults to `student` unless `--default-role` is supplied.

## 6. Publish the frontend

```bash
npm run build
firebase deploy --only hosting
```

## 7. Faculty publishing flow

Once the first faculty user can sign in:

1. Open `/faculty`
2. Import CSV or XLSX questions
3. Set exam window and warning policy
4. Paste target student UIDs
5. Publish the bundle

Publishing writes:

- `examDrafts/{examId}`
- `examDrafts/{examId}/questions/{questionId}`
- `answerKeys/{examId}`
- `examBundles/{examId}`
- `users/{uid}/examAssignments/{examId}`

## 8. Student launch checklist

1. Student signs in with Email/Password Auth
2. `users/{uid}` profile exists with role `student`
3. `users/{uid}/examAssignments/{examId}` exists
4. Student opens `/student`
5. Student prefetched bundle before the exam window if possible
