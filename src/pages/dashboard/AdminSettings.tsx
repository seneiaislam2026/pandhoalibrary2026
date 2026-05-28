import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, Users, FileText, Settings as SettingsIcon, Image as ImageIcon, CheckCircle, UploadCloud, Shield, Trash2, Bell, MessageSquare, ShieldAlert, UserX, Clock, LayoutGrid, Tags, ScanFace, X, Camera as CameraIcon, Package, Download, Send, Printer, Search, ArrowRight, Command, GraduationCap, Copy, UserPlus, Plus, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import Select from 'react-select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { sendSMS } from '../../lib/sms';

const availableSubadminRoutes = [
  { name: 'সদস্য ব্যবস্থাপনা (Users)', path: '/dashboard/users' },
  { name: 'বইয়ের তালিকা (Inventory)', path: '/dashboard/books' },
  { name: 'শেল্ফ ব্যবস্থাপনা (Shelves)', path: '/dashboard/manage-shelves' },
  { name: 'ক্যাটাগরি ব্যবস্থাপনা (Categories)', path: '/dashboard/manage-categories' },
  { name: 'ইস্যু ও ফেরত (Issues)', path: '/dashboard/issues' },
  { name: 'সদস্যদের বকেয়া (Dues)', path: '/dashboard/dues' },
  { name: 'দাতা সদস্য (Donors)', path: '/dashboard/donors' },
  { name: 'হিসাব-নিকাশ (Finances)', path: '/dashboard/finances' },
  { name: 'নোটিশ', path: '/dashboard/notices' },
  { name: 'মেসেজসমূহ', path: '/dashboard/messages' },
  { name: 'বইয়ের অনুরোধ (Requests)', path: '/dashboard/book-requests' },
  { name: 'বারকোড স্ক্যানার (Scanner)', path: '/dashboard/barcode-scanner' },
  { name: 'প্রি-বুকিং', path: '/dashboard/pre-bookings' },
  { name: 'শপ বই ব্যবস্থাপনা', path: '/dashboard/shop-books' },
  { name: 'বই বিক্রয় অর্ডার', path: '/dashboard/shop-orders' },
  { name: 'বই কিনুন (Shop)', path: '/buy-books' },
  { name: 'স্টিকার ও QR', path: '/dashboard/stickers' },
  { name: 'বুক রিভিও', path: '/dashboard/manageblog' },
  { name: 'Event', path: '/dashboard/events' }
];

import { compressImage } from '../../lib/imageUtils';

export default function AdminSettings() {
  const [eventBanners, setEventBanners] = useState<string[]>([]);
  const [subadminAccess, setSubadminAccess] = useState<string[]>([]);
  const [aiToken, setAiToken] = useState<string>('');
  const [smsToken, setSmsToken] = useState<string>('');
  const [callToken, setCallToken] = useState<string>('');
  const [callSenderId, setCallSenderId] = useState<string>('');
  const [smsSenderId, setSmsSenderId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  const [customGreetingEnabled, setCustomGreetingEnabled] = useState(false);
  const [customGreetingTitle, setCustomGreetingTitle] = useState('');
  const [customGreetingSubtitle, setCustomGreetingSubtitle] = useState('');
  const [inaugurationEnabled, setInaugurationEnabled] = useState(false);
  const [inaugurationTitle, setInaugurationTitle] = useState('পানধোয়া উন্মুক্ত পাঠাগার');
  const [inaugurationSubtitle, setInaugurationSubtitle] = useState('শুভ উদ্বোধন');
  const [inaugurationMessage, setInaugurationMessage] = useState('জ্ঞান ও প্রযুক্তির আলোয় আলোকিত হোক আমাদের সমাজ। পাঠাগারের এই নতুন যাত্রায় আপনাকে স্বাগতম। আসুন, বইয়ের পাতায় খুঁজি নতুন এক পৃথিবী।');
  const [inaugurationButtonText, setInaugurationButtonText] = useState('অটোমেশন উদ্বোধন');
  const [inaugurationTargetUsers, setInaugurationTargetUsers] = useState<string[]>([]);
  const [allUsersList, setAllUsersList] = useState<{value: string, label: string, phone?: string}[]>([]);

  // Website Customization State
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactFacebook, setContactFacebook] = useState('');
  const [homeIconUrl, setHomeIconUrl] = useState('');
  const [websiteTitle, setWebsiteTitle] = useState('পানধোয়া উন্মুক্ত পাঠাগার');
  const [websiteSubtitle, setWebsiteSubtitle] = useState('জ্ঞানের আলোয় সমাজ গড়ি');
  const [websiteDescription, setWebsiteDescription] = useState('একটি আধুনিক সমাজ বিনির্মাণে বইয়ের কোনো বিকল্প নেই। পানধোয়া উন্মুক্ত পাঠাগারে আপনাকে স্বাগতম। আসুন এক সাথে বই পড়ি।');
  const [readerRegistrationQuestions, setReaderRegistrationQuestions] = useState<string[]>([]);
  const [isReaderRegistrationFree, setIsReaderRegistrationFree] = useState(false);
  const [isAcademicPortalEnabled, setIsAcademicPortalEnabled] = useState(false);
  const [isKioskModeEnabled, setIsKioskModeEnabled] = useState(true);
  const [hiddenDashboardIcons, setHiddenDashboardIcons] = useState<Record<string, boolean>>({});

  // Custom SMS State
  const [customSmsMessage, setCustomSmsMessage] = useState('');
  const [customSmsTargetUsers, setCustomSmsTargetUsers] = useState<string[]>([]);
  const [customSmsSending, setCustomSmsSending] = useState(false);
  const [customSmsTargetType, setCustomSmsTargetType] = useState<'all' | 'specific'>('specific');

  // AI Scanner State
  const [showAiScanner, setShowAiScanner] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Form Print Modal State
  const [isPrintFormModalOpen, setIsPrintFormModalOpen] = useState(false);
  const [selectedUserForForm, setSelectedUserForForm] = useState<{value: string, label: string} | null>(null);

  // Scholarship Print Modal State
  const [isPrintScholarshipModalOpen, setIsPrintScholarshipModalOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<{value: string, label: string, data?: any} | null>(null);
  const [allApplicantsList, setAllApplicantsList] = useState<{value: string, label: string, data: any}[]>([]);

  // ID Card Print Modal State
  const [isPrintIdCardModalOpen, setIsPrintIdCardModalOpen] = useState(false);
  const [selectedUserForIdCard, setSelectedUserForIdCard] = useState<{value: string, label: string} | null>(null);

  // Added newly mapped state for the book save
  const [scannedBookDetails, setScannedBookDetails] = useState<any>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchItems = [
    { title: 'বৃত্তি সদস্য ব্যবস্থাপনা', path: '/dashboard/scholarship-management', category: 'সদস্য ব্যবস্থাপনা' },
    { title: 'পরিচালনা পর্ষদ', path: '/dashboard/manageteam', category: 'সদস্য ব্যবস্থাপনা' },
    { title: 'মেসেজসমূহ', path: '/dashboard/messages', category: 'সদস্য ব্যবস্থাপনা' },
    { title: 'রিসেট রিকোয়েস্ট', path: '/dashboard/reset-requests', category: 'সদস্য ব্যবস্থাপনা' },
    { title: 'সদস্য ডিলিট করুন', path: '/dashboard/delete-users', category: 'সদস্য ব্যবস্থাপনা' },
    { title: 'শেল্ফ ব্যবস্থাপনা', path: '/dashboard/manage-shelves', category: 'বই ও লাইব্রেরি' },
    { title: 'ক্যাটাগরি ব্যবস্থাপনা', path: '/dashboard/manage-categories', category: 'বই ও লাইব্রেরি' },
    { title: 'অনুরোধকৃত বই', path: '/dashboard/book-requests', category: 'বই ও লাইব্রেরি' },
    { title: 'প্রি-বুকিং ব্যবস্থাপনা', path: '/dashboard/pre-bookings', category: 'বই ও লাইব্রেরি' },
    { title: 'Event', path: '/dashboard/events', category: 'কন্টেন্ট ও ইভেন্ট' },
    { title: 'বুক রিভিও ও ব্লগ', path: '/dashboard/manageblog', category: 'কন্টেন্ট ও ইভেন্ট' },
    { title: 'নোটিশ বোর্ড', path: '/dashboard/notices', category: 'কন্টেন্ট ও ইভেন্ট' },
    { title: 'গঠনতন্ত্র সেটিংস', path: '/dashboard/constitution', category: 'কন্টেন্ট ও ইভেন্ট' },
    { title: 'বৃত্তি আবেদনের পোর্টাল', path: '/dashboard/scholarship-registration', category: 'ফর্ম ও প্রিন্টিং' },
    { title: 'বৃত্তি ফর্ম প্রিন্ট', action: () => setIsPrintScholarshipModalOpen(true), category: 'ফর্ম ও প্রিন্টিং' },
    { title: 'ভর্তি ফর্ম প্রিন্ট', action: () => setIsPrintFormModalOpen(true), category: 'ফর্ম ও প্রিন্টিং' },
    { title: 'আইডি কার্ড প্রিন্ট', action: () => setIsPrintIdCardModalOpen(true), category: 'ফর্ম ও প্রিন্টিং' },
    { title: 'Gemini এআই স্ক্যানার', action: () => setShowAiScanner(true), category: 'এআই টুলস' },
  ];

  const filteredItems = searchQuery.trim() === '' 
    ? [] 
    : searchItems.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.eventBanners)) setEventBanners(data.eventBanners);
          else if (data.eventBanner) setEventBanners([data.eventBanner]);
          else setEventBanners([]);
          setSubadminAccess(data.subadminAccess || []);
          setAiToken(data.sysToken || '');
          setSmsToken(data.smsToken || '');
          setCallToken(data.callToken || '');
          setCallSenderId(data.callSenderId || '');
          setSmsSenderId(data.smsSenderId || '');
          setCustomGreetingEnabled(data.customGreetingEnabled || false);
          setCustomGreetingTitle(data.customGreetingTitle || '');
          setCustomGreetingSubtitle(data.customGreetingSubtitle || '');
          setInaugurationEnabled(data.inaugurationEnabled || false);
          setInaugurationTitle(data.inaugurationTitle || 'পানধোয়া উন্মুক্ত পাঠাগার');
          setInaugurationSubtitle(data.inaugurationSubtitle || 'শুভ উদ্বোধন');
          setInaugurationMessage(data.inaugurationMessage || 'আমাদের প্রতিষ্ঠাবার্ষিকী অনুষ্ঠানে সকল সম্মানিত অতিথিবৃন্দকে জানাই আন্তরিক শুভেচ্ছা ও স্বাগত। জ্ঞান ও প্রযুক্তির আলোয় আলোকিত হোক আমাদের সমাজ। আসুন, বইয়ের পাতায় খুঁজি নতুন এক পৃথিবী।');
          setInaugurationButtonText(data.inaugurationButtonText || 'অটোমেশন উদ্বোধন');
          setInaugurationTargetUsers(data.inaugurationTargetUsers || []);

          setContactPhone(data.contactPhone || '');
          setContactEmail(data.contactEmail || '');
          setContactAddress(data.contactAddress || '');
          setContactFacebook(data.contactFacebook || '');
          setHomeIconUrl(data.homeIconUrl || '');
          setWebsiteTitle(data.websiteTitle || 'পানধোয়া উন্মুক্ত পাঠাগার');
          setWebsiteSubtitle(data.websiteSubtitle || 'জ্ঞানের আলোয় সমাজ গড়ি');
          setWebsiteDescription(data.websiteDescription || 'একটি আধুনিক সমাজ বিনির্মাণে বইয়ের কোনো বিকল্প নেই। পানধোয়া উন্মুক্ত পাঠাগারে আপনাকে স্বাগতম। আসুন এক সাথে বই পড়ি।');
          setReaderRegistrationQuestions(data.readerRegistrationQuestions || []);
          setIsReaderRegistrationFree(data.isReaderRegistrationFree || false);
          setIsAcademicPortalEnabled(data.isAcademicPortalEnabled || false);
          setIsKioskModeEnabled(data.isKioskModeEnabled !== false);
          setHiddenDashboardIcons(data.hiddenDashboardIcons || {});
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();

    const fetchAllUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(doc => ({
          value: doc.id,
          label: `${doc.data().memberId ? `#${doc.data().memberId} - ` : ''}${(doc.data().name || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`).trim()}`,
          phone: doc.data().phone || ''
        }));
        setAllUsersList(users);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAllUsers();

    const fetchScholarshipApplicants = async () => {
      try {
        const snap = await getDocs(collection(db, 'scholarship_applications'));
        const applicants = snap.docs.map(doc => ({
          value: doc.id,
          label: `${doc.data().studentName || ''} - ${doc.data().applicationId || ''}`,
          data: { id: doc.id, ...doc.data() }
        }));
        setAllApplicantsList(applicants);
      } catch (err) {
        console.error(err);
      }
    };
    fetchScholarshipApplicants();

    const fetchCategories = async () => {
      try {
        const booksRef = collection(db, 'books');
        const querySnapshot = await getDocs(booksRef);
        const cats = new Set<string>();
        querySnapshot.forEach(doc => {
          const cat = doc.data().category;
          if (cat) cats.add(cat);
        });
        setCategories(Array.from(cats).sort());
      } catch (err) {
        console.error("Error fetching categories for export:", err);
      }
    };
    fetchCategories();
  }, []);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error('ক্যামেরা চালু করতে সমস্যা হয়েছে।');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const generateBookCode = async (categoryStr: string) => {
    try {
      const dbRef = collection(db, "books");
      const q = query(dbRef, where("category", "==", categoryStr));
      const res = await getDocs(q);
      const count = res.size + 1;
      const getPrefix = (cat: string) => {
        if (!cat) return "GEN";
        if (cat.includes("শিশু")) return "CHI";
        if (cat.includes("ইসলাম")) return "ISL";
        if (cat.includes("গল্প") || cat.includes("ফুটবল")) return "STO";
        if (cat.includes("ইতিহাস")) return "HIS";
        if (cat.includes("প্রবন্ধ")) return "ESS";
        if (cat.includes("কবিতা")) return "POE";
        if (cat.includes("জীবনী")) return "BIO";
        if (cat.includes("বিজ্ঞান")) return "SCI";
        if (cat.includes("উপন্যাস")) return "NOV";
        if (cat.includes("নাটক")) return "DRA";
        return cat.substring(0, 3).toUpperCase();
      };
      const r = Math.floor(100 + Math.random() * 900);
      return `${getPrefix(categoryStr)}-${count}${r}`;
    } catch {
      return `BOK-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsAiProcessing(true);
    const toastId = toast.loading('Gemini বইয়ের কাভার থেকে তথ্য পড়ছে...', { style: { fontFamily: 'Hind Siliguri' } });

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not possible');
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.5);
      const base64Data = base64Image.split(',')[1];

      const sysInstruction = `You are an AI assistant that extracts book details from book covers, specifically for Bengali and English books. Look at the image provided and extract the book's title, author, and likely category in Bengali text. Category must be one of: "শিশু-কিশোর", "ইসলামী বই", "গল্প", "ইতিহাস", "প্রবন্ধ", "কবিতা", "জীবনী ও স্মৃতিচারণ", "বিজ্ঞান", "উপন্যাস", "নাটক" or a fitting short Bengali label. Return a strict JSON object without markdown formatting, using these exact keys: "title", "author", "category". If you cannot identify the title, output "". Do the same for author and category. Example: {"title": "হিমু", "author": "হুমায়ূন আহমেদ", "category": "উপন্যাস"}`;

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: sysInstruction,
          contents: [{
            role: "user",
            parts: [
              { text: "Extract the book info from this cover image." },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Failed');

      // Extract JSON from response text
      let text = data.text;
      
      // Attempt to clean markdown json blocks if any
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
         text = text.split('```')[1].split('```')[0].trim();
      }

      const bookData = JSON.parse(text);
      if (!bookData.title) throw new Error('বইয়ের নাম পাওয়া যায়নি। আবার চেষ্টা করুন।');

      // Success
      toast.success('সফলভাবে তথ্য পাওয়া গেছে!', { id: toastId });
      stopCamera();
      
      const bookCode = await generateBookCode(bookData.category);

      setScannedBookDetails({
         ...bookData,
         cover: base64Image,
         bookCode,
         shelfNo: '',
         status: 'Available',
         review: '',
         description: ''
      });

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error parsing image, try again.', { id: toastId });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const saveAiBook = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!scannedBookDetails) return;
     try {
       const toastId = toast.loading('বই সেভ করা হচ্ছে...');
       await addDoc(collection(db, "books"), {
         ...scannedBookDetails,
         createdAt: serverTimestamp(),
         updatedAt: serverTimestamp()
       });
       toast.success('বই সফলভাবে যুক্ত করা হয়েছে!', { id: toastId });
       setScannedBookDetails(null);
       startCamera();
     } catch (err) {
       toast.error('বই সেভ করতে সমস্যা হয়েছে।');
       console.error(err);
     }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('ছবির সাইজ ২ এমবি এর নিচে হতে হবে।');
        return;
      }
      setLoading(true);
      const toastId = toast.loading('ছবি প্রস্তুত করা হচ্ছে...');
      try {
         const base64Str = await compressImage(file, 1024);
         setEventBanners(prev => [...prev, base64Str]);
         toast.success('ছবি যোগ করা হয়েছে, এবার সেভ করুন।', { id: toastId });
      } catch (err) {
         toast.error('ছবি আপলোড করতে সমস্যা হয়েছে', { id: toastId });
         console.error(err);
      } finally {
         setLoading(false);
         if (e.target) e.target.value = '';
      }
    }
  };

  const removeBanner = (index: number) => {
    setEventBanners(prev => prev.filter((_, i) => i !== index));
    toast.success('ব্যানার সরানো হয়েছে (সেভ করতে ভুলবেন না)');
  };

  const handleToggleAccess = (path: string) => {
    if (subadminAccess.includes(path)) {
      setSubadminAccess(subadminAccess.filter(p => p !== path));
    } else {
      setSubadminAccess([...subadminAccess, path]);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'general'), { 
        eventBanners, 
        subadminAccess, 
        sysToken: aiToken, 
        smsToken, 
        callToken,
        callSenderId,
        smsSenderId,
        customGreetingEnabled,
        customGreetingTitle,
        customGreetingSubtitle,
        inaugurationEnabled,
        inaugurationTitle,
        inaugurationSubtitle,
        inaugurationMessage,
        inaugurationButtonText,
        inaugurationTargetUsers,
        contactPhone,
        contactEmail,
        contactAddress,
        contactFacebook,
        homeIconUrl,
        websiteTitle,
        websiteSubtitle,
        websiteDescription,
        readerRegistrationQuestions,
        isReaderRegistrationFree,
        isAcademicPortalEnabled,
        isKioskModeEnabled,
        hiddenDashboardIcons
      }, { merge: true });
      toast.success('সেটিংস সেভ করা হয়েছে!');
    } catch (err) {
      toast.error('সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSmsSend = async () => {
    if (!customSmsMessage.trim()) {
      return toast.error('দয়া করে এসএমএস এর বিষয়বস্তু লিখুন।');
    }
    
    let targetPhones: string[] = [];
    
    if (customSmsTargetType === 'all') {
      targetPhones = allUsersList.filter(u => u.phone).map(u => u.phone!);
    } else {
      if (customSmsTargetUsers.length === 0) {
        return toast.error('দয়া করে সদস্য নির্বাচন করুন।');
      }
      targetPhones = allUsersList
        .filter(u => customSmsTargetUsers.includes(u.value) && u.phone)
        .map(u => u.phone!);
    }
    
    if (targetPhones.length === 0) {
      return toast.error('নির্বাচিত সদস্যদের কোনো মোবাইল নম্বর পাওয়া যায়নি।');
    }

    const confirmSend = window.confirm(`আপনি কি সত্যিই ${targetPhones.length} জন সদস্যকে এসএমএস পাঠাতে চান?`);
    if (!confirmSend) return;

    setCustomSmsSending(true);
    const toastId = toast.loading(`${targetPhones.length} জনকে এসএমএস পাঠানো হচ্ছে...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const phone of targetPhones) {
      try {
        const res = await sendSMS(phone, customSmsMessage);
        if (res) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    }
    
    setCustomSmsSending(false);
    toast.success(`এসএমএস পাঠানো সম্পন্ন হয়েছে। সফল: ${successCount}, ব্যর্থ: ${failCount}`, { id: toastId });
    if (successCount > 0) setCustomSmsMessage('');
  };

  const executePrintIdCard = async (userId: string | null) => {
    let usr: any = {};
    if (userId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
           usr = userDoc.data();
           usr.id = userDoc.id;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }
    
    const finalMemberId = usr.memberId ? usr.memberId.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : '';
    const name = usr.name || '';
    const phone = usr.phone || '';
    const role = usr.role === 'reader' ? 'পাঠক' : usr.role === 'donor' ? 'দাতা' : 'শিক্ষার্থী';

    const todayDateConverted = usr.createdAt ? new Date(usr.createdAt).toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>সদস্য আইডি কার্ড - ${name || 'খালি'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #0f766e;
                --text-dark: #1e293b;
            }
            body {
                font-family: 'Hind Siliguri', sans-serif;
                background-color: #f1f5f9;
                margin: 0;
                padding: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
            }
            
            .id-card-wrapper {
                width: 95mm;
                height: 60mm;
                background: #ffffff;
                border-radius: 4px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                position: relative;
                overflow: hidden;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                border: 1px solid #e2e8f0;
                padding: 4mm 5mm 0 5mm;
            }

            .bg-dots {
                position: absolute;
                top: 0px;
                left: 0px;
                width: 25mm;
                height: 25mm;
                background-image: radial-gradient(circle, #0f766e 0.5px, transparent 1px);
                background-size: 3mm 3mm;
                opacity: 0.5;
                z-index: 0;
            }

            .bg-top-right {
                position: absolute;
                top: -5px;
                right: -5px;
                width: 30mm;
                height: 30mm;
                background: #0f766e15;
                border-radius: 0 0 0 40mm;
                z-index: 0;
            }

            .bg-waves {
                position: absolute;
                bottom: 8mm; /* above banner */
                left: 0;
                right: 0;
                height: 20mm;
                background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 100 20" xmlns="http://www.w3.org/2000/svg"><path d="M0,10 Q25,20 50,10 T100,10 L100,20 L0,20 Z" fill="%230f766e" fill-opacity="0.2"/><path d="M0,15 Q30,5 60,15 T100,10 L100,20 L0,20 Z" fill="%230f766e" fill-opacity="0.3"/></svg>') no-repeat bottom center;
                background-size: 100% 100%;
                z-index: 0;
            }

            .card-content {
                position: relative;
                z-index: 10;
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                height: calc(100% - 6mm);
                width: 100%;
                gap: 5mm;
            }

            .card-left {
                width: 40%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .card-right {
                width: 58%;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .logo-container {
                width: 14mm;
                height: 14mm;
                margin: 0 auto 1.5mm;
                background: white;
                border-radius: 50%;
                position: relative;
                z-index: 2;
            }
            .logo-container img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                border-radius: 50%;
            }

            .org-name {
                color: var(--primary);
                font-family: 'Noto Serif Bengali', serif;
                font-size: 11px;
                font-weight: 800;
                text-align: center;
                line-height: 1.25;
                margin-bottom: 2mm;
            }
            .org-sub-info {
                font-size: 6.5px; 
                color: var(--primary); 
                font-family: 'Hind Siliguri', sans-serif; 
                font-weight: 700;
            }

            .card-title-container {
                text-align: center;
                width: 100%;
                margin-bottom: 0;
            }
            .card-title-box {
                background: var(--primary);
                color: white;
                text-align: center;
                font-size: 9px;
                font-weight: bold;
                padding: 3px 12px;
                display: inline-block;
                margin: 0 auto;
                border-radius: 4px;
                font-family: 'Outfit', sans-serif;
                letter-spacing: 0.5px;
                box-shadow: 0 1px 3px rgba(15, 118, 110, 0.3);
            }

            .info-table {
                width: 100%;
                font-size: 10px;
                color: var(--text-dark);
                border-collapse: separate;
                border-spacing: 0 1.5mm;
                margin-bottom: 0;
            }

            .info-table td {
                vertical-align: middle;
            }

            .info-label-cell {
                width: 38%;
            }
            .info-label-pill {
                color: var(--primary);
                font-size: 8.5px;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-family: 'Outfit', sans-serif;
                font-weight: 800;
                letter-spacing: 0.5px;
                white-space: nowrap;
            }
            .info-label-icon {
                color: var(--primary);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .info-label-icon svg {
                width: 10px;
                height: 10px;
                stroke: currentColor;
                stroke-width: 2;
                fill: none;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .info-value-box {
                border: 1px solid var(--primary);
                padding: 1.5px 6px;
                font-family: 'Hind Siliguri', sans-serif;
                font-weight: 700;
                display: flex;
                align-items: center;
                width: 95%;
                box-sizing: border-box;
                border-radius: 3px;
                min-height: 16px;
                color: #dc2626; 
                letter-spacing: 0.5px;
                font-size: 10px;
            }

            .info-value-dotted {
                border-bottom: 2px dotted #cbd5e1;
                width: 95%;
                display: flex;
                align-items: center;
                font-family: 'Hind Siliguri', sans-serif;
                font-weight: 700;
                font-size: 11px;
                min-height: 14px;
                padding-bottom: 2px;
                padding-left: 4px;
                color: var(--text-dark);
            }

            .barcode-container {
                margin-top: 3mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
            }
            .barcode-container img {
                max-width: 90%;
                height: 8mm;
            }
            .barcode-text {
                font-family: 'Outfit', sans-serif;
                font-weight: 800;
                color: var(--text-dark);
                font-size: 9px;
                margin-top: 3px;
                letter-spacing: 1px;
            }

            .footer-banner {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--primary);
                color: white;
                text-align: center;
                font-size: 8px;
                font-weight: 700;
                padding: 2.5mm 0;
                letter-spacing: 0.5px;
                font-family: 'Hind Siliguri', sans-serif;
                z-index: 10;
            }

            @media print {
                body { background: transparent; padding: 0; }
                .id-card-wrapper { box-shadow: none; margin: 0; border: 1px solid #cbd5e1; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
            }
            
            .no-print { position: fixed; top: 20px; right: 20px; z-index: 1000; }
            .print-btn {
                background: var(--primary); 
                color: white; border: none; padding: 12px 24px; border-radius: 8px; font-family: 'Hind Siliguri', sans-serif; font-weight: bold; cursor: pointer; font-size: 16px; box-shadow: 0 4px 6px rgba(21, 128, 61, 0.2); transition: all 0.2s;
            }
            .print-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="no-print">
            <button onclick="window.print()" class="print-btn">🖨️ প্রিন্ট করুন</button>
        </div>
        
        <div class="id-card-wrapper">
            <div class="bg-dots"></div>
            <div class="bg-top-right"></div>
            <div class="bg-waves"></div>
            
            <div class="card-content">
                <div class="card-left">
                    <div class="logo-container">
                        <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" crossorigin="anonymous" referrerpolicy="no-referrer" alt="Logo"/>
                    </div>
                    
                    <div class="org-name">
                        পানধোয়া উন্মুক্ত পাঠাগার<br>
                        <span class="org-sub-info">আশুলিয়া, সাভার, ঢাকা</span><br>
                        <span class="org-sub-info">স্থাপিত ২৮ মে ২০২০</span>
                    </div>
                    
                    <div class="card-title-container">
                        <div class="card-title-box">Library Card</div>
                    </div>
                    
                    <div class="barcode-container">
                        ${usr.id ? '<img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=' + (usr.memberId || usr.username || finalMemberId) + '&scale=3&height=8&includetext=false" alt="Barcode" />' : ''}
                        <div class="barcode-text">LC-${finalMemberId || '000000'}</div>
                    </div>
                </div>

                <div class="card-right">
                    <table class="info-table">
                    <tr>
                        <td class="info-label-cell">
                            <div class="info-label-pill">
                                <span class="info-label-icon">
                                    <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                </span> 
                                ID NUMBER
                            </div>
                        </td>
                        <td><div class="info-value-box font-bengali">${usr.id ? `${finalMemberId}` : '&nbsp;'}</div></td>
                    </tr>
                    <tr>
                        <td class="info-label-cell">
                            <div class="info-label-pill">
                                <span class="info-label-icon">
                                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </span> 
                                NAME
                            </div>
                        </td>
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${name || '&nbsp;'}</div></td>
                    </tr>
                    <tr>
                        <td class="info-label-cell">
                            <div class="info-label-pill">
                                <span class="info-label-icon">
                                    <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                </span> 
                                PHONE
                            </div>
                        </td>
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.id ? (usr.phone || '01570206953') : '&nbsp;'}</div></td>
                    </tr>
                    <tr>
                        <td class="info-label-cell">
                            <div class="info-label-pill">
                                <span class="info-label-icon">
                                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </span> 
                                LOGIN ID
                            </div>
                        </td>
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.id ? (usr.username || (usr.email ? usr.email.split('@')[0] : '&nbsp;')) : '&nbsp;'}</div></td>
                    </tr>
                    <tr>
                        <td class="info-label-cell">
                            <div class="info-label-pill">
                                <span class="info-label-icon">
                                    <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                </span> 
                                PASSWORD
                            </div>
                        </td>
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.id ? (usr.password || '******') : '&nbsp;'}</div></td>
                    </tr>
                    <tr>
                        <td class="info-label-cell">
                            <div class="info-label-pill">
                                <span class="info-label-icon">
                                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </span> 
                                ISSUE DATE
                            </div>
                        </td>
                        <td><div class="info-value-dotted font-bengali">${usr.id ? todayDateConverted : '&nbsp;'}</div></td>
                    </tr>
                </table>
                </div>
            </div>
            
            <div class="footer-banner">এই কার্ডটি হস্তান্তরযোগ্য নয়</div>
        </div>
    </body>
    </html>`);
    printWindow.document.close();
    setIsPrintIdCardModalOpen(false);
  };

  const executePrintMemberForm = async (userId: string | null) => {
    let usr: any = {};
    if (userId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
           usr = userDoc.data();
           usr.id = userDoc.id;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }
    
    const todayDateConverted = usr.createdAt ? new Date(usr.createdAt).toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
    const finalMemberId = usr.memberId ? usr.memberId.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'অনির্ধারিত';

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>সদস্য ফর্ম - ${usr.name || 'খালি'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary-color: #1e3a8a;
                --secondary-color: #64748b;
            }
            body {
                font-family: 'Hind Siliguri', sans-serif;
                background-color: #e2e8f0;
                margin: 0;
                padding: 20px;
                color: #0f172a;
                font-size: 16px;
            }
            .form-page {
                width: 210mm;
                min-height: 297mm;
                background: #ffffff;
                margin: 0 auto;
                padding: 15mm 15mm;
                box-sizing: border-box;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                position: relative;
                border: 1px solid #cbd5e1;
            }
            .form-page::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                height: 400px;
                background-image: url('https://i.ibb.co/b5B2gv9b/1777771470223.jpg');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                opacity: 0.05;
                pointer-events: none;
                z-index: 0;
            }
            .content-wrapper {
                position: relative;
                z-index: 1;
            }
            .form-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 3px double var(--primary-color);
                padding-bottom: 12px;
                margin-bottom: 15px;
            }
            .form-logo {
                width: 85px;
                height: 85px;
                object-fit: contain;
            }
            .form-header-text {
                flex: 1;
                text-align: center;
                padding: 0 15px;
            }
            .form-title {
                font-size: 28px;
                font-weight: 700;
                margin: 0 0 8px;
                color: var(--primary-color);
                font-family: 'Noto Serif Bengali', serif;
                letter-spacing: 0.5px;
            }
            .form-subtitle {
                font-size: 15px;
                margin-bottom: 4px;
                font-weight: 600;
                color: var(--secondary-color);
            }
            .form-address {
                font-size: 15px;
                margin-bottom: 4px;
                font-weight: 600;
                color: #334155;
            }
            .form-mobile {
                font-size: 15px;
                font-weight: 600;
                color: #334155;
            }
            .header-photo-box {
                width: 35mm;
                height: 45mm;
                border: 2px dashed #94a3b8;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                color: #64748b;
                text-align: center;
                background: #f8fafc;
            }
            .section-title-wrapper {
                text-align:center; 
                margin-bottom: 20px;
            }
            .section-title {
                display:inline-block; 
                background: var(--primary-color); 
                color: white; 
                padding: 6px 20px; 
                border-radius: 20px; 
                font-weight: 700; 
                font-size: 18px; 
                letter-spacing: 0.5px;
                box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
            }
            .data-table td {
                padding: 6px 0;
                vertical-align: top;
                font-size: 15px;
            }
            .input-line {
                display: inline-block;
                border-bottom: 1px dotted #64748b;
                min-width: 250px;
                margin-left: 5px;
                color: #0f172a;
                font-weight: 700;
            }
            .agreement-box {
                margin-top: 20px;
                padding: 15px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
            }
            .agreement-title {
                font-weight: 700; 
                font-size: 16px; 
                color: var(--primary-color);
                margin-bottom: 5px;
            }
            .agreement-text {
                text-align: justify; 
                line-height: 1.5; 
                color: #334155;
            }
            .signature-sections {
                width: 100%; 
                margin-top: 50px; 
                text-align: center;
                table-layout: fixed;
            }
            .signature-sections td {
                width: 33.33%;
            }
            .sig-line {
                border-top: 1px solid #1e293b; 
                padding-top: 6px;
                display: inline-block;
                min-width: 150px;
                font-weight: 600;
                color: #475569;
            }
            .divider {
                border-top: 2px dashed #cbd5e1; 
                margin: 20px 0;
            }
            @media print {
                body {
                    background-color: transparent;
                    padding: 0;
                }
                .form-page {
                    box-shadow: none;
                    margin: 0;
                    padding: 5mm;
                    width: 100%;
                    min-height: 100%;
                    border: none;
                }
                .no-print { display: none !important; }
            }
            .no-print { position: fixed; top: 20px; right: 20px; z-index: 1000; }
            .print-btn {
                background: #1e3a8a; 
                color: white; 
                border: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                font-family: 'Hind Siliguri', sans-serif; 
                font-weight: bold; 
                cursor: pointer; 
                font-size: 16px;
                box-shadow: 0 4px 6px rgba(30, 58, 138, 0.2);
                transition: all 0.2s;
            }
            .print-btn:hover {
                background: #1e40af;
                transform: translateY(-1px);
            }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="no-print">
            <button onclick="window.print()" class="print-btn">🖨️ প্রিন্ট করুন</button>
        </div>
        <div class="form-page">
            <div class="content-wrapper">
                <div class="form-header">
                    <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="form-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
                    <div class="form-header-text">
                        <h1 class="form-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                        <div class="form-subtitle">স্থাপিত: ২৮ মে ২০২০</div>
                        <div class="form-address">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার</div>
                        <div class="form-mobile">মোবাইল: ০১৫৭০২০৬৯৫৩</div>
                    </div>
                    <div class="header-photo-box">
                        <svg style="width: 32px; height: 32px; margin-bottom: 8px; color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span>পাসপোর্ট<br>সাইজ ছবি</span>
                    </div>
                </div>
                
                <div class="section-title-wrapper">
                   <div class="section-title">সদস্য আবেদন ফর্ম</div>
                </div>
                
                <div class="form-body">
                    <table class="data-table">
                        <tr><td width="30%">১। নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.name || ''}</span></td></tr>
                        <tr><td width="30%">২। পিতার নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.fatherName || ''}</span></td></tr>
                        <tr><td width="30%">৩। মাতার নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;"></span></td></tr>
                        <tr>
                            <td width="30%">৪। পেশা</td>
                            <td width="30%">: <span class="input-line" style="min-width: 150px;">${usr.role === 'reader' ? 'ছাত্র/ছাত্রী' : ''}</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">শ্রেণি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.class || ''}</span></td>
                        </tr>
                        <tr><td width="30%">৫। শিক্ষাপ্রতিষ্ঠান/কর্মস্থল</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.institution || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৬। জন্ম তারিখ</td>
                            <td width="30%">: <span class="input-line" style="min-width: 150px;">${usr.dob || ''}</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">রক্তের গ্রুপ</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;"></span></td>
                        </tr>
                        <tr><td width="30%">৭। বর্তমান ঠিকানা</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.address || ''}</span></td></tr>
                        <tr><td width="30%">৮। স্থায়ী ঠিকানা</td><td colspan="3">: <span class="input-line" style="width: 90%;"></span></td></tr>
                        <tr>
                            <td width="30%">৯। মোবাইল</td>
                            <td colspan="3">: <span class="input-line" style="width: 90%;">${usr.phone || ''}</span></td>
                        </tr>
                        <tr><td width="30%">১০। ইমার্জেন্সি যোগাযোগ</td><td colspan="3">: <span class="input-line" style="width: 90%;"></span></td></tr>
                    </table>

                    <div class="agreement-box">
                       <div class="agreement-title">অঙ্গীকারনামা:</div>
                       <div class="agreement-text">
                           আমি এই মর্মে অঙ্গীকার করছি যে, পানধোয়া উন্মুক্ত পাঠাগার এর সকল নিয়ম-কানুন ও শৃঙ্খলা মেনে চলব। পাঠাগারের কোনো পরিপন্থী কাজে জড়িত হব না এবং পাঠাগারের সার্বিক উন্নতি ও প্রসারে সর্বদা সচেষ্ট থাকিব।
                       </div>
                    </div>

                    <table class="signature-sections">
                        <tr>
                            <td><span class="sig-line">আবেদনকারীর স্বাক্ষর ও তারিখ</span></td>
                            <td></td>
                            <td><span class="sig-line">পিতা/অভিভাবকের স্বাক্ষর</span></td>
                        </tr>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div style="text-align: center; margin-bottom: 20px;">
                       <span style="font-weight: 700; font-size: 16px; background: #e2e8f0; padding: 4px 15px; border-radius: 4px; color: #475569;">পাঠাগার কর্তৃক পূরণীয়</span>
                    </div>
                    
                    <table class="data-table">
                        <tr>
                            <td width="25%" style="color: #64748b; font-weight: 600;">সদস্য আইডি নং</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.id ? finalMemberId : ''}</span></td>
                            <td width="25%" style="color: #64748b; font-weight: 600; text-align: right; padding-right: 10px;">সদস্য ক্যাটাগরি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.id ? (usr.role === 'reader' ? 'পাঠক' : usr.role === 'donor' ? 'দাতা' : '') : ''}</span></td>
                        </tr>
                        <tr>
                            <td width="25%" style="color: #64748b; font-weight: 600;">ইউজারনেম</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.username || (usr.email ? usr.email.split('@')[0] : '') || ''}</span></td>
                            <td width="25%" style="color: #64748b; font-weight: 600; text-align: right; padding-right: 10px;">যোগদানের তারিখ</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.id ? todayDateConverted : ''}</span></td>
                        </tr>
                    </table>

                    ${usr.id && (usr.memberId || usr.username) ? 
                    '<div style="margin-top: 25px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">' +
                        '<img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=' + (usr.memberId || usr.username) + '&scale=2&height=10&includetext=false" alt="Barcode" style="max-height: 40px; opacity: 0.8;" />' +
                        '<div style="font-family: \'Outfit\', sans-serif; font-size: 13px; letter-spacing: 2px; margin-top: 6px; font-weight: 600; color: #475569;">' + (usr.memberId || usr.username) + '</div>' +
                    '</div>'
                     : ''}

                    <table class="signature-sections" style="margin-top: ${usr.id ? '40px' : '60px'};">
                        <tr>
                            <td><span class="sig-line">গৃহীতকারীর স্বাক্ষর</span></td>
                            <td></td>
                            <td><span class="sig-line">অনুমোদনকারীর স্বাক্ষর</span></td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>`);
    printWindow.document.close();
    setIsPrintFormModalOpen(false);
  };

  const executePrintScholarshipForm = (targetApplicants?: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    const appsToPrint = targetApplicants && targetApplicants.length > 0 ? targetApplicants : [{}];
    
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>শিক্ষাবৃত্তি আবেদন ফর্ম</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary-color: #16a34a;
                --secondary-color: #64748b;
            }
            body {
                font-family: 'Hind Siliguri', sans-serif;
                background-color: #e2e8f0;
                margin: 0;
                padding: 20px;
                color: #0f172a;
                font-size: 14px;
            }
            .form-page {
                width: 210mm;
                min-height: 297mm;
                background: #ffffff;
                margin: 0 auto;
                margin-bottom: 20px;
                padding: 15mm 20mm;
                box-sizing: border-box;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                position: relative;
                border: 1px solid #cbd5e1;
                page-break-after: always;
            }
            .form-page:last-child {
                page-break-after: auto;
            }
            .form-page::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                height: 400px;
                background-image: url('https://i.ibb.co/b5B2gv9b/1777771470223.jpg');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                opacity: 0.05;
                pointer-events: none;
                z-index: 0;
            }
            .content-wrapper {
                position: relative;
                z-index: 1;
            }
            .form-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px double var(--primary-color);
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            .form-logo {
                width: 90px;
                height: 90px;
                object-fit: contain;
            }
            .form-header-text {
                flex: 1;
                text-align: center;
                padding: 0 15px;
            }
            .form-title {
                font-size: 28px;
                font-weight: 700;
                margin: 0 0 8px;
                color: var(--primary-color);
                font-family: 'Noto Serif Bengali', serif;
                letter-spacing: 0.5px;
            }
            .form-subtitle {
                font-size: 16px;
                margin-bottom: 4px;
                font-weight: 600;
                color: var(--secondary-color);
            }
            .form-address {
                font-size: 16px;
                margin-bottom: 4px;
                font-weight: 600;
                color: #334155;
            }
            .form-mobile {
                font-size: 15px;
                font-weight: 600;
                color: #334155;
            }
            .header-photo-box {
                width: 40mm;
                height: 50mm;
                border: 2px dashed #94a3b8;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: #64748b;
                text-align: center;
                background: #f8fafc;
            }
            .section-title-wrapper {
                text-align:center; 
                margin-bottom: 20px;
            }
            .section-title {
                display:inline-block; 
                background: var(--primary-color); 
                color: white; 
                padding: 8px 30px; 
                border-radius: 30px; 
                font-weight: 700; 
                font-size: 22px; 
                letter-spacing: 0.5px;
                box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .data-table td {
                padding: 12px 0;
                vertical-align: top;
                font-size: 18px;
            }
            .input-line {
                display: inline-block;
                border-bottom: 1px dotted #64748b;
                min-width: 250px;
                margin-left: 5px;
                color: #0f172a;
                font-weight: 700;
            }
            .agreement-box {
                margin-top: 20px;
                padding: 20px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                margin-bottom: 30px;
            }
            .agreement-title {
                font-weight: 700; 
                font-size: 18px; 
                color: var(--primary-color);
                margin-bottom: 8px;
            }
            .agreement-text {
                text-align: justify; 
                line-height: 1.6; 
                font-size: 16px;
                color: #334155;
            }
            .signature-sections {
                width: 100%; 
                margin-top: 40px; 
                text-align: center;
                table-layout: fixed;
            }
            .signature-sections td {
                width: 33.33%;
            }
            .sig-line {
                border-top: 1px solid #1e293b; 
                padding-top: 6px;
                display: inline-block;
                min-width: 150px;
                font-weight: 600;
                color: #475569;
            }
            .divider {
                border-top: 2px dashed #cbd5e1; 
                margin: 10px 0;
            }
            .attachments-list {
                margin-top: 10px;
                font-weight: 600;
                color: #1e293b;
            }
            .attachments-list ul {
                list-style-type: square;
                margin-top: 5px;
                padding-left: 20px;
                color: #334155;
            }
            @media print {
                body {
                    background-color: transparent;
                    padding: 0;
                }
                .form-page {
                    box-shadow: none;
                    margin: 0;
                    padding: 5mm;
                    width: 100%;
                    min-height: 100%;
                    border: none;
                    page-break-after: always;
                }
                .form-page:last-child {
                    page-break-after: auto;
                }
                .no-print { display: none !important; }
            }
            .no-print { position: fixed; top: 20px; right: 20px; z-index: 1000; }
            .print-btn {
                background: #16a34a; 
                color: white; 
                border: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                font-family: 'Hind Siliguri', sans-serif; 
                font-weight: bold; 
                cursor: pointer; 
                font-size: 16px;
                box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);
                transition: all 0.2s;
            }
            .print-btn:hover {
                background: #15803d;
                transform: translateY(-1px);
            }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="no-print">
            <button onclick="window.print()" class="print-btn">🖨️ প্রিন্ট করুন</button>
        </div>
    `;

    appsToPrint.forEach((app) => {
      htmlContent += `
        <div class="form-page">
            <div class="content-wrapper">
                <div class="form-header">
                    <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="form-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
                    <div class="form-header-text">
                        <h1 class="form-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                        <div class="form-subtitle">স্থাপিত: ২৮ মে ২০২০</div>
                        <div class="form-address">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার</div>
                        <div class="form-mobile">মোবাইল: ০১৫৭০২০৬৯৫৩</div>
                    </div>
                    <div class="header-photo-box">
                        <svg style="width: 32px; height: 32px; margin-bottom: 8px; color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span>পাসপোর্ট<br>সাইজ ছবি</span>
                    </div>
                </div>
                
                <div class="section-title-wrapper">
                   <div class="section-title">শিক্ষাবৃত্তি আবেদন ফর্ম</div>
                </div>
                
                <div class="form-body">
                    <table class="data-table">
                        <tr><td width="30%">১। শিক্ষার্থীর নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.studentName || ''}</span></td></tr>
                        <tr><td width="30%">২। পিতার নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.fatherName || ''}</span></td></tr>
                        <tr><td width="30%">৩। মাতার নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.motherName || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৪। পেশা</td>
                            <td width="30%">: <span class="input-line" style="min-width: 150px;">ছাত্র/ছাত্রী</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">শ্রেণি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${app.studentClass || ''}</span></td>
                        </tr>
                        <tr><td width="30%">৫। শিক্ষাপ্রতিষ্ঠান</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.institution || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৬। জন্ম তারিখ</td>
                            <td width="30%">: <span class="input-line" style="min-width: 150px;">${app.dob || ''}</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">রক্তের গ্রুপ</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${app.bloodGroup || ''}</span></td>
                        </tr>
                        <tr><td width="30%">৭। বর্তমান ঠিকানা</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.presentAddress || ''}</span></td></tr>
                        <tr><td width="30%">৮। স্থায়ী ঠিকানা</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.permanentAddress || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৯। মোবাইল নম্বর</td>
                            <td colspan="3">: <span class="input-line" style="width: 90%;">${app.mobile || ''}</span></td>
                        </tr>
                        <tr><td width="30%">১০। ইমার্জেন্সি যোগাযোগ</td><td colspan="3">: <span class="input-line" style="width: 90%;">${app.emergencyContact || ''}</span></td></tr>
                    </table>
                </div>
            </div>
        </div>

        <div class="form-page">
            <div class="content-wrapper">
                
                <div class="form-body" style="padding-top: 40px;">
                    <div class="attachments-list">
                        সংযুক্তি: (টিক দিন)
                        <ul>
                            <li>জন্ম নিবন্ধন ☑</li>
                            <li>আইডি কার্ড ☑</li>
                            <li>পিতা/মাতার আইডি কার্ড ☑</li>
                        </ul>
                    </div>

                    <div class="agreement-box">
                       <div class="agreement-title">অঙ্গীকারনামা:</div>
                       <div class="agreement-text">
                           আমি এই মর্মে অঙ্গীকার করছি যে, উপরে প্রদত্ত সকল তথ্য সম্পূর্ণ সত্য। পানধোয়া উন্মুক্ত পাঠাগার এর শিক্ষাবৃত্তির সকল নিয়ম-কানুন ও শৃঙ্খলা আমি মেনে চলব। 
                       </div>
                    </div>

                    <table class="signature-sections">
                        <tr>
                            <td><span class="sig-line">আবেদনকারীর স্বাক্ষর ও তারিখ</span></td>
                            <td></td>
                            <td><span class="sig-line">পিতা/অভিভাবকের স্বাক্ষর</span></td>
                        </tr>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div style="text-align: center; margin-bottom: 20px;">
                       <span style="font-weight: 700; font-size: 16px; background: #e2e8f0; padding: 4px 15px; border-radius: 4px; color: #475569;">পাঠাগার কর্তৃক পূরণীয়</span>
                    </div>
                    
                    <table class="data-table">
                        <tr>
                            <td width="25%" style="color: #64748b; font-weight: 600;">আবেদন আইডি নং</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${app.applicationId || ''}</span></td>
                            <td width="25%" style="color: #64748b; font-weight: 600; text-align: right; padding-right: 10px;">বৃত্তির ক্যাটাগরি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;"></span></td>
                        </tr>
                    </table>

                    <table class="signature-sections" style="margin-top: 40px;">
                        <tr>
                            <td><span class="sig-line">গৃহীতকারীর স্বাক্ষর</span></td>
                            <td></td>
                            <td><span class="sig-line">অনুমোদনকারীর স্বাক্ষর</span></td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
      `;
    });

    htmlContent += `
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setIsPrintScholarshipModalOpen(false);
  };

  const printAllLibraryCards = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }
    const toastId = toast.loading('সদস্যদের আইডি কার্ড প্রস্তুত করা হচ্ছে...');
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const activeUsers = usersSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((u: any) => {
            const name = (u.name || "").toLowerCase().trim();
            const email = (u.email || "").toLowerCase().trim();
            const isExcludeName = name === "system admin" || name === "seneia islam" || name === "seneiya islam";
            const isExcludeEmail = email === "seneiaislam@gmail.com";
            return !isExcludeName && !isExcludeEmail && String(u.status).toLowerCase() !== 'pending' && u.name;
        })
        .sort((a: any, b: any) => {
           const idA = a.memberId ? parseInt(a.memberId, 10) : 999999;
           const idB = b.memberId ? parseInt(b.memberId, 10) : 999999;
           return idA - idB;
        });

      if (activeUsers.length === 0) {
        toast.error('প্রিন্ট করার মত কোনো সদস্য পাওয়া যায়নি।', { id: toastId });
        printWindow.close();
        return;
      }

      const cardsHtml = activeUsers.map((usr: any) => {
        const todayDateConverted = usr.createdAt ? new Date(usr.createdAt).toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
        const finalMemberId = usr.memberId ? usr.memberId.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'অনির্ধারিত';
        return `
        <div class="form-page">
            <div class="content-wrapper">
                <div class="form-header">
                    <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="form-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
                    <div class="form-header-text">
                        <h1 class="form-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                        <div class="form-subtitle">স্থাপিত: ২৮ মে ২০২০</div>
                        <div class="form-address">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার</div>
                        <div class="form-mobile">মোবাইল: ০১৫৭০২০৬৯৫৩</div>
                    </div>
                    <div class="header-photo-box">
                        <svg style="width: 32px; height: 32px; margin-bottom: 8px; color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span>পাসপোর্ট<br>সাইজ ছবি</span>
                    </div>
                </div>
                
                <div class="section-title-wrapper">
                   <div class="section-title">সদস্য আবেদন ফর্ম</div>
                </div>
                
                <div class="form-body">
                    <table class="data-table">
                        <tr><td width="30%">১। নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.name || ''}</span></td></tr>
                        <tr><td width="30%">২। পিতার নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.fatherName || ''}</span></td></tr>
                        <tr><td width="30%">৩। মাতার নাম</td><td colspan="3">: <span class="input-line" style="width: 90%;"></span></td></tr>
                        <tr>
                            <td width="30%">৪। পেশা</td>
                            <td width="30%">: <span class="input-line" style="min-width: 150px;">${usr.role === 'reader' ? 'ছাত্র/ছাত্রী' : ''}</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">শ্রেণি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.class || ''}</span></td>
                        </tr>
                        <tr><td width="30%">৫। শিক্ষাপ্রতিষ্ঠান/কর্মস্থল</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.institution || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৬। জন্ম তারিখ</td>
                            <td width="30%">: <span class="input-line" style="min-width: 150px;">${usr.dob || ''}</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">রক্তের গ্রুপ</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;"></span></td>
                        </tr>
                        <tr><td width="30%">৭। বর্তমান ঠিকানা</td><td colspan="3">: <span class="input-line" style="width: 90%;">${usr.address || ''}</span></td></tr>
                        <tr><td width="30%">৮। স্থায়ী ঠিকানা</td><td colspan="3">: <span class="input-line" style="width: 90%;"></span></td></tr>
                        <tr>
                            <td width="30%">৯। মোবাইল</td>
                            <td colspan="3">: <span class="input-line" style="width: 90%;">${usr.phone || ''}</span></td>
                        </tr>
                        <tr><td width="30%">১০। ইমার্জেন্সি যোগাযোগ</td><td colspan="3">: <span class="input-line" style="width: 90%;"></span></td></tr>
                    </table>

                    <div class="agreement-box">
                       <div class="agreement-title">অঙ্গীকারনামা:</div>
                       <div class="agreement-text">
                           আমি এই মর্মে অঙ্গীকার করছি যে, পানধোয়া উন্মুক্ত পাঠাগার এর সকল নিয়ম-কানুন ও শৃঙ্খলা মেনে চলব। পাঠাগারের কোনো পরিপন্থী কাজে জড়িত হব না এবং পাঠাগারের সার্বিক উন্নতি ও প্রসারে সর্বদা সচেষ্ট থাকিব।
                       </div>
                    </div>

                    <table class="signature-sections">
                        <tr>
                            <td><span class="sig-line">আবেদনকারীর স্বাক্ষর ও তারিখ</span></td>
                            <td></td>
                            <td><span class="sig-line">পিতা/অভিভাবকের স্বাক্ষর</span></td>
                        </tr>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div style="text-align: center; margin-bottom: 20px;">
                       <span style="font-weight: 700; font-size: 16px; background: #e2e8f0; padding: 4px 15px; border-radius: 4px; color: #475569;">পাঠাগার কর্তৃক পূরণীয়</span>
                    </div>
                    
                    <table class="data-table">
                        <tr>
                            <td width="25%" style="color: #64748b; font-weight: 600;">সদস্য আইডি নং</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.id ? finalMemberId : ''}</span></td>
                            <td width="25%" style="color: #64748b; font-weight: 600; text-align: right; padding-right: 10px;">সদস্য ক্যাটাগরি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.id ? (usr.role === 'reader' ? 'পাঠক' : usr.role === 'donor' ? 'দাতা' : '') : ''}</span></td>
                        </tr>
                        <tr>
                            <td width="25%" style="color: #64748b; font-weight: 600;">ইউজারনেম</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.username || (usr.email ? usr.email.split('@')[0] : '') || ''}</span></td>
                            <td width="25%" style="color: #64748b; font-weight: 600; text-align: right; padding-right: 10px;">যোগদানের তারিখ</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;">${usr.id ? todayDateConverted : ''}</span></td>
                        </tr>
                    </table>

                    ${usr.id && (usr.memberId || usr.username) ? 
                    '<div style="margin-top: 25px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">' +
                        '<img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=' + (usr.memberId || usr.username) + '&scale=2&height=10&includetext=false" alt="Barcode" style="max-height: 40px; opacity: 0.8;" />' +
                        '<div style="font-family: \'Outfit\', sans-serif; font-size: 13px; letter-spacing: 2px; margin-top: 6px; font-weight: 600; color: #475569;">' + (usr.memberId || usr.username) + '</div>' +
                    '</div>'
                     : ''}

                    <table class="signature-sections" style="margin-top: ${usr.id ? '40px' : '60px'};">
                        <tr>
                            <td><span class="sig-line">গৃহীতকারীর স্বাক্ষর</span></td>
                            <td></td>
                            <td><span class="sig-line">অনুমোদনকারীর স্বাক্ষর</span></td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>`;
      }).join('');

      printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
          <meta charset="UTF-8">
          <title>সদস্য ফর্মসমূহ প্রিন্ট করুন</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
              :root {
                  --primary-color: #1e3a8a;
                  --secondary-color: #64748b;
              }
              body {
                  font-family: 'Hind Siliguri', sans-serif;
                  background-color: #e2e8f0;
                  margin: 0;
                  padding: 20px;
                  color: #0f172a;
                  font-size: 16px;
              }
              .form-page {
                  width: 210mm;
                  min-height: 297mm;
                  background: #ffffff;
                  margin: 0 auto;
                  margin-bottom: 20px;
                  padding: 15mm 15mm;
                  box-sizing: border-box;
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                  position: relative;
                  border: 1px solid #cbd5e1;
                  page-break-after: always;
              }
              .form-page:last-child {
                  page-break-after: auto;
              }
              .form-page::before {
                  content: '';
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 400px;
                  height: 400px;
                  background-image: url('https://i.ibb.co/b5B2gv9b/1777771470223.jpg');
                  background-size: contain;
                  background-repeat: no-repeat;
                  background-position: center;
                  opacity: 0.05;
                  pointer-events: none;
                  z-index: 0;
              }
              .content-wrapper {
                  position: relative;
                  z-index: 1;
              }
              .form-header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  border-bottom: 3px double var(--primary-color);
                  padding-bottom: 12px;
                  margin-bottom: 15px;
              }
              .form-logo {
                  width: 85px;
                  height: 85px;
                  object-fit: contain;
              }
              .form-header-text {
                  flex: 1;
                  text-align: center;
                  padding: 0 15px;
              }
              .form-title {
                  font-size: 28px;
                  font-weight: 700;
                  margin: 0 0 8px;
                  color: var(--primary-color);
                  font-family: 'Noto Serif Bengali', serif;
                  letter-spacing: 0.5px;
              }
              .form-subtitle {
                  font-size: 15px;
                  margin-bottom: 4px;
                  font-weight: 600;
                  color: var(--secondary-color);
              }
              .form-address {
                  font-size: 15px;
                  margin-bottom: 4px;
                  font-weight: 600;
                  color: #334155;
              }
              .form-mobile {
                  font-size: 15px;
                  font-weight: 600;
                  color: #334155;
              }
              .header-photo-box {
                  width: 35mm;
                  height: 45mm;
                  border: 2px dashed #94a3b8;
                  border-radius: 6px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-size: 13px;
                  color: #64748b;
                  text-align: center;
                  background: #f8fafc;
              }
              .section-title-wrapper {
                  text-align:center; 
                  margin-bottom: 20px;
              }
              .section-title {
                  display:inline-block; 
                  background: var(--primary-color); 
                  color: white; 
                  padding: 6px 20px;ative z-40" ref={searchRef}> 6px 20px; 
                  border-radius: 20px; 
                  font-weight: 700; 
                  font-size: 18px; 
                  letter-spacing: 0.5px;
                  box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
              }
              .data-table {
                  width: 100%;
                  border-collapse: collapse;
              }
              .data-table td {
                  padding: 6px 0;
                  vertical-align: top;
                  font-size: 15px;
              }
              .input-line {
                  display: inline-block;
                  border-bottom: 1px dotted #64748b;
                  min-width: 250px;
                  margin-left: 5px;
                  color: #0f172a;
                  font-weight: 700;
              }
              .agreement-box {
                  margin-top: 20px;
                  padding: 15px;
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
              }
              .agreement-title {
                  font-weight: 700; 
                  font-size: 16px; 
                  color: var(--primary-color);
                  margin-bottom: 5px;
              }
              .agreement-text {
                  text-align: justify; 
                  line-height: 1.5; 
                  color: #334155;
              }
              .signature-sections {
                  width: 100%; 
                  margin-top: 50px; 
                  text-align: center;
                  table-layout: fixed;
              }
              .signature-sections td {
                  width: 33.33%;
              }
              .sig-line {
                  border-top: 1px solid #1e293b; 
                  padding-top: 6px;
                  display: inline-block;
                  min-width: 150px;
                  font-weight: 600;
                  color: #475569;
              }
              .divider {
                  border-top: 2px dashed #cbd5e1; 
                  margin: 20px 0;
              }
              @media print {
                  body {
                      background-color: transparent;
                      padding: 0;
                  }
                  .form-page {
                      box-shadow: none;
                      margin: 0;
                      padding: 5mm;
                      width: 100%;
                      min-height: 100%;
                      border: none;
                      page-break-after: always;
                  }
                  .form-page:last-child {
                      page-break-after: auto;
                  }
                  .no-print { display: none !important; }
              }
              .no-print { position: fixed; top: 20px; right: 20px; z-index: 1000; }
              .print-btn {
                  background: #1e3a8a; 
                  color: white; 
                  border: none; 
                  padding: 12px 24px; 
                  border-radius: 8px; 
                  font-family: 'Hind Siliguri', sans-serif; 
                  font-weight: bold; 
                  cursor: pointer; 
                  font-size: 16px;
                  box-shadow: 0 4px 6px rgba(30, 58, 138, 0.2);
                  transition: all 0.2s;
              }
              .print-btn:hover {
                  background: #1e40af;
                  transform: translateY(-1px);
              }
          </style>
      </head>
      <body onload="setTimeout(function(){ window.print(); }, 800)">
          <div class="no-print">
              <button onclick="window.print()" class="print-btn">🖨️ প্রিন্ট করুন</button>
          </div>
          ${cardsHtml}
      </body>
      </html>
      `);
      toast.success('সদস্য ফর্ম প্রস্তুত হয়েছে।', { id: toastId });
    } catch (e) {
      toast.error('কার্ড লোড করতে সমস্যা হয়েছে।', { id: toastId });
      printWindow.close();
    }
  };

  const downloadBookListPDF = async (category: string | 'all') => {
    try {
      setExportingPdf(category);
      const toastId = toast.loading(`${category === 'all' ? 'সকল বই' : 'বই'} এর তালিকা ডাউনলোড হচ্ছে...`);
      
      const q = category === 'all' 
        ? query(collection(db, 'books'), orderBy('title'))
        : query(collection(db, 'books'), where('category', '==', category), orderBy('title'));
      
      const snapshot = await getDocs(q);
      const books = snapshot.docs.map(doc => doc.data());
      
      if (books.length === 0) {
        toast.error('এই ক্যাটাগরিতে কোনো বই পাওয়া যায়নি।', { id: toastId });
        setExportingPdf(null);
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(category === 'all' ? 'All Books List' : `${category} - Books List`, 14, 22);
      
      const tableData = books.map((book: any, idx) => [
        idx + 1,
        book.title || '',
        book.author || '',
        book.category || '',
        book.shelf || ''
      ]);

      (doc as any).autoTable({
        startY: 30,
        head: [['#', 'Title', 'Author', 'Category', 'Shelf']],
        body: tableData,
      });

      doc.save(`BookList_${category.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
      toast.success('পিডিএফ ডাউনলোড সফল হয়েছে!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('পিডিএফ তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setExportingPdf(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-10 lg:mb-14">
         <h1 className="text-2xl md:text-3xl lg:text-4xl font-black font-bengali text-slate-800 tracking-tight flex items-center gap-3">
           <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
             <SettingsIcon className="w-8 h-8" />
           </div>
           অ্যাডমিন সেটিংস
         </h1>
         <p className="text-slate-500 font-medium font-bengali mt-3 text-base">ওয়েবসাইটের বিভিন্ন কনফিগারেশন, সদস্য ব্যবস্থাপনা এবং Event পরিচালনা করুন।</p>
      </div>

      {/* Global Search Bar */}
      <div className="mb-12 relative z-40" ref={searchRef}>
        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bengali text-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm shadow-slate-100"
            placeholder="যেকোনো সেটিংস বা পেজ খুঁজুন..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md border border-slate-200">
              <Command className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400">K</span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showSuggestions && filteredItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute left-0 right-0 mt-2 max-w-2xl bg-white rounded-2xl shadow-2xl shadow-indigo-900/10 border border-slate-100 overflow-hidden"
            >
              <div className="p-2">
                {filteredItems.map((item, index) => (
                  item.path ? (
                    <Link
                      key={index}
                      to={item.path}
                      className="group flex items-center justify-between p-3 hover:bg-indigo-50 rounded-xl transition-all"
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold font-bengali text-slate-800">{item.title}</div>
                          <div className="text-xs text-slate-400 font-bengali">{item.category}</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Jump to Page</div>
                    </Link>
                  ) : (
                    <button
                      key={index}
                      className="w-full group flex items-center justify-between p-3 hover:bg-emerald-50 rounded-xl transition-all text-left"
                      onClick={() => {
                        item.action?.();
                        setShowSuggestions(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold font-bengali text-slate-800">{item.title}</div>
                          <div className="text-xs text-slate-400 font-bengali">{item.category}</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">Quick Action</div>
                    </button>
                  )
                ))}
              </div>
              <div className="bg-slate-50 px-4 py-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Search results for: "{searchQuery}"</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
       <div className="space-y-16 mb-16">
         {/* User & Member Management */}
         <section>
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-slate-100">
               <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100">
                 <Users size={24} />
               </div>
               <div>
                  <h2 className="text-xl md:text-2xl font-black font-bengali text-slate-800">অ্যাডমিন ও সদস্য ব্যবস্থাপনা</h2>
                  <p className="text-sm font-bengali text-slate-500 font-medium">ব্যবহারকারী এবং অ্যাডমিনদের নিয়ন্ত্রণ করুন</p>
               </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
               <Link to="/dashboard/manageteam" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 hover:border-rose-300 transition-all">
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-rose-100">
                     <Users size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">পরিচালনা পর্ষদ</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">টিম মেম্বার এবং কার্যকরী পরিষদ পরিচালনা করুন।</p>
               </Link>
               
               <Link to="/dashboard/messages" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-300 transition-all">
                  <div className="w-14 h-14 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-cyan-100">
                     <MessageSquare size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">মেসেজসমূহ</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">ইউজারদের মেসেজ এবং টেক্সট দেখুন।</p>
               </Link>

               <Link to="/dashboard/reset-requests" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-300 transition-all">
                  <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-purple-100">
                     <ShieldAlert size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">রিসেট রিকোয়েস্ট</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">পাসওয়ার্ড এবং ইনফরমেশন রিসেট করুন।</p>
               </Link>

               <Link to="/dashboard/delete-users" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-red-500/10 hover:border-red-300 transition-all">
                  <div className="w-14 h-14 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-red-100">
                     <UserX size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">সদস্য ডিলিট করুন</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">ওয়েবসাইট থেকে সদস্য রিমুভ করুন।</p>
               </Link>

               <Link to="/dashboard/scholarship-management" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-emerald-100">
                     <GraduationCap size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">বৃত্তি সদস্য ব্যবস্থাপনা</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">শিক্ষাবৃত্তির আবেদনকারীদের তথ্য ও স্ট্যাটাস পরিচালনা করুন।</p>
               </Link>
            </div>
         </section>

         {/* Books & Library Management */}
         <section>
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-slate-100">
               <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                 <LayoutGrid size={24} />
               </div>
               <div>
                 <h2 className="text-xl md:text-2xl font-black font-bengali text-slate-800">বই ও লাইব্রেরি ব্যবস্থাপনা</h2>
                 <p className="text-sm font-bengali text-slate-500 font-medium">বইয়ের শেল্ফ, ক্যাটাগরি এবং স্টকিং দেখুন</p>
               </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
               <Link to="/dashboard/manage-shelves" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300 transition-all">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-indigo-100">
                     <LayoutGrid size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">শেল্ফ ব্যবস্থাপনা</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">বইগুলো ম্যানুয়ালি বিভিন্ন শেল্ফে অর্গানাইজ করুন।</p>
               </Link>

               <Link to="/dashboard/manage-categories" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-emerald-100">
                     <Tags size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">ক্যাটাগরি ব্যবস্থাপনা</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">একসাথে অনেকগুলো বইয়ের ক্যাটাগরি আপডেট করুন।</p>
               </Link>

               <Link to="/dashboard/book-requests" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-blue-100">
                     <FileText size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">অনুরোধকৃত বই</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">ইউজারদের নতুন বইয়ের অনুরোধগুলো দেখুন।</p>
               </Link>

               <Link to="/dashboard/pre-bookings" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-300 transition-all">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-amber-100">
                     <Clock size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">প্রি-বুকিং ব্যবস্থাপনা</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">বইয়ের প্রি-বুকিং তালিকা এবং স্ট্যাটাস দেখুন।</p>
               </Link>
            </div>
         </section>

         {/* Content, Events & Noticeboard */}
         <section>
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-slate-100">
               <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                 <FileText size={24} />
               </div>
               <div>
                  <h2 className="text-xl md:text-2xl font-black font-bengali text-slate-800">কন্টেন্ট, ইভেন্ট ও নোটিশ</h2>
                  <p className="text-sm font-bengali text-slate-500 font-medium">প্রচারণা, ইভেন্ট এবং গঠনতন্ত্র সংক্রান্ত সেটিংস</p>
               </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
               <Link to="/dashboard/events" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300 transition-all">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-indigo-100">
                     <CalendarHeart size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">Event</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">নতুন ইভেন্ট তৈরি করুন, আপডেট বা মুছে ফেলুন।</p>
               </Link>

               <Link to="/dashboard/manageblog" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-emerald-100">
                     <FileText size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">বুক রিভিও ও ব্লগ</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">সদস্যদের ব্লগ এবং বুক রিভিও পরিচালনা করুন।</p>
               </Link>

               <Link to="/dashboard/notices" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-blue-100">
                     <Bell size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">নোটিশ বোর্ড</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">সকল প্রকার নোটিশ আপডেট এবং পরিচালনা করুন।</p>
               </Link>

               <Link to="/dashboard/constitution" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-300 transition-all">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-amber-100">
                     <FileText size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">গঠনতন্ত্র সেটিংস</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">পাঠাগারের গঠনতন্ত্র এবং নীতিসমূহ আপডেট করুন।</p>
               </Link>
            </div>
         </section>

         {/* Prints & Forms */}
         <section>
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-slate-100">
               <div className="w-12 h-12 bg-fuchsia-50 text-fuchsia-600 rounded-xl flex items-center justify-center border border-fuchsia-100">
                 <Printer size={24} />
               </div>
               <div>
                 <h2 className="text-xl md:text-2xl font-black font-bengali text-slate-800">ফর্ম ও কার্ড প্রিন্টিং</h2>
                 <p className="text-sm font-bengali text-slate-500 font-medium">ভর্তি ফর্ম, আইডি কার্ড এবং বৃত্তির আবেদন ডাউনলোড</p>
               </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
               <Link to="/dashboard/scholarship-registration" target="_blank" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-green-500/10 hover:border-green-300 transition-all text-left">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-green-100">
                     <FileText size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">বৃত্তি আবেদনের পোর্টাল</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">শিক্ষাবৃত্তির আবেদন করার পোর্টাল ওপেন করুন।</p>
               </Link>

               <button onClick={() => setIsPrintScholarshipModalOpen(true)} className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-green-500/10 hover:border-green-300 transition-all text-left">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-green-100">
                     <Download size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">বৃত্তি ফর্ম প্রিন্ট</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">নির্দিষ্ট বা সকল বৃত্তি ফর্ম প্রিন্ট করুন।</p>
               </button>

               <button onClick={printAllLibraryCards} className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-fuchsia-500/10 hover:border-fuchsia-300 transition-all text-left">
                  <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-fuchsia-100">
                     <ScanFace size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">সকল ভর্তি ফর্ম প্রিন্ট</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">সকল সদস্যের ভর্তি ফর্ম একসাথে প্রিন্ট করুন।</p>
               </button>

               <button onClick={() => setIsPrintFormModalOpen(true)} className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all text-left">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-blue-100">
                     <Printer size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">সদস্য ভর্তি ফর্ম প্রিন্ট</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">নির্দিষ্ট সদস্য অথবা খালি ভর্তি ফর্ম প্রিন্ট করুন।</p>
               </button>

               <button onClick={() => setIsPrintIdCardModalOpen(true)} className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-300 transition-all text-left">
                  <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform border border-orange-100">
                     <ScanFace size={28} />
                  </div>
                  <h3 className="text-lg font-bold font-bengali text-slate-800 mb-2">আইডি কার্ড প্রিন্ট</h3>
                  <p className="text-sm font-bengali text-slate-500 leading-relaxed">নির্দিষ্ট সদস্য অথবা খালি আইডি কার্ড প্রিন্ট করুন।</p>
               </button>
            </div>
         </section>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden relative mb-8">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 flex-shrink-0">
                  <MessageSquare size={24} />
               </div>
               <div>
                  <h2 className="text-xl font-black font-bengali text-slate-800">স্বাগতম বার্তা (Greeting Banner)</h2>
                  <p className="text-slate-500 font-bengali text-sm mt-1">ড্যাশবোর্ডের স্বাগতম বার্তা কাস্টমাইজ করুন।</p>
               </div>
            </div>
            
            <label className="flex items-center cursor-pointer justify-between bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl border border-slate-100 md:border-transparent">
               <span className="md:hidden font-bengali text-slate-700 font-bold">স্টেটাস:</span>
               <div className="flex items-center">
                  <div className="relative">
                     <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={customGreetingEnabled}
                        onChange={(e) => setCustomGreetingEnabled(e.target.checked)}
                     />
                     <div className={`block w-14 h-8 rounded-full transition-colors ${customGreetingEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                     <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${customGreetingEnabled ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <span className="ml-3 font-bengali text-slate-700 font-bold">{customGreetingEnabled ? 'নতুন মডেল' : 'ডিফল্ট মডেল'}</span>
               </div>
            </label>
         </div>

         <AnimatePresence>
            {customGreetingEnabled && (
               <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="relative z-10 space-y-4 overflow-hidden"
               >
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">
                        ব্যানার টাইটেল (Title)
                        <span className="text-emerald-600 font-normal ml-2 text-xs">ব্যাবহারকারীর নামের জন্য [user] লিখুন</span>
                     </label>
                     <input
                        type="text"
                        placeholder="যেমন: আসসালামু আলাইকুম [user]"
                        value={customGreetingTitle}
                        onChange={(e) => setCustomGreetingTitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-emerald-500 outline-none font-bengali"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ব্যানার সাবটাইটেল (Subtitle)</label>
                     <textarea
                        placeholder="বার্তা বা ইভেন্টের তথ্য লিখুন..."
                        value={customGreetingSubtitle}
                        onChange={(e) => setCustomGreetingSubtitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-emerald-500 outline-none font-bengali h-24 resize-none"
                     ></textarea>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden relative mb-8">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center border border-indigo-100 flex-shrink-0">
                  <LayoutGrid className="w-6 h-6" />
               </div>
               <div>
                  <h2 className="text-xl font-black font-bengali text-slate-800">ওয়েবসাইট কাস্টমাইজেশন</h2>
                  <p className="text-slate-500 font-bengali text-sm mt-1">ওয়েবসাইটের নাম, বর্ণনা এবং যোগাযোগের তথ্য পরিবর্তন করুন।</p>
               </div>
            </div>
         </div>

         <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ওয়েবসাইটের নাম</label>
               <input
                  type="text"
                  placeholder="যেমন: পানধোয়া উন্মুক্ত পাঠাগার"
                  value={websiteTitle}
                  onChange={(e) => setWebsiteTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-bengali"
               />
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ওয়েবসাইটের সাবটাইটেল</label>
               <input
                  type="text"
                  placeholder="যেমন: জ্ঞানের আলোয় সমাজ গড়ি"
                  value={websiteSubtitle}
                  onChange={(e) => setWebsiteSubtitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-bengali"
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ওয়েবসাইটের বর্ণনা</label>
               <textarea
                  placeholder="ওয়েবসাইটের বিস্তারিত বর্ণনা লিখুন..."
                  value={websiteDescription}
                  onChange={(e) => setWebsiteDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-bengali h-20 resize-none"
               ></textarea>
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">Home Icon URL (হোম পেজ আইকন)</label>
               <input
                  type="text"
                  placeholder="https://example.com/icon.png"
                  value={homeIconUrl}
                  onChange={(e) => setHomeIconUrl(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-sans"
               />
            </div>
            
            <div className="md:col-span-2 mt-4 space-y-4 border-t border-slate-100 pt-6">
                <h3 className="text-sm font-black font-bengali text-slate-800">যোগাযোগের তথ্য</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ফোন নম্বর</label>
                        <input
                            type="text"
                            placeholder="+880. . ."
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ইমেইল</label>
                        <input
                            type="email"
                            placeholder="example@gmail.com"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                         <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ফেসবুক পেজ লিংক</label>
                         <input
                            type="text"
                            placeholder="https://facebook.com/..."
                            value={contactFacebook}
                            onChange={(e) => setContactFacebook(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-sans"
                         />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">ঠিকানা</label>
                        <input
                            type="text"
                            placeholder="যেমন: আশুলিয়া, সাভার, ঢাকা"
                            value={contactAddress}
                            onChange={(e) => setContactAddress(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-bengali"
                        />
                    </div>
                </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden relative mb-8">
         <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center border border-teal-100 flex-shrink-0">
                  <UserX className="w-6 h-6" /> 
               </div>
               <div>
                  <h2 className="text-xl font-black font-bengali text-slate-800">পাঠক সদস্য নিবন্ধন ও প্রশ্নপত্র</h2>
                  <p className="text-slate-500 font-bengali text-sm mt-1">পাঠক সদস্য নিবন্ধনের লিংক কপি করুন এবং অতিরিক্ত প্রশ্ন নির্ধারণ করুন।</p>
               </div>
            </div>
            <button 
                onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/register`);
                   toast.success('নিবন্ধন লিংক কপি করা হয়েছে!');
                }}
                className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bengali font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
            >
                <Copy className="w-4 h-4" />
                লিংক কপি করুন
            </button>
         </div>
         
         <div className="relative z-10 p-4 bg-teal-50/50 rounded-xl border border-teal-100 mb-6">
             <label className="flex items-center cursor-pointer">
                <div className="relative">
                   <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={isReaderRegistrationFree}
                      onChange={(e) => setIsReaderRegistrationFree(e.target.checked)}
                   />
                   <div className={`block w-14 h-8 rounded-full transition-colors ${isReaderRegistrationFree ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                   <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isReaderRegistrationFree ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <span className="ml-3 font-bengali text-slate-700 font-bold">পাঠক নিবন্ধন ফি সাময়িক ফ্রি করুন</span>
             </label>
             <p className="hidden md:block text-xs text-slate-500 font-bengali ml-[4.25rem] mt-1">
                 ক্যাম্পেইন বা বিশেষ প্রয়োজনে পাঠক সদস্যদের নিবন্ধন ফি সাময়িকভাবে মওকুফ করতে এটি চালু করুন। চালু থাকলে নতুন পাঠকদের পেমেন্ট ছাড়াই অটোমেটিক পেমেন্ট ভেরিফাইড হিসেবে গ্রহণ করা হবে।
             </p>
         </div>

         <div className="relative z-10">
            <label className="block text-sm font-bold text-slate-700 font-bengali mb-3">নিবন্ধন ফর্মে অতিরিক্ত প্রশ্ন (প্রতি লাইনে একটি প্রশ্ন লিখুন)</label>
            <textarea
                value={readerRegistrationQuestions.join('\n')}
                onChange={e => setReaderRegistrationQuestions(e.target.value.split('\n').filter(q => q.trim() !== ''))}
                placeholder="যেমন: আপনার প্রিয় বই কোনটি?&#10;আপনি কি আগে কোনো পাঠাগারের সদস্য ছিলেন?"
                className="w-full border border-slate-200 rounded-xl p-4 bg-slate-50 focus:bg-white transition-all focus:ring-2 focus:ring-teal-500 outline-none font-bengali text-sm leading-relaxed whitespace-pre-wrap min-h-[120px] resize-y"
            ></textarea>
            <p className="text-xs text-slate-400 font-bengali mt-2 font-medium">এই প্রশ্নগুলো পাঠক সদস্য নিবন্ধনের সময় অতিরিক্ত তথ্য হিসেবে সংগ্রহ করা হবে। প্রশ্ন না চাইলে ফাঁকা রাখুন।</p>
         </div>
      </div>

      {/* Academic Portal Control */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden relative mb-8">
         <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-fuchsia-50 text-fuchsia-600 rounded-xl flex items-center justify-center border border-fuchsia-100 flex-shrink-0">
                  <GraduationCap className="w-6 h-6" /> 
               </div>
               <div>
                  <h2 className="text-xl font-black font-bengali text-slate-800">একাডেমিক পোর্টাল কন্ট্রোল</h2>
                  <p className="text-slate-500 font-bengali text-sm mt-1">একাডেমিক পোর্টালটি ব্যবহারকারীদের জন্য চালু বা বন্ধ রাখুন</p>
               </div>
            </div>
         </div>

         <div className="relative z-10 p-4 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100 mb-2">
             <label className="flex items-center cursor-pointer">
                <div className="relative">
                   <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={isAcademicPortalEnabled}
                      onChange={(e) => setIsAcademicPortalEnabled(e.target.checked)}
                   />
                   <div className={`block w-14 h-8 rounded-full transition-colors ${isAcademicPortalEnabled ? 'bg-fuchsia-500' : 'bg-slate-300'}`}></div>
                   <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isAcademicPortalEnabled ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <span className="ml-3 font-bengali text-slate-700 font-bold">একাডেমিক পোর্টাল আইকন শো করান</span>
             </label>
             <p className="hidden md:block text-xs text-slate-500 font-bengali ml-[4.25rem] mt-1">
                 এটি চালু থাকলে সাধারণ ইউজাররা ড্যাশবোর্ডে অ্যাকাডেমিক পোর্টালে (কুইজ, লেকচার শিট) ঢোকার অপশন দেখতে পাবেন। আপনি চাইলে সাময়িকভাবে এটি বন্ধ রাখতে পারেন!
             </p>
         </div>

         <div className="pt-4 border-t border-slate-100">
             <label className="flex items-center cursor-pointer">
                <div className="relative">
                   <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={isKioskModeEnabled}
                      onChange={(e) => setIsKioskModeEnabled(e.target.checked)}
                   />
                   <div className={`block w-14 h-8 rounded-full transition-colors ${isKioskModeEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                   <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isKioskModeEnabled ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <span className="ml-3 font-bengali text-slate-700 font-bold">ATM/Kiosk মোড চালু করুন</span>
             </label>
             <p className="hidden md:block text-xs text-slate-500 font-bengali ml-[4.25rem] mt-1">
                 এটি চালু থাকলে Kiosk Portal (Self-Service) ব্যবহার করা যাবে। Kiosk মোডের লগইন ক্রেডেনশিয়াল: (ID: Librarypc, Pass: Pcmood@@)
             </p>
         </div>

      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden relative mb-8">
         <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center border border-teal-100 flex-shrink-0">
                  <LayoutDashboard className="w-6 h-6" /> 
               </div>
               <div>
                  <h2 className="text-xl font-black font-bengali text-slate-800">ড্যাশবোর্ড আইকন শো/হাইড সেটিংস</h2>
                  <p className="text-slate-500 font-bengali text-sm mt-1">হোম পেজে/ড্যাশবোর্ডে থাকা সকল আইকন শো বা হাইড করুন</p>
               </div>
            </div>
         </div>

         <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'ইস্যু ও ফেরত', 'সদস্য ব্যবস্থাপনা', 'বইয়ের তালিকা', 'দাতা সদস্য', 'বইয়ের অনুরোধ',
              'বারকোড স্ক্যানার', 'সদস্যদের বকেয়া', 'হিসাব-নিকাশ', 'স্টিকার ও QR', 'শপ বই ব্যবস্থাপনা',
              'বই বিক্রয় অর্ডার', 'বৃত্তি নিবন্ধন', 'আমার প্রোফাইল', 'ইভেন্ট', 'ওয়েবসাইট সেটিংস',
              'একাডেমিক কন্ট্রোল', 'একাডেমিক পোর্টাল', 'আমার পঠিত বই', 'ফি পরিশোধ করুন', 'আমার ইনবক্স',
              'বই কিনুন (Shop)', 'ফেসবুক পেজ', 'WhatsApp সাপোর্ট'
            ].map((iconName) => (
               <div key={iconName} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                   <span className="font-bengali text-slate-700 font-bold text-sm">{iconName}</span>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={!hiddenDashboardIcons[iconName]}
                          onChange={(e) => {
                             setHiddenDashboardIcons(prev => ({
                                 ...prev,
                                 [iconName]: !e.target.checked
                             }))
                          }}
                      />
                      <div className={`block w-11 h-6 rounded-full transition-colors ${!hiddenDashboardIcons[iconName] ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${!hiddenDashboardIcons[iconName] ? 'transform translate-x-5' : ''}`}></div>
                   </label>
               </div>
            ))}
         </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden relative mb-8">
         <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center border border-amber-100 flex-shrink-0">
                  <span className="text-2xl">🎉</span>
               </div>
               <div>
                  <h2 className="text-xl font-black font-bengali text-slate-800">উদ্বোধন মোড (Launch Overlay)</h2>
                  <p className="text-slate-500 font-bengali text-sm mt-1">ব্যবহারকারী প্রথমবার সাইটে ঢুকলে একটি সুন্দর স্ক্রিন শো করবে।</p>
               </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl border border-slate-100 md:border-transparent">
               <label className="flex items-center cursor-pointer justify-between w-full md:w-auto">
                  <span className="md:hidden font-bengali text-slate-700 font-bold">স্টেটাস:</span>
                  <div className="flex items-center">
                     <div className="relative">
                        <input 
                           type="checkbox" 
                           className="sr-only" 
                           checked={inaugurationEnabled}
                           onChange={(e) => setInaugurationEnabled(e.target.checked)}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${inaugurationEnabled ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${inaugurationEnabled ? 'transform translate-x-6' : ''}`}></div>
                     </div>
                     <span className="ml-3 font-bengali text-slate-700 font-bold">{inaugurationEnabled ? 'চালু আছে' : 'বন্ধ আছে'}</span>
                  </div>
               </label>

               {inaugurationEnabled && (
                  <button 
                     onClick={() => {
                        sessionStorage.removeItem('inauguration_seen');
                        window.location.reload();
                     }}
                     className="px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-bengali font-bold rounded-xl text-sm w-full md:w-auto text-center"
                  >
                     পুনরায় টেস্ট করুন
                  </button>
               )}
            </div>
         </div>

         <AnimatePresence>
            {inaugurationEnabled && (
               <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="relative z-10 space-y-4 overflow-hidden"
               >
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">উদ্বোধন টাইটেল</label>
                     <input
                        type="text"
                        placeholder="যেমন: পানধোয়া উন্মুক্ত পাঠাগার"
                        value={inaugurationTitle}
                        onChange={(e) => setInaugurationTitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-amber-500 outline-none font-bengali"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">উদ্বোধন সাবটাইটেল</label>
                     <input
                        type="text"
                        placeholder="যেমন: শুভ উদ্বোধন"
                        value={inaugurationSubtitle}
                        onChange={(e) => setInaugurationSubtitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-amber-500 outline-none font-bengali"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">স্বাগত বার্তা / বিবরণ</label>
                     <textarea
                        placeholder="অতিথিদের জন্য স্বাগত বার্তা..."
                        value={inaugurationMessage}
                        onChange={(e) => setInaugurationMessage(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-amber-500 outline-none font-bengali h-24 resize-none"
                     ></textarea>
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">বাটনের টেক্সট</label>
                     <input
                        type="text"
                        placeholder="যেমন: অটোমেশন উদ্বোধন"
                        value={inaugurationButtonText}
                        onChange={(e) => setInaugurationButtonText(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-amber-500 outline-none font-bengali"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">যাদেরকে মেসেজ পাঠানো হবে (ফাঁকা রাখলে সবার কাছে যাবে)</label>
                     <Select 
                        isMulti 
                        options={allUsersList} 
                        value={allUsersList.filter(u => inaugurationTargetUsers.includes(u.value))}
                        onChange={(selected: any) => setInaugurationTargetUsers(selected ? selected.map((s: any) => s.value) : [])}
                        placeholder="ইউজার সিলেক্ট করুন..."
                        className="font-bengali text-sm"
                        styles={{ control: (base) => ({ ...base, borderRadius: '0.75rem', padding: '0.2rem', borderColor: '#e2e8f0' }) }}
                     />
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 overflow-hidden relative">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
               <ImageIcon size={24} />
            </div>
            <div>
               <h2 className="text-2xl font-black font-bengali text-slate-800">হোম পেইজ ব্যানার / ইভেন্ট ফটো কার্ড</h2>
               <p className="text-slate-500 font-bengali text-sm mt-1">কার্ড আপলোড করুন। সাইজ: ২ এমবি এর নিচে। (প্রস্তাবিত সাইজ: ১৬:৯ অনুপাত বা ১২০০x৬৭৫ পিক্সেল)</p>
            </div>
         </div>

         <div className="grid md:grid-cols-2 gap-8 relative z-10">
            <div>
               <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                  <UploadCloud className="w-12 h-12 text-indigo-400 mb-4" />
                  <p className="font-bengali font-bold text-slate-700 mb-2">ছবি সিলেক্ট করুন বা লিংক দিন</p>
                  <p className="text-xs text-slate-500 mb-4">(MAX: 2MB, Width/Height: 16:9 ratio)</p>

                  <div className="flex flex-col gap-3 w-full max-w-sm mb-4">
                     <input 
                        type="url" 
                        placeholder="ছবির ডাইরেক্ট লিংক দিন"
                        className="w-full px-4 py-2 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-sans text-sm"
                        onKeyDown={(e: any) => {
                           if (e.key === 'Enter' && e.target.value) {
                              e.preventDefault();
                              setEventBanners(prev => [...prev, e.target.value]);
                              toast.success('ব্যানার যোগ করা হয়েছে (সেভ করতে ভুলবেন না)');
                              e.target.value = '';
                           }
                        }}
                     />
                     <span className="text-xs text-slate-500 font-bengali">লিংক দিয়ে Enter চাপুন</span>
                  </div>

                  <label className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bengali font-black cursor-pointer hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                     ডিভাইস থেকে আপলোড করুন
                     <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
               </div>
               
               <button 
                  onClick={saveSettings} 
                  disabled={saving || loading}
                  className="mt-6 w-full py-4 rounded-xl font-bengali font-black text-white bg-slate-900 hover:bg-slate-800 transition shadow-xl shadow-slate-200 flex items-center justify-center gap-2 disabled:bg-slate-300"
               >
                  {saving ? 'সেভ করা হচ্ছে...' : 'সেটিং সেভ করুন'}
                  {!saving && <CheckCircle className="w-5 h-5" />}
               </button>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 min-h-[250px]">
               {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
               ) : eventBanners.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {eventBanners.map((banner, idx) => (
                        <div key={idx} className="relative group">
                           <img src={banner} alt={`Banner ${idx + 1}`} className="w-full h-40 object-cover rounded-xl shadow-md bg-white border border-slate-200" />
                           <button 
                              onClick={() => removeBanner(idx)}
                              className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                              title="সরিয়ে ফেলুন"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                     <p className="font-bengali text-slate-400 font-bold">কোন ছবি সিলেক্ট করা হয়নি</p>
                  </div>
               )}
            </div>
         </div>
      </div>

      <div className="mt-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -ml-32 -mt-32"></div>
         
         <div className="relative z-10 flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
               <Shield size={24} />
            </div>
            <div>
               <h2 className="text-2xl font-black font-bengali text-slate-800">সাব-অ্যাডমিন ওয়েব এক্সেস</h2>
               <p className="text-slate-500 font-bengali text-sm mt-1">কাস্টমাইজ করুন কোন কোন মেনু সাব-অ্যাডমিন ব্যবহার করতে পারবে।</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10 mb-8">
            {availableSubadminRoutes.map((route, idx) => (
                <label key={idx} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${subadminAccess.includes(route.path) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                   <input
                     type="checkbox"
                     checked={subadminAccess.includes(route.path)}
                     onChange={() => handleToggleAccess(route.path)}
                     className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                   />
                   <span className="font-bold text-slate-700 font-bengali text-sm select-none">{route.name}</span>
                </label>
            ))}
         </div>

         <div className="relative z-10 mb-8 pt-8 border-t border-slate-200">
             <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14-8-4 8-4 8 4-8 4Z"/><path d="M4 14v4l8 4 8-4v-4"/></svg>
                 </div>
                 <div>
                    <h2 className="text-xl font-black font-bengali text-slate-800">Gemini AI সেটআপ</h2>
                    <p className="text-slate-500 font-bengali text-sm mt-1">ক্যামেরা দিয়ে বই বা টেক্সট স্ক্যান করার জন্য API কী দিন।</p>
                 </div>
             </div>
             <div>
                <input
                   type="password"
                   placeholder="Gemini API Key (AI Studio)"
                   value={aiToken}
                   onChange={e => setAiToken(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                />
                <p className="text-xs text-slate-400 mt-2">
                   আপনার যদি নিজস্ব কী না থাকে, তবে এই ঘর ফাঁকা রাখতে পারেন (লুকানো ডিফল্ট কী ব্যবহার হবে)।
                </p>
             </div>
         </div>

         <div className="relative z-10 mb-8 pt-8 border-t border-slate-200">
             <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                 </div>
                 <div>
                    <h2 className="text-xl font-black font-bengali text-slate-800">SMS Gateway সেটআপ</h2>
                    <p className="text-slate-500 font-bengali text-sm mt-1">BulkSMSBD API Key এবং Sender ID দিন।</p>
                 </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <input
                     type="password"
                     placeholder="SMS API Key"
                     value={smsToken}
                     onChange={e => setSmsToken(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                  />
                </div>
                <div>
                  <input
                     type="text"
                     placeholder="Sender ID (e.g. 8809617...)"
                     value={smsSenderId}
                     onChange={e => setSmsSenderId(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                  />
                </div>
             </div>
             <p className="text-xs text-slate-400 mt-2">
                এই ঘরগুলো ফাঁকা রাখলে ডিফল্ট API কী ব্যবহার হবে, যা কাজ নাও করতে পারে।
             </p>
         </div>

         <div className="relative z-10 mb-8 pt-8 border-t border-slate-200">
             <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                 </div>
                 <div>
                    <h2 className="text-xl font-black font-bengali text-slate-800">Voice Call API সেটআপ</h2>
                    <p className="text-slate-500 font-bengali text-sm mt-1">অটোমেটিক কল দেয়ার জন্য API Key এবং Caller Number দিন।</p>
                 </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                   type="password"
                   placeholder="Voice Call API Key"
                   value={callToken}
                   onChange={e => setCallToken(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-mono"
                />
                <input
                   type="text"
                   placeholder="Caller Number (Optional)"
                   value={callSenderId}
                   onChange={e => setCallSenderId(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-mono"
                />
             </div>
             <p className="text-xs text-slate-400 mt-2">
                সদস্যদের বই ফেরতের অটোমেটিক কল রিমাইন্ডার দেয়ার জন্য এটি ব্যবহৃত হবে। API Key না দিলে এটি কাজ করবে না।
             </p>
         </div>
         
         <div className="relative z-10 mb-8 pt-8 border-t border-slate-200">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                 <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                         <Package className="w-6 h-6" />
                     </div>
                     <div>
                        <h2 className="text-xl font-black font-bengali text-slate-800">বইয়ের স্টক ব্যবস্থাপনা</h2>
                        <p className="text-indigo-600/70 font-bengali text-sm mt-1">লাইব্রেরির বইয়ের বার্ষিক স্টক স্ট্যাটাস চেক করুন।</p>
                     </div>
                 </div>
                 <Link 
                   to="/dashboard/stock-take"
                   className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold font-bengali transition active:scale-95 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                 >
                   ম্যানেজ স্টক পেইজ এ যান
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                 </Link>
             </div>
         </div>

         <div className="relative z-10 flex justify-end">
             <button 
                onClick={saveSettings} 
                disabled={saving || loading}
                className="py-3 px-8 rounded-xl font-bengali font-black text-white bg-slate-900 hover:bg-slate-800 transition shadow-xl flex items-center justify-center gap-2 disabled:bg-slate-300"
             >
                {saving ? 'সেভ করা হচ্ছে...' : 'সেটিং সেভ করুন'}
                {!saving && <CheckCircle className="w-5 h-5" />}
             </button>
         </div>
      </div>

      {/* Custom SMS Sending Section */}
      <div className="mt-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
               <Send size={24} />
            </div>
            <div>
               <h2 className="text-2xl font-black font-bengali text-slate-800">কাস্টম এসএমএস (Custom SMS)</h2>
               <p className="text-slate-500 font-bengali text-sm mt-1">সব ইউজার বা নির্দিষ্ট ইউজারদের সিলেক্ট করে আপনার ইচ্ছামতো এসএমএস পাঠান।</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest font-bengali mb-1.5 block">প্রাপক নির্বাচন করুন</label>
                <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit mb-3">
                    <button 
                       type="button"
                       onClick={() => setCustomSmsTargetType('specific')}
                       className={`px-4 py-2 rounded-lg text-sm font-bold font-bengali transition-colors ${customSmsTargetType === 'specific' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                    >
                       নির্দিষ্ট সদস্য
                    </button>
                    <button 
                       type="button"
                       onClick={() => setCustomSmsTargetType('all')}
                       className={`px-4 py-2 rounded-lg text-sm font-bold font-bengali transition-colors ${customSmsTargetType === 'all' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                    >
                       সবাইকে পাঠান
                    </button>
                </div>
              </div>

              <AnimatePresence>
                {customSmsTargetType === 'specific' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Select
                       isMulti
                       options={allUsersList.filter(u => u.phone)}
                       value={allUsersList.filter(u => customSmsTargetUsers.includes(u.value))}
                       onChange={(selected: any) => setCustomSmsTargetUsers(selected ? selected.map((s: any) => s.value) : [])}
                       placeholder="সদস্য খুঁজুন এবং সিলেক্ট করুন..."
                       className="font-bengali text-sm"
                       classNames={{
                          control: () => '!bg-white !border-slate-200 !rounded-xl !p-1 !shadow-sm hover:!border-indigo-300',
                          multiValue: () => '!bg-indigo-50 !rounded-lg',
                          multiValueLabel: () => '!text-indigo-700 !font-bold',
                          multiValueRemove: () => '!text-indigo-400 hover:!text-rose-500 hover:!bg-rose-50 rounded-r-lg',
                          menu: () => '!rounded-xl !shadow-lg border border-slate-100',
                          option: (state) => `${state.isFocused ? '!bg-indigo-50 !text-indigo-700' : '!text-slate-600'} !font-medium`
                       }}
                    />
                    <p className="text-[10px] text-slate-400 mt-2">* শুধুমাত্র যাদের মোবাইল নম্বর যুক্ত আছে তাদের দেখানো হচ্ছে।</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest font-bengali mb-1.5 block">এসএমএস মেসেজ</label>
                <textarea
                  value={customSmsMessage}
                  onChange={e => setCustomSmsMessage(e.target.value)}
                  placeholder="আপনার মেসেজ এখানে লিখুন..."
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium font-bengali text-sm h-32 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCustomSmsSend}
                  disabled={customSmsSending || !customSmsMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold font-bengali transition active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {customSmsSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      পাঠানো হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      এসএমএস পাঠান
                    </>
                  )}
                </button>
              </div>
            </div>
         </div>
      </div>

      {/* PDF Export Section */}
      <div className="mt-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         
         <div className="relative z-10 flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shadow-sm">
               <FileText size={24} />
            </div>
            <div>
               <h2 className="text-2xl font-black font-bengali text-slate-800">বইয়ের তালিকা পিডিএফ (PDF) ডাউনলোড</h2>
               <p className="text-slate-500 font-bengali text-sm mt-1">ক্যাটাগরি অনুযায়ী বা সব বইয়ের তালিকা পিডিএফ ফাইল হিসেবে সেভ করুন।</p>
            </div>
         </div>

         <div className="relative z-10 space-y-6">
            {/* All Books Export */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md">
                     <LayoutGrid size={20} />
                  </div>
                  <div>
                     <h3 className="font-black font-bengali text-slate-800">সকল বইয়ের তালিকা</h3>
                     <p className="text-xs text-slate-500 font-bengali">পাঠাগারের সকল বই একসাথ পিডিএফ ফরম্যাটে ডাউনলোড করুন।</p>
                  </div>
               </div>
               <button 
                  onClick={() => downloadBookListPDF('all')}
                  disabled={exportingPdf !== null}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black font-bengali flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition active:scale-95 disabled:opacity-50"
               >
                  {exportingPdf === 'all' ? (
                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                     <Download size={18} />
                  )}
                  ডাউনলোড করুন
               </button>
            </div>

            {/* Categories Export Grid */}
            <div>
               <h4 className="font-black font-bengali text-slate-700 mb-4 flex items-center gap-2">
                  <Tags size={18} className="text-amber-500" />
                  ক্যাটাগরি ভিত্তিক ডাউনলোড
               </h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.length > 0 ? categories.map((cat, idx) => (
                     <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-200 hover:shadow-md transition-all flex items-center justify-between gap-3">
                        <div className="overflow-hidden">
                           <p className="font-bold font-bengali text-slate-800 text-sm truncate" title={cat}>{cat}</p>
                        </div>
                        <button 
                          onClick={() => downloadBookListPDF(cat)}
                          disabled={exportingPdf !== null}
                          className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-colors flex-shrink-0"
                          title="ডাউনলোড পিডিএফ"
                        >
                           {exportingPdf === cat ? (
                              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                           ) : (
                              <Download size={16} />
                           )}
                        </button>
                     </div>
                  )) : (
                     <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 font-bengali text-sm italic">কোনো ক্যাটাগরি পাওয়া যায়নি</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
      <AnimatePresence>
         {isPrintFormModalOpen && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4"
           >
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white rounded-[2rem] p-6 lg:p-8 w-full max-w-lg shadow-2xl overflow-hidden relative"
             >
               <button 
                 onClick={() => setIsPrintFormModalOpen(false)}
                 className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-full transition-colors"
               >
                 <X size={20} />
               </button>
               
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner">
                     <Printer size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black font-bengali text-slate-800 tracking-tight">সদস্য ফর্ম প্রিন্ট</h2>
                    <p className="text-sm font-medium font-bengali text-slate-500 mt-1">নির্দিষ্ট সদস্য সার্চ করুন অথবা খালি ফর্ম প্রিন্ট করুন</p>
                  </div>
               </div>

               <div className="space-y-6">
                 <div>
                   <label className="text-sm font-bold text-slate-700 font-bengali mb-2 block">সদস্য নির্বাচন করুন (ঐচ্ছিক)</label>
                   <Select
                     options={allUsersList}
                     value={selectedUserForForm}
                     onChange={(selected: any) => setSelectedUserForForm(selected)}
                     placeholder="সদস্য খুঁজুন এবং সিলেক্ট করুন..."
                     isClearable
                     className="font-bengali text-sm"
                     classNames={{
                        control: () => '!bg-slate-50 !border-slate-200 !rounded-xl !p-2 !shadow-sm hover:!border-blue-300',
                        menu: () => '!rounded-xl !shadow-lg border border-slate-100',
                        option: (state) => `${state.isFocused ? '!bg-blue-50 !text-blue-700' : '!text-slate-600'} !font-medium`
                     }}
                   />
                   <p className="text-xs text-slate-500 mt-2 italic font-bengali">নির্দিষ্ট কোনো সদস্য নির্বাচন না করলে সম্পূর্ণ একটি খালি ফর্ম প্রিন্ট হবে।</p>
                 </div>

                 <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button 
                       onClick={() => setIsPrintFormModalOpen(false)}
                       className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold font-bengali rounded-xl transition-colors"
                    >
                       বাতিল করুন
                    </button>
                    <button 
                       onClick={() => executePrintMemberForm(selectedUserForForm ? selectedUserForForm.value : null)}
                       className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold font-bengali rounded-xl shadow-lg shadow-blue-500/30 transition-all flex justify-center items-center gap-2"
                    >
                       <Printer size={18} />
                       প্রিন্ট করুন
                    </button>
                 </div>
               </div>
             </motion.div>
           </motion.div>
         )}

         {isPrintIdCardModalOpen && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4"
           >
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white rounded-[2rem] p-6 lg:p-8 w-full max-w-lg shadow-2xl overflow-hidden relative"
             >
               <button 
                 onClick={() => setIsPrintIdCardModalOpen(false)}
                 className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-full transition-colors"
               >
                 <X size={20} />
               </button>
               
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center border border-orange-100 shadow-inner">
                     <ScanFace size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black font-bengali text-slate-800 tracking-tight">সদস্য আইডি কার্ড প্রিন্ট</h2>
                    <p className="text-sm font-medium font-bengali text-slate-500 mt-1">নির্দিষ্ট সদস্য সার্চ করুন অথবা খালি আইডি কার্ড প্রিন্ট করুন</p>
                  </div>
               </div>

               <div className="space-y-6">
                 <div>
                   <label className="text-sm font-bold text-slate-700 font-bengali mb-2 block">সদস্য নির্বাচন করুন (ঐচ্ছিক)</label>
                   <Select
                     options={allUsersList}
                     value={selectedUserForIdCard}
                     onChange={(selected: any) => setSelectedUserForIdCard(selected)}
                     placeholder="সদস্য খুঁজুন এবং সিলেক্ট করুন..."
                     isClearable
                     className="font-bengali text-sm"
                     classNames={{
                        control: () => '!bg-slate-50 !border-slate-200 !rounded-xl !p-2 !shadow-sm hover:!border-orange-300',
                        menu: () => '!rounded-xl !shadow-lg border border-slate-100',
                        option: (state) => `${state.isFocused ? '!bg-orange-50 !text-orange-700' : '!text-slate-600'} !font-medium`
                     }}
                   />
                   <p className="text-xs text-slate-500 mt-2 italic font-bengali">নির্দিষ্ট কোনো সদস্য নির্বাচন না করলে সম্পূর্ণ একটি খালি আইডি কার্ড প্রিন্ট হবে।</p>
                 </div>

                 <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button 
                       onClick={() => setIsPrintIdCardModalOpen(false)}
                       className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold font-bengali rounded-xl transition-colors"
                    >
                       বাতিল করুন
                    </button>
                    <button 
                       onClick={() => executePrintIdCard(selectedUserForIdCard ? selectedUserForIdCard.value : null)}
                       className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold font-bengali rounded-xl shadow-lg shadow-orange-500/30 transition-all flex justify-center items-center gap-2"
                    >
                       <Printer size={18} />
                       প্রিন্ট করুন
                    </button>
                 </div>
               </div>
             </motion.div>
           </motion.div>
         )}
         {isPrintScholarshipModalOpen && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4"
           >
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white rounded-[2rem] p-6 lg:p-8 w-full max-w-lg shadow-2xl overflow-hidden relative"
             >
               <button 
                 onClick={() => setIsPrintScholarshipModalOpen(false)}
                 className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-full transition-colors"
               >
                 <X size={20} />
               </button>
               
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center border border-green-100 shadow-inner">
                     <Download size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black font-bengali text-slate-800 tracking-tight">বৃত্তি ফর্ম ডাউনলোড</h2>
                    <p className="text-sm font-medium font-bengali text-slate-500 mt-1">আবেদনকারী খুঁজুন অথবা খালি ফর্ম ডাউনলোড করুন</p>
                  </div>
               </div>

               <div className="space-y-6">
                 <div>
                   <label className="text-sm font-bold text-slate-700 font-bengali mb-2 block">আবেদনকারী নির্বাচন করুন (ঐচ্ছিক)</label>
                   <Select
                     options={allApplicantsList}
                     value={selectedApplicant}
                     onChange={(selected: any) => setSelectedApplicant(selected)}
                     placeholder="আবেদনকারী খুঁজুন এবং সিলেক্ট করুন..."
                     isClearable
                     className="font-bengali text-sm"
                     classNames={{
                        control: () => '!bg-slate-50 !border-slate-200 !rounded-xl !p-2 !shadow-sm hover:!border-green-300',
                        menu: () => '!rounded-xl !shadow-lg border border-slate-100',
                        option: (state) => `${state.isFocused ? '!bg-green-50 !text-green-700' : '!text-slate-600'} !font-medium`
                     }}
                   />
                   <p className="text-xs text-slate-500 mt-2 italic font-bengali">নির্দিষ্ট কোনো আবেদনকারী নির্বাচন না করলে সম্পূর্ণ একটি খালি ফর্ম প্রিন্ট হবে।</p>
                 </div>

                 <div className="border border-green-100 bg-green-50 rounded-xl p-4">
                    <p className="text-sm font-bengali text-green-800 font-medium mb-3">সকল আবেদনকারীর ফর্ম একসাথে প্রিন্ট করতে চান?</p>
                    <button
                        onClick={() => executePrintScholarshipForm(allApplicantsList.map(a => a.data))}
                        className="w-full py-2 bg-white text-green-700 border border-green-200 hover:bg-green-100 font-bold font-bengali text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Printer size={16} />
                        সকল বৃত্তি আবেদন একত্রিত প্রিন্ট করুন
                    </button>
                    <p className="text-xs text-green-600 mt-2 text-center">সর্বমোট {allApplicantsList.length} টি আবেদন</p>
                 </div>

                 <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button 
                       onClick={() => setIsPrintScholarshipModalOpen(false)}
                       className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold font-bengali rounded-xl transition-colors"
                    >
                       বাতিল করুন
                    </button>
                    <button 
                       onClick={() => executePrintScholarshipForm(selectedApplicant ? [selectedApplicant.data] : undefined)}
                       className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold font-bengali rounded-xl shadow-lg shadow-green-500/30 transition-all flex justify-center items-center gap-2"
                    >
                       <Printer size={18} />
                       প্রিন্ট করুন
                    </button>
                 </div>
               </div>
             </motion.div>
           </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
}

