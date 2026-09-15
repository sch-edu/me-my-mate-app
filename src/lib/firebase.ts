import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, setDoc } from 'firebase/firestore';
import type { Knight } from '@/types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

const SIMULATED_USER_KEY = 'memy-mate-simulated-user-v1';
const SIMULATED_CLOUD_PREFIX = 'memy-mate-cloud-sim-';
const SHARED_KEY = 'memy-mate-shared-v1';

let simulatedUserListeners: Array<(user: User | null) => void> = [];

function getSimulatedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SIMULATED_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function setSimulatedUser(user: User | null): void {
  if (typeof window !== 'undefined') {
    if (user) {
      window.localStorage.setItem(SIMULATED_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(SIMULATED_USER_KEY);
    }
  }
  simulatedUserListeners.forEach((fn) => {
    try {
      fn(user);
    } catch (err) {
      console.warn('Error in auth listener', err);
    }
  });
}

function getServices() {
  if (!firebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void): () => void {
  const services = getServices();
  if (services) {
    return onAuthStateChanged(services.auth, callback);
  }
  simulatedUserListeners.push(callback);
  callback(getSimulatedUser());
  return () => {
    simulatedUserListeners = simulatedUserListeners.filter((fn) => fn !== callback);
  };
}

export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  const services = getServices();
  if (services) {
    const cred = await createUserWithEmailAndPassword(services.auth, email, pass);
    return cred.user;
  }
  // Simulated offline user when Firebase env credentials are not provided
  const now = new Date().toISOString();
  const mockUser = {
    uid: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email,
    isAnonymous: false,
    metadata: {
      creationTime: now,
      lastSignInTime: now,
    },
  } as unknown as User;
  setSimulatedUser(mockUser);
  return mockUser;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const services = getServices();
  if (services) {
    const cred = await signInWithEmailAndPassword(services.auth, email, pass);
    return cred.user;
  }
  const existing = getSimulatedUser();
  if (existing && existing.email === email) {
    return existing;
  }
  const now = new Date().toISOString();
  const mockUser = {
    uid: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email,
    isAnonymous: false,
    metadata: {
      creationTime: now,
      lastSignInTime: now,
    },
  } as unknown as User;
  setSimulatedUser(mockUser);
  return mockUser;
}

export async function logOut(): Promise<void> {
  const services = getServices();
  if (services) {
    await firebaseSignOut(services.auth);
    return;
  }
  setSimulatedUser(null);
}

export async function loadCloudKnights(userId: string): Promise<Knight[]> {
  const services = getServices();
  if (services) {
    const snapshot = await getDocs(collection(services.db, 'users', userId, 'knights'));
    return snapshot.docs.map((item) => item.data() as Knight);
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${SIMULATED_CLOUD_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Knight[]) : [];
  } catch {
    return [];
  }
}

export async function saveCloudKnight(userId: string, knight: Knight): Promise<void> {
  const services = getServices();
  if (services) {
    await setDoc(doc(services.db, 'users', userId, 'knights', knight.id), knight);
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    const key = `${SIMULATED_CLOUD_PREFIX}${userId}`;
    const current = JSON.parse(window.localStorage.getItem(key) || '[]') as Knight[];
    const filtered = current.filter((item) => item.id !== knight.id);
    window.localStorage.setItem(key, JSON.stringify([knight, ...filtered]));
  } catch {
    // Storage unavailable
  }
}

export async function saveSharedKnight(userId: string, knight: Knight): Promise<void> {
  const services = getServices();
  const payload = {
    ...knight,
    ownerId: userId,
    sharedAt: new Date().toISOString(),
  };

  if (services) {
    await setDoc(doc(services.db, 'sharedKnights', knight.id), payload);
  }

  // Also preserve locally as fallback
  if (typeof window !== 'undefined') {
    try {
      const current = JSON.parse(window.localStorage.getItem(SHARED_KEY) || '{}') as Record<string, Knight>;
      window.localStorage.setItem(SHARED_KEY, JSON.stringify({ ...current, [knight.id]: knight }));
    } catch {
      // Storage unavailable
    }
  }
}

export async function loadSharedKnight(knightId: string): Promise<Knight | null> {
  const services = getServices();
  if (services) {
    try {
      const snapshot = await getDoc(doc(services.db, 'sharedKnights', knightId));
      if (snapshot.exists()) {
        return snapshot.data() as Knight;
      }
    } catch (err) {
      console.warn('Error fetching shared knight from Firestore', err);
    }
  }
  if (typeof window === 'undefined') return null;
  try {
    const current = JSON.parse(window.localStorage.getItem(SHARED_KEY) || '{}') as Record<string, Knight>;
    return current[knightId] ?? null;
  } catch {
    return null;
  }
}
