import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, getDoc, doc, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Calendar, Clock, MapPin, Printer, CheckCircle, ArrowRight, Sparkles, Zap, Award, FileText, X, Copy } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { sendSMS } from '../../lib/sms';

import { storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  location?: string;
  status: 'Active' | 'Closed' | 'Upcoming';
  type: string;
  image?: string;
  isScholarship?: boolean;
  requiredDocuments?: string[];
  customQuestions?: string[];
  customFields?: CustomField[];
  smsTemplate?: string;
  targetUserPhone?: string;
  guidelines?: string;
  hasQuota?: boolean;
  quota?: number;
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');

  // Quota states
  const [quotaChecking, setQuotaChecking] = useState(false);
  const [isQuotaFull, setIsQuotaFull] = useState(false);
  const [currentRegCount, setCurrentRegCount] = useState(0);

  const isAdmin = user?.role === 'admin' || user?.subadminAccess?.includes('/dashboard/events');

  // Scholarship Application State
  const [scholarshipAnswers, setScholarshipAnswers] = useState<Record<string, string>>({});
  const [scholarshipFiles, setScholarshipFiles] = useState<Record<string, File>>({});
  
  // Custom form state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [currentSerial, setCurrentSerial] = useState(1);
  const [isDirectLinkLoading, setIsDirectLinkLoading] = useState(!!new URLSearchParams(window.location.search).get('eventId'));
  const [isDirectModeState, setIsDirectModeState] = useState(!!new URLSearchParams(window.location.search).get('eventId'));

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    deadline: '',
    type: 'সাংস্কৃতিক',
    status: 'Active' as const,
    image: '',
    requiredDocuments: [] as string[],
    customQuestions: [] as string[],
    customFields: [] as CustomField[],
    isScholarship: false,
    smsTemplate: '',
    targetUserPhone: '',
    guidelines: ''
  });
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleCloseModal = () => {
    setSelectedEvent(null);
    if (isDirectModeState) {
      window.history.pushState({}, '', '/events');
      setIsDirectModeState(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Slip</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
          </head>
          <body>
            ${printRef.current?.innerHTML || ''}
            <script>
              JsBarcode("#barcode", "${currentSerial.toString().padStart(4, '0')}", {
                format: "CODE128",
                width: 2,
                height: 40,
                displayValue: true,
                fontSize: 14,
                margin: 10
              });
              setTimeout(() => {
                window.print();
                window.close();
              }, 800);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      toast.error('Please allow pop-ups to print');
    }
  };

  useEffect(() => {
    // Fast-load event if URL has eventId
    const urlParams = new URLSearchParams(window.location.search);
    const eventIdFromUrl = urlParams.get('eventId');
    
    if (eventIdFromUrl) {
       getDoc(doc(db, 'events', eventIdFromUrl)).then(docSnap => {
         if (docSnap.exists()) {
           const targetEvent = { id: docSnap.id, ...docSnap.data() } as any;
           setSelectedEvent(targetEvent);
           if (user) {
             setApplicantName(isAdmin ? '' : user.name);
             setApplicantPhone(isAdmin ? '' : (user.phone || ''));
           }
         }
       }).catch(console.error).finally(() => {
         setIsDirectLinkLoading(false);
       });
    }

    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, 'events'));
      const querySnapshot = await getDocs(q);
      const now = new Date();
      
      let fetchedEvents = querySnapshot.docs.map(doc => {
        const data = doc.data() as Event;
        const eventDate = new Date(data.date);
        const deadline = new Date(data.deadline);
        
        let autoStatus = data.status;
        
        // Auto-close only if deadline passed
        if (now > deadline) {
          autoStatus = 'Closed';
        } else if (data.status === 'Closed') {
          autoStatus = 'Closed';
        } else if (!data.status) {
          autoStatus = now < deadline ? 'Active' : 'Closed';
        }

        return {
          ...data,
          id: doc.id,
          status: autoStatus
        };
      }) as Event[];
      
      // Only show Active and Upcoming on public page
      fetchedEvents = fetchedEvents.filter(ev => ev.status !== 'Closed');
      
      fetchedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Filter targeted events out if user doesn't match
      if (user?.role !== 'admin' && user?.role !== 'subadmin' && user?.role !== 'visitor_admin') {
         fetchedEvents = fetchedEvents.filter(ev => {
            if (!ev.targetUserPhone) return true;
            return ev.targetUserPhone === user?.phone;
         });
      }

      setEvents(fetchedEvents);

      // We handled auto-opening in the useEffect directly for faster load,
      // but if something changed or to be safe we can leave this or remove it.
      // Removed the redundant slow check.
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'events'), {
        ...newEvent,
        creatorId: user.id,
        createdAt: serverTimestamp()
      });
      toast.success("ইভেন্ট সফলভাবে তৈরি হয়েছে!");
      
      const newEventData = {
        id: docRef.id,
        ...newEvent,
        creatorId: user.id,
        createdAt: new Date().toISOString()
      } as any;
      
      setEvents(prev => [...prev, newEventData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      
      setShowCreateModal(false);
      setNewEvent({
        title: '',
        description: '',
        date: '',
        deadline: '',
        type: 'সাংস্কৃতিক',
        status: 'Active',
        image: '',
        requiredDocuments: [],
        customQuestions: [],
        customFields: [],
        isScholarship: false,
        smsTemplate: '',
        targetUserPhone: '',
        guidelines: ''
      });
      setEventImageFile(null);
      fetchEvents();
    } catch (error) {
      toast.error("ইভেন্ট তৈরি করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    
    let finalName = applicantName;
    let finalPhone = applicantPhone;

    if (selectedEvent.customFields) {
      const nameField = selectedEvent.customFields.find(f => f.label.toLowerCase().includes('name') || f.label.includes('নাম'));
      const phoneField = selectedEvent.customFields.find(f => f.label.toLowerCase().includes('phone') || f.label.toLowerCase().includes('mobile') || f.label.includes('মোবাইল') || f.label.includes('ফোন') || f.label.toLowerCase().includes('number'));
      
      if (!finalName && nameField) finalName = customFieldValues[nameField.id] || '';
      if (!finalPhone && phoneField) finalPhone = customFieldValues[phoneField.id] || '';
    }

    if (!finalName || !finalPhone) {
      toast.error("দয়া করে নাম এবং মোবাইল নম্বর প্রদান করুন");
      return;
    }

    setRegistering(true);
    try {
      // Final Quota Check
      const regQuery = query(collection(db, 'event_registrations'), where('eventId', '==', selectedEvent.id));
      const snapshot = await getDocs(regQuery);
      if (selectedEvent.hasQuota && selectedEvent.quota && snapshot.size >= selectedEvent.quota) {
          toast.error("দুঃখিত, ইতিমধ্যে কোটা পূর্ণ হয়ে গেছে");
          setRegistering(false);
          handleCloseModal();
          return;
      }

      let registrationData: any = {
        eventId: selectedEvent.id,
        userId: user?.id || 'anonymous',
        userName: finalName,
        userPhone: finalPhone,
        registeredAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      setApplicantName(finalName);
      setApplicantPhone(finalPhone);

      // Handle Scholarship/Medical Documents & Answers
      if (selectedEvent.isScholarship || selectedEvent.type === 'মেডিকেল ইভেন্ট') {
        // Upload Files
        const documentUrls: Record<string, string> = {};
        for (const [docName, file] of Object.entries(scholarshipFiles)) {
          const fileRef = ref(storage, `scholarships/${selectedEvent.id}/${user?.id || 'anon'}_${Date.now()}/${docName}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          documentUrls[docName] = url;
        }

        registrationData = {
          ...registrationData,
          isScholarshipApplication: true,
          answers: scholarshipAnswers,
          documents: documentUrls
        };
      }

      // Add modern custom fields
      if (selectedEvent.customFields && selectedEvent.customFields.length > 0) {
         const formattedAnswers: Record<string, { label: string, value: string }> = {};
         selectedEvent.customFields.forEach(field => {
            const safeKey = field.id || Date.now().toString() + Math.random().toString(36).slice(2);
            formattedAnswers[safeKey] = {
               label: field.label || 'Unknown Field',
               value: customFieldValues[field.id] || ''
            };
         });
         registrationData.customFieldAnswers = formattedAnswers;
      }

      // Generate a Serial Number ONLY for medical camps
      const isMedicalEvent = selectedEvent.type?.includes('মেডিকেল') || selectedEvent.title?.toLowerCase().includes('medical');
      
      if (isMedicalEvent) {
         try {
            const regQuery = query(collection(db, 'event_registrations'), where('eventId', '==', selectedEvent.id));
            const snapshot = await getDocs(regQuery);
            
            let isDepartmental = false;
            let departmentValue = '';
            if (selectedEvent.type === 'মেডিকেল ক্যাম্পেইন' && selectedEvent.customFields) {
               const deptField = selectedEvent.customFields.find(f => f.label.toLowerCase().includes('dept') || f.label.toLowerCase().includes('বিভাগ'));
               if (deptField && customFieldValues[deptField.id]) {
                   isDepartmental = true;
                   departmentValue = customFieldValues[deptField.id].toLowerCase().trim();
               }
            }

            if (isDepartmental && departmentValue) {
                const deptDocs = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    if (!data.customFieldAnswers) return false;
                    return Object.values(data.customFieldAnswers).some((ans: any) => 
                        (ans.label.toLowerCase().includes('dept') || ans.label.toLowerCase().includes('বিভাগ')) && 
                        String(ans.value).toLowerCase().trim() === departmentValue
                    );
                });
                registrationData.serialNumber = deptDocs.length + 1;
            } else {
                registrationData.serialNumber = snapshot.size + 1;
            }
         } catch (err) {
            registrationData.serialNumber = 1;
         }
         setCurrentSerial(registrationData.serialNumber);
      } else {
         setCurrentSerial(0);
      }

      await addDoc(collection(db, 'event_registrations'), registrationData);
      
      // Handle Auto SMS
      if (applicantPhone) {
         let message = '';
         const isMedicalCamp = selectedEvent.type?.includes('মেডিকেল') || selectedEvent.title?.toLowerCase().includes('medical');
         
         if (isMedicalCamp) {
             let deptValue = 'Not Specified';
             if (selectedEvent.customFields) {
                const deptField = selectedEvent.customFields.find(f => f.label.toLowerCase().includes('dept') || f.label.toLowerCase().includes('বিভাগ'));
                if (deptField && customFieldValues[deptField.id]) {
                   deptValue = customFieldValues[deptField.id];
                }
             }
             const patientId = `FMC${new Date().getFullYear().toString().slice(-2)}${registrationData.serialNumber.toString().padStart(3, '0')}`;
             
             message = `Dear ${applicantName || user?.name || 'Patient'},\nYour registration for the Free Medical Camp by Pandhoa Public Library has been confirmed.\n\nPatient ID: ${patientId} | Serial: ${registrationData.serialNumber}\nDoctor Department: ${deptValue}\n\nPlease visit on time and show this SMS at the registration desk.\nThank you.`;
         } else if (selectedEvent.smsTemplate) {
            message = selectedEvent.smsTemplate
                 .replace(/{name}/g, applicantName || user?.name || '')
                 .replace(/{serial}/g, (registrationData.serialNumber || '').toString());
         } else {
            message = `ধন্যবাদ ${applicantName || ''}। ${selectedEvent.title}-এ আপনাকে স্বাগতম!`;
         }
         
         try {
             await sendSMS(applicantPhone, message);
         } catch (e) {
             console.error('Failed to send SMS', e);
         }
      }

      toast.success(selectedEvent.isScholarship ? "আবেদন সফল হয়েছে!" : "রেজিস্ট্রেশন সফল হয়েছে!");
      setHasRegistered(true);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(selectedEvent.isScholarship ? "আবেদন করতে সমস্যা হয়েছে" : "রেজিস্ট্রেশন করতে সমস্যা হয়েছে");
    } finally {
      setRegistering(false);
    }
  };

  if (isDirectLinkLoading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-bengali font-medium animate-pulse">ইভেন্ট লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <Helmet>
        <title>ইভেন্ট ও প্রতিযোগিতা - পানধোয়া উন্মুক্ত পাঠাগার</title>
        <meta name="description" content="লাইব্রেরির সকল আসন্ন ইভেন্ট, প্রতিযোগিতা এবং বৃত্তি পরীক্ষার তথ্য এখানে দেখুন। অনলাইনে রেজিস্ট্রেশন করুন।" />
      </Helmet>

      <div className={isDirectModeState ? "hidden" : ""}>
        {/* Header Area */}
        <div className="bg-slate-50 border-b border-slate-100 pt-12 pb-8 sm:pt-20 sm:pb-12 px-6 text-center">
        <div className="max-w-7xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-black text-slate-900 mb-4 font-bengali tracking-tight"
          >
            ইভেন্ট ও প্রতিযোগিতা
          </motion.h1>
          <p className="text-lg md:text-xl text-slate-500 font-bengali max-w-2xl mx-auto font-medium">লাইব্রেরির সকল ইভেন্ট, সাংস্কৃতিক প্রতিযোগিতা এবং বৃত্তি পরীক্ষার তথ্য এখানে পাবেন।</p>
          
          {user && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowCreateModal(true)}
              className="mt-10 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black font-bengali text-lg shadow-xl shadow-indigo-200 hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-3 mx-auto"
            >
               নতুন ইভেন্ট তৈরি করুন <Sparkles size={24} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-slate-50 rounded-2xl h-80"></div>
            ))}
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.95 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
                }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border-[1.5px] border-slate-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group flex flex-col h-full ring-1 ring-slate-900/5"
              >
                <div className="relative w-full aspect-auto sm:aspect-auto overflow-hidden bg-white flex items-center justify-center p-2 rounded-t-[2rem] sm:rounded-t-[2.5rem]">
                  <img src={event.image || 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=1974&auto=format&fit=crop'} alt={event.title} referrerPolicy="no-referrer" className="w-full h-auto max-h-[250px] sm:max-h-[300px] object-contain group-hover:scale-105 transition-transform duration-700 ease-out" />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent pointer-events-none rounded-t-[2rem] sm:rounded-t-[2.5rem]" />
                  <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex flex-wrap gap-2">
                    {event.status === 'Upcoming' && (
                      <span className="bg-amber-400/95 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-black text-amber-950 font-bengali tracking-wider shadow-sm uppercase">
                        আসন্ন
                      </span>
                    )}
                    {event.type && (
                      <span className="bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-black text-indigo-700 font-bengali tracking-wider shadow-sm uppercase">
                        {event.type}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex flex-col flex-1 relative z-10 bg-white">
                   <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3 font-bengali group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">{event.title}</h3>
                   <p className="text-slate-500 font-bengali mb-6 line-clamp-2 leading-relaxed font-medium text-sm sm:text-base">{event.description}</p>
                   
                   <div className="mt-auto grid grid-cols-1 gap-3 mb-8">
                      <div className="flex items-center gap-4 bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-100/60 transition-colors group-hover:bg-indigo-50/50 group-hover:border-indigo-100/50">
                         <div className="p-2.5 bg-white shadow-sm rounded-xl text-indigo-600">
                            <Calendar size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase font-sans mb-0.5">EVENT DATE</p>
                            <p className="font-bengali font-bold text-slate-800 text-sm sm:text-base">{new Date(event.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4 bg-rose-50/50 p-3 sm:p-4 rounded-2xl border border-rose-100/60 transition-colors group-hover:bg-rose-50">
                         <div className="p-2.5 bg-white shadow-sm rounded-xl text-rose-500">
                            <Clock size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black tracking-widest text-rose-400 uppercase font-sans mb-0.5">REGISTRATION DEADLINE</p>
                            <p className="font-bengali font-bold text-rose-700 text-sm sm:text-base">{new Date(event.deadline).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4 bg-emerald-50/50 p-3 sm:p-4 rounded-2xl border border-emerald-100/60 transition-colors group-hover:bg-emerald-50 sm:col-span-2">
                         <div className="p-2.5 bg-white shadow-sm rounded-xl text-emerald-500">
                            <MapPin size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-sans mb-0.5">স্থান</p>
                            <p className="font-bengali font-bold text-emerald-700 text-sm sm:text-base uppercase tracking-widest text-lg">{event.location || 'এইচকিউ'}</p>
                         </div>
                      </div>
                   </div>

                    <div className="flex gap-3">
                      <motion.button
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.98 }}
                       onClick={async () => {
                         // Check quota
                         let quotaReached = false;
                         let regCount = 0;
                         if (event.hasQuota && event.quota && event.quota > 0) {
                           setQuotaChecking(true);
                           const toastId = toast.loading("কোটা চেক করা হচ্ছে...");
                           try {
                             const regQuery = query(collection(db, 'event_registrations'), where('eventId', '==', event.id));
                             const snapshot = await getDocs(regQuery);
                             regCount = snapshot.size;
                             if (regCount >= event.quota) {
                               quotaReached = true;
                               toast.error(`দুঃখিত, এই ইভেন্টের কোটা পূরণ হয়ে গেছে (${event.quota} জন)`, { id: toastId });
                             } else {
                               toast.success(`আর মাত্র ${event.quota - regCount} টি সিট বাকি আছে!`, { id: toastId });
                             }
                           } catch (err) {
                             console.error("Quota check failed", err);
                             toast.dismiss(toastId);
                           }
                           setQuotaChecking(false);
                         }

                         setIsQuotaFull(quotaReached);
                         setCurrentRegCount(regCount);

                         if (!quotaReached) {
                             setSelectedEvent(event);
                             setApplicantName(isAdmin ? '' : (user?.name || ''));
                             setApplicantPhone(isAdmin ? '' : (user?.phone || ''));
                             setHasRegistered(false);
                             // Clear state
                             setScholarshipAnswers({});
                             setScholarshipFiles({});
                             setCustomFieldValues({});
                         }
                       }}
                       disabled={quotaChecking}
                       className="flex-[4] py-3.5 sm:py-4 rounded-2xl font-black font-bengali text-base sm:text-lg transition-all flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-indigo-600 shadow-[0_8px_20px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 disabled:opacity-50"
                      >
                        রেজিস্ট্রেশন করুন <ArrowRight size={20} className="hidden sm:block" />
                      </motion.button>
                      
                      <button 
                         onClick={() => {
                            const url = `${window.location.origin}/events?eventId=${event.id}`;
                            navigator.clipboard.writeText(url);
                            toast.success("লিংক কপি করা হয়েছে!");
                         }}
                         className="flex-[1] flex items-center justify-center p-3.5 sm:p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100 hover:border-indigo-100"
                         title="লিংক কপি করুন"
                      >
                         <Copy size={20} />
                      </button>
                    </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && events.length === 0 && (
          <div className="text-center py-32 bg-slate-50 rounded-[3.5rem] border-2 border-dashed border-slate-200">
             <Calendar size={64} className="mx-auto mb-6 text-slate-300" />
             <h3 className="text-2xl font-black text-slate-900 font-bengali mb-3">আপাতত নতুন কোনো ইভেন্ট নেই</h3>
             <p className="text-slate-500 font-bengali text-lg">পরবর্তীতে আবার দেখুন অথবা আমাদের ফেসবুক পেজে চোখ রাখুন।</p>
          </div>
        )}
      </div>
      </div>

      {/* Create Event Modal - Google Form Style */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f0ebf8]">
            <div className="min-h-screen py-8 px-4">
              <div className="max-w-3xl mx-auto flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                   <div className="bg-[#673ab7] p-2 rounded-lg">
                      <FileText size={24} className="text-white" />
                   </div>
                   <h2 className="text-xl font-bold font-bengali text-slate-800">নতুন ইভেন্ট তৈরি</h2>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-600" />
                </button>
              </div>

              <div className="max-w-3xl mx-auto space-y-4">
                <form onSubmit={handleCreateEvent} className="space-y-4 pb-32">
                  {/* Top Accent */}
                  <div className="h-2.5 bg-[#673ab7] w-full rounded-t-xl mb-[-4px]" />
                  
                  {/* Header Card */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm p-8">
                    <input
                      type="text"
                      required
                      value={newEvent.title}
                      onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                      className="w-full text-4xl font-bold font-bengali text-slate-900 border-b-2 border-transparent focus:border-[#673ab7] mb-6 outline-none transition-all placeholder:text-slate-200 py-2 bg-transparent"
                      placeholder="ইভেন্টের নাম (Event Title)"
                    />
                    <textarea
                      required
                      value={newEvent.description}
                      onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      className="w-full px-0 py-2 bg-transparent text-slate-700 font-bengali text-lg outline-none resize-none min-h-[100px] border-b-2 border-transparent focus:border-[#673ab7] transition-all placeholder:text-slate-300"
                      placeholder="ইভেন্টের বিস্তারিত বিবরণ..."
                    />
                  </div>

                  {/* Type Selection */}
                  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm group">
                     <label className="block text-base font-bold text-slate-900 font-bengali mb-4 transition-colors">ইভেন্টের ধরন</label>
                     <select 
                       value={newEvent.type} 
                       onChange={e => {
                         const type = e.target.value;
                         let newCustomFields: any[] = [];
                         if (type === 'মেডিকেল ক্যাম্পেইন') {
                            newCustomFields = [
                               { id: 'field_' + Date.now() + 1, label: 'Patient Name', type: 'text', required: true },
                               { id: 'field_' + Date.now() + 2, label: 'Mobile Number', type: 'text', required: true },
                               { id: 'field_' + Date.now() + 3, label: 'Gender', type: 'select', required: true, options: 'Male, Female, Other' },
                               { id: 'field_' + Date.now() + 4, label: 'Age (DOB)', type: 'date', required: true, calculateAge: true },
                               { id: 'field_' + Date.now() + 5, label: 'Dept', type: 'text', required: true }
                            ];
                         }
                         setNewEvent({...newEvent, type, customFields: newCustomFields, isScholarship: type === 'Scholarship' || type === 'QuestionAnswer' || type === 'বৃত্তি' || type === 'প্রশ্ন উত্তর'});
                       }} 
                       className="w-full px-0 py-3 bg-transparent border-b-2 border-slate-200 group-focus-within:border-[#673ab7] outline-none transition-all font-bengali font-bold text-slate-700"
                     >
                        <option>বৃত্তি পরীক্ষা</option>
                        <option>সাংস্কৃতিক</option>
                        <option>রচনা প্রতিযোগিতা</option>
                        <option>সেমিনার</option>
                        <option>মেডিকেল ক্যাম্পেইন</option>
                        <option>অন্যান্য</option>
                     </select>
                  </div>

                  {/* Documents & Questions (From User Screenshot) */}
                  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm group">
                     <label className="block text-base font-bold text-slate-900 font-bengali mb-4 transition-colors">প্রয়োজনীয় নথিপত্র (কমা দিয়ে লিখুন)</label>
                     <input 
                       type="text" 
                       value={newEvent.requiredDocuments?.join(', ') || ''} 
                       onChange={e => setNewEvent({...newEvent, requiredDocuments: e.target.value.split(',').map(s=>s.trim())})} 
                       className="w-full px-0 py-3 bg-transparent border-b-2 border-slate-200 group-focus-within:border-[#673ab7] outline-none transition-all font-bengali font-bold text-slate-700 placeholder:text-slate-300"
                       placeholder="পাসপোর্ট সাইজ ছবি, মার্কশিট, প্রত্যয়নপত্র" 
                     />
                  </div>

                  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm group">
                     <label className="block text-base font-bold text-slate-900 font-bengali mb-4 transition-colors">কাস্টম প্রশ্ন (কমা দিয়ে লিখুন)</label>
                     <input 
                       type="text" 
                       value={newEvent.customQuestions?.join(', ') || ''} 
                       onChange={e => setNewEvent({...newEvent, customQuestions: e.target.value.split(',').map(s=>s.trim())})} 
                       className="w-full px-0 py-3 bg-transparent border-b-2 border-slate-200 group-focus-within:border-[#673ab7] outline-none transition-all font-bengali font-bold text-slate-700 placeholder:text-slate-300"
                       placeholder="আবেদনের কারণ, ভবিষ্যৎ পরিকল্পনা" 
                     />
                  </div>

                  {/* Dates */}
                  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="group border-l-4 border-indigo-500 pl-4 py-2">
                         <label className="block text-base font-bold text-slate-900 font-bengali mb-2">ইভেন্ট তারিখ</label>
                         <input type="date" required value={newEvent.date} onChange={e=>setNewEvent({...newEvent, date: e.target.value})} className="w-full px-0 py-2 bg-transparent border-b-2 border-slate-200 group-focus-within:border-[#673ab7] outline-none transition-all font-sans font-bold" />
                       </div>
                       <div className="group border-l-4 border-rose-500 pl-4 py-2">
                         <label className="block text-base font-bold text-slate-900 font-bengali mb-2">রেজিস্ট্রেশন ডেডলাইন</label>
                         <input type="date" required value={newEvent.deadline} onChange={e=>setNewEvent({...newEvent, deadline: e.target.value})} className="w-full px-0 py-2 bg-transparent border-b-2 border-slate-200 group-focus-within:border-[#673ab7] outline-none transition-all font-sans font-bold" />
                       </div>
                    </div>
                  </div>

                  {/* Image */}
                  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm group">
                     <label className="block text-base font-bold text-slate-900 font-bengali mb-4 transition-colors">ইভেন্ট কভার ইমেজ (ঐচ্ছিক, Max 2MB) বা লিংক</label>
                     <input
                       type="url"
                       value={newEvent.image || ''}
                       onChange={(e) => {
                         setNewEvent({ ...newEvent, image: e.target.value });
                         setEventImageFile(null);
                       }}
                       className="w-full px-0 py-3 border-b-2 border-slate-100 focus:border-[#673ab7] outline-none font-sans text-sm transition-all mb-4"
                       placeholder="ইমেজের ডাইরেক্ট লিংক দিন (অথবা নিচে থেকে ফাইল আপলোড করুন)"
                     />
                     <input 
                       type="file" 
                       accept="image/*"
                       onChange={async e => {
                         const file = e.target.files?.[0];
                         if (file) {
                           if (file.size > 2 * 1024 * 1024) {
                             toast.error('ইমেজের সাইজ 2MB এর বেশি হতে পারবে না');
                             e.target.value = '';
                             return;
                           }
                           const toastId = toast.loading("ইমেজ আপলোড হচ্ছে...");
                           try {
                              const fileRef = ref(storage, `events/${Date.now()}_${file.name}`);
                              await uploadBytes(fileRef, file);
                              const url = await getDownloadURL(fileRef);
                              setNewEvent({ ...newEvent, image: url });
                              setEventImageFile(null);
                              toast.success("ইমেজ আপলোড সফল!", { id: toastId });
                           } catch (err) {
                              toast.error("ইমেজ আপলোড করতে সমস্যা হয়েছে", { id: toastId });
                              console.error(err);
                           }
                         }
                       }} 
                       className="w-full px-0 py-3 bg-transparent outline-none transition-all font-sans font-bold text-sm" 
                     />
                    {newEvent.image && !eventImageFile && (
                       <p className="text-xs text-green-600 mt-2">ইতিমধ্যে একটি ছবি বা লিংক দেওয়া আছে। পরিবর্তন করতে নতুন ছবি নির্বাচন বা লিংক দিন।</p>
                    )}
                  </div>

                  {/* Floating Submit Button (similar to screenshot) */}
                  <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#f0ebf8] via-[#f0ebf8]/90 to-transparent z-50 pointer-events-none flex justify-center">
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="pointer-events-auto bg-[#673ab7] text-white px-8 py-4 rounded-full font-bold font-bengali text-lg shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 w-full max-w-sm"
                    >
                      <CheckCircle size={24} /> ইভেন্ট পাবলিশ করুন
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Registration Modal - Bold Redesign */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white w-full h-full sm:h-auto max-w-5xl sm:rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col sm:max-h-[95vh]"
            >
              <button 
                onClick={handleCloseModal}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 p-2.5 sm:p-3 bg-white/50 sm:bg-slate-100/80 hover:bg-slate-200 backdrop-blur text-slate-800 rounded-full transition-all group shadow-sm"
              >
                <X size={22} className="group-hover:rotate-90 transition-transform" />
              </button>

              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col sm:flex-row">
                {/* LH Panel - Event Hero (Hidden on Mobile) */}
                <div className="hidden sm:flex sm:w-[45%] bg-slate-100 relative min-h-[500px] p-6 lg:p-10 justify-center items-center">
                  <img src={selectedEvent.image || 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=1974&auto=format&fit=crop'} alt={selectedEvent.title} className="w-full h-auto max-h-[80%] object-contain" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent sm:bg-gradient-to-r sm:from-slate-100/10 sm:to-white/90 pointer-events-none" />
                  <div className="relative h-full w-full flex flex-col p-10 justify-end">
                    <div className="mt-auto space-y-4 max-w-lg">
                      <div className="inline-flex px-3 py-1 bg-indigo-500/80 backdrop-blur rounded-lg text-xs font-black text-white uppercase tracking-widest">{selectedEvent.type}</div>
                      <h2 className="text-3xl lg:text-4xl font-black text-white font-bengali leading-tight drop-shadow-md">{selectedEvent.title}</h2>
                      
                      <div className="flex flex-col gap-3 pt-6 border-t border-white/20">
                        <div className="flex items-center gap-3 text-slate-100">
                          <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                             <Calendar size={18} />
                          </div>
                          <span className="font-bengali font-bold">{new Date(selectedEvent.date).toLocaleDateString('bn-BD')}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-100">
                          <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                             <MapPin size={18} />
                          </div>
                          <span className="font-bengali font-black uppercase text-lg">{selectedEvent.location || 'এইচকিউ'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:hidden relative bg-slate-100 p-4 shrink-0 flex items-center justify-center">
                  <img src={selectedEvent.image || 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=1974&auto=format&fit=crop'} alt={selectedEvent.title} className="w-full h-auto max-h-[160px] object-contain rounded-xl" />
                </div>
                {/* Mobile Header (Only on Mobile) */}
                <div className="sm:hidden relative px-5 pt-5 pb-2 w-full shrink-0 space-y-2">
                  <h2 className="pr-14 text-slate-900 font-black text-xl font-bengali leading-tight">{selectedEvent.title}</h2>
                  <div className="flex items-center gap-3 text-emerald-600">
                    <MapPin size={16} />
                    <span className="font-bengali font-black uppercase text-sm tracking-widest">স্থান: {selectedEvent.location || 'এইচকিউ'}</span>
                  </div>
                </div>

                {/* RH Panel - Form/Success */}
                <div className="w-full sm:w-[55%] p-5 sm:p-10 lg:p-12 flex flex-col bg-slate-50/50">
                  {!hasRegistered ? (
                    <form onSubmit={handleRegister} className="space-y-10">
                      <div className="space-y-2">
                        <h4 className="text-2xl font-black text-slate-900 font-bengali">অংশগ্রহণ করুন</h4>
                        <p className="text-slate-500 font-bengali font-medium">নিচের তথ্যগুলো প্রদান করে ইভেন্টে অংশ নিন</p>
                      </div>

                      <div className="space-y-8">
                        {/* Standard Fields If No Custom Fields */}
                        {(!selectedEvent.customFields || selectedEvent.customFields.length === 0) && (
                          <div className="space-y-6">
                             <div className="relative group">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sans mb-1.5 block group-focus-within:text-indigo-600 transition-colors">{(selectedEvent.type.includes('মেডিকেল') || selectedEvent.title.includes('Medical')) ? 'PATIENT NAME' : 'APPLICANT NAME'} <span className="text-rose-500">*</span></label>
                                <input type="text" required value={applicantName} onChange={e=>setApplicantName(e.target.value)} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-sans font-bold text-base sm:text-lg text-slate-800" />
                             </div>
                             <div className="relative group">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sans mb-1.5 block group-focus-within:text-indigo-600 transition-colors">MOBILE NUMBER <span className="text-rose-500">*</span></label>
                                <input type="text" required value={applicantPhone} onChange={e=>setApplicantPhone(e.target.value)} placeholder="017........" className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-sans font-bold text-base sm:text-lg text-slate-800 tracking-wider" />
                             </div>
                          </div>
                        )}

                        {/* Scholarship/Advanced Logic */}
                        {(selectedEvent.isScholarship || (selectedEvent.customFields && selectedEvent.customFields.length > 0)) && (
                          <div className="space-y-6 sm:space-y-8">
                            {/* Inject applicant name if not in custom fields */}
                            {!(selectedEvent.customFields?.some(f => f.label.toLowerCase().includes('name') || f.label.includes('নাম'))) && (
                               <div className="relative group mb-6">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sans mb-1.5 block group-focus-within:text-indigo-600 transition-colors">{(selectedEvent.type.includes('মেডিকেল') || selectedEvent.title.includes('Medical')) ? 'PATIENT NAME' : 'APPLICANT NAME'} <span className="text-rose-500">*</span></label>
                                <input type="text" required value={applicantName} onChange={e=>setApplicantName(e.target.value)} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-sans font-bold text-base sm:text-lg text-slate-800" />
                               </div>
                            )}

                            {/* Inject applicant phone if not in custom fields */}
                            {!(selectedEvent.customFields?.some(f => /phone|mobile|number|মোবাইল|মোবাইল|ফোন|নম্বর|নাম্বার/i.test(f.label))) && (
                               <div className="relative group mb-6">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sans mb-1.5 block group-focus-within:text-indigo-600 transition-colors">MOBILE NUMBER <span className="text-rose-500">*</span></label>
                                <input type="text" required value={applicantPhone} onChange={e=>setApplicantPhone(e.target.value)} placeholder="017........" className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-sans font-bold text-base sm:text-lg text-slate-800 tracking-wider" />
                               </div>
                            )}

                            {selectedEvent.isScholarship && (
                              <div className="space-y-6 sm:space-y-8">
                                {(selectedEvent.requiredDocuments || []).filter(d => d.trim() !== '').map(docName => (
                                  <div key={docName} className="space-y-2 sm:space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">{docName} আপলোড করুন <span className="text-rose-500">*</span></label>
                                    <input
                                      type="file"
                                      required
                                      accept="image/*,application/pdf"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setScholarshipFiles(prev => ({ ...prev, [docName]: file }));
                                      }}
                                      className="w-full text-xs sm:text-sm font-bengali file:mr-3 sm:file:mr-4 file:py-2 sm:file:py-3 file:px-4 sm:file:px-6 file:rounded-lg sm:file:rounded-xl file:border-0 file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-colors"
                                    />
                                  </div>
                                ))}

                                {(selectedEvent.customQuestions || []).filter(q => q.trim() !== '').map(q => {
                                  const isRequired = !q.endsWith(' (Optional)');
                                  const baseQ = q.replace(' (Optional)', '');
                                  return (
                                  <div key={q} className="space-y-2 sm:space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">
                                       {baseQ} {isRequired && <span className="text-rose-500">*</span>}
                                    </label>
                                    <textarea
                                      required={isRequired}
                                      value={scholarshipAnswers[q] || ''}
                                      onChange={(e) => setScholarshipAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                                      className="w-full bg-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all min-h-[100px] sm:min-h-[120px] font-bengali font-bold text-base sm:text-lg shadow-sm custom-scrollbar"
                                      placeholder="আপনার উত্তর দিন..."
                                    />
                                  </div>
                                )})}
                              </div>
                            )}

                            {selectedEvent.customFields?.map((field, idx) => (
                              <div key={field.id} className="relative group mb-6">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sans mb-1.5 block group-focus-within:text-indigo-600 transition-colors">
                                  {field.label} {field.required !== false && <span className="text-rose-500">*</span>}
                                </label>
                                {field.type === 'text' && (
                                   <input type="text" required={field.required !== false} value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bengali font-bold text-base sm:text-lg text-slate-800" />
                                )}
                                {field.type === 'number' && (
                                   <input type="number" required={field.required !== false} value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-sans font-bold text-base sm:text-lg text-slate-800 tracking-wider" />
                                )}
                                {field.type === 'textarea' && (
                                   <textarea required={field.required !== false} value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bengali font-bold min-h-[100px] sm:min-h-[120px] text-base sm:text-lg text-slate-800 custom-scrollbar" />
                                )}
                                {field.type === 'select' && (
                                   <select required={field.required !== false} value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bengali font-bold text-base sm:text-lg text-slate-800 appearance-none cursor-pointer">
                                      <option value="">নির্বাচন করুন</option>
                                      {field.options?.split(',').map((opt, i) => <option key={i} value={opt.trim()}>{opt.trim()}</option>)}
                                   </select>
                                )}
                                {field.type === 'date' && (
                                   <input type="date" required={field.required !== false} value={customFieldValues[field.id]?.split(' ')[0] || ''} onChange={e => {
                                      let val = e.target.value;
                                      if (field.calculateAge && val) {
                                         const birthDate = new Date(val);
                                         const age = Math.abs(new Date(Date.now() - birthDate.getTime()).getUTCFullYear() - 1970);
                                         val = `${val} (বয়স: ${age} বছর)`;
                                      }
                                      setCustomFieldValues(prev => ({ ...prev, [field.id]: val }))
                                   }} className="w-full bg-slate-50/70 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] outline-none transition-all px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-sans font-bold text-base sm:text-lg text-slate-800" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-8 flex flex-col sm:flex-row gap-4">
                        <button
                          type="submit"
                          disabled={registering}
                          className="flex-[2] bg-indigo-600 text-white py-5 sm:py-6 rounded-3xl font-bengali font-black text-xl shadow-2xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {registering ? 'প্রসেস হচ্ছে...' : 'রেজিস্ট্রেশন নিশ্চিত করুন'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="flex-1 bg-slate-100 text-slate-500 py-5 sm:py-6 rounded-3xl font-bengali font-black text-lg hover:bg-slate-200 transition-all"
                        >
                          বাতিল
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10">
                      <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="w-32 h-32 bg-emerald-500 text-white rounded-[3.5rem] flex items-center justify-center shadow-2xl shadow-emerald-200">
                        <CheckCircle size={64} />
                      </motion.div>
                      <div className="space-y-4">
                        <h2 className="text-4xl font-black text-slate-900 font-bengali">রেজিস্ট্রেশন টোকেন</h2>
                        <p className="text-slate-500 font-bengali text-lg max-w-sm mx-auto">সফলভাবে নিবন্ধিত হয়েছেন! আপনার স্লিপটি ডাউনলোড করে নিন।</p>
                      </div>

                      {(selectedEvent.type?.includes('মেডিকেল') || selectedEvent.title?.toLowerCase().includes('medical')) && (
                        <div className="bg-indigo-50 border-4 border-white shadow-xl rounded-[2.5rem] p-10 w-full max-w-sm">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-bengali block mb-2">আপনার সিরিয়াল নম্বর</span>
                          <p className="text-6xl font-black text-indigo-600 font-sans tracking-tight">#{currentSerial}</p>
                        </div>
                      )}

                      <div className="flex flex-col w-full max-w-sm gap-4 pt-6">
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              setHasRegistered(false);
                              setApplicantName('');
                              setApplicantPhone('');
                              setScholarshipAnswers({});
                              setScholarshipFiles({});
                              setCustomFieldValues({});
                            }}
                            className="bg-emerald-100 text-emerald-700 flex items-center justify-center gap-3 py-4 rounded-3xl font-black font-bengali text-lg hover:bg-emerald-200 transition-all font-sans"
                          >
                            + নতুন আরেকটি রেজিস্ট্রেশন করুন
                          </button>
                        )}
                        <button onClick={() => handlePrint()} className="bg-slate-900 text-white flex items-center justify-center gap-3 py-5 rounded-3xl font-black font-bengali text-lg hover:bg-indigo-600 transition-all">
                          স্লিপ ডাউনলোড করুন <Printer size={22} />
                        </button>
                        <button onClick={handleCloseModal} className="text-slate-400 font-bold font-bengali hover:text-slate-900 transition-colors">ফিরে যান</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
