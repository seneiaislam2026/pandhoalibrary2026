import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, where, getDocsFromCache, getDocsFromServer, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { compressImage } from '../../lib/imageUtils';
import { Plus, Trash2, Calendar, FileText, CheckCircle, Clock, Printer, X, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../store/AuthContext';
import { Link } from 'react-router-dom';
import Select from 'react-select';

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string;
  calculateAge?: boolean;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  deadline: string;
  status: 'Active' | 'Closed' | 'Upcoming';
  type: string;
  image?: string;
  creatorId?: string;
  isScholarship?: boolean;
  requiredDocuments?: string[];
  customQuestions?: string[];
  customFields?: CustomField[];
  smsTemplate?: string;
  targetUserPhone?: string;
  guidelines?: string;
  hasQuota?: boolean;
  quota?: number;
  location?: string;
}

export default function ManageEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    deadline: '',
    status: 'Upcoming' as 'Upcoming' | 'Active' | 'Closed',
    type: 'Competition',
    image: '',
    isScholarship: false,
    requiredDocuments: [] as string[],
    customQuestions: [] as string[],
    customFields: [] as CustomField[],
    smsTemplate: '',
    targetUserPhone: '',
    guidelines: '',
    hasQuota: false,
    quota: 0,
    location: ''
  });
  const [viewApplicants, setViewApplicants] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [applicantSearchTerm, setApplicantSearchTerm] = useState('');
  const [editApplicant, setEditApplicant] = useState<any | null>(null);
  const [editApplicantFormData, setEditApplicantFormData] = useState<any>({});
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [hiddenPrintColumns, setHiddenPrintColumns] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);

  // Admin Registration States
  const [showAdminRegModal, setShowAdminRegModal] = useState<Event | null>(null);
  const [adminRegName, setAdminRegName] = useState('');
  const [adminRegPhone, setAdminRegPhone] = useState('');
  const [adminRegCustomValues, setAdminRegCustomValues] = useState<Record<string, string>>({});
  const [adminRegLoading, setAdminRegLoading] = useState(false);
  const [adminRegCurrentSerial, setAdminRegCurrentSerial] = useState(1);
  const [adminRegSuccess, setAdminRegSuccess] = useState(false);

  const filteredApplicants = applicants.filter(app => {
    if (!applicantSearchTerm) return true;
    const term = applicantSearchTerm.toLowerCase();
    return (
      app.userName?.toLowerCase().includes(term) ||
      app.userPhone?.toLowerCase().includes(term) ||
      app.serialNumber?.toString().includes(term) ||
      String(app.registeredAt?.seconds).includes(term)
    );
  });

  useEffect(() => {
    fetchEvents();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const cacheKey = 'admin_users_cache';
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setUsers(parsed);
          // Still fetch in background if older than 30 mins
          const lastFetch = sessionStorage.getItem(cacheKey + '_time');
          if (lastFetch && Date.now() - parseInt(lastFetch) < 30 * 60 * 1000) return;
        }
      }

      const q = query(collection(db, 'users'));
      let querySnapshot;
      try {
        querySnapshot = await getDocsFromCache(q);
      } catch (e) {
        try {
           querySnapshot = await getDocs(q);
        } catch (serverErr) {
           console.error("Error fetching users:", serverErr);
           return;
        }
      }
      
      const fetchedUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(fetchedUsers);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(fetchedUsers));
        sessionStorage.setItem(cacheKey + '_time', Date.now().toString());
      } catch (e) {
        console.warn('Quota exceeded for sessionStorage', e);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    if (viewApplicants) {
      fetchApplicants(viewApplicants);
      setHiddenPrintColumns([]);
    }
  }, [viewApplicants]);

  const fetchApplicants = async (eventId: string) => {
    setLoadingApplicants(true);
    try {
      const q = query(collection(db, 'event_registrations'), where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      const fetchedApplicants = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'pending'
      }));
      setApplicants(fetchedApplicants);
      setSelectedApplicants([]);
    } catch (error) {
      console.error("Error fetching applicants:", error);
      toast.error("আবেদনকারী লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoadingApplicants(false);
    }
  };

  const fetchEvents = async (forceRefresh = false) => {
    try {
      const cacheKey = 'admin_events_cache';
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.length > 0) {
            setEvents(parsed);
            const lastFetch = sessionStorage.getItem(cacheKey + '_time');
            if (lastFetch && Date.now() - parseInt(lastFetch) < 10 * 60 * 1000) {
              setLoading(false);
              return;
            }
          }
        }
      }

      const q = query(collection(db, 'events'), orderBy('date', 'desc'));
      let querySnapshot;
      try {
        if (!forceRefresh) {
          try {
             querySnapshot = await getDocsFromCache(q);
          } catch (cacheErr) {
             querySnapshot = await getDocs(q);
          }
        } else {
          querySnapshot = await getDocs(q);
        }
      } catch (e) {
        console.error("Error fetching events:", e);
        return;
      }

      const now = new Date();
      const fetchedEvents = querySnapshot.docs.map(doc => {
        const data = doc.data() as Event;
        const eventDate = new Date(data.date);
        const deadline = new Date(data.deadline);
        
        let autoStatus = data.status;
        
        // Auto-close only if deadline is truly passed
        if (now > deadline) {
          autoStatus = 'Closed';
        } else if (data.status === 'Closed') {
          // If manually closed, keep it closed
          autoStatus = 'Closed';
        } else if (!data.status) {
          // Default fallback
          autoStatus = now < deadline ? 'Active' : 'Closed';
        }

        return {
          ...data,
          id: doc.id,
          status: autoStatus
        };
      }) as Event[];
      setEvents(fetchedEvents);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(fetchedEvents));
        sessionStorage.setItem(cacheKey + '_time', Date.now().toString());
      } catch (e) {
        console.warn('Quota exceeded for sessionStorage', e);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("ইভেন্ট লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("অনুগ্রহ করে লগইন করুন");
    if (!formData.title || !formData.date || !formData.deadline || !formData.description) return toast.error("সব প্রয়োজনীয় ঘর পূরণ করুন (নাম, বর্ণনা, সময়, ডেডলাইন)");
    
    try {
      const payload: any = JSON.parse(JSON.stringify({ ...formData, image: formData.image }));

      if (editEventId) {
        await updateDoc(doc(db, 'events', editEventId), payload);
        toast.success("ইভেন্ট সফলভাবে আপডেট হয়েছে");
        setEvents(prev => prev.map(ev => ev.id === editEventId ? { ...ev, ...payload } : ev));
      } else {
        const docRef = await addDoc(collection(db, 'events'), {
          ...payload,
          creatorId: user.id,
          createdAt: new Date().toISOString()
        });
        toast.success("ইভেন্ট সফলভাবে তৈরি হয়েছে");
        
        const newEventData = {
          id: docRef.id,
          ...formData,
          image: formData.image,
          creatorId: user.id,
          createdAt: new Date().toISOString()
        } as Event;
        
        setEvents(prev => [newEventData, ...prev]);
      }
      resetForm();
      fetchEvents(true);
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("ইভেন্ট সেভ করতে সমস্যা হয়েছে");
    }
  };

  const handleAdminSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdminRegModal) return;

    let finalName = adminRegName;
    let finalPhone = adminRegPhone;

    if (showAdminRegModal.customFields) {
      const nameField = showAdminRegModal.customFields.find(f => f.label.toLowerCase().includes('name') || f.label.includes('নাম'));
      const phoneField = showAdminRegModal.customFields.find(f => f.label.toLowerCase().includes('phone') || f.label.toLowerCase().includes('mobile') || f.label.includes('মোবাইল') || f.label.includes('ফোন') || f.label.toLowerCase().includes('number'));
      
      if (!finalName && nameField) finalName = adminRegCustomValues[nameField.id] || '';
      if (!finalPhone && phoneField) finalPhone = adminRegCustomValues[phoneField.id] || '';
    }

    if (!finalName || !finalPhone) {
      toast.error("দয়া করে নাম এবং মোবাইল নম্বর প্রদান করুন");
      return;
    }

    setAdminRegLoading(true);
    try {
      // Quota Check
      const regQuery = query(collection(db, 'event_registrations'), where('eventId', '==', showAdminRegModal.id));
      const snapshot = await getDocs(regQuery);
      if (showAdminRegModal.hasQuota && showAdminRegModal.quota && snapshot.size >= showAdminRegModal.quota) {
          toast.error("দুঃখিত, ইতিমধ্যে কোটা পূর্ণ হয়ে গেছে");
          setAdminRegLoading(false);
          return;
      }

      let registrationData: any = {
        eventId: showAdminRegModal.id,
        userId: user?.id || 'admin_manual',
        userName: finalName,
        userPhone: finalPhone,
        registeredAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        isAdminAssigned: true // Flag indicating admin manually added this
      };

      if (showAdminRegModal.customFields && showAdminRegModal.customFields.length > 0) {
         const formattedAnswers: Record<string, { label: string, value: string }> = {};
         showAdminRegModal.customFields.forEach(field => {
            const safeKey = field.id || Date.now().toString() + Math.random().toString(36).slice(2);
            formattedAnswers[safeKey] = {
               label: field.label || 'Unknown Field',
               value: adminRegCustomValues[field.id] || ''
            };
         });
         registrationData.customFieldAnswers = formattedAnswers;
      }

      try {
         const snaps = await getDocs(query(collection(db, 'event_registrations'), where('eventId', '==', showAdminRegModal.id)));
         const isMedicalEvent = showAdminRegModal.type?.includes('মেডিকেল') || showAdminRegModal.title?.toLowerCase().includes('medical');

         if (isMedicalEvent) {
             let isDepartmental = false;
             let departmentValue = '';
             if (showAdminRegModal.type === 'মেডিকেল ক্যাম্পেইন' && showAdminRegModal.customFields) {
                const deptField = showAdminRegModal.customFields.find(f => f.label.toLowerCase().includes('dept') || f.label.toLowerCase().includes('বিভাগ'));
                if (deptField && adminRegCustomValues[deptField.id]) {
                    isDepartmental = true;
                    departmentValue = adminRegCustomValues[deptField.id];
                }
             }

             let nextSerial = 1;
             if (isDepartmental && departmentValue) {
                const deptRegs = snaps.docs.filter(d => {
                   const ans = d.data().customFieldAnswers;
                   if (!ans) return false;
                   return Object.values(ans).some((a:any) => 
                      (a.label.toLowerCase().includes('dept') || a.label.includes('বিভাগ')) && a.value === departmentValue
                   );
                });
                nextSerial = deptRegs.length + 1;
             } else {
                nextSerial = snaps.size + 1;
             }

             registrationData.serialNumber = nextSerial;
         }
      } catch (err) {
         if (showAdminRegModal.type?.includes('মেডিকেল') || showAdminRegModal.title?.toLowerCase().includes('medical')) {
            registrationData.serialNumber = 1;
         }
      }
      
      if (registrationData.serialNumber) {
         setAdminRegCurrentSerial(registrationData.serialNumber);
      }
      await addDoc(collection(db, 'event_registrations'), registrationData);

      if (registrationData.serialNumber) {
         toast.success(`রেজিস্ট্রেশন সফল হয়েছে! সিরিয়াল নম্বর: ${registrationData.serialNumber}`, { duration: 4000 });
      } else {
         toast.success(`রেজিস্ট্রেশন সফল হয়েছে!`, { duration: 4000 });
      }
      // Reset form variables to keep form open for next entry
      setAdminRegName('');
      setAdminRegPhone('');
      setAdminRegCustomValues({});
      
      // refresh applicants if we're viewing them
      if (viewApplicants === showAdminRegModal.id) {
         fetchApplicants(showAdminRegModal.id);
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("রেজিস্ট্রেশন করতে সমস্যা হয়েছে");
    } finally {
      setAdminRegLoading(false);
    }
  };

  const resetAdminRegForm = () => {
     setShowAdminRegModal(null);
     setAdminRegName('');
     setAdminRegPhone('');
     setAdminRegCustomValues({});
     setAdminRegSuccess(false);
  };

  const resetForm = () => {
      setFormData({
        title: '',
        description: '',
        date: '',
        deadline: '',
        status: 'Upcoming',
        type: 'Competition',
        image: '',
        isScholarship: false,
        requiredDocuments: [],
        customQuestions: [],
        customFields: [],
        smsTemplate: '',
        targetUserPhone: '',
        guidelines: '',
        hasQuota: false,
        quota: 0,
        location: ''
      });
      setEventImageFile(null);
      setShowAddForm(false);
      setEditEventId(null);
  };

  const handleEditClick = (event: Event) => {
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      deadline: event.deadline,
      status: event.status,
      type: event.type,
      image: event.image || '',
      isScholarship: !!event.isScholarship,
      requiredDocuments: event.requiredDocuments || [],
      customQuestions: event.customQuestions || [],
      customFields: event.customFields || [],
      smsTemplate: event.smsTemplate || '',
      targetUserPhone: event.targetUserPhone || '',
      guidelines: event.guidelines || '',
      hasQuota: !!event.hasQuota,
      quota: event.quota || 0,
      location: event.location || ''
    });
    setEditEventId(event.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই ইভেন্টটি ডিলিট করতে চান?")) return;
    try {
      setEvents(prev => prev.filter(e => e.id !== id));
      await deleteDoc(doc(db, 'events', id));
      toast.success("ইভেন্টটি ডিলিট করা হয়েছে");
      fetchEvents(true);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("ইভেন্ট ডিলিট করতে সমস্যা হয়েছে");
      fetchEvents(true); // Re-fetch to restore if failed
    }
  };

  const updateStatus = async (id: string, newStatus: Event['status']) => {
    try {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
      await updateDoc(doc(db, 'events', id), { status: newStatus });
      toast.success("স্ট্যাটাস আপডেট করা হয়েছে");
      fetchEvents(true);
    } catch (error) {
      console.error("Error updating status:", error);
      fetchEvents(true); // Re-fetch on error
    }
  };

  const updateApplicantStatus = async (appId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'event_registrations', appId), { status: newStatus });
      setApplicants(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      toast.success("আবেদনকারীর স্ট্যাটাস আপডেট করা হয়েছে");
    } catch (e) {
      toast.error("স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে");
    }
  };

  const handleUpdateApplicantDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApplicant) return;
    
    try {
      const updatedData = {
          userName: editApplicantFormData.userName,
          userPhone: editApplicantFormData.userPhone,
          serialNumber: editApplicantFormData.serialNumber,
          customFieldAnswers: editApplicantFormData.customFieldAnswers || {}
      };
      await updateDoc(doc(db, 'event_registrations', editApplicant.id), updatedData);
      setApplicants(prev => prev.map(a => a.id === editApplicant.id ? { ...a, ...updatedData } : a));
      toast.success("আবেদনকারীর তথ্য আপডেট হয়েছে");
      setEditApplicant(null);
    } catch (err: any) {
      toast.error("তথ্য আপডেট করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const handleDeleteApplicant = async (appId: string) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে এই আবেদনকারীকে মুছে ফেলতে চান (এই কাজটি অপরিবর্তনযোগ্য)?")) return;
    try {
      await deleteDoc(doc(db, 'event_registrations', appId));
      setApplicants(prev => prev.filter(a => a.id !== appId));
      setSelectedApplicants(prev => prev.filter(id => id !== appId));
      toast.success("আবেদনকারীকে মুছে ফেলা হয়েছে");
    } catch (e) {
      toast.error("আবেদনকারী মুছতে সমস্যা হয়েছে");
    }
  };

  const handlePrintSelected = () => {
    const listToPrint = selectedApplicants.length > 0 
       ? applicants.filter(a => selectedApplicants.includes(a.id))
       : applicants.filter(a => a.status !== 'pending');
    
    if (listToPrint.length === 0) return toast.error("প্রিন্ট করার জন্য কিছু নেই");

    const currentEvent = events.find(e => e.id === viewApplicants);
    const eventName = currentEvent?.title || 'আবেদনকারী তালিকা';
    const customFields = currentEvent?.customFields || [];
    const customQuestions = currentEvent?.customQuestions || [];

    const colsToPrint: any[] = [
      { id: 'serial', label: '# সিরিয়াল' },
      { id: 'name', label: 'আবেদনকারীর নাম' },
      { id: 'phone', label: 'মোবাইল নম্বর' },
      ...customFields.map(f => ({ id: `field_${f.id}`, label: f.label })),
      ...customQuestions.filter(q => q.trim() !== '').map(q => ({ id: `question_${q}`, label: q.replace(' (Optional)', ''), key: q })),
      { id: 'tracking', label: 'ট্র্যাকিং আইডি' }
    ].filter(col => !hiddenPrintColumns.includes(col.id));

    const html = `
      <html>
        <head>
          <title>${eventName} - সকল আবেদনকারী</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700;900&display=swap');
            :root {
              --primary: #4338ca;
              --surface: #f8fafc;
              --border: #e2e8f0;
              --text-main: #0f172a;
              --text-muted: #64748b;
            }
            body { 
              font-family: 'Noto Sans Bengali', sans-serif; 
              background: #f1f5f9;
              margin: 0; 
              padding: 20px;
              color: var(--text-main);
            }
            .print-container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
              overflow-x: auto;
            }
            .header-section {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
            }
            .brand-title {
              font-size: 26px;
              font-weight: 900;
              color: var(--text-main);
              margin: 0 0 4px 0;
              letter-spacing: -0.5px;
            }
            .event-subtitle {
              font-size: 16px;
              font-weight: 700;
              color: var(--primary);
              margin: 0 0 12px 0;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 4px 12px;
              background: var(--surface);
              color: var(--text-muted);
              border-radius: 20px;
              font-size: 12px;
              font-weight: 700;
              border: 1px solid var(--border);
            }
            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              font-size: 13px;
              min-width: 600px;
              border-radius: 12px;
              border: 1px solid var(--border);
              overflow: hidden;
            }
            th {
              background: var(--primary);
              color: #ffffff;
              font-weight: 700;
              text-align: left;
              padding: 14px 16px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-right: 1px solid rgba(255,255,255,0.1);
              white-space: nowrap;
            }
            th:last-child { border-right: none; }
            td {
              padding: 12px 16px;
              color: var(--text-main);
              border-bottom: 1px solid var(--border);
              border-right: 1px solid var(--border);
              vertical-align: middle;
            }
            td:last-child { border-right: none; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) td { background-color: var(--surface); }
            tr:hover td { background-color: #f1f5f9; }
            .serial {
              font-weight: 800;
              color: var(--primary);
              white-space: nowrap;
            }
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid var(--border);
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: var(--text-muted);
              font-weight: 500;
            }
            
            /* Scrollbar styles for modern look */
            .print-container::-webkit-scrollbar { width: 6px; height: 6px; }
            .print-container::-webkit-scrollbar-track { background: transparent; }
            .print-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
            .print-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

            @media print {
              body { background: white; padding: 0; }
              .print-container { box-shadow: none; padding: 0; border-radius: 0; max-width: 100%; overflow: visible; border: none; }
              th { background-color: var(--primary) !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              tr:nth-child(even) td { background-color: var(--surface) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 10mm; }
            }
            @media (max-width: 640px) {
              body { padding: 12px; }
              .print-container { padding: 20px; border-radius: 12px; }
              .brand-title { font-size: 20px; }
              .event-subtitle { font-size: 14px; }
              th, td { padding: 8px 12px; font-size: 12px; }
            }
          </style>
        </head>
        <body onload="JsBarcode('.barcode').init(); setTimeout(() => window.print(), 1000)">
          <div class="print-container">
            <div class="header-section">
              <h1 class="brand-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
              <h2 class="event-subtitle">${eventName}</h2>
              <div class="badge">মোট আবেদনকারী (প্রিন্ট): ${listToPrint.length} জন</div>
            </div>
            
            <table>
              <thead>
                <tr>
                  ${colsToPrint.map(col => `
                    <th>${col.label}</th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${listToPrint.map((app, idx) => `
                  <tr>
                    ${colsToPrint.map(col => {
                      if (col.id === 'serial') {
                        return `<td class="serial"># ${app.serialNumber || idx + 1}</td>`;
                      }
                      if (col.id === 'name') {
                        return `<td style="font-weight: 700; white-space: nowrap;">${app.userName}</td>`;
                      }
                      if (col.id === 'phone') {
                        return `<td style="font-family: monospace;">${app.userPhone}</td>`;
                      }
                      if (col.id.startsWith('field_')) {
                        const ansStr = app.customFieldAnswers ? (Object.values(app.customFieldAnswers) as any[]).find(a => a.label === col.label)?.value : '';
                        return `<td style="white-space: nowrap;">${ansStr || '-'}</td>`;
                      }
                      if (col.id.startsWith('question_')) {
                        const ansStr = app.answers ? app.answers[col.key] : '';
                        return `<td>${ansStr || '-'}</td>`;
                      }
                      if (col.id === 'tracking') {
                        return `
                          <td style="text-align: center; max-width: 150px;">
                             <svg class="barcode"
                                jsbarcode-format="CODE128"
                                jsbarcode-value="${app.serialNumber || idx + 1}"
                                jsbarcode-textmargin="0"
                                jsbarcode-height="25"
                                jsbarcode-width="1.5"
                                jsbarcode-displayvalue="true"
                                jsbarcode-fontsize="10">
                             </svg>
                          </td>
                        `;
                      }
                      return '';
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="footer">
               <p>প্রিন্ট করার সময়: ${new Date().toLocaleString('bn-BD')}</p>
               <p>পানধোয়া উন্মুক্ত পাঠাগার সিষ্টেম</p>
            </div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintMedicalPads = () => {
    const listToPrint = selectedApplicants.length > 0 
       ? applicants.filter(a => selectedApplicants.includes(a.id))
       : applicants.filter(a => a.status !== 'pending');
    
    if (listToPrint.length === 0) return toast.error("প্রিন্ট করার জন্য কিছু নেই");

    const pagesHtml = listToPrint.map((app, index) => {
        let patientName = app.userName;
        let age = '';
        let gender = '';
        let dept = '';
        
        if (app.customFieldAnswers) {
            Object.values(app.customFieldAnswers).forEach((f: any) => {
               const lbl = f.label.toLowerCase();
               if (lbl.includes('name') || lbl.includes('নাম')) patientName = f.value || app.userName;
               if (lbl.includes('age') || lbl.includes('বয়স')) {
                   const matched = f.value.match(/বয়স:\s*(\d+)/) || f.value.match(/(\d+)\s*years/i);
                   if (matched) {
                       age = matched[1] + ' Years';
                   } else {
                       age = f.value.includes('(') ? f.value.split('(')[1].replace(')', '') : f.value;
                   }
               }
               if (lbl.includes('gender') || lbl.includes('sex') || lbl.includes('লিঙ্গ')) gender = f.value;
               if (lbl.includes('dept') || lbl.includes('department') || lbl.includes('বিভাগ')) dept = f.value;
            });
        }
        
        // Auto create 5-digit patient ID based on serial number or index
        const serialNum = app.serialNumber || (index + 1);
        const patientId = serialNum.toString().padStart(5, '0');

        return `
          <div class="pad-container">
             <div class="header">
                <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="pad-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
                <h2>PANDHOA PUBLIC LIBRARY</h2>
                <p>Pandhoa, Shanwalia-1344, Ashulia, Savar, Dhaka.</p>
                <p>Department of Social Welfare</p>
                <p style="font-size: 14px; font-weight: normal;">Mobile: 01570206953</p>
             </div>
             <table class="info-table">
                <tr>
                   <td class="label" style="width: 15%">Patient's ID</td>
                   <td class="value" style="width: 25%">: ${patientId}</td>
                   <td class="barcode-cell" style="width: 30%; text-align: center; vertical-align: middle;">
                     <svg class="barcode" jsbarcode-value="${patientId}" jsbarcode-width="1.2" jsbarcode-height="25" jsbarcode-displayvalue="false" jsbarcode-margin="0"></svg>
                   </td>
                   <td class="label" style="width: 10%">Date</td>
                   <td class="value" style="width: 20%">${new Date().toLocaleDateString('en-GB')}</td>
                </tr>
                <tr>
                   <td class="label">Patient's Name</td>
                   <td class="value" colspan="4">: <strong>${patientName}</strong></td>
                </tr>
                <tr>
                   <td class="label">Age</td>
                   <td class="value" colspan="2">: ${age || '....'}</td>
                   <td class="label">Gender</td>
                   <td class="value">${gender || '....'}</td>
                </tr>
                <tr>
                   <td class="label">Dept</td>
                   <td class="value" colspan="2">: ${dept || '....'}</td>
                   <td class="label">Phone</td>
                   <td class="value">${app.userPhone || '....'}</td>
                </tr>
             </table>
             
             <!-- Empty space for doctor's prescription and advice -->
             <div class="prescription-space"></div>
             
             <div class="signature">
                <div class="sig-line"></div>
                <div class="sig-title">Doctor's Signature & Date</div>
                <div style="font-size: 12px; font-weight: normal; margin-top: 4px;">Powered by: Inflex It</div>
             </div>
          </div>
        `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Medical Pads Print</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
             @page { size: A4; margin: 0; }
             body { 
               font-family: 'Times New Roman', serif; 
               background: #e2e8f0; 
               margin: 0; 
               padding: 20px; 
               display: flex;
               flex-direction: column;
               align-items: center;
             }
             .pad-container { 
               background: white; 
               width: 210mm; 
               height: 297mm; 
               margin: 0 auto 20mm; 
               padding: 20mm; 
               box-sizing: border-box;
               border: 1px solid #ccc; 
               box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
               position: relative;
             }
             @media print {
               body { background: white; padding: 0; display: block; }
               .pad-container { margin: 0; border: none; box-shadow: none; page-break-after: always; }
             }
             .header { text-align: center; margin-bottom: 20px; position: relative; }
             .pad-logo { position: absolute; left: 10px; top: 10px; width: 60px; height: 60px; object-fit: contain; }
             .header h2 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
             .header p { margin: 4px 0; font-size: 16px; font-weight: bold;}
             .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
             .info-table td { padding: 8px 10px; border: 1px solid #000; font-size: 15px;}
             .info-table .label { font-weight: normal; color: #333; }
             .info-table .value { font-weight: bold; }
             .barcode-cell { padding: 2px !important; }
             .barcode-cell svg { display: block; margin: 0 auto; }
             .prescription-space { flex-grow: 1; min-height: 150mm; }
             .signature { position: absolute; bottom: 30px; right: 50px; text-align: center;}
             .sig-line { border-top: 1px solid #000; width: 200px; margin-bottom: 5px; }
             .sig-title { font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body onload="JsBarcode('.barcode').init(); setTimeout(() => window.print(), 1000)">
           ${pagesHtml}
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintA4SerialList = () => {
    const listToPrint = selectedApplicants.length > 0 
       ? applicants.filter(a => selectedApplicants.includes(a.id))
       : applicants.filter(a => a.status !== 'pending');
    
    if (listToPrint.length === 0) return toast.error("প্রিন্ট করার জন্য কিছু নেই");

    const eventName = events.find(e => e.id === viewApplicants)?.title || 'আবেদনকারী তালিকা';
    
    // Sort by serial number if available
    listToPrint.sort((a, b) => (Number(a.serialNumber) || 0) - (Number(b.serialNumber) || 0));

    const html = `
      <html>
        <head>
          <title>${eventName} - টোকেন স্লিপ</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
            body { font-family: 'Noto Sans Bengali', sans-serif; background: #fff; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: 210mm; min-height: 297mm; padding: 10mm; margin: 0 auto; background: white; box-sizing: border-box; }
            .tickets-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15mm 10mm; }
            .ticket { border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; break-inside: avoid; position: relative; gap: 12px; }
            .cut-mark { position: absolute; font-size: 16px; color: #94a3b8; background: white; }
            .cut-top { top: -11px; left: 50%; transform: translateX(-50%); padding: 0 4px; }
            .cut-bottom { bottom: -11px; left: 50%; transform: translateX(-50%); padding: 0 4px; }
            @media print {
               body { background: white; }
               .page { margin: 0; padding: 10mm; width: auto; min-height: auto; box-shadow: none; }
               @page { size: A4; margin: 0; }
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="page">
            <div class="tickets-grid">
                ${listToPrint.map((app, idx) => {
                  const serialNum = app.serialNumber || (idx + 1);
                  const patientId = serialNum.toString().padStart(5, '0');
                  let extraInfo = '';
                  if (app.customFieldAnswers) {
                     const answers = Object.values(app.customFieldAnswers) as any[];
                     const deptField = answers.find((f: any) => f.label.toLowerCase().includes('dept') || f.label.includes('বিভাগ'));
                     if (deptField && deptField.value) extraInfo = `<span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold mt-1.5 inline-block">${deptField.value}</span>`;
                  }
                  return `
                    <div class="ticket">
                      <div class="cut-mark cut-top">✂</div>
                      <div class="cut-mark cut-bottom">✂</div>
                      
                      <div class="flex justify-between items-start border-b-2 border-slate-100 pb-3">
                        <div class="pr-2">
                          <h1 class="text-sm font-black text-slate-900 leading-tight">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                          <h2 class="text-[10px] font-bold text-indigo-600 mt-1 line-clamp-1">${eventName}</h2>
                        </div>
                        <div class="text-right shrink-0">
                          <span class="text-[9px] text-slate-400 block uppercase tracking-widest mb-0.5">Serial No</span>
                          <div class="text-xl font-black text-indigo-600 font-mono leading-none">#${serialNum}</div>
                        </div>
                      </div>
                      
                      <div class="py-1">
                        <div class="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Patient Name</div>
                        <div class="font-bold text-lg text-slate-800 leading-tight">${app.userName || 'N/A'}</div>
                        ${extraInfo}
                      </div>

                      <div class="flex justify-between items-end mt-auto pt-3 border-t-2 border-slate-100">
                         <div>
                            <div class="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Phone</div>
                            <div class="font-mono text-sm font-bold text-slate-600">${app.userPhone || 'N/A'}</div>
                         </div>
                         <div class="text-right">
                            <div class="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Patient ID</div>
                            <div class="font-mono text-xl font-black text-slate-900 leading-none">${patientId}</div>
                         </div>
                      </div>
                    </div>
                  `;
                }).join('')}
            </div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintAllApplicants = () => {
    const currentEvent = events.find(e => e.id === viewApplicants);
    const eventName = currentEvent?.title || 'আবেদনকারী তালিকা';
    const customFields = currentEvent?.customFields || [];
    const customQuestions = currentEvent?.customQuestions || [];

    const colsToPrint: any[] = [
      { id: 'serial', label: '# সিরিয়াল' },
      { id: 'name', label: 'আবেদনকারীর নাম' },
      { id: 'phone', label: 'মোবাইল নম্বর' },
      ...customFields.map(f => ({ id: `field_${f.id}`, label: f.label })),
      ...customQuestions.filter(q => q.trim() !== '').map(q => ({ id: `question_${q}`, label: q.replace(' (Optional)', ''), key: q })),
      { id: 'tracking', label: 'ট্র্যাকিং আইডি' }
    ].filter(col => !hiddenPrintColumns.includes(col.id));

    const html = `
      <html>
        <head>
          <title>${eventName} - সকল আবেদনকারী</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700;900&display=swap');
            :root {
              --primary: #4338ca;
              --surface: #f8fafc;
              --border: #e2e8f0;
              --text-main: #0f172a;
              --text-muted: #64748b;
            }
            body { 
              font-family: 'Noto Sans Bengali', sans-serif; 
              background: #f1f5f9;
              margin: 0; 
              padding: 20px;
              color: var(--text-main);
            }
            .print-container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
              overflow-x: auto;
            }
            .header-section {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
            }
            .brand-title {
              font-size: 26px;
              font-weight: 900;
              color: var(--text-main);
              margin: 0 0 4px 0;
              letter-spacing: -0.5px;
            }
            .event-subtitle {
              font-size: 16px;
              font-weight: 700;
              color: var(--primary);
              margin: 0 0 12px 0;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 4px 12px;
              background: var(--surface);
              color: var(--text-muted);
              border-radius: 20px;
              font-size: 12px;
              font-weight: 700;
              border: 1px solid var(--border);
            }
            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              font-size: 13px;
              min-width: 600px;
              border-radius: 12px;
              border: 1px solid var(--border);
              overflow: hidden;
            }
            th {
              background: var(--primary);
              color: #ffffff;
              font-weight: 700;
              text-align: left;
              padding: 14px 16px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-right: 1px solid rgba(255,255,255,0.1);
              white-space: nowrap;
            }
            th:last-child { border-right: none; }
            td {
              padding: 12px 16px;
              color: var(--text-main);
              border-bottom: 1px solid var(--border);
              border-right: 1px solid var(--border);
              vertical-align: middle;
            }
            td:last-child { border-right: none; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) td { background-color: var(--surface); }
            tr:hover td { background-color: #f1f5f9; }
            .serial {
              font-weight: 800;
              color: var(--primary);
              white-space: nowrap;
            }
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid var(--border);
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: var(--text-muted);
              font-weight: 500;
            }
            
            /* Scrollbar styles for modern look */
            .print-container::-webkit-scrollbar { width: 6px; height: 6px; }
            .print-container::-webkit-scrollbar-track { background: transparent; }
            .print-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
            .print-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

            @media print {
              body { background: white; padding: 0; }
              .print-container { box-shadow: none; padding: 0; border-radius: 0; max-width: 100%; overflow: visible; border: none; }
              th { background-color: var(--primary) !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              tr:nth-child(even) td { background-color: var(--surface) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 10mm; }
            }
            @media (max-width: 640px) {
              body { padding: 12px; }
              .print-container { padding: 20px; border-radius: 12px; }
              .brand-title { font-size: 20px; }
              .event-subtitle { font-size: 14px; }
              th, td { padding: 8px 12px; font-size: 12px; }
            }
          </style>
        </head>
        <body onload="JsBarcode('.barcode').init(); setTimeout(() => window.print(), 1000)">
          <div class="print-container">
            <div class="header-section">
              <h1 class="brand-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
              <h2 class="event-subtitle">${eventName} - সকল আবেদনকারীর তালিকা</h2>
              <div class="badge">মোট আবেদনকারী: ${applicants.filter(a => a.status !== 'pending').length} জন</div>
            </div>
            
            <table>
              <thead>
                <tr>
                  ${colsToPrint.map(col => `
                    <th>${col.label}</th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${applicants.filter(a => a.status !== 'pending').map((app, idx) => `
                  <tr>
                    ${colsToPrint.map(col => {
                      if (col.id === 'serial') {
                        return `<td class="serial"># ${app.serialNumber || idx + 1}</td>`;
                      }
                      if (col.id === 'name') {
                        return `<td style="font-weight: 700; white-space: nowrap;">${app.userName}</td>`;
                      }
                      if (col.id === 'phone') {
                        return `<td style="font-family: monospace;">${app.userPhone}</td>`;
                      }
                      if (col.id.startsWith('field_')) {
                        const ansStr = app.customFieldAnswers ? (Object.values(app.customFieldAnswers) as any[]).find(a => a.label === col.label)?.value : '';
                        return `<td style="white-space: nowrap;">${ansStr || '-'}</td>`;
                      }
                      if (col.id.startsWith('question_')) {
                        const ansStr = app.answers ? app.answers[col.key] : '';
                        return `<td>${ansStr || '-'}</td>`;
                      }
                      if (col.id === 'tracking') {
                        return `
                          <td style="text-align: center; max-width: 150px;">
                             <svg class="barcode"
                                jsbarcode-format="CODE128"
                                jsbarcode-value="${app.serialNumber || idx + 1}"
                                jsbarcode-textmargin="0"
                                jsbarcode-height="25"
                                jsbarcode-width="1.5"
                                jsbarcode-displayvalue="true"
                                jsbarcode-fontsize="10">
                             </svg>
                          </td>
                        `;
                      }
                      return '';
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="footer">
               <p>প্রিন্ট করার সময়: ${new Date().toLocaleString('bn-BD')}</p>
               <p>পানধোয়া উন্মুক্ত পাঠাগার সিষ্টেম</p>
            </div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintQuizAdmitCards = () => {
    const listToPrint = selectedApplicants.length > 0 
       ? applicants.filter(a => selectedApplicants.includes(a.id))
       : applicants.filter(a => a.status !== 'pending');
    
    if (listToPrint.length === 0) return toast.error("প্রিন্ট করার জন্য কিছু নেই");

    const eventName = events.find(e => e.id === viewApplicants)?.title || 'আবেদনকারী তালিকা';
    
    // Sort by serial number if available
    listToPrint.sort((a, b) => (Number(a.serialNumber) || 0) - (Number(b.serialNumber) || 0));

    const html = `
      <html>
        <head>
          <title>${eventName} - প্রবেশপত্র</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
            body { font-family: 'Noto Sans Bengali', sans-serif; background: #f8fafc; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: 210mm; min-height: 297mm; padding: 10mm; margin: 0 auto; background: white; box-sizing: border-box; }
            .tickets-grid { display: flex; flex-direction: column; gap: 20px; }
            .ticket { 
               border: 1px solid #1e293b; 
               padding: 0; 
               display: flex; 
               flex-direction: column; 
               break-inside: avoid; 
               position: relative; 
               background: #fff;
               border-radius: 8px;
               overflow: hidden;
            }
            .ticket-header {
               background: #1e293b;
               color: white;
               padding: 15px 20px;
               display: flex;
               justify-content: space-between;
               align-items: center;
               border-bottom: 2px solid #000;
            }
            .ticket-body {
               display: flex;
               padding: 20px;
               gap: 20px;
               min-height: 220px;
            }
            .ticket-info {
               flex: 1;
            }
            .ticket-barcode-area {
               width: 150px;
               display: flex;
               flex-direction: column;
               align-items: flex-end;
               justify-content: space-between;
            }
            .photo-box {
               width: 120px;
               height: 140px;
               border: 1px solid #cbd5e1;
               background: #f8fafc;
               display: flex;
               align-items: center;
               justify-content: center;
               font-size: 11px;
               text-align: center;
               color: #94a3b8;
               overflow: hidden;
               border-radius: 4px;
            }
            .photo-box img {
               width: 100%;
               height: 100%;
               object-fit: cover;
            }
            .ticket-footer {
               padding: 15px 20px;
               border-top: 1px dashed #cbd5e1;
               display: flex;
               justify-content: space-between;
               align-items: flex-end;
            }
            .info-row {
               margin-bottom: 12px;
            }
            .info-label {
               font-size: 10px;
               color: #64748b;
               text-transform: uppercase;
               letter-spacing: 1px;
               margin-bottom: 2px;
               font-weight: 700;
            }
            .info-value {
               font-size: 16px;
               color: #0f172a;
               font-weight: 700;
            }
            .barcode-svg {
               max-width: 100%;
               height: auto;
            }
            .signature-line {
               width: 150px;
               border-bottom: 1px solid #1e293b;
               text-align: center;
               padding-bottom: 5px;
               font-size: 11px;
               font-weight: bold;
               color: #1e293b;
            }
            @media print {
               body { background: white; }
               .page { margin: 0; padding: 10mm; width: auto; min-height: auto; box-shadow: none; }
               @page { size: A4; margin: 0; }
            }
          </style>
        </head>
        <body onload="JsBarcode('.barcode').init(); setTimeout(() => window.print(), 1000)">
          <div class="page">
            <div class="tickets-grid">
                ${listToPrint.map((app, idx) => {
                  const serialNum = app.serialNumber || (idx + 1);
                  let school = '';
                  let className = '';
                  if (app.customFieldAnswers) {
                     const answers = Object.values(app.customFieldAnswers) as any[];
                     const schoolField = answers.find((f: any) => f.label.toLowerCase().includes('school') || f.label.includes('প্রতিষ্ঠান') || f.label.includes('বিদ্যালয়'));
                     const classField = answers.find((f: any) => f.label.toLowerCase().includes('class') || f.label.includes('শ্রেণী') || f.label.includes('শ্রেণি'));
                     
                     if (schoolField && schoolField.value) school = schoolField.value;
                     if (classField && classField.value) className = classField.value;
                  }
                  
                  let photoUrl = '';
                  if (app.documents) {
                     for (const [name, url] of Object.entries(app.documents) as [string, string][]) {
                        if (name.toLowerCase().includes('ছবি') || name.toLowerCase().includes('photo') || name.toLowerCase().includes('image') || name.toLowerCase().includes('picture')) {
                           photoUrl = url;
                           break;
                        }
                     }
                  }

                  const trackingId = app.id || Date.now().toString();

                  return `
                    <div class="ticket">
                      <div class="ticket-header">
                        <div>
                           <div class="text-[10px] uppercase tracking-widest text-slate-300 mb-1">Admit Card</div>
                           <h1 class="text-xl font-black leading-tight">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                           <h2 class="text-sm font-medium text-slate-200">${eventName}</h2>
                        </div>
                        <div class="text-right">
                           <div class="text-[10px] uppercase tracking-widest text-slate-300 mb-1">Roll No</div>
                           <div class="text-3xl font-mono font-black tracking-wider">#${serialNum.toString().padStart(4, '0')}</div>
                        </div>
                      </div>
                      
                      <div class="ticket-body">
                         <div class="ticket-info">
                            <div class="info-row">
                               <div class="info-label">Candidate Name</div>
                               <div class="info-value text-xl">${app.userName || 'N/A'}</div>
                            </div>
                            <div class="flex gap-8">
                               <div class="info-row flex-1">
                                  <div class="info-label">Class / Section</div>
                                  <div class="info-value">${className || '-'}</div>
                               </div>
                               <div class="info-row flex-1 shrink-0">
                                  <div class="info-label">Phone No.</div>
                                  <div class="info-value font-mono">${app.userPhone || 'N/A'}</div>
                               </div>
                            </div>
                            <div class="info-row mt-2">
                               <div class="info-label">Institution / School</div>
                               <div class="info-value whitespace-normal leading-snug">${school || '-'}</div>
                            </div>
                         </div>
                         <div class="ticket-barcode-area">
                            <div class="photo-box">
                               ${photoUrl ? `<img src="${photoUrl}" alt="Photo" crossorigin="anonymous" referrerpolicy="no-referrer" />` : 'ছবি<br/>সংযুক্ত করুন'}
                            </div>
                            <div class="mt-4 w-full flex justify-end">
                               <svg class="barcode w-full barcode-svg"
                                 jsbarcode-format="CODE128"
                                 jsbarcode-value="${trackingId.slice(0, 15)}"
                                 jsbarcode-textmargin="0"
                                 jsbarcode-height="30"
                                 jsbarcode-displayvalue="true"
                                 jsbarcode-fontsize="10">
                               </svg>
                            </div>
                         </div>
                      </div>

                      <div class="ticket-footer">
                         <div class="text-[9px] text-slate-400">
                            Printed on: ${new Date().toLocaleString('bn-BD')}<br/>
                            System Generated Admit Card
                         </div>
                         <div class="flex gap-10 text-right">
                            <div class="signature-line">
                               Candidate's Signature
                            </div>
                            <div class="signature-line">
                               Authority Signature
                            </div>
                         </div>
                      </div>
                    </div>
                  `;
                }).join('')}
            </div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintScholarshipForms = () => {
    const listToPrint = selectedApplicants.length > 0 
       ? applicants.filter(a => selectedApplicants.includes(a.id))
       : applicants.filter(a => a.status !== 'pending');
    
    if (listToPrint.length === 0) return toast.error("প্রিন্ট করার জন্য কিছু নেই");

    const eventName = events.find(e => e.id === viewApplicants)?.title || 'আবেদন ফরম';

    const pagesHtml = listToPrint.map((app) => {
        let photoUrl = '';
        if (app.documents) {
           for (const [name, url] of Object.entries(app.documents) as [string, string][]) {
              if (name.toLowerCase().includes('ছবি') || name.toLowerCase().includes('photo') || name.toLowerCase().includes('image') || name.toLowerCase().includes('picture')) {
                 photoUrl = url;
                 break;
              }
           }
        }
        
        let roll = app.serialNumber || '';
        let orgName = "পানধোয়া উন্মুক্ত পাঠাগার";
        
        let answersArray: {label: string, value: any}[] = [];
        if (app.customFieldAnswers) {
            answersArray = [...answersArray, ...Object.values(app.customFieldAnswers) as {label: string, value: any}[]];
        }
        if (app.answers) {
            Object.entries(app.answers).forEach(([q, a]) => {
                answersArray.push({ label: q, value: a });
            });
        }
        
        const photoHtml = photoUrl 
          ? `<img src="${photoUrl}" alt="Photo" />` 
          : `<div class="photo-placeholder">ছবি<br/>সংযুক্ত করুন<br/>(পাসপোর্ট সাইজ)</div>`;

        return `
          <div class="form-page">
            <div class="header-section">
                <div class="logo-area">
                    <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" style="max-height:90px;" crossorigin="anonymous" referrerpolicy="no-referrer" />
                </div>
                <div class="title-area">
                    <h1 class="main-title">বৃত্তির আবেদনের ফর্ম</h1>
                    <h2 class="org-name">[${orgName}]</h2>
                    <p class="org-address">সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার, ঢাকা</p>
                    <p class="org-contact"><b>মোবাইল:</b> ০১৫৭০২০৬৯৫৩ &nbsp;&nbsp; <b>ইমেইল:</b> info@pandhoa.org</p>
                </div>
                <div class="photo-area">
                    ${photoHtml}
                </div>
            </div>

            <div class="top-info">
                <div><span>বৃত্তির নাম:</span> <span style="border-bottom: 1px dotted #000; padding: 0 10px;">${eventName}</span></div>
                <div><span>তারিখ:</span> <span style="border-bottom: 1px dotted #000; padding: 0 10px;">${new Date(app.registeredAt?.seconds * 1000).toLocaleDateString('bn-BD')}</span></div>
            </div>

            <table class="form-table">
                <tbody>
                    <tr class="section-header"><td colspan="4">১. শিক্ষার্থীর ব্যক্তিগত ও সাধারণ তথ্য</td></tr>
                    <tr>
                        <td class="label">আবেদনকারীর নাম</td>
                        <td class="value" colspan="3"><b>${app.userName || ''}</b></td>
                    </tr>
                    <tr>
                        <td class="label">মোবাইল নম্বর</td>
                        <td class="value"><b>${app.userPhone || ''}</b></td>
                        <td class="label">সিস্টেম ট্র্যাকিং আইডি</td>
                        <td class="value font-mono">#E${(app.registeredAt?.seconds || Date.now()).toString().slice(-6)} ${roll ? `(Serial: ${roll})` : ''}</td>
                    </tr>
                    ${answersArray.reduce((acc, curr, i) => {
                        if (i % 2 === 0) {
                            acc += `<tr><td class="label">${curr.label}</td><td class="value">${curr.value || ''}</td>`;
                            if (i === answersArray.length - 1) { 
                                acc += `<td class="label"></td><td class="value"></td></tr>`;
                            }
                        } else {
                            acc += `<td class="label">${curr.label}</td><td class="value">${curr.value || ''}</td></tr>`;
                        }
                        return acc;
                    }, '')}
                </tbody>
            </table>

            <table class="form-table mt-4">
                <tbody>
                    <tr class="section-header"><td colspan="2">২. ঘোষণা</td></tr>
                    <tr>
                        <td colspan="2" class="declaration-text">
                            আমি এ মর্মে ঘোষণা করছি যে, উপরের তথ্যসমূহ সঠিক ও সত্য। প্রদত্ত কোনো তথ্য অসত্য প্রমাণিত হলে আমার আবেদন বাতিল হতে পারে এবং প্রতিষ্ঠানের সিদ্ধান্ত চূড়ান্ত বলে গণ্য হবে।
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="signature-section">
                <div class="sig-box">
                    <div class="line"></div>
                    <p>তারিখ</p>
                </div>
                <div class="sig-box">
                    <div class="line"></div>
                    <p>আবেদনকারীর স্বাক্ষর</p>
                </div>
            </div>

            <table class="form-table mt-4">
                <tbody>
                    <tr class="section-header"><td colspan="4">শুধুমাত্র অফিস ব্যবহারের জন্য</td></tr>
                    <tr>
                        <td class="label" style="width: 25%">আবেদন নং:</td><td class="value" style="width: 25%"></td>
                        <td class="label" style="width: 25%">প্রাপ্তির তারিখ:</td><td class="value" style="width: 25%"></td>
                    </tr>
                    <tr>
                        <td class="label">মন্তব্য:</td><td class="value" colspan="3"></td>
                    </tr>
                    <tr>
                        <td class="label border-none-right">অনুমোদন:</td>
                        <td class="value border-none-left" colspan="3">
                            <div style="display:flex; justify-content: space-between; align-items:center;">
                                <div><span style="border:1px solid #000; padding: 0 4px; display:inline-block; margin-right:4px;">&nbsp;</span> অনুমোদিত &nbsp;&nbsp;&nbsp; <span style="border:1px solid #000; padding: 0 4px; display:inline-block; margin-right:4px;">&nbsp;</span> অনুমোদিত নয়</div>
                                <div style="display:flex; align-items:center; gap: 10px;">স্বাক্ষর: <div style="border-bottom: 1px solid #000; width: 150px;"></div></div>
                                <div style="display:flex; align-items:center; gap: 10px;">তারিখ: <div style="border-bottom: 1px solid #000; width: 100px;"></div></div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
          </div>
        `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>${eventName} - বৃত্তি ফর্ম</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700;900&display=swap');
            * { box-sizing: border-box; }
            body { 
              font-family: 'Noto Sans Bengali', sans-serif; 
              margin: 0; 
              padding: 0;
              color: #000; 
              background-color: #f8fafc;
              line-height: 1.5;
            }
            .form-page {
              max-width: 800px;
              margin: 20px auto;
              background: #ffffff;
              padding: 40px;
              border: 1px solid #ccc;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              page-break-after: always;
            }
            .header-section {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .logo-area {
              width: 120px;
              text-align: center;
            }
            .title-area {
              flex: 1;
              text-align: center;
              padding: 0 20px;
            }
            .main-title {
              font-size: 28px;
              font-weight: 900;
              margin: 0 0 10px 0;
            }
            .org-name {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 5px 0;
            }
            .org-address, .org-contact {
              font-size: 14px;
              margin: 2px 0;
            }
            .photo-area {
              width: 130px;
              height: 160px;
              border: 1px solid #000;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .photo-area img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .photo-placeholder {
              text-align: center;
              font-size: 14px;
              color: #333;
            }
            .top-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 15px;
              font-size: 15px;
              font-weight: 700;
            }
            .form-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .form-table th, .form-table td {
              border: 1px solid #000;
              padding: 8px 12px;
              font-size: 14px;
              vertical-align: middle;
            }
            .section-header td {
              background-color: #f1f5f9;
              text-align: center;
              font-weight: 900;
              font-size: 16px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label {
              font-weight: 700;
              width: 25%;
              background-color: #f8fafc;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .value {
              width: 25%;
            }
            .declaration-text {
              padding: 15px !important;
              text-align: justify;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 60px;
              margin-bottom: 30px;
              padding: 0 20px;
            }
            .sig-box {
              text-align: center;
              width: 200px;
            }
            .sig-box .line {
              border-top: 1px dashed #000;
              margin-bottom: 5px;
            }
            .border-none-right { border-right: none !important; }
            .border-none-left { border-left: none !important; }
            .mt-4 { margin-top: 15px; }
            .font-mono { font-family: monospace; }
            
            @media print {
              body { background: white; margin: 0; padding: 0; }
              .form-page { 
                margin: 0; 
                border: none; 
                box-shadow: none; 
                padding: 30px; 
                width: 100%;
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body onload="setTimeout(() => window.print(), 1000)">
          ${pagesHtml}
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintApplicant = (app: any) => {
    const eventName = events.find(e => e.id === viewApplicants)?.title || 'আবেদন ফরম';

    let photoUrl = '';
    if (app.documents) {
       for (const [name, url] of Object.entries(app.documents) as [string, string][]) {
          if (name.toLowerCase().includes('ছবি') || name.toLowerCase().includes('photo') || name.toLowerCase().includes('image') || name.toLowerCase().includes('picture')) {
             photoUrl = url;
             break;
          }
       }
    }

    const photoHtml = photoUrl 
      ? `<div class="photo-box"><img src="${photoUrl}" alt="Applicant Photo" /></div>`
      : `<div class="photo-placeholder"><p>আবেদনকারীর<br/>ছবি</p></div>`;

    const html = `
      <html>
        <head>
          <title>${app.userName} - ডেটা সংগ্রহ ফরম</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700;900&display=swap');
            * { box-sizing: border-box; }
            body { 
              font-family: 'Noto Sans Bengali', sans-serif; 
              margin: 0; 
              padding: 40px; 
              color: #1e293b; 
              background-color: #f8fafc;
              line-height: 1.6;
            }
            .document-container {
              max-width: 800px;
              margin: 0 flex;
              background: #ffffff;
              padding: 50px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.05);
              border: 1px solid #e2e8f0;
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start;
              border-bottom: 3px solid #0f172a; 
              padding-bottom: 30px; 
              margin-bottom: 40px; 
            }
            .header-content { flex: 1; }
            .brand-name { margin: 0; font-size: 32px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;}
            .address { margin: 5px 0 0; font-size: 13px; color: #64748b; font-weight: 500; }
            .form-title { 
              font-weight: 900; 
              color: #4f46e5; 
              font-size: 20px; 
              margin-top: 20px; 
              display: inline-block;
              background: #eef2ff;
              padding: 6px 16px;
              border-radius: 6px;
              border: 1px solid #c7d2fe;
            }
            
            .photo-box { width: 130px; height: 160px; border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .photo-box img { width: 100%; height: 100%; object-fit: cover; }
            .photo-placeholder { width: 130px; height: 160px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; text-align: center; color: #94a3b8; font-size: 13px; font-weight: bold; background: #f8fafc;}
            
            .section { margin-bottom: 40px; }
            .section-title { 
              font-size: 16px; 
              font-weight: 900; 
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 1px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 10px;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .section-title::before {
              content: '';
              display: inline-block;
              width: 12px;
              height: 12px;
              background: #4f46e5;
              border-radius: 3px;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .info-item {
              background: #f8fafc;
              padding: 16px 20px;
              border-radius: 8px;
              border: 1px solid #f1f5f9;
            }
            .info-label {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 16px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
            }
            
            .qa-box { 
              margin-bottom: 20px; 
              page-break-inside: avoid; 
              border: 1px solid #e2e8f0; 
              border-radius: 10px; 
              background: #fff;
              overflow: hidden;
            }
            .q-text { 
              font-weight: 700; 
              color: #1e293b; 
              margin: 0; 
              font-size: 15px; 
              background: #f8fafc;
              padding: 12px 16px;
              border-bottom: 1px solid #e2e8f0;
            }
            .a-text { 
              margin: 0; 
              color: #334155; 
              font-size: 15px; 
              line-height: 1.6; 
              padding: 16px;
            }
            
            .footer { 
              margin-top: 80px; 
              display: flex; 
              justify-content: space-between; 
              font-size: 14px; 
              color: #64748b;
              page-break-inside: avoid;
            }
            .signature-block {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
            }
            .signature-line {
              width: 200px;
              border-bottom: 1.5px dashed #94a3b8;
            }
            .signature-text {
              font-weight: 600;
              font-size: 13px;
              color: #475569;
            }
            
            .meta-stamp {
              text-align: center;
              margin-top: 50px;
              font-size: 10px;
              color: #cbd5e1;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-weight: 700;
            }

            @media print {
              body { background: white; padding: 0; }
              .document-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
              .qa-box { border: 1px solid #e2e8f0 !important; }
              .form-title { border: 1px solid #000; color: #000; background: #fff; }
              .section-title::before { background: #000; }
              .info-item { border: 1px solid #e2e8f0; }
            }
          </style>
        </head>
        <body onload="setTimeout(() => window.print(), 500)">
          <div class="document-container">
            <div class="header">
              <div class="header-content">
                <h1 class="brand-name">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                <p class="address">সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার, ঢাকা</p>
                <div class="form-title">${eventName}</div>
              </div>
              ${photoHtml}
            </div>

            <div class="section">
              <div class="section-title">ব্যক্তিগত ও সাধারণ তথ্য</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">আবেদনকারীর নাম</div>
                  <p class="info-value">${app.userName}</p>
                </div>
                <div class="info-item">
                  <div class="info-label">মোবাইল নম্বর</div>
                  <p class="info-value">${app.userPhone}</p>
                </div>
                <div class="info-item">
                  <div class="info-label">আবেদনের তারিখ ও সময়</div>
                  <p class="info-value">${new Date(app.registeredAt?.seconds * 1000).toLocaleString('bn-BD')}</p>
                </div>
                <div class="info-item">
                  <div class="info-label">সিস্টেম ট্র্যাকিং আইডি / সিরিয়াল</div>
                  <p class="info-value" style="font-family: monospace;">#E${(app.registeredAt?.seconds || Date.now()).toString().slice(-6)} ${app.serialNumber ? `<span style="font-size: 11px; color: #64748b;">(Serial: ${app.serialNumber})</span>` : ''}</p>
                </div>
              </div>
            </div>

            ${app.customFieldAnswers ? `
              <div class="section">
                <div class="section-title">রেজিস্ট্রেশন ফরমের তথ্য</div>
                ${Object.values(app.customFieldAnswers).map((field: any) => `
                  <div class="qa-box">
                    <p class="q-text">${field.label}</p>
                    <p class="a-text">${field.value as string || '<span style="color:#94a3b8;font-style:italic;">উত্তর প্রদান করা হয়নি</span>'}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${app.answers && Object.keys(app.answers).length > 0 ? `
              <div class="section">
                <div class="section-title">সংগৃহীত তথ্য ও প্রশ্নোত্তর</div>
                ${Object.entries(app.answers).map(([q, a]) => `
                  <div class="qa-box">
                    <p class="q-text">${q}</p>
                    <p class="a-text">${a as string || '<span style="color:#94a3b8;font-style:italic;">উত্তর প্রদান করা হয়নি</span>'}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="footer">
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-text">আবেদনকারীর স্বাক্ষর ও তারিখ</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-text">মূল্যায়নকারী/কর্তৃপক্ষের স্বাক্ষর</div>
              </div>
            </div>
            
            <div class="meta-stamp">
              System Generated Document • Verified by Pan Dhoa Library Data Platform
            </div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-bengali">ইভেন্ট ম্যানেজমেন্ট</h1>
          <p className="text-gray-600 font-bengali">বৃত্তি, প্রতিযোগিতা এবং অন্যান্য ইভেন্ট তৈরি করুন</p>
          <Link to="/events" target="_blank" rel="noreferrer" className="text-indigo-600 font-bengali text-sm font-bold hover:underline mt-2 inline-block">
            + সকল ইভেন্ট দেখুন (পাবলিক পেজ)
          </Link>
        </div>
        {user?.role !== 'visitor_admin' && (
          <button
            onClick={() => {
              if (showAddForm) {
                setShowAddForm(false);
              } else {
                resetForm();
                setShowAddForm(true);
              }
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-bengali shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Plus size={20} /> নতুন ইভেন্ট যোগ করুন
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-0 z-[60] overflow-y-auto bg-[#f0ebf8]"
          >
            <div className="min-h-screen py-8 px-4">
              {/* Top Navigation / Close */}
              <div className="max-w-3xl mx-auto flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                   <div className="bg-[#673ab7] p-2 rounded-lg">
                      <Plus size={24} className="text-white" />
                   </div>
                   <h2 className="text-xl font-bold font-bengali text-slate-800">ইভেন্ট তৈরি/এডিট করুন</h2>
                </div>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-600" />
                </button>
              </div>

              {/* Google Form Style Container */}
              <div className="max-w-3xl mx-auto space-y-4">
                <div id="event-create-form" className="space-y-4 pb-20">
                  {/* Characteristic Google Form Top Accent */}
                  <div className="h-2.5 bg-[#673ab7] w-full rounded-t-xl mb-[-4px]" />
                  
                  {/* Header Card */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative p-5 sm:p-8">
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full text-2xl sm:text-4xl font-bold font-bengali text-slate-900 border-b-2 border-transparent focus:border-[#673ab7] mb-4 sm:mb-6 outline-none transition-all placeholder:text-slate-200 py-2 sm:py-2"
                      placeholder="ইভেন্টের নাম (Event Title)"
                    />
                    <textarea
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-0 py-2 bg-transparent text-slate-700 font-bengali text-sm sm:text-lg outline-none resize-none min-h-[100px] placeholder:text-slate-300"
                      placeholder="ইভেন্টের বিস্তারিত বর্ণনা এখানে লিখুন..."
                    />
                  </div>

                  {/* Question Card: Event Type */}
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <label className="block text-base font-bold text-slate-900 font-bengali mb-4 sm:mb-6 border-l-4 border-[#673ab7] pl-4">ইভেন্টের ধরণ (Event Type) *</label>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {['প্রতিযোগিতা', 'বৃত্তি', 'মেডিকেল ক্যাম্পেইন', 'ওয়ার্কশপ', 'প্রশ্ন উত্তর', 'অন্যান্য'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            let newCustomFields = formData.customFields;
                            if (type === 'মেডিকেল ক্যাম্পেইন' && formData.type !== 'মেডিকেল ক্যাম্পেইন') {
                               newCustomFields = [
                                  { id: 'field_' + Date.now() + 1, label: 'Patient Name', type: 'text', required: true },
                                  { id: 'field_' + Date.now() + 2, label: 'Mobile Number', type: 'text', required: true },
                                  { id: 'field_' + Date.now() + 3, label: 'Gender', type: 'select', required: true, options: 'Male, Female, Other' },
                                  { id: 'field_' + Date.now() + 4, label: 'Age (DOB)', type: 'date', required: true, calculateAge: true },
                                  { id: 'field_' + Date.now() + 5, label: 'Dept', type: 'text', required: true }
                               ];
                            }
                            setFormData({ 
                              ...formData, 
                              type,
                              customFields: newCustomFields,
                              isScholarship: type === 'Scholarship' || type === 'QuestionAnswer' || type === 'বৃত্তি' || type === 'প্রশ্ন উত্তর' 
                            });
                          }}
                          className={`px-4 py-2 sm:px-8 sm:py-3.5 rounded-xl font-bold font-bengali text-sm sm:text-base transition-all border-2 flex-grow sm:flex-grow-0 ${
                            formData.type === type 
                              ? 'bg-[#673ab7] text-white border-[#673ab7] shadow-lg shadow-indigo-200' 
                              : 'bg-white text-slate-600 border-slate-100 hover:border-[#673ab7]/30'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Card: Status */}
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <label className="block text-base font-bold text-slate-900 font-bengali mb-4 sm:mb-6 border-l-4 border-indigo-600 pl-4">ইভেন্ট স্ট্যাটাস (Event Status) *</label>
                    <div className="flex flex-wrap gap-2 sm:gap-4">
                      {[
                        { value: 'Upcoming', label: 'আসন্ন (Upcoming)', color: 'bg-blue-500' },
                        { value: 'Active', label: 'চলমান (Active)', color: 'bg-emerald-500' },
                        { value: 'Closed', label: 'বন্ধ (Closed)', color: 'bg-rose-500' }
                      ].map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: s.value as any })}
                          className={`px-6 py-3 rounded-xl font-bold font-bengali text-sm transition-all border-2 flex items-center gap-2 ${
                            formData.status === s.value 
                              ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                              : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${s.color}`} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 font-bengali">* দ্রষ্টব্য: ডেডলাইন পার হয়ে গেলে অটোমেটিক 'বন্ধ' দেখাবে।</p>
                  </div>

                  {/* Guideline Card */}
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-emerald-500 pl-4">ইভেন্ট গাইডলাইন (Guidelines)</label>
                    <textarea
                      value={formData.guidelines}
                      onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-[#673ab7] outline-none min-h-[120px] font-bengali"
                      placeholder="ইভেন্টের নিয়মাবলী এখানে লিখুন..."
                    />
                  </div>

                  {/* Question Card: Timing and Location */}
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
                      <div className="group">
                        <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-indigo-500 pl-4">ইভেন্টের সময়</label>
                        <input
                          type="datetime-local"
                          required
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-0 py-3 border-b-2 border-slate-100 group-focus-within:border-[#673ab7] outline-none font-bold text-slate-700 transition-all bg-transparent"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-rose-500 pl-4">রেজিস্ট্রেশন শেষ সময়</label>
                        <input
                          type="datetime-local"
                          required
                          value={formData.deadline}
                          onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                          className="w-full px-0 py-3 border-b-2 border-slate-100 group-focus-within:border-rose-500 outline-none font-bold text-rose-600 transition-all bg-transparent"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-emerald-500 pl-4">ইভেন্টের স্থান (Location)</label>
                        <input
                          type="text"
                          required
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-0 py-3 border-b-2 border-slate-100 group-focus-within:border-emerald-500 outline-none font-bold text-slate-700 transition-all bg-transparent"
                          placeholder="ইভেন্টের স্থান..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Question Card: Quota Limit */}
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-[#673ab7] pl-4">আসন/কোটা সীমা (Registration Limit)</label>
                    <div className="flex items-center gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer font-bengali font-bold text-slate-700">
                        <input
                          type="radio"
                          name="quota"
                          checked={!formData.hasQuota}
                          onChange={() => setFormData({ ...formData, hasQuota: false })}
                          className="w-4 h-4 text-[#673ab7] focus:ring-[#673ab7]"
                        />
                        আনলিমিটেড (Unlimited)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bengali font-bold text-slate-700">
                        <input
                          type="radio"
                          name="quota"
                          checked={formData.hasQuota}
                          onChange={() => setFormData({ ...formData, hasQuota: true })}
                          className="w-4 h-4 text-[#673ab7] focus:ring-[#673ab7]"
                        />
                        নির্দিষ্ট সংখ্যা (Limited)
                      </label>
                    </div>
                    {formData.hasQuota && (
                      <div>
                        <input
                          type="number"
                          min="1"
                          required={formData.hasQuota}
                          value={formData.quota || ''}
                          onChange={(e) => setFormData({ ...formData, quota: parseInt(e.target.value) || 0 })}
                          className="w-full max-w-xs px-4 py-3 rounded-lg border border-slate-200 focus:border-[#673ab7] outline-none font-bold text-slate-700"
                          placeholder="আসন সংখ্যা (যেমন: 200)"
                        />
                        <p className="text-xs text-slate-500 mt-2 font-bengali">এই সংখ্যা পার হয়ে গেলে আর কেউ রেজিস্ট্রেশন করতে পারবে না।</p>
                      </div>
                    )}
                  </div>

                  {/* Question Card: Image */}
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm group">
                    <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-sky-500 pl-4">ইভেন্ট কভার ইমেজ (Max 5MB) বা লিংক</label>
                    <input
                      type="url"
                      value={formData.image || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, image: e.target.value });
                        setEventImageFile(null);
                      }}
                      className="w-full px-0 py-3 border-b-2 border-slate-100 focus:border-[#673ab7] outline-none font-sans text-sm transition-all mb-4"
                      placeholder="ইমেজের ডাইরেক্ট লিংক দিন (অথবা নিচে থেকে ফাইল আপলোড করুন)"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                           if (file.size > 5 * 1024 * 1024) {
                             toast.error('ইমেজের সাইজ 5MB এর বেশি হতে পারবে না');
                             if (e.target) e.target.value = '';
                             return;
                           }
                           const toastId = toast.loading("ইমেজ প্রস্তুত হচ্ছে...");
                           try {
                              const base64Str = await compressImage(file, 1024);
                              setFormData({ ...formData, image: base64Str });
                              setEventImageFile(null);
                              toast.success("ইমেজ যোগ করা হয়েছে!", { id: toastId });
                           } catch (err) {
                              toast.error("ইমেজ যোগ করতে সমস্যা হয়েছে", { id: toastId });
                              console.error(err);
                           }
                           if (e.target) e.target.value = '';
                         }
                      }}
                      className="w-full px-0 py-3 border-b-2 border-slate-100 group-focus-within:border-[#673ab7] outline-none font-mono text-sm transition-all"
                    />
                    {formData.image && !eventImageFile && (
                       <p className="text-xs text-green-600 mt-2">ইতিমধ্যে একটি ছবি বা লিংক দেওয়া আছে। পরিবর্তন করতে নতুন ছবি নির্বাচন বা লিংক দিন।</p>
                    )}
                  </div>

                  {/* Scholarship specific cards... */}
                  {formData.isScholarship && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm group">
                        <label className="block text-base font-bold text-slate-900 font-bengali mb-6 border-l-4 border-amber-500 pl-4">ইউজার ফিল্টারিং</label>
                        <div className="space-y-8">
                          <div>
                            <p className="text-sm font-bold text-slate-400 mb-2 font-bengali">অ্যাডমিশন ডকুমেন্টস (কমা দিয়ে লিখুন)</p>
                            <input
                              type="text"
                              value={formData.requiredDocuments.join(', ')}
                              onChange={(e) => setFormData({ ...formData, requiredDocuments: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                              className="w-full p-0 py-3 border-b-2 border-slate-100 group-focus-within:border-[#673ab7] outline-none font-bengali text-lg transition-all"
                              placeholder="উদাঃ ফটো আইডি, মার্কশিট"
                            />
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-400 mb-2 font-bengali">নির্দিষ্ট ইউজার নির্বাচন (ঐচ্ছিক)</p>
                             <Select
                                options={[
                                  { value: '', label: 'সবাই (পাবলিক ইভেন্ট)' },
                                  ...users.map(u => ({
                                    value: u.phone || u.memberId || u.email,
                                    label: `${u.name} - ${u.phone || u.memberId}`
                                  }))
                                ]}
                                value={formData.targetUserPhone ? { value: formData.targetUserPhone, label: formData.targetUserPhone } : { value: '', label: 'সবাই (পাবলিক ইভেন্ট)' }}
                                onChange={(selectedOption) => setFormData({ ...formData, targetUserPhone: selectedOption ? selectedOption.value : '' })}
                                className="font-bengali"
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    border: 'none',
                                    borderBottom: '2px solid #f1f5f9',
                                    borderRadius: '0',
                                    padding: '5px 0',
                                    boxShadow: 'none'
                                  })
                                }}
                             />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                        <label className="block text-base font-bold text-slate-900 font-bengali mb-6 border-l-4 border-fuchsia-500 pl-4">কাস্টম প্রশ্নাবলি (Questions)</label>
                        <div className="space-y-6">
                           {formData.customQuestions.map((q, idx) => (
                              <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
                                 <span className="bg-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-[#673ab7] shadow-sm shrink-0 mt-1">{idx + 1}</span>
                                 <div className="flex-1 space-y-4">
                                    <input
                                      type="text"
                                      value={q.replace(' (Optional)', '')}
                                      onChange={(e) => {
                                         const isOpt = q.endsWith(' (Optional)');
                                         const newQs = [...formData.customQuestions];
                                         newQs[idx] = e.target.value + (isOpt ? ' (Optional)' : '');
                                         setFormData({ ...formData, customQuestions: newQs });
                                      }}
                                      className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#673ab7] outline-none font-bold font-bengali text-slate-800 py-2 transition-all"
                                      placeholder="আপনার প্রশ্নটি টাইপ করুন..."
                                    />
                                    <label className="flex items-center gap-2 text-sm text-slate-700 font-bold font-bengali p-2 bg-white rounded-lg border border-slate-100 shadow-sm cursor-pointer w-fit">
                                       <input
                                          type="checkbox"
                                          checked={!q.endsWith(' (Optional)')}
                                          onChange={(e) => {
                                             const newQs = [...formData.customQuestions];
                                             const baseQ = q.replace(' (Optional)', '');
                                             newQs[idx] = e.target.checked ? baseQ : `${baseQ} (Optional)`;
                                             setFormData({ ...formData, customQuestions: newQs });
                                          }}
                                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600 cursor-pointer"
                                       />
                                       প্রশ্নটি বাধ্যতামূলক (Required)
                                       {q.endsWith(' (Optional)') && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-2 uppercase tracking-wide">Optional</span>}
                                    </label>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={() => {
                                       const newQs = formData.customQuestions.filter((_, i) => i !== idx);
                                       setFormData({ ...formData, customQuestions: newQs });
                                    }}
                                    className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition"
                                 >
                                    <Trash2 size={22} />
                                 </button>
                              </div>
                           ))}
                           <button
                              type="button"
                              onClick={() => setFormData({ ...formData, customQuestions: [...formData.customQuestions, ''] })}
                              className="w-full py-4 rounded-xl border-2 border-dashed border-slate-200 text-[#673ab7] font-bold font-bengali hover:bg-white hover:border-[#673ab7] transition-all flex items-center justify-center gap-2"
                           >
                              <Plus size={20} /> আরও একটি প্রশ্ন যোগ করুন
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Advanced Form Builder (Campaign & Others) */}
                  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mt-4">
                    <label className="block text-base font-bold text-slate-900 font-bengali mb-6 border-l-4 border-indigo-500 pl-4">রেজিস্ট্রেশন ফরম বিল্ডার (Registration Form)</label>
                    <div className="space-y-6">
                      {formData.customFields.map((field, idx) => (
                        <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col gap-4">
                           <div className="flex justify-between items-center bg-slate-100 p-2 rounded-lg">
                             <span className="font-bold text-sm text-slate-500 font-bengali">ফিল্ড #{idx + 1}</span>
                             <button
                                type="button"
                                onClick={() => {
                                  const newFields = formData.customFields.filter((_, i) => i !== idx);
                                  setFormData({ ...formData, customFields: newFields });
                                }}
                                className="text-rose-500 text-sm font-bold font-bengali"
                             >
                               ডিলিট
                             </button>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input
                                placeholder="ফিল্ডের নাম (যেমন: বয়স, বিভাগ)"
                                value={field.label}
                                onChange={e => {
                                  const newFields = [...formData.customFields];
                                  newFields[idx].label = e.target.value;
                                  setFormData({ ...formData, customFields: newFields });
                                }}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-[#673ab7] outline-none font-bengali"
                              />
                              <select
                                value={field.type}
                                onChange={e => {
                                  const newFields = [...formData.customFields];
                                  newFields[idx].type = e.target.value as any;
                                  setFormData({ ...formData, customFields: newFields });
                                }}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-[#673ab7] outline-none font-bengali"
                              >
                                <option value="text">শর্ট টেক্সট (Short Text)</option>
                                <option value="number">নাম্বার (Number)</option>
                                <option value="date">তারিখ (Date)</option>
                                <option value="select">সিলেক্ট (Dropdown)</option>
                                <option value="textarea">লং টেক্সট (Textarea)</option>
                              </select>
                           </div>
                           {field.type === 'select' && (
                             <input
                                placeholder="অপশনগুলো কমা (,) দিয়ে লিখুন"
                                value={field.options || ''}
                                onChange={e => {
                                  const newFields = [...formData.customFields];
                                  newFields[idx].options = e.target.value;
                                  setFormData({ ...formData, customFields: newFields });
                                }}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-[#673ab7] outline-none font-bengali text-sm"
                             />
                           )}
                           {field.type === 'date' && (
                             <label className="flex items-center gap-2 text-sm text-slate-700 font-bengali font-bold">
                                <input
                                  type="checkbox"
                                  checked={field.calculateAge || false}
                                  onChange={e => {
                                    const newFields = [...formData.customFields];
                                    newFields[idx].calculateAge = e.target.checked;
                                    setFormData({ ...formData, customFields: newFields });
                                  }}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                />
                                অটো বয়স ক্যালকুলেশন করুন (স্মার্ট)
                             </label>
                           )}
                           <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm mt-3 cursor-pointer hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-3">
                                 <input
                                   type="checkbox"
                                   checked={field.required !== false}
                                   onChange={e => {
                                     const newFields = [...formData.customFields];
                                     newFields[idx].required = e.target.checked;
                                     setFormData({ ...formData, customFields: newFields });
                                   }}
                                   className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600 cursor-pointer"
                                 />
                                 <span className="text-sm text-slate-700 font-bold font-bengali">এই প্রশ্নটি বাধ্যতামূলক (Required)</span>
                              </div>
                              {field.required === false && <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-3 py-1 rounded-full uppercase tracking-widest">Optional</span>}
                           </label>
                        </div>
                      ))}
                      <button
                         type="button"
                         onClick={() => {
                           const newId = 'field_' + Date.now();
                           setFormData({ ...formData, customFields: [...formData.customFields, { id: newId, label: '', type: 'text', required: true }] });
                         }}
                         className="w-full py-4 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 font-bold font-bengali hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                      >
                         <Plus size={20} /> নতুন ফর্ম ফিল্ড যোগ করুন
                      </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                       <label className="block text-base font-bold text-slate-900 font-bengali mb-4 border-l-4 border-indigo-500 pl-4">রেজিস্ট্রেশন কনফার্মেশন এসএমএস (SMS Template)</label>
                       <p className="text-xs text-slate-500 mb-3 font-bengali">অপশনাল। যদি ফিল্ড ফাঁকা না থাকে, ইউজার রেজিস্টার করলে অটো এই মেসেজ যাবে। <br/><br/>উপলব্ধ ভ্যারিয়েবল: <span className="font-mono bg-slate-100 px-1 rounded text-slate-700">{'{name}'}</span>, <span className="font-mono bg-slate-100 px-1 rounded text-slate-700">{'{serial}'}</span></p>
                       <textarea
                         value={formData.smsTemplate || ''}
                         onChange={e => setFormData({ ...formData, smsTemplate: e.target.value })}
                         className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-[#673ab7] outline-none min-h-[120px] font-bengali"
                         placeholder="যেমন: ধন্যবাদ {name}, আপনার সিরিয়াল নাম্বার {serial}। পানধোয়া ফ্রি মেডিকেল ক্যাম্পেইনে আপনাকে স্বাগতম।"
                       />
                    </div>
                  </div>

                  {/* Submission Row */}
                  <div className="fixed sm:sticky bottom-0 sm:bottom-8 left-0 right-0 p-4 sm:py-6 sm:px-8 bg-white/95 sm:bg-white/80 backdrop-blur-md border-t sm:border border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] sm:shadow-2xl flex flex-row justify-between items-center z-[60] mx-auto sm:max-w-2xl sm:rounded-2xl gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 sm:flex-none text-slate-500 font-bold font-bengali px-4 sm:px-8 py-3.5 hover:bg-slate-100 rounded-xl transition text-center"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-[2] sm:flex-none bg-[#673ab7] text-white px-4 sm:px-12 py-3.5 sm:py-4 rounded-xl font-bengali font-bold text-base sm:text-lg hover:shadow-[0_10px_30px_rgba(103,58,183,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 shrink-0"
                    >
                      সেভ করুন (Save)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {events.map((event) => (
            <motion.div
              layout
              variants={{
                hidden: { opacity: 0, y: 20, scale: 0.95 },
                show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5 } }
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              key={event.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-40 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                {event.image ? (
                  <img src={event.image} alt={event.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <Calendar className="text-gray-300" size={48} />
                )}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold font-bengali ${
                    event.status === 'Active' ? 'bg-green-100 text-green-600' :
                    event.status === 'Closed' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {event.status === 'Active' ? 'চলমান' : event.status === 'Closed' ? 'বন্ধ' : 'আসন্ন'}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold font-black text-slate-800 mb-3 font-bengali leading-relaxed">{event.title}</h3>
                <p className="text-slate-500 text-sm mb-5 line-clamp-2 font-bengali leading-relaxed">{event.description}</p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Calendar size={16} />
                    <span className="font-bengali">{new Date(event.date).toLocaleDateString('bn-BD')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                    <Clock size={16} />
                    <span className="font-bengali">ডেডলাইন: {new Date(event.deadline).toLocaleDateString('bn-BD')}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                      <span className="font-bengali line-clamp-1">স্থান: {event.location}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setViewApplicants(event.id)}
                      className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-bold font-bengali transition-colors text-center"
                    >
                      আবেদনকারী দেখুন
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + '/events?eventId=' + event.id);
                        toast.success('পোর্টাল লিংক কপি করা হয়েছে');
                      }}
                      className="text-violet-600 bg-violet-50 hover:bg-violet-100 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0"
                      title="পাবলিক লিংক কপি করুন"
                    >
                      <Copy size={16} />
                    </button>
                    {user?.role !== 'visitor_admin' && (
                      <select
                        value={event.status}
                        onChange={(e) => updateStatus(event.id, e.target.value as any)}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 h-8 outline-none focus:border-indigo-500 font-bengali text-slate-700 bg-white"
                      >
                        <option value="Upcoming">আসন্ন</option>
                        <option value="Active">চলমান</option>
                        <option value="Closed">বন্ধ</option>
                      </select>
                    )}
                  </div>
                  {user?.role !== 'visitor_admin' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(event)}
                        className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors shrink-0"
                        title="ইভেন্ট এডিট করুন"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
                        title="ডিলিট করুন"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {events.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500 font-bengali">
              কোন ইভেন্ট পাওয়া যায়নি
            </div>
          )}
        </motion.div>
      )}

      {/* Applicant View Modal */}
      <AnimatePresence>
        {viewApplicants && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewApplicants(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white w-full h-full sm:h-auto sm:max-w-5xl sm:rounded-[2rem] shadow-2xl p-5 sm:p-8 overflow-y-auto sm:max-h-[90vh]">
               <div className="flex flex-col mb-6">
                  <div className="flex justify-between items-start w-full">
                    <h2 className="text-2xl font-black text-slate-800 font-bengali">আবেদনকারীদের তালিকা</h2>
                     <button onClick={() => setViewApplicants(null)} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition-colors shrink-0 sm:hidden">
                        <X size={20} />
                     </button>
                  </div>

                  <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4 lg:gap-0 mt-4">
                     <div>
                       {applicants.length > 0 && (
                         <div className="flex flex-wrap gap-3">
                            <div className="bg-slate-50 px-4 py-2 border border-slate-200 rounded-xl text-center">
                               <p className="text-xs text-slate-500 font-black uppercase font-bengali">মোট আবেদন</p>
                               <p className="text-xl font-bold text-slate-800">{applicants.length}</p>
                            </div>
                            <div className="bg-amber-50 px-4 py-2 border border-amber-200 rounded-xl text-center">
                               <p className="text-xs text-amber-600 font-black uppercase font-bengali">অপেক্ষমান</p>
                               <p className="text-xl font-bold text-amber-700">{applicants.filter(a => a.status === 'pending').length}</p>
                            </div>
                            <div className="bg-emerald-50 px-4 py-2 border border-emerald-200 rounded-xl text-center">
                               <p className="text-xs text-emerald-600 font-black uppercase font-bengali">অনুমোদিত</p>
                               <p className="text-xl font-bold text-emerald-700">{applicants.filter(a => a.status === 'approved').length}</p>
                            </div>
                         </div>
                       )}
                     </div>
                     <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0 justify-start lg:justify-end">
                     {selectedApplicants.length > 0 && (
                        <button 
                           onClick={async () => {
                              if (!window.confirm(`আপনি কি নিশ্চিত যে নির্বাচিত ${selectedApplicants.length} জন আবেদনকারীকে মুছে ফেলতে চান?`)) return;
                              const toastId = toast.loading('মুছে ফেলা হচ্ছে...');
                              try {
                                 for (const id of selectedApplicants) {
                                    await deleteDoc(doc(db, 'event_registrations', id));
                                 }
                                 setApplicants(prev => prev.filter(a => !selectedApplicants.includes(a.id)));
                                 setSelectedApplicants([]);
                                 toast.success("আবেদনকারী মুছে ফেলা হয়েছে", { id: toastId });
                              } catch (e) {
                                 toast.error("মুছতে সমস্যা হয়েছে", { id: toastId });
                              }
                           }}
                           className="flex-auto lg:flex-none justify-center items-center gap-2 bg-rose-50 text-rose-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-rose-100 transition-colors shadow-sm inline-flex"
                        >
                           <Trash2 size={16} /> মুছুন ({selectedApplicants.length})
                        </button>
                     )}
                     {applicants.length > 0 && (() => {
                        const evt = events.find(e => e.id === viewApplicants);
                        const isQuiz = evt?.type === 'কুইজ' || evt?.title?.toLowerCase().includes('quiz') || evt?.title?.includes('কুইজ');
                        const isScholarship = evt?.type === 'বৃত্তি' || evt?.title?.includes('বৃত্তি') || evt?.isScholarship;

                        if (isQuiz) {
                           return (
                              <>
                                <button onClick={handlePrintSelected} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-indigo-100 transition-colors shadow-sm inline-flex">
                                   <Printer size={16} /> তালিকা প্রিন্ট
                                </button>
                                <button onClick={handlePrintQuizAdmitCards} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-emerald-100 transition-colors shadow-sm inline-flex">
                                   <Printer size={16} /> প্রবেশপত্র
                                </button>
                              </>
                           );
                        }
                        
                        if (isScholarship) {
                           return (
                              <>
                                <button onClick={handlePrintSelected} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-indigo-100 transition-colors shadow-sm inline-flex">
                                   <Printer size={16} /> তালিকা প্রিন্ট
                                </button>
                                <button onClick={handlePrintScholarshipForms} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-pink-50 text-pink-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-pink-100 transition-colors shadow-sm inline-flex">
                                   <Printer size={16} /> বৃত্তি ফর্ম প্রিন্ট
                                </button>
                              </>
                           );
                        }

                        return (
                           <>
                              <button onClick={handlePrintSelected} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-indigo-100 transition-colors shadow-sm inline-flex">
                                 <Printer size={16} /> তালিকা প্রিন্ট
                              </button>
                              <button onClick={handlePrintA4SerialList} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-emerald-100 transition-colors shadow-sm inline-flex">
                                 <Printer size={16} /> টোকেন স্লিপ
                              </button>
                              <button onClick={handlePrintMedicalPads} className="max-sm:min-w-[45%] flex-auto lg:flex-none justify-center items-center gap-2 bg-pink-50 text-pink-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-pink-100 transition-colors shadow-sm inline-flex">
                                 <Printer size={16} /> প্যাড প্রিন্ট
                              </button>
                           </>
                        );
                     })()}
                     <button 
                        onClick={() => {
                           const eventToReg = events.find(e => e.id === viewApplicants);
                           if (eventToReg) setShowAdminRegModal(eventToReg);
                        }}
                        className="flex-auto lg:flex-none justify-center items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-sm font-bold font-bengali hover:bg-emerald-100 transition-colors shadow-sm whitespace-nowrap inline-flex">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        নতুন রেজিস্ট্রেশন
                     </button>
                     <button onClick={() => setViewApplicants(null)} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition-colors shrink-0 hidden sm:block">
                        <X size={20} />
                     </button>
                  </div>
               </div>

               {/* Column Selector Widget */}
               {(() => {
                  const evt = events.find(e => e.id === viewApplicants);
                  if (!evt) return null;
                  const customFields = evt.customFields || [];
                  const customQuestions = evt.customQuestions || [];
                  const cols = [
                    { id: 'serial', label: '# সিরিয়াল' },
                    { id: 'name', label: 'আবেদনকারীর নাম' },
                    { id: 'phone', label: 'মোবাইল নম্বর' },
                    ...customFields.map(f => ({ id: `field_${f.id}`, label: f.label })),
                    ...customQuestions.filter(q => q.trim() !== '').map(q => ({ id: `question_${q}`, label: q.replace(' (Optional)', '') })),
                    { id: 'tracking', label: 'ট্র্যাকিং আইডি' }
                  ];
                  return (
                     <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 mt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-200/60 pb-2">
                           <div className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
                              <p className="text-xs font-black text-slate-700 uppercase tracking-widest font-sans">প্রিন্ট কলাম নির্বাচন করুন (Print Column Selector)</p>
                           </div>
                           <div className="flex items-center gap-3 self-end sm:self-center">
                              <button 
                                 onClick={() => setHiddenPrintColumns([])} 
                                 className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider font-sans"
                              >
                                 সব সিলেক্ট
                              </button>
                              <span className="text-slate-300 text-xs">|</span>
                              <button 
                                 onClick={() => setHiddenPrintColumns(cols.map(c => c.id))} 
                                 className="text-[11px] font-bold text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-wider font-sans"
                              >
                                 সব আনসিলেক্ট
                              </button>
                           </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {cols.map(col => {
                              const isChecked = !hiddenPrintColumns.includes(col.id);
                              return (
                                 <label 
                                    key={col.id} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold font-bengali cursor-pointer transition-all border select-none ${
                                       isChecked 
                                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm hover:bg-indigo-100/70' 
                                          : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200/50 hover:text-slate-500'
                                    }`}
                                 >
                                    <input 
                                       type="checkbox" 
                                       checked={isChecked}
                                       onChange={(e) => {
                                          if (e.target.checked) {
                                             setHiddenPrintColumns(prev => prev.filter(id => id !== col.id));
                                          } else {
                                             setHiddenPrintColumns(prev => [...prev, col.id]);
                                          }
                                       }}
                                       className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    {col.label}
                                 </label>
                              );
                           })}
                        </div>
                     </div>
                  );
               })()}
            </div>

               {loadingApplicants ? (
                 <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
               ) : applicants.length === 0 ? (
                 <div className="text-center py-10 text-slate-500 font-bengali">কোন আবেদনকারী পাওয়া যায়নি</div>
               ) : (
                 <div className="space-y-4">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-100 sticky top-0 bg-white z-10 w-full mb-4">
                      <div className="flex items-center gap-3 px-4">
                          <input 
                             type="checkbox" 
                             className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                             checked={selectedApplicants.length === filteredApplicants.length && filteredApplicants.length > 0}
                             onChange={(e) => {
                                if (e.target.checked) setSelectedApplicants(filteredApplicants.map(a => a.id));
                                else setSelectedApplicants([]);
                             }}
                          />
                          <span className="text-sm font-bold text-slate-700 font-bengali">সব নির্বাচন করুন ({selectedApplicants.length} টি নির্বাচিত)</span>
                      </div>
                      <div className="px-4">
                         <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                               type="text" 
                               placeholder="সিরিয়াল, নাম, বা মোবাইল দিয়ে খুঁজুন... (Barcode Scanner Ready)"
                               value={applicantSearchTerm}
                               onChange={(e) => setApplicantSearchTerm(e.target.value)}
                               className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 w-full sm:w-96 font-sans text-sm transition-all shadow-sm"
                            />
                         </div>
                      </div>
                   </div>
                   
                   {filteredApplicants.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 font-bengali">সার্চের সাথে মিল পাওয়া যায়নি</div>
                   ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {filteredApplicants.map((app) => (
                     <div key={app.id} className="p-5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors flex gap-4">
                        <div className="pt-1 select-none">
                           <input 
                              type="checkbox"
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={selectedApplicants.includes(app.id)}
                              onChange={(e) => {
                                 if (e.target.checked) setSelectedApplicants([...selectedApplicants, app.id]);
                                 else setSelectedApplicants(selectedApplicants.filter(id => id !== app.id));
                              }}
                           />
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-3">
                              <div className="min-w-0">
                                 <h4 className="font-bold text-slate-800 font-bengali text-base sm:text-lg leading-tight mb-0.5 break-words">{app.userName}</h4>
                                 <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">{app.userPhone}</p>
                              </div>
                              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 w-full sm:w-auto overflow-hidden">
                                 <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-lg truncate shrink">{new Date(app.registeredAt?.seconds * 1000).toLocaleString('bn-BD')}</span>
                                 <select 
                                   value={app.status || 'pending'} 
                                   onChange={(e) => updateApplicantStatus(app.id, e.target.value)}
                                   className="text-xs sm:text-sm font-bold border border-slate-200 rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 outline-none font-bengali cursor-pointer bg-slate-50 text-slate-700 shrink-0"
                                 >
                                    <option value="pending">অপেক্ষমান</option>
                                    <option value="approved">অনুমোদিত</option>
                                    <option value="rejected">বাতিল</option>
                                 </select>
                              </div>
                           </div>
                           
                           {app.customFieldAnswers && Object.keys(app.customFieldAnswers).length > 0 && (
                             <div className="mb-3 space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                {Object.values(app.customFieldAnswers).map((field: any, idx: number) => (
                                  <div key={`${field.label}-${idx}`} className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 sm:items-start">
                                     <p className="text-[10px] sm:text-[11px] text-slate-500 font-bengali uppercase tracking-wide break-words" title={field.label}>{field.label}</p>
                                     <p className="text-xs sm:text-[12px] font-semibold text-slate-800 font-bengali sm:col-span-2 break-words leading-snug">{field.value || '-'}</p>
                                  </div>
                                ))}
                             </div>
                           )}

                           <div className="flex flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                             <button 
                                onClick={() => {
                                  setEditApplicant(app);
                                  setEditApplicantFormData({
                                    userName: app.userName || '',
                                    userPhone: app.userPhone || '',
                                    serialNumber: app.serialNumber || '',
                                    customFieldAnswers: app.customFieldAnswers || {}
                                  });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-xs font-bold transition-colors font-bengali"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> এডিট
                             </button>
                             <button 
                                onClick={() => handleDeleteApplicant(app.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors font-bengali"
                             >
                                <Trash2 size={14} /> মুছুন
                             </button>
                             <button 
                                onClick={() => { window.location.href = `tel:${app.userPhone}`; }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors font-sans"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                Phone
                             </button>
                             <button 
                                onClick={() => {
                                  const iframe = document.createElement('iframe');
                                  iframe.style.display = 'none';
                                  iframe.src = `sip:${app.userPhone}`;
                                  document.body.appendChild(iframe);
                                  setTimeout(() => document.body.removeChild(iframe), 2000);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold transition-colors font-sans"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                Zoiper
                             </button>
                             <button 
                                onClick={() => handlePrintApplicant(app)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-colors font-bengali"
                             >
                                <Printer size={14} /> সাধারণ প্রিন্ট
                             </button>
                           </div>
                        </div>
                     </div>
                   ))}
                   </div>
                   )}
                 </div>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Manual Registration Modal */}
      <AnimatePresence>
        {showAdminRegModal && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetAdminRegForm} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 font-bengali">অ্যাডমিন প্যানেল হতে রেজিস্ট্রেশন</h2>
                    <button onClick={resetAdminRegForm} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition-colors">
                       <X size={20} />
                    </button>
                 </div>
                 
                 {adminRegSuccess ? (
                    <div className="text-center py-10 space-y-4">
                       <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle size={32} />
                       </div>
                       <h3 className="text-2xl font-bold font-bengali text-slate-800">সফলভাবে রেজিস্ট্রেশন হয়েছে!</h3>
                       <p className="text-slate-500 font-bengali">সিরিয়াল নম্বর: <span className="font-bold text-indigo-600 text-xl">{adminRegCurrentSerial}</span></p>
                       <button onClick={resetAdminRegForm} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold font-bengali">বন্ধ করুন</button>
                    </div>
                 ) : (
                    <form onSubmit={handleAdminSubmitRegistration} className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                           <p className="text-sm text-slate-500 font-bengali">ইভেন্ট:</p>
                           <p className="text-lg font-bold text-slate-800 font-bengali">{showAdminRegModal.title}</p>
                        </div>
                        
                        {(!showAdminRegModal.customFields || showAdminRegModal.customFields.length === 0) && (
                           <div className="space-y-4">
                              <div>
                                 <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">নাম</label>
                                 <input type="text" required value={adminRegName} onChange={e => setAdminRegName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" />
                              </div>
                              <div>
                                 <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">মোবাইল নাম্বার</label>
                                 <input type="text" required value={adminRegPhone} onChange={e => setAdminRegPhone(e.target.value)} placeholder="017..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none tracking-wider" />
                              </div>
                           </div>
                        )}

                        {showAdminRegModal.customFields && showAdminRegModal.customFields.length > 0 && (
                           <div className="space-y-4">
                              {/* If name is missing from custom fields */}
                              {!(showAdminRegModal.customFields?.some(f => /name|নাম/i.test(f.label))) && (
                                 <div>
                                    <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">নাম *</label>
                                    <input type="text" required value={adminRegName} onChange={e => setAdminRegName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" />
                                 </div>
                              )}
                              
                              {/* If phone is missing from custom fields */}
                              {!(showAdminRegModal.customFields?.some(f => /phone|mobile|number|মোবাইল|ফোন/i.test(f.label))) && (
                                 <div>
                                    <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">মোবাইল নাম্বার *</label>
                                    <input type="text" required value={adminRegPhone} onChange={e => setAdminRegPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none tracking-wider" />
                                 </div>
                              )}

                              <div className="space-y-4 pt-4 border-t border-slate-100">
                                 <p className="font-bold text-slate-800 font-bengali">কাস্টম ফিল্ডসমূহ</p>
                                 {showAdminRegModal.customFields.map((field, idx) => (
                                    <div key={idx}>
                                       <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">
                                          {field.label} {field.required !== false && <span className="text-rose-500">*</span>}
                                       </label>
                                       {field.type === 'select' ? (
                                          <select required={field.required !== false} value={adminRegCustomValues[field.id] || ''} onChange={e => setAdminRegCustomValues(prev => ({...prev, [field.id]: e.target.value}))} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none">
                                             <option value="">নির্বাচন করুন</option>
                                             {field.options?.split(',').map((opt, i) => <option key={i} value={opt.trim()}>{opt.trim()}</option>)}
                                          </select>
                                       ) : (
                                          <input type={field.type === 'date' ? 'date' : (field.type === 'number' ? 'number' : 'text')} required={field.required !== false} value={field.type === 'date' ? (adminRegCustomValues[field.id]?.split(' ')[0] || '') : (adminRegCustomValues[field.id] || '')} onChange={e => {
                                             let val = e.target.value;
                                             if (field.type === 'date' && field.calculateAge && val) {
                                                const birthDate = new Date(val);
                                                const age = Math.abs(new Date(Date.now() - birthDate.getTime()).getUTCFullYear() - 1970);
                                                val = `${val} (বয়স: ${age} বছর)`;
                                             }
                                             setAdminRegCustomValues(prev => ({...prev, [field.id]: val}));
                                          }} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" />
                                       )}
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}

                        <div className="pt-6 flex gap-3">
                           <button type="submit" disabled={adminRegLoading} className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold font-bengali hover:bg-slate-900 transition-colors disabled:opacity-50 text-lg shadow-lg">
                              {adminRegLoading ? 'প্রসেস হচ্ছে...' : 'রেজিস্ট্রেশন করুন'}
                           </button>
                        </div>
                    </form>
                 )}
              </motion.div>
           </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editApplicant && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditApplicant(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 font-bengali">আবেদনকারীর তথ্য আপডেট</h2>
                    <button onClick={() => setEditApplicant(null)} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition-colors">
                       <X size={20} />
                    </button>
                 </div>
                 
                 <form onSubmit={handleUpdateApplicantDetails} className="space-y-6">
                    <div>
                       <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">আবেদনকারীর নাম</label>
                       <input 
                          type="text" 
                          required 
                          value={editApplicantFormData.userName || ''} 
                          onChange={e => setEditApplicantFormData(prev => ({...prev, userName: e.target.value}))} 
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" 
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">মোবাইল নম্বর</label>
                       <input 
                          type="text" 
                          required 
                          value={editApplicantFormData.userPhone || ''} 
                          onChange={e => setEditApplicantFormData(prev => ({...prev, userPhone: e.target.value}))} 
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" 
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">সিরিয়াল নম্বর</label>
                       <input 
                          type="number" 
                          value={editApplicantFormData.serialNumber || ''} 
                          onChange={e => setEditApplicantFormData(prev => ({...prev, serialNumber: e.target.value}))} 
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" 
                       />
                    </div>

                    {editApplicantFormData.customFieldAnswers && Object.keys(editApplicantFormData.customFieldAnswers).length > 0 && (
                       <div className="space-y-4">
                          <p className="font-bold text-slate-800 font-bengali">কাস্টম ফিল্ডসমূহ</p>
                          {Object.values(editApplicantFormData.customFieldAnswers).map((field: any, idx) => (
                             <div key={idx}>
                                <label className="block text-sm font-bold text-slate-700 font-bengali mb-1">{field.label}</label>
                                <input 
                                   type="text" 
                                   value={field.value || ''} 
                                   onChange={e => {
                                      const newAnswers = { ...editApplicantFormData.customFieldAnswers };
                                      const fieldKey = Object.keys(newAnswers).find(k => newAnswers[k].label === field.label);
                                      if (fieldKey) {
                                        newAnswers[fieldKey] = { ...newAnswers[fieldKey], value: e.target.value };
                                        setEditApplicantFormData(prev => ({...prev, customFieldAnswers: newAnswers}));
                                      }
                                   }} 
                                   className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" 
                                />
                             </div>
                          ))}
                       </div>
                    )}

                    <div className="pt-6 flex gap-3">
                       <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold font-bengali hover:bg-slate-900 transition-colors text-lg shadow-lg">
                          আপডেট করুন
                       </button>
                    </div>
                 </form>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
