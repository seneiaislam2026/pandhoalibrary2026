import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from "html5-qrcode";
import { BookOpen, RefreshCcw, UserPlus, LogOut, Scan, Loader2, CheckCircle2, ChevronRight, RefreshCw, Smartphone, QrCode, Library, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../../store/AuthContext';
import { cn } from '../../lib/utils';
import { sendSMS } from '../../lib/sms';
import QRCode from 'react-qr-code';

type KioskMode = 'login' | 'home' | 'issue' | 'return' | 'register' | 'books';

export default function KioskHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<KioskMode>('login');
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState<string>('');
  
  // Issue state
  const [bookCode, setBookCode] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [step, setStep] = useState(1); // 1 = member, 2 = book, 3 = confirm
  
  // Scanned objects caching
  const [foundBook, setFoundBook] = useState<any>(null);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [memberIssuedBooks, setMemberIssuedBooks] = useState<any[]>([]);

  // Return state
  const [returnBookCode, setReturnBookCode] = useState('');
  
  // Book Collection Mode State
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestBook, setRequestBook] = useState<any>(null);
  const [requestMemberCode, setRequestMemberCode] = useState('');
  
  // Registration Form State
  const [kioskRegForm, setKioskRegForm] = useState({ name: '', phone: '', address: '', dob: '', username: '', fatherName: '' });
  
  // Exit Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPin, setExitPin] = useState('');
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
     if (mode === 'books') {
        fetchBooks();
     }
  }, [mode]);

  const fetchBooks = async () => {
      setLoading(true);
      try {
         const snapshot = await getDocs(collection(db, 'books'));
         setAllBooks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
         console.error(err);
      } finally {
         setLoading(false);
      }
  };

  const handleKioskRegister = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!kioskRegForm.name || !kioskRegForm.phone || !kioskRegForm.username) return toast.error('আবশ্যকীয় ফিল্ডগুলো পূরণ করুন');
     setLoading(true);
     try {
       // Check duplicate username
       const userQ = query(collection(db, 'users'), where('username', '==', kioskRegForm.username));
       const uSnap = await getDocs(userQ);
       if (!uSnap.empty) {
          toast.error('এই ইউজারনেমটি আগে ব্যবহৃত হয়েছে');
          setLoading(false);
          return;
       }
       
       await setDoc(doc(collection(db, 'users')), {
          ...kioskRegForm,
          role: 'reader',
          status: 'pending',
          createdAt: serverTimestamp(),
          isKioskRegistration: true,
          password: '123' // default placeholder password for Kiosk users, they should change later
       });
       
       toast.success('রেজিস্ট্রেশন সফল! অ্যাডমিন রিভিউয়ের অপেক্ষায়।');
       setKioskRegForm({ name: '', phone: '', address: '', dob: '', username: '', fatherName: '' });
       setTimeout(() => setMode('home'), 2000);
     } catch (err) {
       toast.error('এরর হয়েছে');
     } finally {
       setLoading(false);
     }
  };

  const handleRequestBook = async () => {
       if (!requestMemberCode.trim()) return toast.error('কার্ড স্ক্যান করুন বা নম্বর দিন');
       setLoading(true);
       try {
           const rawCode = requestMemberCode;
           const mCode = rawCode.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()).trim();
           const paddedCode = isNaN(Number(mCode)) ? mCode : String(Number(mCode)).padStart(3, '0');

           let memberQ = query(collection(db, 'users'), where('memberId', '==', mCode));
           let snapshot = await getDocs(memberQ);
           
           if (snapshot.empty && mCode !== paddedCode) {
              memberQ = query(collection(db, 'users'), where('memberId', '==', paddedCode));
              snapshot = await getDocs(memberQ);
           }
           
           if (snapshot.empty) {
               memberQ = query(collection(db, 'users'), where('phone', '==', mCode));
               snapshot = await getDocs(memberQ);
           }
           
           if (snapshot.empty) {
               toast.error('সদস্য পাওয়া যায়নি!');
               return;
           }
           const mData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
           
           if (mData.status === 'pending') {
              toast.error("আপনার আবেদনটি বর্তমানে পেন্ডিং অবস্থায় আছে।");
              return;
           }
           if (mData.status !== 'active') {
              toast.error("আপনার অ্যাকাউন্টটি সক্রিয় নয়!");
              return;
           }

           if (mData.borrowBlocked) {
              toast.error("আপনার বই নেওয়া সাময়িকভাবে স্থগিত।");
              setRequestMemberCode('');
              return;
           }
           
           await setDoc(doc(collection(db, 'pre-bookings')), {
               bookId: requestBook.id,
               userId: mData.id,
               status: 'Pending',
               createdAt: serverTimestamp()
           });
           toast.success('বইয়ের রিকোয়েস্ট পাঠানো হয়েছে!');
           setRequestBook(null);
           setRequestMemberCode('');
       } catch (err) {
           toast.error('এরর হয়েছে');
       } finally {
           setLoading(false);
       }
  };

  // Keyboard Scanner support
  const barcodeBuffer = useRef('');
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleScannedCodeRef = useRef<(code: string) => void | Promise<void>>(undefined);
  
  useEffect(() => {
     handleScannedCodeRef.current = handleScannedCode;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in a real input (except our custom hidden ones if needed)
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 2) {
          if (handleScannedCodeRef.current) handleScannedCodeRef.current(barcodeBuffer.current.trim());
        }
        barcodeBuffer.current = '';
        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = '';
        }, 100);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hidden Camera Scanner logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isRunning = false;

    const startCamera = async () => {
      try {
        html5QrCode = new Html5Qrcode("hidden-scanner-cam");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 4, qrbox: { width: 400, height: 400 } },
          (decodedText) => {
             if (handleScannedCodeRef.current) {
                handleScannedCodeRef.current(decodedText);
             }
          },
          (errorMessage) => {
            // ignore scan errors (empty frames)
          }
        );
        isRunning = true;
      } catch (err) {
        console.warn("Could not start hidden camera automatically. No webcam?", err);
      }
    };

    if (mode === 'issue' || mode === 'return') {
      startCamera();
    }

    return () => {
      if (html5QrCode && isRunning) {
        try {
           html5QrCode.stop().then(() => {
              if (html5QrCode) html5QrCode.clear();
           }).catch(console.error);
        } catch (e) {
           console.error(e);
        }
      }
    };
  }, [mode]);

  const handleScannedCode = async (code: string) => {
    if (mode === 'home' || mode === 'register') return;
    
    // For book collection mode -> booking
    if (mode === 'books' && requestBook) {
       setRequestMemberCode(code);
       // We can directly call the handler here, wait we need state to update.
    } else {
       // Auto populate fields based on mode & step
       if (mode === 'login' || step === 1) {
          setMemberCode(code);
          await verifyMember(code);
       } else if (step === 2) {
          setBookCode(code);
          await verifyBook(code);
       }
    }
  };

  const fetchMemberIssuedBooks = async (userId: string) => {
      setLoading(true);
      try {
         const issueQ = query(collection(db, 'issues'), where('userId', '==', userId), where('status', '==', 'Issued'));
         const issueSnapshot = await getDocs(issueQ);
         if (issueSnapshot.empty) {
             toast.error("আপনাকে বর্তমানে কোনো বই ইস্যু করা নেই!");
             return false;
         }
         const issuedBooksWithDetails = await Promise.all(issueSnapshot.docs.map(async (iDoc) => {
             const issueData = iDoc.data();
             const bDoc = await getDoc(doc(db, 'books', issueData.bookId));
             if (!bDoc.exists()) return null;
             return {
                 issueId: iDoc.id,
                 bookId: issueData.bookId,
                 ...bDoc.data(),
                 issueData
             };
         }));
         setMemberIssuedBooks(issuedBooksWithDetails.filter(Boolean));
         return true;
      } catch (err) {
         toast.error('বইয়ের লিস্ট পেতে সমস্যা হয়েছে');
         return false;
      } finally {
         setLoading(false);
      }
  };

  const verifyMember = async (rawCode: string) => {
     setLoading(true);
     try {
       const mCode = rawCode.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()).trim();
       const paddedCode = isNaN(Number(mCode)) ? mCode : String(Number(mCode)).padStart(3, '0');

       let memberQ = query(collection(db, 'users'), where('memberId', '==', mCode));
       let snapshot = await getDocs(memberQ);
       
       if (snapshot.empty && mCode !== paddedCode) {
          memberQ = query(collection(db, 'users'), where('memberId', '==', paddedCode));
          snapshot = await getDocs(memberQ);
       }

       if (snapshot.empty) {
          memberQ = query(collection(db, 'users'), where('phone', '==', mCode));
          snapshot = await getDocs(memberQ);
       }
       
       if (snapshot.empty) {
          toast.error("সদস্য পাওয়া যায়নি (সদস্য কার্ড বা ফোন নম্বর দিন)");
          setMemberCode('');
       } else {
          const mData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
          if (mData.status === 'pending') {
             toast.error("আপনার আবেদনটি বর্তমানে পেন্ডিং অবস্থায় আছে।");
             setMemberCode('');
             return;
          }
          if (mData.status !== 'active') {
             toast.error("আপনার অ্যাকাউন্টটি সক্রিয় নয়।");
             setMemberCode('');
             return;
          }
          if (mode === 'issue' && mData.borrowBlocked) {
             toast.error("আপনার বই নেওয়া সাময়িকভাবে স্থগিত।");
             setMemberCode('');
             return;
          }

          setFoundUser(mData);
          if (mode === 'login') {
             toast.success("সফলভাবে লগিন হয়েছে।");
             setMode('home');
             setStep(2);
          } else {
             setStep(2); // move to book section
             toast.success("সদস্য যাচাই সম্পন্ন হয়েছে।");
          }
       }
     } catch (err) {
       toast.error("এরর হয়েছে");
     } finally {
       setLoading(false);
     }
  };

  const verifyBook = async (rawCode: string) => {
     setLoading(true);
     try {
       const bCode = rawCode.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()).trim();
       let q = query(collection(db, 'books'), where('bookCode', '==', bCode));
       let snapshot = await getDocs(q);
       if (snapshot.empty) {
           q = query(collection(db, 'books'), where('barcode', '==', bCode));
           snapshot = await getDocs(q);
       }
       if (snapshot.empty) {
          toast.error("এই কোডের কোনো বই পাওয়া যায়নি");
          setBookCode('');
          return;
       } 
       const bookData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
          
       if (mode === 'issue') {
          // is book already issued?
          const issueQ = query(collection(db, 'issues'), where('bookId', '==', bookData.id), where('status', '==', 'Issued'));
          const issueSnapshot = await getDocs(issueQ);
          if (!issueSnapshot.empty) {
             toast.error("বইটি ইতিমধ্যে অন্য কাউকে ইস্যু করা আছে!");
             setBookCode('');
             return;
          }
       } else if (mode === 'return') {
          // check if book is issued to this exact member
          const issueQ = query(collection(db, 'issues'), where('bookId', '==', bookData.id), where('userId', '==', foundUser?.id), where('status', '==', 'Issued'));
          const issueSnapshot = await getDocs(issueQ);
          if (issueSnapshot.empty) {
             toast.error("এই বইটি আপনার নামে ইস্যু করা নেই!");
             setBookCode('');
             return;
          }
          // We will store the issue doc to mark it returned later
          setFoundBook({ ...bookData, activeIssueId: issueSnapshot.docs[0].id });
          setStep(3);
          toast.success("বই যাচাই সম্পন্ন হয়েছে। কনফার্ম করুন।");
          setLoading(false);
          return;
       }

       setFoundBook(bookData);
       setStep(3); // ready to confirm
       toast.success("বই স্ক্যান সম্পন্ন হয়েছে। নিশ্চিত করুন।");
     } catch (err) {
       toast.error("এরর হয়েছে");
     } finally {
       setLoading(false);
     }
  };

  const confirmAction = async () => {
     if (!foundBook || !foundUser) return;
     setLoading(true);
     try {
        if (mode === 'issue') {
           const issueData = {
              bookId: foundBook.id,
              userId: foundUser.id,
              issueDate: new Date().toISOString(),
              expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'ISSUED',
              createdAt: serverTimestamp(),
              issuedBy: user?.name || 'Kiosk System'
           };
           await setDoc(doc(collection(db, 'issues')), issueData);

           // Also sync status in book document
           await updateDoc(doc(db, 'books', foundBook.id), {
              status: 'ISSUED',
              currentReaderName: foundUser.name || 'Anonymous',
              currentReaderId: foundUser.id,
              expectedReturnDate: issueData.expectedReturnDate,
              updatedAt: serverTimestamp()
           });

           toast.success("বইটি সফলভাবে ইস্যু করা হয়েছে!");
        } else if (mode === 'return') {
           if (!foundBook.activeIssueId) return;
           await updateDoc(doc(db, 'issues', foundBook.activeIssueId), {
              status: 'Returned',
              returnDate: new Date().toISOString(),
              receivedBy: user?.name || 'Kiosk System'
           });

           // Also sync status in book document
           await updateDoc(doc(db, 'books', foundBook.id), {
              status: 'Available',
              currentReaderName: '',
              currentReaderId: '',
              expectedReturnDate: '',
              updatedAt: serverTimestamp()
           });

           toast.success("বই চমৎকারভাবে ফেরত নেওয়া হয়েছে!");
        }
        
        setTimeout(() => resetKiosk(), 3000);
     } catch (err) {
        console.error("confirmAction error:", err);
        toast.error("কার্যক্রমে সমস্যা হয়েছে।");
     } finally {
        setLoading(false);
     }
  };

  const cancelToHome = () => {
    setMode('home');
    setBookCode('');
    setReturnBookCode('');
    setRequestBook(null);
    setRequestMemberCode('');
    setSearchQuery('');
    setStep(2); // Since user is already authenticated
  };

  const resetKiosk = () => {
    setMode('login');
    setBookCode('');
    setMemberCode('');
    setReturnBookCode('');
    setStep(1);
    setFoundBook(null);
    setFoundUser(null);
    setRequestBook(null);
    setRequestMemberCode('');
    setSearchQuery('');
    setMemberIssuedBooks([]);
  };

  return (
    <div className="min-h-screen bg-[#004B87] font-bengali relative flex flex-col select-none overflow-y-auto w-full">
      {/* Invisible Camera Scanner */}
      <div className="absolute -z-50 opacity-0 overflow-hidden w-[1px] h-[1px]">
          <div id="hidden-scanner-cam" className="w-[1px] h-[1px]"></div>
      </div>

      {/* ATM Header Area */}
      <div className="w-full h-auto bg-[#003366] border-b-[4px] md:border-b-[8px] border-amber-500 shadow-2xl z-20 flex flex-col md:flex-row items-center justify-between p-4 md:px-12 xl:px-20 py-4 gap-4 shrink-0">
         <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto justify-center md:justify-start">
            <div className="w-12 h-12 md:w-24 md:h-24 bg-white p-1.5 md:p-2 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner shrink-0">
               <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="text-center md:text-left">
               <h1 className="text-xl sm:text-3xl md:text-4xl xl:text-5xl font-black text-white font-bengali tracking-wide drop-shadow-md leading-tight">পানধোয়া উন্মুক্ত পাঠাগার</h1>
            </div>
         </div>
         <div className="text-center md:text-right bg-black/40 px-4 md:px-6 py-2 md:py-4 rounded-xl border-2 border-black/20 shadow-inner w-full md:w-auto shrink-0">
            <div className="text-xl md:text-3xl font-black text-green-400 font-mono tracking-widest drop-shadow-md">
               {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs md:text-sm font-bold text-slate-300 font-mono mt-1 tracking-widest uppercase">
               {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' })}
            </div>
         </div>
      </div>

      {/* Screen Content Wrapper */}
      <div className="flex-1 w-full px-4 md:px-12 xl:px-20 py-6 md:py-12 flex flex-col items-center justify-center z-10 relative shrink-0 min-h-max">

         <AnimatePresence mode="wait">
             {mode === 'login' && (
              <motion.div 
                 key="login"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
                 transition={{ duration: 0.3 }}
                 className="w-full max-w-md mx-auto flex flex-col gap-6 items-center"
              >
                  <div className="bg-white rounded-3xl p-8 w-full text-center shadow-2xl border-4 border-slate-300">
                     <div className="w-16 h-16 bg-blue-100 text-[#003366] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Scan className="w-8 h-8" />
                     </div>
                     <h3 className="text-2xl font-black text-[#003366] mb-2">সদস্য লগিন করুন</h3>
                     <p className="text-slate-500 font-bold mb-6">কার্ড স্ক্যান করুন অথবা ফোন নম্বর দিন</p>
                     
                     <div className="flex gap-2 mb-6">
                        <input 
                           type="text" 
                           inputMode="numeric"
                           pattern="[0-9]*"
                           value={memberCode}
                           onChange={(e) => setMemberCode(e.target.value)}
                           onKeyDown={(e) => { if(e.key === 'Enter') verifyMember(memberCode); }}
                           placeholder="" 
                           className="w-full bg-white border-2 border-[#003366] text-[#003366] px-4 py-3 rounded-xl font-mono text-xl font-black focus:outline-none text-center"
                           autoFocus
                        />
                     </div>
                     
                     <div className="flex gap-4">
                         <button onClick={() => verifyMember(memberCode)} disabled={!memberCode || loading} className="flex-1 bg-red-600 active:bg-red-800 text-white py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 hover:bg-red-700">
                            প্রবেশ করুন
                         </button>
                     </div>
                  </div>
                  
                  <button onClick={() => setMode('register')} className="w-full bg-white rounded-2xl p-4 text-center shadow-md border-2 border-slate-200 active:translate-y-[2px] transition-all flex items-center justify-center gap-3">
                     <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center overflow-hidden">
                        <UserPlus className="w-6 h-6 text-amber-600" />
                     </div>
                     <h2 className="text-lg font-black text-[#003366]">নতুন সদস্য নিবন্ধন</h2>
                  </button>

              </motion.div>
             )}

            {mode === 'home' && (
              <motion.div 
                 key="home"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 transition={{ duration: 0.3 }}
                 className="w-full max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 xl:gap-16 mt-4 md:mt-8"
              >
                 <div className="col-span-full text-center mb-2 md:mb-8 bg-[#003b6e] border-[4px] border-[#002f5c] p-4 md:p-6 rounded-2xl shadow-xl">
                    <h2 className="text-2xl md:text-4xl font-black text-white">অনুগ্রহপূর্বক আপনার কাঙ্ক্ষিত সেবাটি নির্বাচন করুন</h2>
                 </div>

                 <button onClick={() => setMode('issue')} className="group bg-slate-100 hover:bg-white active:bg-slate-300 border-[4px] md:border-[6px] border-slate-300 hover:border-indigo-500 rounded-2xl md:rounded-3xl p-6 md:p-12 text-left shadow-[0_8px_0_rgba(0,0,0,0.2)] md:shadow-[0_15px_0_rgba(0,0,0,0.2)] transition-all duration-100 active:translate-y-2 md:active:translate-y-4 active:shadow-[0_0_0_rgba(0,0,0,0.2)] flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-[#003366] mb-1 md:mb-3">বই ইস্যু</h2>
                        <p className="text-slate-600 font-bold text-base md:text-2xl uppercase tracking-widest">Issue Book</p>
                    </div>
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                       <Scan className="w-8 h-8 md:w-12 md:h-12 text-indigo-700" />
                    </div>
                 </button>

                 <button onClick={async () => {
                     const hasBooks = await fetchMemberIssuedBooks(foundUser.id);
                     if (hasBooks) {
                        setMode('return');
                        setStep(2);
                     }
                 }} className="group bg-slate-100 hover:bg-white active:bg-slate-300 border-[4px] md:border-[6px] border-slate-300 hover:border-emerald-500 rounded-2xl md:rounded-3xl p-6 md:p-12 text-left shadow-[0_8px_0_rgba(0,0,0,0.2)] md:shadow-[0_15px_0_rgba(0,0,0,0.2)] transition-all duration-100 active:translate-y-2 md:active:translate-y-4 active:shadow-[0_0_0_rgba(0,0,0,0.2)] flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-[#003366] mb-1 md:mb-3">বই ফেরত</h2>
                        <p className="text-slate-600 font-bold text-base md:text-2xl uppercase tracking-widest">Return Book</p>
                    </div>
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                       <RefreshCw className="w-8 h-8 md:w-12 md:h-12 text-emerald-700" />
                    </div>
                 </button>

                 <button onClick={() => setMode('books')} className="group bg-slate-100 hover:bg-white active:bg-slate-300 border-[4px] md:border-[6px] border-slate-300 hover:border-amber-500 rounded-2xl md:rounded-3xl p-6 md:p-12 text-left shadow-[0_8px_0_rgba(0,0,0,0.2)] md:shadow-[0_15px_0_rgba(0,0,0,0.2)] transition-all duration-100 active:translate-y-2 md:active:translate-y-4 active:shadow-[0_0_0_rgba(0,0,0,0.2)] flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-[#003366] mb-1 md:mb-3">বই সমূহ</h2>
                        <p className="text-slate-600 font-bold text-base md:text-2xl uppercase tracking-widest">Book Collection</p>
                    </div>
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-amber-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                       <Library className="w-8 h-8 md:w-12 md:h-12 text-amber-700" />
                    </div>
                 </button>

                 <button onClick={() => setMode('register')} className="group bg-[#002f5c] hover:bg-[#00254a] active:bg-[#001b36] border-[4px] md:border-[6px] border-[#001b36] hover:border-amber-500 rounded-2xl md:rounded-3xl p-6 md:p-12 text-left shadow-[0_8px_0_rgba(0,0,0,0.4)] md:shadow-[0_15px_0_rgba(0,0,0,0.4)] transition-all duration-100 active:translate-y-2 md:active:translate-y-4 active:shadow-[0_0_0_rgba(0,0,0,0.4)] flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-1 md:mb-3">নতুন সদস্য</h2>
                        <p className="text-amber-500 font-bold text-base md:text-2xl uppercase tracking-widest">New Member</p>
                    </div>
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-[#001b36] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                       <UserPlus className="w-8 h-8 md:w-12 md:h-12 text-amber-500" />
                    </div>
                 </button>
              </motion.div>
            )}

            {(mode === 'issue' || mode === 'return') && (
               <motion.div
                 key="action"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="bg-slate-100 rounded-3xl border-[6px] md:border-[8px] border-slate-300 shadow-2xl mx-auto w-full max-w-6xl overflow-hidden"
               >
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-[#003366] px-6 py-4 md:px-10 md:py-6 border-b-[6px] border-slate-300 gap-4">
                     <h2 className="text-2xl md:text-4xl font-black text-white flex items-center gap-4">
                        <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-white text-[#003366]">
                           {mode === 'issue' ? <Scan className="w-6 h-6 md:w-10 md:h-10" /> : <RefreshCw className="w-6 h-6 md:w-10 md:h-10" />}
                        </div>
                        {mode === 'issue' ? 'বই ইস্যু প্রক্রিয়া' : 'বই ফেরত প্রক্রিয়া'}
                     </h2>
                     <button onClick={cancelToHome} className="w-full sm:w-auto px-6 py-3 md:px-8 md:py-4 bg-red-600 active:bg-red-800 text-white rounded-xl font-bold text-base md:text-xl uppercase tracking-widest border-b-[4px] md:border-b-[6px] border-red-800 active:border-b-0 active:translate-y-[4px] md:active:translate-y-[6px]">
                        বাতিল (Cancel)
                     </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 p-6 md:p-10 gap-6 md:gap-10">
                     {/* Left - Scanner Animation & Status */}
                     <div className="bg-white border-4 border-slate-200 rounded-2xl p-6 md:p-10 flex flex-col items-center justify-center relative shadow-inner min-h-[300px] md:min-h-[400px]">
                        
                        {loading && (
                           <div className="absolute inset-0 z-10 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                              <Loader2 className="w-16 h-16 md:w-20 md:h-20 animate-spin text-[#003366] mb-4 md:mb-6" />
                              <p className="text-[#003366] font-bold text-xl md:text-2xl">অনুগ্রহ করে অপেক্ষা করুন...</p>
                           </div>
                        )}

                        <div className="w-40 h-40 md:w-56 md:h-56 rounded-3xl bg-slate-100 border-[6px] border-slate-300 flex items-center justify-center relative mb-6 md:mb-10 shadow-inner">
                           {step === 1 ? <Smartphone className="w-20 h-20 md:w-28 md:h-28 text-[#003366]" /> : <BookOpen className="w-20 h-20 md:w-28 md:h-28 text-[#003366]" />}
                        </div>

                        <h3 className="text-xl md:text-3xl font-black text-[#003366] text-center mb-2 md:mb-4 leading-normal">
                           {step === 1 ? 'অনুগ্রহ করে কার্ড স্ক্যান করুন\nঅথবা নম্বর লিখুন' : (step === 2 ? 'অনুগ্রহ করে বই স্ক্যান করুন\nঅথবা কোড লিখুন' : 'তথ্যাদি নিশ্চিত করুন')}
                        </h3>
                     </div>

                     {/* Right - Information & Input fallback */}
                     <div className="space-y-4 md:space-y-6 flex flex-col justify-center">
                        
                        {/* Member Module */}
                        <div className={cn("bg-slate-200 p-4 md:p-6 rounded-2xl border-4 transition-all duration-300", step === 1 ? "border-[#003366] shadow-md opacity-100" : "border-slate-300 opacity-50 pointer-events-none")}>
                           <label className="text-base md:text-lg font-black text-slate-500 uppercase tracking-widest mb-3 md:mb-4 block">1. Member Info</label>
                           {foundUser ? (
                              <div className="bg-white border-4 border-green-500 p-4 md:p-5 rounded-xl flex items-center gap-4 md:gap-6">
                                 <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-green-500" />
                                 <div>
                                    <h4 className="text-[#003366] font-black text-xl md:text-2xl mb-1">{foundUser.name}</h4>
                                    <p className="text-slate-600 font-mono text-base md:text-lg font-bold">{foundUser.phone || foundUser.memberId}</p>
                                 </div>
                              </div>
                           ) : (
                              <div className="relative">
                                 <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={memberCode}
                                    onChange={(e) => setMemberCode(e.target.value)}
                                    placeholder="ফোন নম্বর..." 
                                    className="w-full bg-white border-[3px] md:border-4 border-[#003366] text-[#003366] px-4 py-4 md:px-6 md:py-6 rounded-xl font-mono text-2xl md:text-3xl font-black focus:outline-none placeholder-slate-400"
                                    disabled={step !== 1}
                                 />
                                 {step === 1 && memberCode && (
                                    <button onClick={() => verifyMember(memberCode)} className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 p-3 md:p-4 rounded-xl text-white bg-[#003366] active:bg-[#001b36] shadow-md border-b-[4px] border-[#001b36] active:border-b-0 active:mt-1">
                                       <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                                    </button>
                                 )}
                              </div>
                           )}
                        </div>

                        {/* Book Module */}
                        <div className={cn("bg-slate-200 p-4 md:p-6 rounded-2xl border-4 transition-all duration-300", step === 2 ? "border-[#003366] shadow-md opacity-100" : (step > 2 ? "border-slate-300 opacity-50 pointer-events-none" : "border-slate-300 opacity-30 pointer-events-none"))}>
                           <label className="text-base md:text-lg font-black text-slate-500 uppercase tracking-widest mb-3 md:mb-4 block">2. Book Data</label>
                           {foundBook ? (
                              <div className="bg-white border-4 border-green-500 p-4 md:p-5 rounded-xl flex items-center gap-4 md:gap-6">
                                 <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-green-500" />
                                 <div>
                                    <h4 className="text-[#003366] font-black text-xl md:text-2xl mb-1 line-clamp-1">{foundBook.title}</h4>
                                    <p className="text-slate-600 font-mono text-base md:text-lg font-bold">{foundBook.bookCode}</p>
                                 </div>
                              </div>
                           ) : (
                               mode === 'return' ? (
                                  <div className="grid grid-cols-1 gap-3 md:gap-4 max-h-[150px] overflow-y-auto pr-3 md:pr-4 custom-scrollbar">
                                     {memberIssuedBooks.map((book) => (
                                        <button 
                                           key={book.issueId}
                                           onClick={() => {
                                              setFoundBook({ ...book, activeIssueId: book.issueId });
                                              setStep(3);
                                              toast.success("বই নির্বাচন করা হয়েছে।");
                                           }}
                                           className="w-full text-left bg-white border-[3px] md:border-4 border-slate-300 p-4 md:p-6 rounded-xl active:border-[#003366] transition-all flex justify-between items-center group active:bg-slate-100"
                                        >
                                           <div>
                                              <p className="text-[#003366] font-black text-lg md:text-xl mb-1">{book.title}</p>
                                              <p className="text-slate-500 font-mono text-base md:text-lg font-bold">{book.bookCode}</p>
                                           </div>
                                           <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                                              <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-[#003366]" />
                                           </div>
                                        </button>
                                     ))}
                                  </div>
                               ) : (
                                  <div className="relative">
                                     <input 
                                        type="text" 
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={bookCode}
                                        onChange={(e) => setBookCode(e.target.value)}
                                        placeholder="বইয়ের কোড..." 
                                        className="w-full bg-white border-[3px] md:border-4 border-[#003366] text-[#003366] px-4 py-4 md:px-6 md:py-6 rounded-xl font-mono text-2xl md:text-3xl font-black focus:outline-none placeholder-slate-400"
                                        disabled={step !== 2}
                                     />
                                     {step === 2 && bookCode && (
                                        <button onClick={() => verifyBook(bookCode)} className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 p-3 md:p-4 rounded-xl text-white bg-[#003366] active:bg-[#001b36] shadow-md border-b-[4px] border-[#001b36] active:border-b-0 active:mt-1">
                                           <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                                        </button>
                                     )}
                                  </div>
                               )
                           )}
                        </div>

                        {/* Confirmation Module */}
                        <AnimatePresence>
                           {step === 3 && foundBook && foundUser && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2">
                                 <button onClick={confirmAction} disabled={loading} className="w-full py-4 md:py-6 bg-green-600 active:bg-green-800 text-white rounded-xl font-black text-2xl md:text-3xl border-b-[6px] md:border-b-[8px] border-green-800 active:border-b-0 active:translate-y-[6px] md:active:translate-y-[8px] disabled:opacity-50 disabled:pointer-events-none">
                                    নিশ্চিত করুন (CONFIRM)
                                 </button>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  </div>
               </motion.div>
            )}

            {mode === 'books' && (
               <motion.div
                  key="books"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-100 rounded-3xl border-[6px] md:border-[8px] border-slate-300 shadow-2xl mx-auto w-full max-w-7xl overflow-hidden flex flex-col h-[75vh]"
               >
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-[#003366] px-4 py-3 md:px-10 md:py-6 border-b-[6px] border-slate-300 gap-4 shrink-0">
                     <h2 className="text-xl md:text-4xl font-black text-white flex items-center gap-3 md:gap-4">
                        <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-white text-[#003366]">
                           <Library className="w-6 h-6 md:w-10 md:h-10" />
                        </div>
                        বই সমূহ
                     </h2>
                     <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                         <input type="text" placeholder="বই খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full sm:w-64 px-4 py-3 md:py-4 rounded-xl border-[3px] border-slate-300 focus:outline-none focus:border-amber-500 font-bold text-base md:text-lg" />
                         <button onClick={cancelToHome} className="px-6 py-3 md:px-8 md:py-4 bg-red-600 active:bg-red-800 text-white rounded-xl font-bold text-base md:text-xl uppercase tracking-widest border-b-[4px] md:border-b-[6px] border-red-800 active:border-b-0 active:translate-y-[4px] md:active:translate-y-[6px] shrink-0">
                            বাতিল
                         </button>
                     </div>
                  </div>
                  
                  <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar bg-slate-200 flex-1 relative">
                     {loading ? (
                         <div className="absolute inset-0 bg-slate-200/80 flex items-center justify-center z-10">
                            <Loader2 className="w-16 h-16 animate-spin text-[#003366]" />
                         </div>
                     ) : null}

                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {allBooks.filter(b => (b.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (b.author || '').toLowerCase().includes(searchQuery.toLowerCase())).map(book => (
                            <div key={book.id} className="bg-white p-3 md:p-4 rounded-2xl border-[4px] border-slate-300 shadow-xl flex flex-col h-full">
                               <div className="aspect-[3/4] bg-slate-100 rounded-xl mb-3 md:mb-4 overflow-hidden border-2 border-slate-200 relative">
                                  {book.cover ? <img src={book.cover} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <BookOpen className="w-12 h-12 md:w-16 md:h-16 m-auto mt-8 md:mt-12 text-slate-300" />}
                                  {requestBook?.id === book.id && (
                                     <div className="absolute inset-x-0 bottom-0 bg-[#003366] text-white z-10 flex flex-col p-4 animate-in slide-in-from-bottom-4 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                                         <h4 className="font-bold text-center mb-3 leading-tight text-xs md:text-sm">বইটি নিতে সদস্য আইডি/নম্বর দিন</h4>
                                         <input type="text" value={requestMemberCode} onChange={e=>setRequestMemberCode(e.target.value)} className="w-full text-center py-2 px-3 rounded-lg text-[#003366] font-bold mb-2 border-2 border-white/50 focus:border-amber-400 outline-none transition-colors text-sm" placeholder="আইডি/নম্বর" />
                                         <button onClick={handleRequestBook} className="bg-amber-500 text-[#003366] px-4 py-2 rounded-lg font-black w-full shadow-md active:translate-y-[2px] mb-3 text-sm">নিশ্চিত করুন</button>
                                         
                                         <div className="pt-2 border-t border-white/20 text-center">
                                            <p className="text-[10px] text-slate-300 mb-1">সদস্য নন?</p>
                                            <button onClick={() => setMode('register')} className="bg-white text-[#003366] px-3 py-1.5 rounded-md font-bold text-xs w-full shadow-sm active:bg-slate-200">এখনই সদস্য হোন</button>
                                         </div>

                                         <button onClick={() => {setRequestBook(null); setRequestMemberCode('');}} className="absolute top-2 right-2 text-white/50 hover:text-white bg-black/20 rounded-full p-1"><X className="w-4 h-4"/></button>
                                     </div>
                                  )}
                               </div>
                               <h3 className="font-black text-base md:text-xl text-[#003366] line-clamp-2 leading-tight mb-1">{book.title}</h3>
                               <p className="text-slate-600 font-bold text-xs md:text-base mb-4 flex-1">{book.author || '---'}</p>
                               <div className="mt-auto">
                                   <button onClick={() => setRequestBook(book)} className="w-full py-2 md:py-3 bg-amber-500 active:bg-amber-600 text-[#003366] rounded-xl font-black text-xs md:text-sm border-b-[4px] border-amber-700 active:border-b-0 active:translate-y-[4px]">
                                      রিকোয়েস্ট করুন
                                   </button>
                               </div>
                            </div>
                        ))}
                        {allBooks.length > 0 && allBooks.filter(b => (b.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (b.author || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-500 font-black text-2xl">
                                কোনো বই পাওয়া যায়নি
                            </div>
                        )}
                     </div>
                  </div>
               </motion.div>
            )}

            {mode === 'register' && (
               <motion.div
                 key="register"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="bg-slate-100 rounded-3xl border-[6px] md:border-[8px] border-slate-300 shadow-2xl mx-auto w-full max-w-7xl overflow-hidden flex flex-col h-[80vh] md:h-[70vh]"
               >
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-[#003366] px-4 py-3 md:px-10 md:py-6 border-b-[6px] border-slate-300 gap-4 shrink-0">
                     <h2 className="text-xl md:text-3xl font-black text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500 text-[#003366]">
                           <UserPlus className="w-8 h-8" />
                        </div>
                        নতুন সদস্য নিবন্ধন
                     </h2>
                     <button onClick={resetKiosk} className="w-full sm:w-auto px-6 py-3 md:px-8 md:py-4 bg-red-600 active:bg-red-800 text-white rounded-xl font-bold text-base md:text-xl uppercase tracking-widest border-b-[4px] md:border-b-[6px] border-red-800 active:border-b-0 active:translate-y-[4px] md:active:translate-y-[6px]">
                        বাতিল (Cancel)
                     </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto w-full flex flex-col lg:flex-row shadow-inner bg-white">
                     {/* Left - QR Code */}
                     <div className="w-full lg:w-1/2 p-6 md:p-10 border-b-4 lg:border-b-0 lg:border-r-4 border-slate-200 flex flex-col items-center justify-center bg-slate-50">
                        <h3 className="text-2xl md:text-3xl font-black text-[#003366] text-center mb-6 leading-normal">
                           আপনার মোবাইল থেকে<br/>স্ক্যান করে ফর্ম পূরণ করুন
                        </h3>
                        <div className="bg-white p-4 md:p-6 rounded-3xl border-[6px] border-amber-500 mb-6 shadow-xl inline-block">
                           <QRCode 
                              value={`${window.location.origin}/register`}
                              size={220}
                              level="H"
                              className="rounded-xl mx-auto"
                           />
                        </div>
                        <p className="font-mono text-[#003366] text-lg md:text-xl font-black tracking-widest bg-slate-200 px-6 py-3 rounded-xl border-[3px] border-slate-300 w-full text-center truncate">
                           {window.location.origin.replace('https://', '')}/register
                        </p>
                     </div>
                     
                     {/* Right - Form */}
                     <div className="w-full lg:w-1/2 p-6 md:p-10 relative">
                        {loading && (
                           <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex items-center justify-center">
                              <Loader2 className="w-16 h-16 animate-spin text-[#003366]" />
                           </div>
                        )}
                        <h3 className="text-2xl md:text-3xl font-black text-[#003366] mb-6 border-b-4 border-amber-500 pb-3 inline-block">
                           অথবা, এখানে পূরণ করুন
                        </h3>
                        
                        <form onSubmit={handleKioskRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="md:col-span-2">
                              <label className="block text-slate-700 font-bold mb-2">পূর্ণ নাম *</label>
                              <input required type="text" value={kioskRegForm.name} onChange={e=>setKioskRegForm({...kioskRegForm, name: e.target.value})} className="w-full bg-slate-100 border-[3px] border-slate-300 focus:border-[#003366] rounded-xl px-4 py-3 font-bold focus:outline-none" placeholder="আপনার নাম..." />
                           </div>
                           
                           <div>
                              <label className="block text-slate-700 font-bold mb-2">ফোন নম্বর *</label>
                              <input required type="text" value={kioskRegForm.phone} onChange={e=>setKioskRegForm({...kioskRegForm, phone: e.target.value})} className="w-full bg-slate-100 border-[3px] border-slate-300 focus:border-[#003366] rounded-xl px-4 py-3 font-bold font-mono focus:outline-none" placeholder="01XXXXXXXXX" />
                           </div>
                           
                           <div>
                              <label className="block text-slate-700 font-bold mb-2">ইউজারনেম *</label>
                              <input required type="text" value={kioskRegForm.username} onChange={e=>setKioskRegForm({...kioskRegForm, username: e.target.value.toLowerCase().replace(/\s+/g,'')})} className="w-full bg-slate-100 border-[3px] border-slate-300 focus:border-[#003366] rounded-xl px-4 py-3 font-bold focus:outline-none lowercase" placeholder="username" />
                           </div>

                           <div className="md:col-span-2">
                              <label className="block text-slate-700 font-bold mb-2">ঠিকানা</label>
                              <input type="text" value={kioskRegForm.address} onChange={e=>setKioskRegForm({...kioskRegForm, address: e.target.value})} className="w-full bg-slate-100 border-[3px] border-slate-300 focus:border-[#003366] rounded-xl px-4 py-3 font-bold focus:outline-none" placeholder="গ্রাম/মহল্লা..." />
                           </div>
                           
                           <div className="md:col-span-2 mt-4">
                              <button type="submit" disabled={loading} className="w-full py-4 bg-[#003366] active:bg-[#001b36] text-white rounded-xl font-black text-xl border-b-[6px] border-[#001b36] active:border-b-0 active:translate-y-[6px]">
                                 রেজিস্ট্রেশন জমা দিন
                              </button>
                           </div>
                        </form>
                     </div>
                  </div>
               </motion.div>
             )}

         </AnimatePresence>

         <div className="mt-auto pt-10 pb-6 z-50 shrink-0">
            <button onClick={() => setShowExitModal(true)} className="flex items-center gap-3 text-white/50 hover:text-white transition-colors bg-black/20 px-8 py-3 rounded-2xl border-[3px] border-black/20 active:border-b-0 active:translate-y-[3px]">
               <LogOut className="w-6 h-6" />
               <span className="text-lg font-bold uppercase tracking-widest font-mono">Exit Kiosk</span>
            </button>
         </div>
      </div>

      {/* Exit Modal */}
      <AnimatePresence>
         {showExitModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
               <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-slate-300">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <LogOut className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-[#003366] mb-4">কিয়স্ক বন্ধ করুন</h3>
                  <p className="text-slate-500 font-bold mb-6">টিম পিন (PIN) প্রদান করুন</p>
                  <input 
                     type="password" 
                     value={exitPin}
                     onChange={(e) => setExitPin(e.target.value)}
                     className="w-full text-center py-4 text-3xl tracking-[1em] font-mono border-4 border-[#003366] rounded-xl text-[#003366] mb-6 focus:outline-none"
                     autoFocus
                  />
                  <div className="flex gap-4">
                     <button onClick={() => { setShowExitModal(false); setExitPin(''); }} className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-xl font-bold border-b-4 border-slate-300 active:translate-y-1 active:border-b-0">বাতিল</button>
                     <button onClick={async () => {
                        if (exitPin === '2005') {
                           await logout();
                           navigate('/login');
                        } else {
                           toast.error('ভুল পিন!');
                           setExitPin('');
                        }
                     }} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold border-b-4 border-red-800 active:translate-y-1 active:border-b-0">নিশ্চিত করুন</button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}
