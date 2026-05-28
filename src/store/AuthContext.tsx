import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, query, collection, where, getDocs, limit } from 'firebase/firestore';

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  email?: string;
  memberId?: string;
  phone?: string;
  address?: string;
  avatar?: string;
  borrowBlocked?: boolean;
  status?: string;
  password?: string; // Only for manual users, stored in Firestore
  hasGiftSubscription?: boolean;
  giftSubscriptionExpiry?: string | null;
  createdAt?: any;
  subadminAccess?: string[];
  dob?: string;
  class?: string;
  fatherName?: string;
  institution?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  loginWithUsername: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  loginWithUsername: async () => {},
  logout: () => {},
  updateUser: () => {},
  loading: true
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    let unsubscribeProfileSubscription: (() => void) | null = null;

    const fetchAndUpdateProfile = async (uid: string, isManual = false, initialData?: User) => {
      try {
        const { getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        
        if (!isSubscribed) return;

        if (docSnap.exists()) {
          const data = docSnap.data() as User;
          const isSuperAdmin = 
            data.email === 'seneiaislam@gmail.com' || 
            data.email === 'admin@library.com' || 
            data.email === 'admin_master@library.com' ||
            data.email === 'seneiaislam@library.com' ||
            data.username === 'admin' ||
            data.username === 'seneiaislam';
            
          const finalUser = { ...data, id: uid };
          if (isSuperAdmin) finalUser.role = 'admin';

          if (!isManual && finalUser.status === 'pending' && !isSuperAdmin) {
            setUser(null);
            setToken(null);
            signOut(auth);
          } else {
            setUser(finalUser);
            if (!isManual) {
              localStorage.setItem(`auth_user_${uid}`, JSON.stringify(data));
              localStorage.setItem(`auth_user_time_${uid}`, Date.now().toString());
            }
          }
        } else if (initialData) {
          setUser(initialData);
        }
      } catch (err) {
        console.warn("Profile fetch error:", err);
        if (initialData) setUser(initialData);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        localStorage.removeItem('pandho_manual_user');
        const idToken = await firebaseUser.getIdToken();
        
        if (isSubscribed) {
          setToken(idToken);
        }
        
        const cachedProfile = localStorage.getItem(`auth_user_${firebaseUser.uid}`);
        const cacheTime = localStorage.getItem(`auth_user_time_${firebaseUser.uid}`);
        
        if (cachedProfile && cacheTime && (Date.now() - parseInt(cacheTime) < 60 * 60 * 1000)) {
          const data = JSON.parse(cachedProfile);
          if (isSubscribed) {
            setUser({ ...data, id: firebaseUser.uid, email: firebaseUser.email || data.email });
            setLoading(false);
          }
          // Still fetch fresh in background
          fetchAndUpdateProfile(firebaseUser.uid);
        } else {
          const userEmail = firebaseUser.email || '';
          const isSuperAdminFallback = 
            userEmail === 'seneiaislam@gmail.com' || 
            userEmail === 'admin@library.com' || 
            userEmail === 'admin_master@library.com' ||
            userEmail === 'seneiaislam@library.com';
          const isKioskFallback = userEmail === 'librarypc@library.com';

          fetchAndUpdateProfile(firebaseUser.uid, false, {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || (isSuperAdminFallback ? 'System Admin' : (isKioskFallback ? 'Library Kiosk' : 'User')),
            username: userEmail.split('@')[0] || '',
            email: userEmail || undefined,
            role: isSuperAdminFallback ? 'admin' : (isKioskFallback ? 'kiosk' : 'reader')
          });
        }
      } else {
        const savedManualUser = localStorage.getItem('pandho_manual_user');
        if (savedManualUser) {
          try {
            const parsed = JSON.parse(savedManualUser);
            if (isSubscribed) {
              setUser(parsed);
              setToken('manual_session');
            }
            fetchAndUpdateProfile(parsed.id, true);
          } catch (e) {
            localStorage.removeItem('pandho_manual_user');
            if (isSubscribed) {
              setUser(null);
              setToken(null);
              setLoading(false);
            }
          }
        } else {
          if (isSubscribed) {
            setUser(null);
            setToken(null);
            setLoading(false);
          }
        }
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribeAuth();
      if (unsubscribeProfileSubscription) unsubscribeProfileSubscription();
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

    const loginWithUsername = async (username: string, pass: string) => {
    const usernameLower = username.toLowerCase().trim();
    
    if (usernameLower === 'admin' || usernameLower === 'seneiaislam' || usernameLower === 'seneiaislam@gmail.com') {
       // Allow normal Firebase auth checks
       // if (pass !== 'pandhoalibrary@28052020') {
       //    throw new Error('ভুল পাসওয়ার্ড! অ্যাডমিন হিসেবে লগইন করতে সঠিক পাসওয়ার্ড দিন।');
       // }
    }
    
    const emailToSignIn = `${usernameLower}@library.com`;
    
    try {
      // Try to sign in with Firebase Auth first
      // This ensures request.auth is established for Firestore rules
      const userCred = await signInWithEmailAndPassword(auth, emailToSignIn, pass);
      const firebaseUser = userCred.user;
      
      // The onAuthStateChanged listener in useEffect will handle fetching the profile
      // and setting the user state. We just need to wait or return.
      console.log("Logged in with Firebase Auth for username:", usernameLower);
    } catch (authError: any) {
      console.warn("Firebase Auth sign-in failed, falling back to manual Firestore check:", authError.message);
      
      // Fallback: Manual Firestore check (for older users or sync issues)
      let q = query(collection(db, "users"), where("username", "==", username), limit(1));
      let querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty && username !== usernameLower) {
        q = query(collection(db, "users"), where("username", "==", usernameLower), limit(1));
        querySnapshot = await getDocs(q);
      }
      
      const isMasterAdmin = (usernameLower === 'admin' || usernameLower === 'seneiaislam' || usernameLower === 'seneiaislam@gmail.com') && pass === 'pandhoalibrary@28052020';
      
      if (querySnapshot.empty) {
        if (isMasterAdmin) {
           const fullUser = {
              username: usernameLower,
              name: 'System Admin',
              role: 'admin',
              id: 'admin_master_uid',
              status: 'active'
           } as any;
           setUser(fullUser);
           setToken('manual_session');
           localStorage.setItem('pandho_manual_user', JSON.stringify(fullUser));
           return;
        }
        throw new Error("User not found");
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as User;
      
      if (userData.password === pass || isMasterAdmin) {
        if (userData.status === 'pending' && !isMasterAdmin) {
           throw new Error("আপনার একাউন্টটি বর্তমানে পাঠাগার কর্তৃপক্ষের অনুমোদনের অপেক্ষায় আছে। অ্যাডমিন এপ্রুভ না করা পর্যন্ত লগইন করা যাবে না।");
        }
        const fullUser = { ...userData, id: userDoc.id };
        if (usernameLower === 'admin' || usernameLower === 'seneiaislam') {
          fullUser.role = 'admin';
        }
        setUser(fullUser);
        setToken('manual_session');
        localStorage.setItem('pandho_manual_user', JSON.stringify(fullUser));
      } else {
        throw new Error("Invalid password");
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('pandho_manual_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithUsername, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
