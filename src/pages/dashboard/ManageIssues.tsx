import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { BookmarkMinus, CheckCircle2, Trash2, ShieldAlert, FileDown, BookOpen, ScanFace, Camera as CameraIcon, X, ScanLine, ClipboardList, UserCircle, Clock, MessageSquare, Save, BellRing } from 'lucide-react';
import { onSnapshot, collection, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { sendSMS } from '../../lib/sms';

export default function ManageIssues() {
  const [issues, setIssues] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const { user: currentUser } = useAuth();
  const location = useLocation();
  
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'issue') {
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      setFormData({ 
        bookId: '', 
        userId: '', 
        expectedReturnDate: sevenDaysLater.toISOString().split('T')[0] 
      });
      setShowIssueForm(true);
    }
  }, [location]);

  const [formData, setFormData] = useState({ bookId: '', userId: '', expectedReturnDate: '' });
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
  const barcodeScannerRef = useRef<Html5Qrcode | null>(null);

  const [bookSearchText, setBookSearchText] = useState('');
  const [userSearchText, setUserSearchText] = useState('');

  const lookupBookByBarcode = (code: string) => {
    const term = code.trim().toLowerCase();
    if (!term) return;

    const matchedBook = books.find(b => 
      (b.barcode && b.barcode.trim().toLowerCase() === term) || 
      (b.bookCode && b.bookCode.trim().toLowerCase() === term)
    );

    if (matchedBook) {
      if (matchedBook.status !== 'Available' && matchedBook.status !== 'AVAILABLE') {
        toast.error(`বইটি বর্তমানে ${matchedBook.status === 'Issued' ? 'ইস্যুকৃত' : 'বন্ধ'} অবস্থায় আছে।`);
        return;
      }
      setFormData(prev => ({ ...prev, bookId: matchedBook.id }));
      toast.success(`বইটি পাওয়া গেছে: ${matchedBook.title}`);
      setBarcodeInput('');
    } else {
      toast.error('এই বারকোডের কোনো বই পাওয়া যায়নি।');
    }
  };

  const startBarcodeScanner = async () => {
    setIsBarcodeScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("barcode-reader-issue");
        barcodeScannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.8), height: Math.floor(Math.min(w, h) * 0.8) })
          },
          (decodedText) => {
            html5QrCode.stop().then(() => {
              setIsBarcodeScanning(false);
              barcodeScannerRef.current = null;
              lookupBookByBarcode(decodedText);
            });
          },
          () => {}
        );
      } catch (err) {
        console.error("Scanner error:", err);
        toast.error("ক্যামেরা চালু করতে সমস্যা হয়েছে।");
        setIsBarcodeScanning(false);
      }
    }, 100);
  };

  const stopBarcodeScanner = () => {
    if (barcodeScannerRef.current) {
      barcodeScannerRef.current.stop().then(() => {
        setIsBarcodeScanning(false);
        barcodeScannerRef.current = null;
      }).catch(console.error);
    } else {
      setIsBarcodeScanning(false);
    }
  };

  const [editId, setEditId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getDocs, query, collection, orderBy } = await import('firebase/firestore');
        const db = (await import('../../lib/firebase')).db;

        const checkCache = (key: string) => {
          const cached = sessionStorage.getItem(key);
          const cachedTime = sessionStorage.getItem(`${key}_time`);
          if (cached && cachedTime && (Date.now() - parseInt(cachedTime) < 5 * 60 * 1000)) {
            return JSON.parse(cached);
          }
          return null;
        };
        const setCache = (key: string, data: any) => {
          try {
            sessionStorage.setItem(key, JSON.stringify(data));
            sessionStorage.setItem(`${key}_time`, Date.now().toString());
          } catch (storageErr) {
            console.warn("Could not set cache for", key, storageErr);
          }
        };

        const [issuesSnap, booksSnap, usersSnap] = await Promise.all([
          checkCache('admin_issues_cache') ? null : getDocs(collection(db, "issues")),
          checkCache('admin_books_cache') ? null : getDocs(collection(db, "books")),
          checkCache('admin_users_cache') ? null : getDocs(collection(db, "users"))
        ]);

        if (issuesSnap) {
          const docs = issuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setIssues(docs);
          setCache('admin_issues_cache', docs);
        } else setIssues(checkCache('admin_issues_cache'));

        if (booksSnap) {
          const docs = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl }));
          setBooks(docs);
          setCache('admin_books_cache', docs);
        } else setBooks(checkCache('admin_books_cache'));

        if (usersSnap) {
          const docs = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(docs);
          setCache('admin_users_cache', docs);
        } else setUsers(checkCache('admin_users_cache'));

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'issues/books/users');
      }
    };
    fetchData();
  }, []);

  const updateIssuesCache = (newIssues: any[]) => {
    sessionStorage.setItem('admin_issues_cache', JSON.stringify(newIssues));
    sessionStorage.setItem('admin_issues_cache_time', Date.now().toString());
  };

  const handleSendOverdueAlerts = async () => {
    if (issues.length === 0 || users.length === 0 || books.length === 0) return;

    let processing = false;

    if (processing) return;
    processing = true;
    let alertsSent = 0;

    for (const issue of issues) {
      if ((issue.status === 'ISSUED' || issue.status === 'Issued') && !issue.autoAlertSent && new Date(issue.expectedReturnDate) < new Date()) {
        const issueUser = users.find(u => u.id === issue.userId);
        const issueBook = books.find(b => b.id === issue.bookId);

        if (issueUser && issueUser.phone) {
          const smsMessage = `প্রিয় ${issueUser.name}, পানধোয়া উন্মুক্ত পাঠাগার থেকে নেওয়া আপনার "${issueBook?.title || 'বইটি'}" বইটির ফেরত দেওয়ার তারিখ অতিক্রম হয়েছে। দয়া করে বইটি দ্রুত ফেরত দিন। ওয়েবসাইট: www.pandhoalibrary.org`;
          
          try {
            const success = await sendSMS(issueUser.phone, smsMessage);
            
            if (success) {
                const currentNote = issue.adminNote || '';
                await updateDoc(doc(db, "issues", issue.id), {
                  autoAlertSent: true,
                  adminNote: currentNote ? currentNote + ' | AUTO ALERT SENT' : 'AUTO ALERT SENT'
                });
                alertsSent++;
            }
          } catch (err) {
            console.error("Auto alert failed for issue", issue.id, err);
          }
        }
      }
    }
    processing = false;
    
    if (alertsSent > 0) {
      toast.success(`${alertsSent} জনকে মেয়াদ উত্তীর্ণের মেসেজ পাঠানো হয়েছে।`);
    } else {
      toast.error('নতুন কোনো মেয়াদ উত্তীর্ণ সদস্য পাওয়া যায়নি যাদের মেসেজ পাঠানো বাকি আছে।');
    }
  };

  const handleUpdateNote = async (id: string, text: string = note) => {
    try {
      await updateDoc(doc(db, "issues", id), { adminNote: text });
      setEditId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const handleAlert = async (id: string, userPhone: string) => {
    toast.success(`Alert sent to phone number: ${userPhone || 'N/A'}`);
    await handleUpdateNote(id, 'ALERT SENT (Overdue)');
  };

  const handleIssue = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    console.log('--- Start Book Issue Process ---');
    console.log('Form Data:', formData);

    // 1. Form Validation
    if (!formData.bookId || !formData.userId || !formData.expectedReturnDate) {
      console.warn('Validation failed: missing fields');
      toast.error("Validation Error: Please select a book, a user, and a return date.");
      return;
    }

    // 2. Prepare Data (finding titles/names)
    const selectedBook = books.find(b => b.id === formData.bookId);
    const selectedUser = users.find(u => u.id === formData.userId);

    console.log('Selected Book:', selectedBook);
    console.log('Selected User:', selectedUser);

    if (!selectedBook) {
      console.error('Book not found in the local state:', formData.bookId);
      toast.error("Error: Selected book not found. Please try again.");
      return;
    }

    if (!selectedUser) {
      console.error('User not found in the local state:', formData.userId);
      toast.error("Error: Selected user not found. Please try again.");
      return;
    }

    // Check if user is blocked
    if (selectedUser.borrowBlocked) {
      toast.error(`Error: Membership Blocked! \n\n${selectedUser.blockedReason || "এই সদস্যের বই নেয়ার সুযোগ সাময়িকভাবে বন্ধ আছে।"}`);
      return;
    }

    // Additional check for IDs
    if (!selectedBook.id || !selectedUser.id) {
        console.error('Missing ID in entities:', { bookId: selectedBook.id, userId: selectedUser.id });
        toast.error("Critical Error: Invalid data format (Missing ID). Please contact support.");
        return;
    }

    // 3. Start Loading
    setIsSubmitting(true);

    try {
      if (!currentUser) {
          throw new Error("Authentication Error: You must be logged in to perform this action.");
      }

      // 4. Create Issue Document
      const issueId = `ISS-${Date.now()}`;
      const issueData = {
        bookId: String(selectedBook.id),
        bookTitle: selectedBook.title || 'Untitled',
        bookCode: selectedBook.bookCode || 'N/A',
        userId: String(selectedUser.id),
        userName: selectedUser.name || 'Anonymous',
        memberId: selectedUser.memberId || 'N/A',
        issueDate: new Date().toISOString(),
        returnDate: formData.expectedReturnDate,
        expectedReturnDate: formData.expectedReturnDate,
        status: "ISSUED",
        adminNote: "",
        autoAlertSent: false,
        issuedBy: currentUser.id,
        createdAt: serverTimestamp()
      };

      console.log('Creating Issue Doc with ID:', issueId, 'Payload:', issueData);
      await setDoc(doc(db, "issues", issueId), issueData);
      console.log('Issue document created successfully');
      setIssues(prev => {
        const updated = [...prev, { id: issueId, ...issueData }];
        updateIssuesCache(updated);
        return updated;
      });

      // 5. Update Book Status
      console.log('Updating Book Status for book:', selectedBook.id);
      const bookUpdates = { 
        status: "ISSUED",
        currentReaderName: selectedUser.name || 'Anonymous',
        currentReaderId: selectedUser.id,
        expectedReturnDate: formData.expectedReturnDate,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "books", String(selectedBook.id)), bookUpdates);
      setBooks(prev => {
        const updated = prev.map(b => b.id === selectedBook.id ? { ...b, ...bookUpdates } : b);
        sessionStorage.setItem('admin_books_cache', JSON.stringify(updated));
        sessionStorage.setItem('admin_books_cache_time', Date.now().toString());
        return updated;
      });
      console.log('Book status updated successfully');

      // 6. Success Handling
      toast.success(`Success: ${selectedBook.title} has been successfully issued to ${selectedUser.name}!`);

      console.log("Checking phone number for SMS:", selectedUser.phone);
      if (selectedUser.phone) {
        const bdDate = new Date(formData.expectedReturnDate).toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
        const smsMessage = `প্রিয় ${selectedUser.name}, পানধোয়া উন্মুক্ত পাঠাগার থেকে আপনাকে "${selectedBook.title}" বইটি ইস্যু করা হয়েছে। ফেরত দেওয়ার শেষ তারিখ: ${bdDate}। পাঠাগারের সাথে থাকার জন্য ধন্যবাদ। ওয়েবসাইট: www.pandhoalibrary.org`;
        
        // Send SMS in background to avoid blocking
        (async () => {
          try {
            const success = await sendSMS(selectedUser.phone || '', smsMessage);
            if (!success) {
              toast.error("সদস্যের মোবাইলে SMS পাঠানো সম্ভব হয়নি। দয়া করে API ব্যালেন্স চেক করুন।", { icon: '⚠️' });
            }
          } catch (e) {
            console.error("SMS Error:", e);
          }
        })();
      } else {
        console.warn("User has no phone number, skipping SMS.");
      }

      setFormData({ bookId: '', userId: '', expectedReturnDate: '' });
      setShowIssueForm(false);
      
    } catch (err: any) {
      // 7. Error Handling
      console.error("Critical Problem during book issuance:", err);
      const errorMessage = err.message || "An unexpected error occurred during database write.";
      toast.error(`Critical Error: Failed to issue book. \n\nReason: ${errorMessage}\n\nPlease check console logs for details.`);
      handleFirestoreError(err, OperationType.CREATE, "issues");
    } finally {
      // 8. Reset Loading State
      setIsSubmitting(false);
      console.log('--- End Book Issue Process ---');
    }
  };

  const downloadOverdueReport = () => {
    const overdueIssues = issues.filter(i => {
      if (i.status !== 'ISSUED') return false;
      const expected = new Date(i.expectedReturnDate);
      return expected < new Date();
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    const printContent = overdueIssues.map((i, index) => {
      const book = books.find(b => b.id === i.bookId);
      const user = users.find(u => u.id === i.userId);
      const serialConverted = (index + 1).toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
      const memberIdConverted = user?.memberId ? user.memberId.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'অনির্ধারিত';
      const phoneConverted = user?.phone ? user.phone.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'N/A';
      const expectedDateConverted = new Date(i.expectedReturnDate).toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));

      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${serialConverted}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #1e293b;">${memberIdConverted}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">${user?.name || 'অজানা'}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-family: 'JetBrains Mono', monospace; color: #64748b; font-size: 13px;">${phoneConverted}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${book?.title || 'অজানা বই'}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #e11d48; text-align: right;">${expectedDateConverted}</td>
      </tr>`;
    }).join('');

    const todayDateConverted = new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
    const todayTimeConverted = new Date().toLocaleString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>ওভারডিউ বইয়ের রিপোর্ট</title>
        
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
            body {
                font-family: 'Hind Siliguri', sans-serif;
                padding: 40px;
                color: #0f172a;
                margin: 0;
                background-color: #f8fafc;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid #e2e8f0;
            }
            .logo-placeholder {
                width: 60px;
                height: 60px;
                background: #fff1f2;
                border-radius: 50%;
                margin: 0 auto 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            .title {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 2px;
                color: #0f172a;
            }
            .address-box {
                font-family: 'Outfit', 'Hind Siliguri', sans-serif; 
                font-size: 15px; 
                color: #1e293b; 
                margin: 10px 0; 
                font-weight: 700; 
                background: #f1f5f9; 
                display: inline-block; 
                padding: 4px 18px; 
                border-radius: 10px; 
                border: 1px solid #e2e8f0;
            }
            .subtitle {
                color: #e11d48;
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.5px;
                margin-top: 5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 15px;
                font-family: 'Hind Siliguri', sans-serif;
            }
            th {
                background-color: #f1f5f9;
                padding: 16px;
                text-align: left;
                font-weight: 700;
                color: #475569;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            th:first-child { text-align: center; border-radius: 8px 0 0 8px; }
            th:last-child { text-align: right; border-radius: 0 8px 8px 0; }
            .total-row {
                background-color: #fff1f2;
                border-top: 2px solid #e11d48;
            }
            .total-row td {
                padding: 16px;
                font-weight: 700;
                color: #0f172a;
                font-size: 16px;
                border-bottom: none;
            }
            .total-row td:last-child {
                text-align: right;
                color: #e11d48;
                font-size: 18px;
            }
            .footer {
                margin-top: 60px;
                text-align: center;
                color: #94a3b8;
                font-size: 13px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
            }
            @media print {
                body { padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .container { padding: 0; box-shadow: none; max-width: 100%; }
                .header { margin-top: 0; }
                @page { margin: 20mm; }
                .no-print { display: none !important; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-placeholder">⏰</div>
                <div class="title">পানধোয়া উন্মুক্ত পাঠাগার</div>
                <div class="address-box">ঠিকানা: পানধোয়া, সেনওয়ালিয়া-1344, আশুলিয়া, সাভার, ঢাকা।</div>
                <div class="subtitle">ওভারডিউ (দেরিতে ফেরত) বইয়ের রিপোর্ট — ${todayDateConverted}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>ক্রমিক</th>
                        <th>সদস্য আইডি</th>
                        <th>নাম</th>
                        <th>মোবাইল নম্বর</th>
                        <th>বইয়ের নাম</th>
                        <th>ফেরতের তারিখ</th>
                    </tr>
                </thead>
                <tbody>
                    ${printContent}
                    <tr class="total-row">
                        <td colspan="5" style="text-align: right;">সর্বমোট ওভারডিউ বই:</td>
                        <td>${overdueIssues.length.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))} টি</td>
                    </tr>
                </tbody>
            </table>
            <div class="footer">
                রিপোর্ট জেনারেট করা হয়েছে: ${todayTimeConverted}<br>
                © পানধোয়া উন্মুক্ত পাঠাগার
            </div>
        </div>
        <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="background: #e11d48; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-family: 'Noto Serif Bengali', serif; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.2); transition: all 0.2s;">
                🖨️ প্রিন্ট / পিডিএফ সেভ করুন
            </button>
            <p style="color: #64748b; font-size: 14px; margin-top: 12px; font-family: sans-serif;">মোবাইল ব্রাউজারে সমস্যা হলে উপরের বাটনে ক্লিক করুন</p>
        </div>
        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 800);
            };
        </script>
    </body>
    </html>
    `);
  };

  const handleReturn = async (id: string) => {
    console.log('--- Start Book Return Process ---');
    console.log('Issue ID to return:', id);

    const issue = issues.find(iss => iss.id === id);
    if (!issue) {
      console.error('Issue not found in local state:', id);
      return;
    }
    
    try {
      if (!currentUser) throw new Error("Auth required");

      console.log('Updating Issue Doc:', id);
      const issueUpdates = {
        status: 'Returned',
        returnDate: new Date().toISOString(),
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "issues", id), issueUpdates);
      setIssues(prev => {
        const updated = prev.map(iss => iss.id === id ? { ...iss, ...issueUpdates } : iss);
        updateIssuesCache(updated);
        return updated;
      });
      console.log('Issue record updated to Returned');

      console.log('Updating Book status to Available for bookId:', issue.bookId);
      const returnBookUpdates = { 
        status: 'Available',
        currentReaderName: null,
        currentReaderId: null,
        expectedReturnDate: null,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "books", issue.bookId), returnBookUpdates);
      setBooks(prev => {
        const updated = prev.map(b => b.id === issue.bookId ? { ...b, ...returnBookUpdates } : b);
        sessionStorage.setItem('admin_books_cache', JSON.stringify(updated));
        sessionStorage.setItem('admin_books_cache_time', Date.now().toString());
        return updated;
      });
      console.log('Book status updated successfully');
      toast.success('Book returned successfully!');

      const issueUser = users.find(u => u.id === issue.userId);
      const issueBook = books.find(b => b.id === issue.bookId);
      if (issueUser && issueUser.phone) {
        const smsMessage = `প্রিয় ${issueUser.name}, আপনার জমাকৃত "${issueBook?.title || 'বইটি'}" বইটির ফেরত প্রক্রিয়া সফলভাবে সম্পন্ন হয়েছে। পানধোয়া উন্মুক্ত পাঠাগারের সাথে থাকার জন্য ধন্যবাদ। ওয়েবসাইট: www.pandhoalibrary.org`;
        
        // Send SMS in background
        (async () => {
          try {
            const success = await sendSMS(issueUser.phone || '', smsMessage);
            if (!success) {
              toast.error("ফেরত মেসেজটি পাঠানো সম্ভব হয়নি।", { icon: '⚠️' });
            }
          } catch (e) {
            console.error("SMS Error:", e);
          }
        })();
      }
    } catch (err: any) {
      console.error('Error during return process:', err);
      toast.error('Failed to return book: ' + (err.message || String(err)));
      handleFirestoreError(err, OperationType.UPDATE, `issues/${id}`);
    } finally {
      console.log('--- End Book Return Process ---');
    }
  };

  const handleDeleteIssue = async (id: string) => {
    console.log('--- Delete Issue Process ---');
    console.log('ID to delete:', id);

    if (!window.confirm("Are you sure you want to delete this issue record?")) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      if (!currentUser) throw new Error("Auth required");

      // Find the issue to know which book it was
      const issueToDelete = issues.find(iss => iss.id === id);
      if (issueToDelete && (issueToDelete.status === 'Issued' || issueToDelete.status === 'ISSUED') && issueToDelete.bookId) {
          // Revert book back to Available since the issue record is being deleted without it being returned
        const bookDocRef = doc(db, 'books', issueToDelete.bookId);
        await updateDoc(bookDocRef, {
            status: 'Available',
            currentReaderName: null,
            currentReaderId: null,
            expectedReturnDate: null,
            updatedAt: serverTimestamp()
        });
      }

      await deleteDoc(doc(db, "issues", id));
      setIssues(prev => {
        const updated = prev.filter(iss => iss.id !== id);
        updateIssuesCache(updated);
        return updated;
      });
      console.log('Document deleted successfully from Firestore');
    } catch (err) {
      console.error('Error deleting issue:', err);
      handleFirestoreError(err, OperationType.DELETE, `issues/${id}`);
    } finally {
      console.log('--- End Delete Issue Process ---');
    }
  };

  const userOptions = users.filter(u => 
    u.status === 'active' && 
    u.name?.toLowerCase() !== 'system admin' && 
    u.name?.toLowerCase() !== 'seneia islam' &&
    u.email !== 'seneiaislam@gmail.com'
  ).map(u => ({
    value: u.id,
    label: `${u.name} (আইডি: ${u.memberId ? u.memberId.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'অনির্ধারিত'})`
  }));

  const bookOptions = books.filter(b => b.status === 'Available' || b.status === 'AVAILABLE').map(b => ({
    value: b.id,
    label: `${b.title} ${b.category ? `(${b.category})` : ''} - [${b.bookCode || 'N/A'}]`
  }));

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      border: state.isFocused ? '2px solid #6366f1' : '2px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '0.25rem',
      boxShadow: 'none',
      fontFamily: 'inherit',
      fontSize: '0.875rem',
      fontWeight: '500',
      color: '#334155',
      backgroundColor: 'white',
      '&:hover': {
        border: state.isFocused ? '2px solid #6366f1' : '2px solid #cbd5e1'
      }
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#e0e7ff' : 'transparent',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '0.875rem',
      fontWeight: state.isSelected ? '700' : '500',
      padding: '0.75rem 1rem',
      '&:active': {
        backgroundColor: '#4338ca'
      }
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#94a3b8',
      fontFamily: 'inherit'
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '0.75rem',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      overflow: 'hidden',
      zIndex: 50,
      fontFamily: 'inherit'
    })
  };

  const handleRejectExtend = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে সময় বৃদ্ধির রিকোয়েস্ট বাতিল করতে চান?")) return;
    try {
      const updates = {
        extendRequested: false,
        adminNote: "সময় বৃদ্ধির রিকোয়েস্ট বাতিল করা হয়েছে। দয়া করে বইটি দ্রুত ফেরত দিন।",
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "issues", id), updates);
      
      setIssues(prev => {
        const updated = prev.map(iss => iss.id === id ? { ...iss, ...updates } : iss);
        updateIssuesCache(updated);
        return updated;
      });
      
      toast.success('রিকোয়েস্ট বাতিল করা হয়েছে।');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const [extendConfig, setExtendConfig] = useState<{ id: string, currentDateStr: string } | null>(null);
  const [extendDays, setExtendDays] = useState(7);

  const confirmExtension = async () => {
    if (!extendConfig) return;
    const { id, currentDateStr } = extendConfig;
    if (isNaN(extendDays) || extendDays <= 0) {
      toast.error("Invalid number of days.");
      return;
    }
    try {
      const currentExpected = new Date(currentDateStr);
      currentExpected.setDate(currentExpected.getDate() + extendDays);
      const newDateIso = currentExpected.toISOString();
      const bdDate = currentExpected.toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
      
      const updates = {
        extendRequested: false,
        expectedReturnDate: newDateIso,
        adminNote: `সময় বৃদ্ধি করা হয়েছে। নতুন তারিখ: ${bdDate}`,
        autoAlertSent: false,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "issues", id), updates);
      
      setIssues(prev => {
        const updated = prev.map(iss => iss.id === id ? { ...iss, extendRequested: false, expectedReturnDate: newDateIso, adminNote: `সময় বৃদ্ধি করা হয়েছে। নতুন তারিখ: ${bdDate}`, autoAlertSent: false } : iss);
        updateIssuesCache(updated);
        return updated;
      });
      
      toast.success('সময় বৃদ্ধি করা হয়েছে।');

      setExtendConfig(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const handleAcceptExtend = (id: string, currentExpectedStr: string) => {
    setExtendConfig({ id, currentDateStr: currentExpectedStr });
  };

  const filteredIssues = issues.filter(i => {
    if (filterStatus === 'returned' && i.status !== 'Returned') return false;
    if (filterStatus === 'issued' && i.status !== 'ISSUED' && i.status !== 'Issued') return false;
    if (filterStatus === 'overdue') {
       if (i.status !== 'ISSUED' && i.status !== 'Issued') return false;
       if (new Date(i.expectedReturnDate) >= new Date()) return false;
    }
    if (filterStatus === 'extend' && !i.extendRequested) return false;

    const book = books.find(b => b.id === i.bookId);
    const user = users.find(u => u.id === i.userId);
    const term = search.toLowerCase();
    return (book?.bookCode?.toLowerCase()?.includes(term) || book?.title?.toLowerCase()?.includes(term) || user?.memberId?.toLowerCase()?.includes(term) || user?.name?.toLowerCase()?.includes(term));
  });

  const groupedIssues = Object.values(filteredIssues.reduce((acc, issue) => {
    if (!acc[issue.userId]) {
      acc[issue.userId] = {
        userId: issue.userId,
        member: users.find(u => u.id === issue.userId),
        issues: []
      };
    }
    acc[issue.userId].issues.push(issue);
    return acc;
  }, {} as Record<string, { userId: string, member: any, issues: any[] }>));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-bengali">
      {/* Page Header & Stats Summary */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
               <BookmarkMinus className="w-8 h-8 text-indigo-600" />
               ইস্যু ও ফেরত ব্যবস্থাপনা
             </h2>
             <p className="text-slate-500 font-medium text-sm mt-1">পাঠাগারের বই লেনদেন ও সদস্যদের বই ফেরত কার্যক্রম পরিচালনা করুন।</p>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const sevenDaysLater = new Date();
              sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
              setFormData({ 
                bookId: '', 
                userId: '', 
                expectedReturnDate: sevenDaysLater.toISOString().split('T')[0] 
              });
              setShowIssueForm(true);
            }} 
            className="flex items-center justify-center gap-2 bg-indigo-600 shadow-xl shadow-indigo-600/20 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-indigo-700 transition-all font-bengali"
          >
            <BookOpen className="w-5 h-5" />
            নতুন বই ইস্যু করুন
          </motion.button>
        </div>

        {/* Quick Stats & Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">মোট ইস্যুকৃত</p>
              <p className="text-xl font-black text-slate-800">
                {issues.filter(i => i.status === 'ISSUED' || i.status === 'Issued').length.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))} টি
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">ওভারডিউ বা লেট</p>
              <p className="text-xl font-black text-rose-600">
                {issues.filter(i => (i.status === 'ISSUED' || i.status === 'Issued') && new Date(i.expectedReturnDate) < new Date()).length.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))} টি
              </p>
            </div>
          </div>

          <button onClick={handleSendOverdueAlerts} className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-4 hover:bg-indigo-100 transition-all text-left">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
              <ScanFace className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[12px] font-black text-indigo-700 leading-tight">মেয়াদ উত্তীর্ণদের<br />মেসেজ পাঠান</p>
              <p className="text-[10px] text-indigo-500 mt-0.5 font-bold uppercase tracking-widest">এক ক্লিকেই</p>
            </div>
          </button>

          <button onClick={downloadOverdueReport} className="bg-slate-900 p-5 rounded-2xl shadow-xl shadow-slate-200 border border-slate-800 flex items-center gap-4 hover:bg-black transition-all text-left">
            <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center">
              <FileDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[12px] font-black text-white leading-tight">ওভারডিউ প্রিন্ট<br />রিপোর্ট ডাউনলোড</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-widest">পিডিএফ ভার্সন</p>
            </div>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="বইয়ের নাম, কোড বা মেম্বার আইডি দিয়ে খুঁজুন..." 
            className="w-full bg-slate-50 border-2 border-slate-100 px-12 py-4 rounded-2xl text-base font-medium shadow-inner focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <BookmarkMinus className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            {id:'all',l:'সবগুলো', color: 'slate'},
            {id:'issued',l:'বর্তমানে ইস্যুকৃত', color: 'indigo'},
            {id:'overdue',l:'ওভারডিউ বা লেট', color: 'rose'},
            {id:'returned',l:'ফেরত দেওয়া', color: 'emerald'},
            {id:'extend',l:'সময় বৃদ্ধির রিকোয়েস্ট', color: 'amber'}
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilterStatus(btn.id)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border tracking-wide ${
                filterStatus === btn.id 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                : "bg-white text-slate-600 border-slate-100 hover:bg-slate-50 hover:border-slate-200"
              }`}
            >
              {btn.l}
            </button>
          ))}
        </div>
      </div>

      {extendConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-900 mb-2 font-bengali">সময় বৃদ্ধি করুন</h3>
            <p className="text-slate-500 text-sm mb-6 font-bengali">কত দিন সময় বাড়াতে চান লিখুন (ডিফল্ট ৭ দিন)।</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 font-bengali">দিন সংখ্যা</label>
                <input 
                  type="number" 
                  value={extendDays} 
                  onChange={e => setExtendDays(Number(e.target.value))} 
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono text-center font-bold text-lg" 
                  min="1"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setExtendConfig(null)} 
                  className="flex-1 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-bold font-bengali transition-colors"
                >
                  বাতিল
                </button>
                <button 
                  onClick={confirmExtension} 
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 font-bengali"
                >
                  নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIssueForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto font-bengali">
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 relative my-4 sm:my-8 overflow-hidden sticky top-4">
            
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <div className="sticky top-0 bg-white z-10 px-8 sm:px-10 py-6 border-b border-slate-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><BookOpen className="w-7 h-7" /></div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-bengali">নতুন বই ইস্যু</h3>
            </div>
            
            <div className="px-8 sm:px-10 py-4 bg-slate-50 border-b border-slate-100">
               <div className="flex flex-col gap-3">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-bengali">বারকোড স্ক্যান করুন (মেশিন দিয়ে)</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={barcodeInput}
                        onChange={e => setBarcodeInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            lookupBookByBarcode(barcodeInput);
                          }
                        }}
                        placeholder="বারকোড মেশিন দিয়ে স্ক্যান করুন..."
                        className="w-full bg-white border-2 border-slate-200 px-10 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                      />
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-[1px] flex-1 bg-slate-200"></div>
                    <span className="text-[10px] font-bold text-slate-400 font-bengali uppercase">অথবা</span>
                    <div className="h-[1px] flex-1 bg-slate-200"></div>
                  </div>

                  {isBarcodeScanning ? (
                    <div className="bg-slate-900 rounded-2xl overflow-hidden p-2">
                       <div id="barcode-reader-issue" className="w-full aspect-square bg-black rounded-xl overflow-hidden"></div>
                       <button 
                         type="button" 
                         onClick={stopBarcodeScanner}
                         className="w-full mt-2 bg-rose-500 text-white py-2 rounded-lg font-bold font-bengali text-xs"
                       >
                         স্ক্যান বন্ধ করুন
                       </button>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      onClick={startBarcodeScanner}
                      className="w-full bg-white border-2 border-indigo-100 hover:bg-slate-50 text-indigo-600 p-3 rounded-xl font-bold font-bengali flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                    >
                      <CameraIcon className="w-5 h-5" /> মোবাইলের ক্যামেরা দিয়ে স্ক্যান
                    </button>
                  )}
               </div>
            </div>

            <form onSubmit={handleIssue} className="p-8 sm:p-10 pt-4 sm:pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider font-bengali">বই <span className="text-rose-500">*</span></label>
                  <Select
                    options={bookOptions}
                    value={bookOptions.find(o => o.value === formData.bookId) || null}
                    onChange={(option: any) => {
                      setFormData(p => ({...p, bookId: option?.value || ''}));
                    }}
                    placeholder="বই খুঁজুন..."
                    styles={selectStyles}
                    classNamePrefix="react-select"
                    className="text-sm font-medium focus:outline-none font-bengali"
                    required
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider font-bengali">সদস্য <span className="text-rose-500">*</span></label>
                  <Select
                    options={userOptions}
                    value={userOptions.find(o => o.value === formData.userId) || null}
                    onChange={(option: any) => {
                      setFormData(p => ({...p, userId: option?.value || ''}));
                    }}
                    placeholder="সদস্য খুঁজুন..."
                    styles={selectStyles}
                    classNamePrefix="react-select"
                    className="text-sm font-medium focus:outline-none font-bengali"
                    required
                  />
                  {formData.userId && (
                    <div className={`mt-3 p-4 rounded-xl flex items-center justify-between shadow-sm border ${users.find(u => u.id === formData.userId)?.borrowBlocked ? "bg-rose-50 border-rose-200" : "bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100"}`}>
                      <div>
                        <p className={`text-sm font-extrabold ${users.find(u => u.id === formData.userId)?.borrowBlocked ? "text-rose-700" : "text-slate-800"}`}>
                          {users.find(u => u.id === formData.userId)?.name}
                        </p>
                        {users.find(u => u.id === formData.userId)?.borrowBlocked && (
                          <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-widest animate-pulse font-bengali">
                            সদস্য সাময়িকভাবে স্থগিত: {users.find(u => u.id === formData.userId)?.blockedReason || "কোন কারণ উল্লেখ করা হয়নি"}
                          </p>
                        )}
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest border shadow-sm ${users.find(u => u.id === formData.userId)?.borrowBlocked ? "bg-rose-600 text-white border-rose-600" : "bg-white text-indigo-700 border-indigo-200"}`}>
                        ID: #{users.find(u => u.id === formData.userId)?.memberId || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-1.5 max-w-sm">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider font-bengali">ফেরতের সম্ভাব্য তারিখ <span className="text-rose-500">*</span></label>
                <input type="date" required value={formData.expectedReturnDate ? formData.expectedReturnDate.split('T')[0] : ''} onChange={e => {
                  const val = e.target.value;
                  if (!val) {
                    setFormData(p => ({...p, expectedReturnDate: ''}));
                    return;
                  }
                  try {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      setFormData(p => ({...p, expectedReturnDate: d.toISOString()}));
                    }
                  } catch (e) {
                    // ignore
                  }
                }} className="w-full border-2 border-slate-200 px-4 py-2 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-700 transition font-bengali" />
              </div>
              
              <div className="sticky bottom-0 bg-white z-10 flex justify-end gap-3 py-6 border-t border-slate-50">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => setShowIssueForm(false)} 
                  className="px-6 py-2.5 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition disabled:opacity-50 font-bengali"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-slate-900 shadow-xl shadow-slate-900/10 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bengali"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      প্রসেস করা হচ্ছে...
                    </>
                  ) : 'নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="bg-transparent overflow-hidden">
        <div className="flex items-center justify-between mb-4 px-2">
           <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              সাম্প্রতিক লেনদেন সমূহ
           </h3>
           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
             মোট {filteredIssues.length.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))} টি ফলাফল
           </span>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {groupedIssues.map((group: any, idx) => {
              const member = group.member;
              
              return (
                <motion.div 
                  key={group.userId}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white rounded-[1.5rem] p-5 md:p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden group"
                >
                  {/* Left border indicator */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-400"></div>

                  <div className="pl-2">
                    {/* User Profile Header */}
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-50">
                      <div className="w-12 h-12 bg-indigo-50 rounded-full border border-indigo-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {member?.photoURL ? (
                           <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                           <UserCircle className="w-8 h-8 text-indigo-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-0.5">সদস্যের তথ্য</p>
                        <h4 className="text-base md:text-lg font-black text-slate-800 leading-tight line-clamp-1">{member?.name || 'অজানা সদস্য'}</h4>
                        <p className="text-[11px] font-bold text-indigo-500 mt-0.5">ID: #{member?.memberId?.replace(/[0-9]/g, (w: string) => String.fromCharCode(w.charCodeAt(0) + 2486)) || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Issued Books List */}
                    <div className="space-y-4">
                      {group.issues.map((i: any) => {
                        const book = books.find(b => b.id === i.bookId);
                        const isOverdue = (i.status === 'ISSUED' || i.status === 'Issued') && new Date(i.expectedReturnDate) < new Date();

                        return (
                          <div key={i.id} className="relative bg-slate-50 border border-slate-100 rounded-xl p-4 transition hover:bg-slate-100/50">
                            <div className="flex flex-col md:flex-row gap-5">
                              {/* Book Info */}
                              <div className="flex-1 flex gap-3.5">
                                <div className="w-14 h-20 md:w-16 md:h-24 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-slate-200 shadow-sm">
                                  {book?.cover ? (
                                     <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                                  ) : (
                                     <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                        <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-slate-300" />
                                     </div>
                                  )}
                                </div>
                                <div className="flex flex-col justify-center py-1 flex-1">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center shrink-0 ${i.status === 'Returned' ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                      {i.status === 'Returned' ? 'ফেরত দেওয়া হয়েছে' : isOverdue ? 'ওভারডিউ' : 'ইস্যুকৃত'}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">#{i.id.slice(-6).replace(/[0-9]/g, (w: string) => String.fromCharCode(w.charCodeAt(0) + 2486))}</span>
                                  </div>

                                  <h5 className="text-sm md:text-base font-black text-slate-800 leading-tight mb-1">{book?.title || 'অজানা বই'}</h5>
                                  <div className="text-[11px] font-medium text-slate-500 mb-2 line-clamp-1">{book?.author || 'অজানা লেখক'}</div>
                                  
                                  <div className="flex flex-wrap gap-2 mt-auto">
                                     <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded text-[10px] font-bold text-slate-500 border border-slate-200 shadow-sm">
                                       <ScanLine className="w-3 h-3 text-slate-400" />
                                       {book?.bookCode?.replace(/[0-9]/g, (w: string) => String.fromCharCode(w.charCodeAt(0) + 2486)) || 'N/A'}
                                     </span>
                                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${isOverdue ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-white text-slate-600 border border-slate-200'}`}>
                                       <Clock className="w-3 h-3 opacity-70" />
                                       ফেরত: {i.expectedReturnDate ? new Date(i.expectedReturnDate).toLocaleDateString('bn-BD').replace(/[0-9]/g, (w: string) => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'N/A'}
                                     </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions for individual issue */}
                            <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                               <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditId(i.id);
                                      setNote(i.adminNote || '');
                                    }}
                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm"
                                    title="নোট"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                  {(i.status === 'ISSUED' || i.status === 'Issued') && (
                                    <button 
                                      onClick={() => handleAcceptExtend(i.id, i.expectedReturnDate)}
                                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-colors shadow-sm"
                                      title="সময় বৃদ্ধি করুন"
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleDeleteIssue(i.id)}
                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors shadow-sm"
                                    title="ডিলিট"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {(i.status === 'ISSUED' || i.status === 'Issued') && isOverdue && member?.phone && (
                                    <button 
                                      onClick={() => handleAlert(i.id, member.phone)}
                                      className="flex items-center justify-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-100 px-3 h-8 rounded-lg font-bold text-[10px] hover:bg-rose-100 transition shadow-sm"
                                    >
                                      <BellRing className="w-3" /> রিমাইন্ডার
                                    </button>
                                  )}
                               </div>

                               {(i.status === 'ISSUED' || i.status === 'Issued') && (
                                  <button 
                                    onClick={() => handleReturn(i.id)}
                                    className="flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-4 h-8 rounded-lg font-bold text-[11px] hover:bg-indigo-700 transition shadow-sm active:scale-95"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> বই ফেরত
                                  </button>
                               )}
                            </div>

                            {/* Extension Request Banner */}
                            {i.extendRequested && (
                              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                                <div className="flex items-center gap-2">
                                  <div className="bg-amber-100 p-1 rounded-full text-amber-600">
                                     <Clock className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold text-amber-900 leading-tight">সময় বৃদ্ধির রিকোয়েস্ট</p>
                                    <p className="text-[9px] font-medium text-amber-700">সদস্য বইটি ফেরত দেয়ার সময় বাড়াতে চাচ্ছেন।</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                   <button onClick={() => handleAcceptExtend(i.id, i.expectedReturnDate)} className="px-3 py-1.5 bg-amber-500 text-white rounded text-[10px] font-bold hover:bg-amber-600 shadow-sm active:scale-95 transition-all">অনুমোদন</button>
                                   <button onClick={() => handleRejectExtend(i.id)} className="px-3 py-1.5 bg-white text-rose-600 border border-slate-200 rounded text-[10px] font-bold hover:bg-rose-50 hover:border-rose-200 active:scale-95 shadow-sm transition-all">বাতিল</button>
                                </div>
                              </div>
                            )}

                            {/* Edit Note Overlay for individual issue */}
                            {editId === i.id && (
                              <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm p-4 rounded-xl flex flex-col justify-center animate-in fade-in zoom-in-95">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                     <MessageSquare className="w-3 h-3 text-indigo-500" /> নোট
                                  </p>
                                  <button onClick={() => setEditId(null)} className="p-1 text-slate-400 hover:text-rose-500 rounded bg-rose-50/0 hover:bg-rose-50 transition"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="flex gap-2">
                                   <input className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-0 px-3 py-2 rounded-lg text-xs font-bold font-bengali" placeholder="কিছু লিখুন..." value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateNote(i.id); }} autoFocus />
                                   <button onClick={() => handleUpdateNote(i.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm"><Save className="w-3 h-3" /> সেভ</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {filteredIssues.length === 0 && (
             <div className="bg-white p-12 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                   <BookmarkMinus className="w-10 h-10 text-slate-300" />
                </div>
                <div>
                   <h4 className="text-lg font-black text-slate-800">কোনো কিছু পাওয়া যায়নি</h4>
                   <p className="text-slate-500 font-medium">আপনার ফিল্টার বা সার্চ টার্ম পরিবর্তন করে চেষ্টা করুন।</p>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
