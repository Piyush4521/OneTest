import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

let servicesPromise: Promise<FirebaseServices | null> | null = null;

export async function getFirebaseServices() {
  if (!firebaseConfigured) {
    return null;
  }

  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [{ getApp, getApps, initializeApp }, { getAuth }, { getFirestore }] =
        await Promise.all([
          import("firebase/app"),
          import("firebase/auth"),
          import("firebase/firestore")
        ]);

      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

      return {
        app,
        auth: getAuth(app),
        firestore: getFirestore(app)
      };
    })();
  }

  return servicesPromise;
}
