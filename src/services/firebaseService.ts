import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDocFromCache,
  getDocsFromCache,
  getDocFromServer,
  getDocsFromServer
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export const firebaseService = {
  // Generic methods
  async getDocument(collectionName: string, id: string) {
    const docRef = doc(db, collectionName, id);
    try {
      // Prefer cache for speed and quota savings
      try {
        const cachedSnap = await getDocFromCache(docRef);
        if (cachedSnap.exists()) return { id: cachedSnap.id, ...cachedSnap.data() };
      } catch (cacheErr) {
        // Not in cache, proceed to server
      }
      
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('Quota limit exceeded'))) {
        console.warn(`Firestore Quota exceeded for ${collectionName}/${id}. Attempting to return stale cache or null.`);
        try {
          const cachedSnap = await getDocFromCache(docRef);
          return cachedSnap.exists() ? { id: cachedSnap.id, ...cachedSnap.data() } : null;
        } catch (e) {
          return null; // Return null when quota is exceeded and no cache is available.
        }
      }
      handleFirestoreError(error, OperationType.GET, `${collectionName}/${id}`);
      return null;
    }
  },

  async getCollection(collectionName: string) {
    const colRef = collection(db, collectionName);
    try {
      // Default getDocs handles cache/server balance correctly
      const querySnapshot = await getDocs(colRef);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('Quota limit exceeded'))) {
        console.warn(`Firestore Quota exceeded for collection ${collectionName}. Returning cache if available, else empty.`);
        try {
          const cachedSnapshot = await getDocsFromCache(colRef);
          return cachedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
          return [];
        }
      }
      handleFirestoreError(error, OperationType.LIST, collectionName);
      return [];
    }
  },

  async addDocument(collectionName: string, id: string, data: any) {
    try {
      await setDoc(doc(db, collectionName, id), data);
      return { id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${collectionName}/${id}`);
    }
  },

  async updateDocument(collectionName: string, id: string, data: any) {
    try {
      await updateDoc(doc(db, collectionName, id), data);
      return { id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  },

  async deleteDocument(collectionName: string, id: string) {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  }
};
