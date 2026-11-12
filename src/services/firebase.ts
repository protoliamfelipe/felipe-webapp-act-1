import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
  getDocFromServer,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, FileRecord } from '../types';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline check: please verify configuration.');
    }
  }
}
testConnection();

// Firebase User & Data Management
export const fbService = {
  // Sign in with Google Popup
  async signInWithGoogle(): Promise<User> {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    const userDocRef = doc(db, 'users', fbUser.uid);

    let profile: User;
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        profile = snap.data() as User;
      } else {
        profile = {
          id: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || 'Designer',
          role: 'freelancer',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, profile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
      throw err;
    }

    return profile;
  },

  // Sign up with Email & Password
  async signUpWithEmail(data: {
    email: string;
    password: string;
    name: string;
    role: 'freelancer' | 'client';
    company?: string;
  }): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const fbUser = cred.user;
    const userDocRef = doc(db, 'users', fbUser.uid);

    const profile: User = {
      id: fbUser.uid,
      email: fbUser.email || data.email,
      name: data.name.trim(),
      role: data.role,
      company: data.company?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(userDocRef, profile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
      throw err;
    }

    return profile;
  },

  // Sign in with Email & Password
  async signInWithEmail(email: string, pass: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const fbUser = cred.user;
    const userDocRef = doc(db, 'users', fbUser.uid);

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        return snap.data() as User;
      }
      // If profile doesn't exist yet, create default
      const profile: User = {
        id: fbUser.uid,
        email: fbUser.email || email,
        name: fbUser.displayName || email.split('@')[0],
        role: 'freelancer',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, profile);
      return profile;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
      throw err;
    }
  },

  // Sign Out
  async signOutUser(): Promise<void> {
    await signOut(auth);
  },

  // Fetch current user files
  async getUserFiles(userId: string): Promise<FileRecord[]> {
    const filesPath = 'files';
    try {
      const q = query(collection(db, filesPath), where('userId', '==', userId));
      const snap = await getDocs(q);
      const list: FileRecord[] = [];
      snap.forEach((d) => {
        list.push(d.data() as FileRecord);
      });
      // Sort client side by newest
      list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, filesPath);
      return [];
    }
  },

  // Save new file record to Firestore
  async saveFileRecord(record: FileRecord): Promise<void> {
    const docPath = `files/${record.id}`;
    try {
      await setDoc(doc(db, 'files', record.id), record);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    }
  },

  // Delete file record from Firestore
  async deleteFileRecord(fileId: string): Promise<void> {
    const docPath = `files/${fileId}`;
    try {
      await deleteDoc(doc(db, 'files', fileId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  },

  // Increment download counter
  async incrementDownloadCount(fileId: string, currentCount: number): Promise<void> {
    const docPath = `files/${fileId}`;
    try {
      await updateDoc(doc(db, 'files', fileId), {
        downloadsCount: currentCount + 1,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  },
};
