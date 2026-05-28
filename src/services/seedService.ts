import { db } from '../lib/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';

export async function seedFirebaseFromLocal(localData: any) {
  const collections = Object.keys(localData);
  
  for (const collectionName of collections) {
    const dataArray = localData[collectionName];
    if (!Array.isArray(dataArray)) continue;
    
    // Check if collection already has data
    const snapshot = await getDocs(collection(db, collectionName));
    if (snapshot.empty) {
      console.log(`Seeding ${collectionName}...`);
      for (const item of dataArray) {
        const id = item.id || Math.random().toString(36).substring(7);
        const { id: _, ...itemData } = item;
        // Ensure admin user keeps their role if seeding users
        if (collectionName === 'users' && (itemData.username === 'admin' || itemData.email === 'seneiaislam@gmail.com')) {
          itemData.role = 'admin';
        }
        await setDoc(doc(db, collectionName, id), itemData);
      }
      console.log(`Seeded ${collectionName} successfully.`);
    } else {
      console.log(`Collection ${collectionName} already has data, skipping seeding.`);
    }
  }
}
