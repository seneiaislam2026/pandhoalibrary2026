import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Search, Scan, Book, User, Calendar, CheckCircle2, XCircle, ArrowLeftRight, RefreshCcw, ScanLine } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { motion, AnimatePresence } from 'motion/react';
import { sendSMS } from '../../lib/sms';
import { cn } from '../../lib/utils';

export default function BarcodeScanner() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScannerActive, setIsScannerActive] = useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scannerInstance = React.useRef<Html5Qrcode | null>(null);
  const isScanningBlocked = React.useRef(false);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Global listener removed as per user request to prevent automatic keyboard popup
  }, []);

  useEffect(() => {
    if (!isScannerActive) {
      if (scannerInstance.current && scannerInstance.current.isScanning) {
         scannerInstance.current.stop().then(() => {
             scannerInstance.current?.clear();
         }).catch(err => console.error("Error stopping scanner", err));
      }
      return;
    }

    const html5QrCode = new Html5Qrcode("reader", {
      formatsToSupport: [ 
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 
      ]
    } as any);
    scannerInstance.current = html5QrCode;
    isScanningBlocked.current = false;
    
    const startScanner = async () => {
      try {
        let cameraConfig: any = { facingMode: "environment" };
        
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCamera = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('rear')
            );
            if (backCamera) {
              cameraConfig = backCamera.id;
            }
          }
        } catch (e) {
          console.warn("Could not probe cameras, using default environment mode", e);
        }

        // Small delay to ensure hardware is released
        await new Promise(r => setTimeout(r, 200));

        const qrboxConfig = (videoWidth: number, videoHeight: number) => {
          const minEdge = Math.min(videoWidth, videoHeight);
          // Standard qrbox size is 70% of minEdge, but at least 150px and at most 80%
          let size = Math.floor(minEdge * 0.7);
          if (size < 150) size = Math.min(minEdge, 150);
          if (size < 50) size = 50; // Absolute library minimum
          return { width: size, height: size };
        };

        try {
          await html5QrCode.start(
            cameraConfig, 
            { 
              fps: 10, 
              qrbox: qrboxConfig,
              aspectRatio: 1.0
            },
            async (decodedText) => {
              if (isScanningBlocked.current) return;
              
              if (!book) {
                isScanningBlocked.current = true;
                setScanResult(decodedText);
                try { await html5QrCode.stop(); } catch(e) {}
                setIsScannerActive(false); 
                handleBookLookup(decodedText);
              } else if (book.status === 'Available' && !selectedUserId) {
                handleMemberScan(decodedText);
                isScanningBlocked.current = true;
                setTimeout(() => { isScanningBlocked.current = false; }, 2000);
              }
            },
            () => {}
          );
        } catch (innerErr: any) {
          // If specific camera ID failed, retry with generic environment mode
          if (cameraConfig !== "environment") {
            console.warn("Retrying with generic environment mode due to error:", innerErr);
            await html5QrCode.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: qrboxConfig, aspectRatio: 1.0 },
              async (decodedText) => {
                 /* same callback */
                 if (isScanningBlocked.current) return;
                 if (!book) {
                   isScanningBlocked.current = true;
                   setScanResult(decodedText);
                   try { await html5QrCode.stop(); } catch(e) {}
                   setIsScannerActive(false); 
                   handleBookLookup(decodedText);
                 } else if (book.status === 'Available' && !selectedUserId) {
                   handleMemberScan(decodedText);
                   isScanningBlocked.current = true;
                   setTimeout(() => { isScanningBlocked.current = false; }, 2000);
                 }
              },
              () => {}
            );
          } else {
            throw innerErr;
          }
        }
      } catch (err) {
        console.error("Camera start error:", err);
        toast.error("ক্যামেরা চালু করতে সমস্যা হয়েছে। দয়া করে ব্রাউজারের ক্যামেরা পারমিশন চেক করুন।");
        setIsScannerActive(false);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Cleanup error:", err));
      }
    };
  }, [isScannerActive]);

  useEffect(() => {
    // Fetch users for issuing
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), where("status", "==", "active"));
        const snap = await getDocs(q);
        const userData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userData.filter((u: any) => 
          u.role !== 'admin' && 
          u.name?.toLowerCase() !== 'system admin' && 
          u.email !== 'seneiaislam@gmail.com'
        ));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, []);

  const handleBookLookup = async (code: string) => {
    setLoading(true);
    setBook(null);
    try {
      // First try searching by bookCode
      let q = query(collection(db, "books"), where("bookCode", "==", code));
      let snap = await getDocs(q);
      
      // If not found by bookCode, try searching by the new barcode field (ISBN/UPC)
      if (snap.empty) {
        q = query(collection(db, "books"), where("barcode", "==", code));
        snap = await getDocs(q);
      }
      
      if (snap.empty) {
        // If still not found, check if this is a memberId being scanned while a book is NOT found yet
        // Maybe the user scanned the member first by mistake?
        const memberQuery = query(collection(db, "users"), where("memberId", "==", code));
        const memberSnap = await getDocs(memberQuery);
        if (!memberSnap.empty) {
           toast.error("এটি একজন মেম্বারের আইডি। দয়া করে আগে বই স্ক্যান করুন।");
        } else {
           toast.error("বইটি খুঁজে পাওয়া যায়নি!");
        }
        setScanResult(null);
      } else {
        const bookData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        setBook(bookData);
        
        // Auto set 7 days return date
        if (bookData.status === 'Available') {
          const sevenDaysLater = new Date();
          sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
          setExpectedReturnDate(sevenDaysLater.toISOString().split('T')[0]);
        }
        
        toast.success("বইটি পাওয়া গিয়েছে!");
        
        // After finding a book, we don't auto-focus anymore as per user request
        /*
        setTimeout(() => {
          inputRef.current?.focus();
        }, 500);
        */
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "books");
    } finally {
      setLoading(false);
    }
  };

  const handleMemberScan = (code: string) => {
    const foundUser = users.find(u => u.memberId === code || u.id === code || u.username === code.toLowerCase());
    if (foundUser) {
      setSelectedUserId(foundUser.id);
      toast.success(`${foundUser.name} সিলেক্ট করা হয়েছে।`);
    } else {
      toast.error("এই মেম্বার আইডিটি খুঁজে পাওয়া যায়নি!");
    }
  };

  const handleIssue = async () => {
    if (!selectedUserId || !expectedReturnDate) {
      toast.error("দয়া করে মেম্বার এবং ফেরতের তারিখ সিলেক্ট করুন।");
      return;
    }

    const selectedUser = users.find(u => u.id === selectedUserId);
    if (selectedUser?.borrowBlocked) {
      toast.error("এই মেম্বারটি বর্তমানে ব্লক করা আছে!");
      return;
    }

    setIsSubmitting(true);
    try {
      const issueId = `ISS-${Date.now()}`;
      const issueData = {
        bookId: String(book.id),
        bookTitle: book.title || 'Untitled',
        bookCode: book.bookCode || 'N/A',
        userId: String(selectedUser.id),
        userName: selectedUser.name || 'Anonymous',
        memberId: selectedUser.memberId || 'N/A',
        issueDate: new Date().toISOString(),
        returnDate: expectedReturnDate,
        expectedReturnDate: expectedReturnDate,
        status: "ISSUED",
        adminNote: "Bar-code Scan Entry",
        autoAlertSent: false,
        issuedBy: currentUser?.id,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "issues", issueId), issueData);
      
      const bookUpdates = { 
        status: "ISSUED",
        currentReaderName: selectedUser.name || 'Anonymous',
        currentReaderId: selectedUser.id,
        expectedReturnDate: expectedReturnDate,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "books", String(book.id)), bookUpdates);

      toast.success("বইটি সফলভাবে ইস্যু করা হয়েছে!");
      
      // SMS
      if (selectedUser.phone) {
        const bdDate = new Date(expectedReturnDate).toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
        const smsMessage = `প্রিয় ${selectedUser.name}, পানধোয়া উন্মুক্ত পাঠাগার থেকে আপনাকে "${book.title}" বইটি ইস্যু করা হয়েছে। ফেরত দেওয়ার শেষ তারিখ: ${bdDate}। ওয়েবসাইট: www.pandhoalibrary.org`;
        sendSMS(selectedUser.phone, smsMessage).catch(console.error);
      }

      resetScanner();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "issues");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async () => {
    setIsSubmitting(true);
    try {
      // Find the active issue for this book
      const q = query(
        collection(db, "issues"), 
        where("bookId", "==", book.id), 
        where("status", "==", "ISSUED")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // Just update status if record not found for some reason
        await updateDoc(doc(db, "books", book.id), { status: 'Available' });
      } else {
        const issueId = snap.docs[0].id;
        const issueData = snap.docs[0].data();
        
        await updateDoc(doc(db, "issues", issueId), {
          status: 'Returned',
          returnDate: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });

        await updateDoc(doc(db, "books", book.id), { 
          status: 'Available',
          currentReaderName: null,
          currentReaderId: null,
          expectedReturnDate: null,
          updatedAt: serverTimestamp()
        });

        const issueUser = users.find(u => u.id === issueData.userId);
        if (issueUser && issueUser.phone) {
           const smsMessage = `প্রিয় ${issueUser.name}, পানধোয়া উন্মুক্ত পাঠাগারে "${book.title}" বইটি ফেরত দেওয়ার প্রক্রিয়া সফলভাবে সম্পন্ন হয়েছে। ধন্যবাদ।`;
           sendSMS(issueUser.phone, smsMessage).catch(console.error);
        }
      }

      toast.success("বইটি ফেরত নেওয়া হয়েছে!");
      resetScanner();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "issues");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setBook(null);
    setSelectedUserId(null);
    setExpectedReturnDate('');
    setIsScannerActive(true);
    
    // Refocus for physical machine removed as per user request
    /*
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    */

    isScanningBlocked.current = false;
    if (scannerInstance.current && scannerInstance.current.resume) {
      try {
        scannerInstance.current.resume();
      } catch(e) {}
    }
  };

  const userOptions = users.map(u => ({
    value: u.id,
    label: `${u.name} (${u.memberId || 'N/A'})`
  }));

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: '0.75rem',
      padding: '0.2rem',
      borderColor: '#e2e8f0',
      fontFamily: 'Hind Siliguri'
    })
  };

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8 font-bengali">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">বারকোড স্ক্যানার</h2>
          <p className="text-slate-500 text-sm">বই ইস্যু এবং ফেরত নেওয়ার দ্রুত পদ্ধতি</p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <Scan className="w-6 h-6" />
        </div>
      </div>

      <div className="space-y-6">
        {/* Scanner Section - Keep it in DOM but hidden when not active */}
        <div className={cn(
          "bg-white p-2 max-w-sm mx-auto rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden text-center",
          (scanResult || !isScannerActive) && "hidden"
        )}>
          <div id="reader" className="w-full min-h-[350px] max-h-[400px] flex items-center justify-center rounded-2xl overflow-hidden border-2 border-indigo-100 bg-slate-50 relative">
             <button 
               onClick={() => setIsScannerActive(false)}
               className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center z-50 hover:bg-rose-500 transition-colors"
             >
               <XCircle size={20} />
             </button>
          </div>
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold mb-1">
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
              বারকোড স্ক্যান করুন
            </div>
            <p className="text-xs text-slate-400">বইয়ের বারকোড ক্যামেরার সামনে ধরুন</p>
          </div>
        </div>

        {/* Manual Input Section */}
        <div className={cn("transition-all", scanResult && "opacity-50 pointer-events-none")}>
          <div className="relative group">
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const code = manualCode.trim();
                  if (!code) return;
                  setManualCode('');
                  
                  if (!book) {
                    setScanResult(code);
                    handleBookLookup(code);
                  } else if (book.status === 'Available' && !selectedUserId) {
                    handleMemberScan(code);
                  } else {
                    handleBookLookup(code);
                  }
                }
              }}
              placeholder={!book ? "বইয়ের বারকোড দিন..." : "মেম্বার আইডি দিন..."}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all font-black text-indigo-600 placeholder:text-slate-300 placeholder:font-bold shadow-inner"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-400">
               <ScanLine size={24} />
            </div>
          </div>
          <p className="text-center text-slate-400 text-[10px] mt-2 italic font-medium">
            {!book ? "বারকোড মেশিন দিয়ে স্ক্যান করলে এখানে বই অটোমেটিক আসবে।" : "এবার মেম্বারের বারকোড স্ক্যান করুন।"}
          </p>
        </div>

        {/* Results Section */}
        <div className="min-h-[200px]">
          {!scanResult && !isScannerActive && !loading && !book && (
            <div className="bg-white p-10 rounded-[2rem] text-center border border-dashed border-slate-200">
               <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ScanLine size={32} />
               </div>
               <h3 className="text-lg font-bold text-slate-700">স্ক্যান শুরু করুন</h3>
               <button
                  onClick={() => setIsScannerActive(true)}
                  className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95 flex items-center justify-center gap-2 mx-auto"
                >
                  <Scan size={18} />
                  ক্যামেরা চালু করুন
                </button>
            </div>
          )}

          {loading && (
            <div className="bg-white p-12 rounded-[2.5rem] text-center shadow-lg border border-slate-100">
              <RefreshCcw className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
              <p className="font-bold text-slate-600">উপাত্ত খুঁজে বের করা হচ্ছে...</p>
            </div>
          )}

          {!loading && scanResult && book && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-8 -mt-8 -z-0"></div>
              
              <div className="relative z-10 font-bengali">
                {/* Book Details */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
                    <Book size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg mb-1 uppercase tracking-tighter">
                      Code: {book.bookCode}
                    </span>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{book.title}</h3>
                    <p className="text-sm text-slate-500 font-medium">{book.author || 'অজানা লেখক'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-8">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black",
                    book.status === 'Available' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                  )}>
                    {book.status === 'Available' ? <CheckCircle2 size={16} /> : <ArrowLeftRight size={16} />}
                    {book.status === 'Available' ? 'পাওয়া যাবে (Available)' : 'ইস্যুকৃত (Issued)'}
                  </div>
                </div>

                {book.status === 'Available' ? (
                  <div className="space-y-6">
                    <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">মেম্বার সিলেক্ট করুন (বা স্ক্যান করুন)</label>
                        <Select
                          options={userOptions}
                          styles={selectStyles}
                          value={userOptions.find(o => o.value === selectedUserId)}
                          placeholder="নাম বা আইডি লিখুন..."
                          onChange={(opt: any) => setSelectedUserId(opt?.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ফেরত দেওয়ার তারিখ</label>
                        <input
                          type="date"
                          value={expectedReturnDate}
                          onChange={e => setExpectedReturnDate(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleIssue}
                      disabled={isSubmitting}
                      className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? <RefreshCcw className="animate-spin" /> : <ScanLine />}
                      বই ইস্যু করুন
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                      <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                        <User size={18} />
                        বর্তমানে যার কাছে আছে:
                      </div>
                      <p className="text-xl font-bold text-amber-900">{book.currentReaderName}</p>
                    </div>
                    <button
                      onClick={handleReturn}
                      disabled={isSubmitting}
                      className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? <RefreshCcw className="animate-spin" /> : <RefreshCcw />}
                      বই ফেরত নিন
                    </button>
                  </div>
                )}

                <button
                  onClick={resetScanner}
                  className="w-full mt-4 py-3 text-slate-500 font-bold hover:text-indigo-600 transition-colors"
                >
                  আবার স্ক্যান করুন
                </button>
              </div>
            </div>
          )}

          {!loading && scanResult && !book && (
            <div className="bg-white p-12 rounded-[2.5rem] text-center shadow-lg border border-slate-100 animate-in zoom-in duration-300">
              <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
              <h3 className="text-xl font-black text-slate-900 mb-2">বই পাওয়া যায়নি!</h3>
              <p className="text-slate-500 mb-8 font-bengali">বারকোডটি সঠিক কিনা যাচাই করুন।</p>
              <button
                onClick={resetScanner}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
