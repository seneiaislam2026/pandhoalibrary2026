import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };
const app = initializeApp(firebaseConfig);

// Use persistent local cache if supported
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Test connection on boot as per guidelines
export async function testConnection() {
  const cacheKey = 'fb_conn_test';
  const lastTest = sessionStorage.getItem(cacheKey);
  if (lastTest && Date.now() - parseInt(lastTest) < 60 * 60 * 1000) return; // Only once per hour per session

  try {
    const { getDoc } = await import('firebase/firestore');
    await getDoc(doc(db, 'test', 'connection')); // Use getDoc instead of getDocFromServer to prefer cache
    sessionStorage.setItem(cacheKey, Date.now().toString());
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    } else if (error instanceof Error && error.message.includes('Quota exceeded')) {
      console.warn("Firestore Quota exceeded - connection test skipped.");
    } else {
      console.error("Firebase connection test error:", error);
    }
  }
}
testConnection();

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('Quota exceeded') || errorMessage.includes('Quota limit exceeded')) {
    console.warn(`Firestore Quota Exceeded for ${operationType} on ${path}. Falling back where applicable.`);
    throw new Error(errorMessage);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}
