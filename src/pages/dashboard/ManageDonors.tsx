import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Check, Search, Calendar, Plus, Trash2, Edit2, FileDown, Eye, X, ArrowRight, Ticket, DollarSign, CheckCircle, Phone } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, updateDoc, query, orderBy, serverTimestamp, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Select from 'react-select';
import { reactSelectCustomStyles } from './ManageBooks';

interface DonorMember {
  id: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: any;
  serial?: number;
  monthlyDonation?: number;
}

interface DonorPayment {
  id: string;
  donorId: string;
  amount: number;
  month: string;
  status: string; // Paid, Unpaid
  paymentMethod?: 'Cash' | 'Bkash';
  collectedBy?: string;
  date: string;
}

export default function ManageDonors() {
  const { user } = useAuth();
  const isAdminRole = user?.role === 'admin';
  const location = useLocation();

  const [donors, setDonors] = useState<DonorMember[]>([]);
  const [payments, setPayments] = useState<DonorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOption, setFilterOption] = useState<'all' | 'paid' | 'unpaid'>('all');
  
  const [showAddDonor, setShowAddDonor] = useState(false);
  const [editingDonor, setEditingDonor] = useState<DonorMember | null>(null);
  const [donorForm, setDonorForm] = useState({ name: '', phone: '', address: '', serial: '', monthlyDonation: '200' });
  
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [amount, setAmount] = useState(200);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bkash'>('Cash');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [paymentMonthCount, setPaymentMonthCount] = useState(1);
  const [collectedBy, setCollectedBy] = useState(user?.name || '');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [paymentMonth, setPaymentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [overviewDonor, setOverviewDonor] = useState<DonorMember | null>(null);
  const [showReportMonthModal, setShowReportMonthModal] = useState(false);
  const [callConfirmDonor, setCallConfirmDonor] = useState<DonorMember | null>(null);
  const [callingDonor, setCallingDonor] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceMonth, setInvoiceMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const numberToBengaliWords = (num: number): string => {
    const ones = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const tens = ['', 'দশ', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];
    const teens = ['দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ'];
    
    if (num === 0) return 'শূন্য';
    if (num < 0) return 'মাইনাস ' + numberToBengaliWords(Math.abs(num));

    let words = '';

    if (num >= 10000000) {
      words += numberToBengaliWords(Math.floor(num / 10000000)) + ' কোটি ';
      num %= 10000000;
    }
    if (num >= 100000) {
      words += numberToBengaliWords(Math.floor(num / 100000)) + ' লক্ষ ';
      num %= 100000;
    }
    if (num >= 1000) {
      words += numberToBengaliWords(Math.floor(num / 1000)) + ' হাজার ';
      num %= 1000;
    }
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + ' শত ';
      num %= 100;
    }
    if (num >= 20) {
      words += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      words += teens[num - 10] + ' ';
      num = 0;
    }
    if (num > 0) {
      words += ones[num] + ' ';
    }

    return words.trim() + ' টাকা মাত্র';
  };

  const generateBulkInvoices = () => {
    if (donors.length === 0) {
      toast.error('কোনো দাতা সদস্য পাওয়া যায়নি।');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoicesHtml = donors.map((donor, index) => {
      // Find if there's a payment record, otherwise use the donor's default amount
      const p = payments.find(pay => pay.donorId === donor.id && pay.month === invoiceMonth);
      const invoiceAmount = p ? p.amount : (donor.monthlyDonation || 200);
      const method = p?.paymentMethod || 'Cash';
      
      const dateObj = new Date();
      const dd = dateObj.getDate().toString().padStart(2, '0');
      const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = dateObj.getFullYear().toString();
      const yy = yyyy.slice(-2);
      
      const dateBn = `${dd}/${mm}/${yyyy}`.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
      const dateEn = `${dd}/${mm}/${yyyy}`;
      const monthParts = invoiceMonth.split('-');
      const monthNamesBn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
      const monthNameBn = monthNamesBn[parseInt(monthParts[1]) - 1];
      const amountWords = numberToBengaliWords(invoiceAmount);
      const autoSerialBn = `${dd}${mm}${yy}${(index + 1).toString().padStart(3, '0')}`.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
      const autoSerialEn = `${dd}${mm}${yy}${(index + 1).toString().padStart(3, '0')}`;
      const amountBn = invoiceAmount.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
      const amountEn = invoiceAmount.toString();

      return `
        <div class="receipt-outer">
          <div class="receipt-card">
            <div class="watermark">পানধোয়া উন্মুক্ত পাঠাগার</div>
            
            <div class="header">
              <div class="brand">
                <div class="logo">📖</div>
                <div class="brand-text">
                  <h1>পানধোয়া উন্মুক্ত পাঠাগার</h1>
                  <p class="address">পানধোয়া, সেনওয়ালিয়া-<span style="font-family: 'Outfit', sans-serif; font-weight: 800; border-bottom: 1px solid #000;">1344</span>, আশুলিয়া, সাভার, ঢাকা।</p>
                  <p class="phone" style="font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 900; margin-top: 5px; color: #fff; background: #000; padding: 2px 10px; border-radius: 4px; display: inline-block; letter-spacing: 1px;">01570206953</p>
                </div>
              </div>
              <div class="meta">
                <div class="receipt-title">মানি রিসিট</div>
                <div class="sl" style="font-weight: 800; font-size: 15px;">রিসিট নং: <span class="serial-val" style="font-family: 'Outfit', sans-serif; font-weight: 950; font-size: 19px; color: #000; letter-spacing: 0.5px; border-bottom: 2px solid #000; display: inline-block; margin-left: 5px;">${autoSerialEn}</span></div>
                <div class="date" style="font-family: 'Hind Siliguri', sans-serif; font-weight: 700; margin-top: 6px; font-size: 15px;">তারিখ: <span style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 16px;">${dateEn}</span></div>
              </div>
            </div>

            <div class="body">
              <div class="row">
                <div class="field w-full">
                  <span class="label">নাম:</span>
                  <span class="val name-val">${donor?.name || ''}</span>
                </div>
              </div>
              
              <div class="row" style="gap: 25px;">
                <div class="field flex-1">
                  <span class="label">সদস্য নং:</span>
                  <span class="val" style="font-family: 'Outfit', 'Hind Siliguri', sans-serif;">${donor?.serial?.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) || '---'}</span>
                </div>
                <div class="field flex-1">
                  <span class="label">মোবাইল:</span>
                  <span class="val" style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 950; letter-spacing: 1.5px; color: #000; border-bottom: 2px solid #000;">${donor?.phone || ''}</span>
                </div>
              </div>

              <div class="row">
                <div class="field flex-1">
                  <span class="label">বিবরণ:</span>
                  <span class="val">মাসিক অনুদান (${monthNameBn})</span>
                </div>
              </div>

              <div class="row" style="margin-top: 5px;">
                <div class="field flex-1">
                  <span class="label">টাকা (কথায়):</span>
                  <span class="val-words">${amountWords} মাত্র।</span>
                </div>
              </div>

              <div class="payment-method-row">
                <span class="label-method">পেমেন্ট মাধ্যম:</span>
                <div class="checkbox-group">
                  <div class="checkbox-item"><span class="box">${method === 'Cash' ? '✓' : ''}</span> নগদ টাকা</div>
                  <div class="checkbox-item"><span class="box">${method === 'Bkash' ? '✓' : ''}</span> বিকাশ</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <div class="amount-container">
                <div class="amount-label">টাকার পরিমাণ (সংখ্যায়)</div>
                <div class="amount-val-box" style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 950; border: 3px solid #000; letter-spacing: 1.5px; color: #000;">
                  ৳ ${amountEn}/-
                </div>
              </div>
              
              <div class="signature">
                <div class="sig-line"></div>
                <div class="sig-text">অনুমোদিত স্বাক্ষর</div>
              </div>
            </div>
          </div>
          <div class="cut-line no-print">✂----------------------------------------------------------------------------------------------------------✂</div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>রিসিট - ${invoiceMonth}</title>
          
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
                  <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Hind Siliguri', sans-serif; 
              margin: 0; 
              padding: 0;
              background: #fff;
            }
            @page { size: A4 portrait; margin: 0; }
            
            .receipt-outer {
              width: 100%;
              page-break-inside: avoid;
              padding: 5mm 10mm;
            }

            .receipt-card {
              border: 1px solid #000;
              padding: 20px 30px;
              height: 130mm; /* Fits 2 on A4 portrait */
              position: relative;
              display: flex;
              flex-direction: column;
              background: #fff;
              overflow: hidden;
            }

            .watermark {
              position: absolute;
              top: 55%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-12deg);
              font-size: 55px;
              font-weight: 800;
              color: rgba(0, 0, 0, 0.04);
              white-space: nowrap;
              z-index: 0;
              pointer-events: none;
              width: 150%;
              text-align: center;
            }

            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2.5px solid #000;
              padding-bottom: 12px;
              margin-bottom: 18px;
              z-index: 1;
              align-items: center;
            }

            .brand { display: flex; align-items: center; gap: 15px; }
            .logo { font-size: 42px; filter: grayscale(1); }
            .brand-text h1 { margin: 0; font-size: 28px; font-weight: 800; color: #000; letter-spacing: -0.5px; }
            .brand-text p { margin: 0; font-size: 15px; font-weight: 500; color: #334155; }
            .brand-text p.address { font-size: 13px; font-weight: 700; color: #000; }

            .meta { text-align: right; }
            .receipt-title { 
              font-size: 20px; 
              font-weight: 900; 
              color: #000;
              text-decoration: underline;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .sl { font-size: 16px; font-weight: 700; color: #000; }
            .date { font-size: 16px; font-weight: 700; margin-top: 3px; }

            .body { flex: 1; z-index: 1; }
            .row { display: flex; margin-bottom: 15px; align-items: baseline; }
            .field { display: flex; align-items: baseline; }
            .label { font-size: 18px; font-weight: 700; color: #000; white-space: nowrap; margin-right: 10px; }
            .val { 
              font-size: 20px; 
              font-weight: 600; 
              border-bottom: 1.5px dotted #475569; 
              flex: 1; 
              padding-bottom: 3px;
              color: #000;
            }
            .name-val { font-size: 24px; font-weight: 800; }
            
            .val-words { font-size: 18px; font-weight: 700; color: #1e293b; border-bottom: 1.5px dotted #475569; flex: 1; }

            .payment-method-row {
              display: flex;
              align-items: center;
              margin-top: 15px;
              gap: 20px;
            }
            .label-method { font-size: 16px; font-weight: 800; color: #000; }
            .checkbox-group { display: flex; gap: 20px; }
            .checkbox-item { display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 700; }
            .box { width: 14px; height: 14px; border: 2px solid #000; display: inline-block; }

            .footer {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              z-index: 1;
              position: relative;
              margin-top: 10px;
            }

            .amount-container {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .amount-label { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #475569; }
            .amount-val-box {
              border: 2.5px solid #000;
              padding: 8px 25px;
              background: #f8fafc;
              text-align: center;
              min-width: 170px;
              font-size: 26px;
              font-weight: 900;
              border-radius: 6px;
            }

            .signature { width: 180px; text-align: center; }
            .sig-line { border-top: 2px solid #000; margin-bottom: 6px; width: 100%; }
            .sig-text { font-size: 16px; font-weight: 800; color: #000; }

            .cut-line { text-align: center; color: #94a3b8; font-size: 12px; margin: 8px 0; letter-spacing: 3px; }
            
            @media print {
              .no-print { display: none; }
              body { background: #fff; }
              .receipt-outer { padding: 6mm 0; }
              .receipt-card { border: 2px solid #000; height: 135mm; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <button onclick="window.print()" style="font-family: 'Hind Siliguri', sans-serif; padding: 10px 25px; background: #000; color: #fff; border: none; font-size: 15px; font-weight: 700; cursor: pointer; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">রিসিট প্রিন্ট করুন (A4 পেজে ২টি)</button>
             <p style="margin-top: 8px; color: #64748b; font-size: 12px; font-weight: 600;">A4 Portrait কাগজে ২টি রিসিট প্রিন্ট করার জন্য অপ্টিমাইজ করা।</p>
          </div>
          ${invoicesHtml}
          <script>window.onload = () => setTimeout(() => { /* window.print(); */ }, 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  useEffect(() => {
    window.scrollTo(0, 0);
    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get('action');
    if (action === 'add-donor') {
      setShowAddDonor(true);
      setEditingDonor(null);
      setDonorForm({ name: '', phone: '', address: '', serial: '', monthlyDonation: '200' });
    } else if (action === 'payment') {
      setShowPaymentForm(true);
    }
  }, [location.search, location.pathname]);

  useEffect(() => {
    const fetchData = () => {
      setLoading(true);
      
      // Attempt to load from cache
      const cachedDonors = sessionStorage.getItem('cached_donor_members');
      const cachedPayments = sessionStorage.getItem('cached_donor_payments');
      const cacheTime = sessionStorage.getItem('cached_donors_time');

      if (cachedDonors && cachedPayments && cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
        const parsedDonors = JSON.parse(cachedDonors);
        const parsedPayments = JSON.parse(cachedPayments);
        if (parsedDonors.length > 0) {
          setDonors(parsedDonors);
          setPayments(parsedPayments);
          setLoading(false);
        }
      }
      
      // Standardize data fetching with real-time listeners for better performance and instant updates
      const donorsQuery = query(collection(db, 'donor-members'), orderBy('createdAt', 'asc'));
      const unsubDonors = onSnapshot(donorsQuery, (snapshot) => {
        const donorList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DonorMember[];
        setDonors(donorList);
        sessionStorage.setItem('cached_donor_members', JSON.stringify(donorList));
        sessionStorage.setItem('cached_donors_time', Date.now().toString());
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'donor-members');
        setLoading(false);
      });

      const paymentsQuery = collection(db, 'donor-payments');
      const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
        const payList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DonorPayment[];
        setPayments(payList);
        sessionStorage.setItem('cached_donor_payments', JSON.stringify(payList));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'donor-payments');
      });

      return () => {
        unsubDonors();
        unsubPayments();
      };
    };

    const cleanup = fetchData();
    return cleanup;
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...donorForm,
        monthlyDonation: Number(donorForm.monthlyDonation) || 0
      };
      if (editingDonor) {
        await updateDoc(doc(db, 'donor-members', editingDonor.id), payload);
        toast.success('সদস্যের তথ্য আপডেট করা হয়েছে।');
        setEditingDonor(null);
      } else {
        const newDocRef = doc(collection(db, 'donor-members'));
        await setDoc(newDocRef, { ...payload, id: newDocRef.id, createdAt: serverTimestamp() });
        toast.success('নতুন সদস্য যোগ করা হয়েছে।');
      }
      setShowAddDonor(false);
      setDonorForm({ name: '', phone: '', address: '', serial: '', monthlyDonation: '200' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'donor-members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditDonor = (donor: DonorMember) => {
    setEditingDonor(donor);
    setDonorForm({
       name: donor.name,
       phone: donor.phone,
       address: donor.address || '',
       serial: donor.serial ? String(donor.serial) : '',
       monthlyDonation: donor.monthlyDonation ? String(donor.monthlyDonation) : '200'
    });
    setShowAddDonor(true);
  };

  const handleDeleteDonor = async (id: string) => {
    if(!confirm('আপনি কি এই দাতা সদস্যকে ডিলিট করতে চান?')) return;
    try {
       const deletedDonor = donors.find(d => d.id === id);
       const deletedSerial = deletedDonor?.serial ? parseInt(String(deletedDonor.serial), 10) : null;
       
       await deleteDoc(doc(db, 'donor-members', id));
       
       if (deletedSerial !== null && !isNaN(deletedSerial)) {
          const donorsToUpdate = donors.filter(d => {
            if (!d.serial) return false;
            const currentId = parseInt(String(d.serial), 10);
            return !isNaN(currentId) && currentId > deletedSerial;
          });
          
          donorsToUpdate.sort((a, b) => parseInt(String(a.serial), 10) - parseInt(String(b.serial), 10));
          
          for (const d of donorsToUpdate) {
             const currentId = parseInt(String(d.serial), 10);
             const newSerial = String(currentId - 1);
             await updateDoc(doc(db, 'donor-members', d.id), { serial: newSerial });
          }
       }
       toast.success("সদস্য ডিলিট করা হয়েছে এবং সিরিয়াল আপডেট করা হয়েছে।");
    } catch (error) {
       console.error(error);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonorId) {
      toast.error('দাতা সদস্য নির্বাচন করুন।');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const dbCollection = collection(db, 'donor-payments');
      const financeCollection = collection(db, 'finances');
      const donor = donors.find(d => d.id === selectedDonorId);
      
      let currentYear = parseInt(paymentMonth.split('-')[0], 10);
      let currentMonthNum = parseInt(paymentMonth.split('-')[1], 10);

      const monthsBn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

      for (let i = 0; i < paymentMonthCount; i++) {
        const formattedMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
        const actualMonthTitle = monthsBn[currentMonthNum - 1];
        
        const newDocRef = doc(dbCollection);
        await setDoc(newDocRef, {
          donorId: selectedDonorId,
          amount,
          month: formattedMonth,
          status: paymentStatus,
          paymentMethod,
          collectedBy,
          id: newDocRef.id,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        });

        // Auto-add to finances if status is Paid
        if (paymentStatus === 'Paid') {
          const financeRef = doc(financeCollection);
          await setDoc(financeRef, {
            id: financeRef.id,
            type: 'income',
            amount: amount,
            description: `দাতা সদস্য অনুদান: ${donor?.name || 'অজানা'} (${actualMonthTitle}, ${currentYear})${collectedBy ? ' - আদায়কারী: ' + collectedBy : ''}`,
            date: new Date().toISOString(),
            paymentId: newDocRef.id // link them
          });
        }
        
        currentMonthNum++;
        if (currentMonthNum > 12) {
          currentMonthNum = 1;
          currentYear++;
        }
      }
      
      toast.success('পেমেন্ট সফলভাবে সংরক্ষণ করা হয়েছে।');
      setShowPaymentForm(false);
      setSelectedDonorId('');
      setPaymentMonthCount(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'donor-payments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaymentStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    try {
      await updateDoc(doc(db, 'donor-payments', id), { status: newStatus });
      
      // Update finances accordingly
      if (newStatus === 'Paid') {
        const p = payments.find(pay => pay.id === id);
        const donor = donors.find(d => d.id === p?.donorId);
        if (p) {
          const [year, mNum] = p.month.split('-');
          const monthsBn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
          const actualMonthTitle = monthsBn[parseInt(mNum) - 1];

          const financeRef = doc(collection(db, 'finances'));
          await setDoc(financeRef, {
            id: financeRef.id,
            type: 'income',
            amount: p.amount,
            description: `দাতা সদস্য অনুদান: ${donor?.name || 'অজানা'} (${actualMonthTitle}, ${year})`,
            date: new Date().toISOString(),
            paymentId: id
          });
        }
      } else {
        // Find and delete related finance record
        const financeSnap = await getDocs(query(collection(db, 'finances'), where('paymentId', '==', id)));
        for (const doc of financeSnap.docs) {
          await deleteDoc(doc.ref);
        }
      }
      toast.success(`পেমেন্ট ${newStatus === 'Paid' ? 'পরিশোধিত' : 'বকেয়া'} হিসেবে চিহ্নিত করা হয়েছে।`);
    } catch (error) {
      console.error(error);
      toast.error('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে।');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if(!confirm('পেমেন্টটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'donor-payments', id));
      // Delete from finances too
      const financeSnap = await getDocs(query(collection(db, 'finances'), where('paymentId', '==', id)));
      for (const doc of financeSnap.docs) {
        await deleteDoc(doc.ref);
      }
      toast.success('পেমেন্ট এবং সম্পর্কিত হিসাব ডিলিট করা হয়েছে।');
    } catch (error) {
       console.error(error);
    }
  };

  const openOverview = (donor: DonorMember) => {
    setOverviewDonor(donor);
    setShowOverviewModal(true);
  };

  const downloadMonthlyReport = (selectedMonth: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    const [year, monthNum] = selectedMonth.split('-');
    const bnMonths: any = {
      '01': 'জানুয়ারি', '02': 'ফেব্রুয়ারি', '03': 'মার্চ', '04': 'এপ্রিল',
      '05': 'মে', '06': 'জুন', '07': 'জুলাই', '08': 'আগস্ট',
      '09': 'সেপ্টেম্বর', '10': 'অক্টোবর', '11': 'নভেম্বর', '12': 'ডিসেম্বর'
    };
    const monthName = bnMonths[monthNum] || selectedMonth;
    const yearConverted = year.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));

    const printContent = filtered.map((d, index) => {
      const p = payments.filter(pay => pay.donorId === d.id && pay.month === selectedMonth);
      const total = p.filter(pay => pay.status === 'Paid').reduce((sum, pay) => sum + Number(pay.amount), 0);
      
      const serialString = String(d.serial || (index + 1));
      const amountString = total.toString();
      const phoneString = d.phone || '';
      
      const statusText = total > 0 ? 'পরিশোধিত' : 'বকেয়া';
      const statusColor = total > 0 ? '#10b981' : '#f43f5e';

      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 15px;">${serialString}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">${d.name}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-family: 'Outfit', sans-serif; color: #475569; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">${phoneString}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: ${statusColor}; text-align: center; font-family: 'Hind Siliguri', sans-serif; font-size: 15px;">${statusText} ${total > 0 ? `<span style="font-family: 'Outfit', sans-serif; margin-left: 5px;">(৳${amountString})</span>` : ''}</td>
      </tr>`;
    }).join('');

    const grandTotal = filtered.reduce((totalSum, d) => {
      const p = payments.filter(pay => pay.donorId === d.id && pay.month === selectedMonth);
      const total = p.filter(pay => pay.status === 'Paid').reduce((sum, pay) => sum + Number(pay.amount), 0);
      return totalSum + total;
    }, 0);
    const grandTotalString = grandTotal.toString();

    const todayTimeConverted = new Date().toLocaleString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>মাসিক অনুদান রিপোর্ট - ${monthName} ${yearConverted}</title>
        
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
                max-width: 850px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4338ca;
            }
            .title {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 5px;
                color: #1e1b4b;
            }
            .subtitle {
                color: #4338ca;
                font-size: 18px;
                font-weight: 700;
            }
            .report-info {
                text-align: center;
                margin-bottom: 20px;
                font-size: 14px;
                color: #64748b;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            th {
                background-color: #f8fafc;
                padding: 14px;
                text-align: left;
                font-weight: 700;
                color: #334155;
                font-size: 13px;
                border-bottom: 2px solid #e2e8f0;
            }
            th:first-child { text-align: center; }
            th:last-child { text-align: center; }
            .total-row {
                background-color: #f8fafc;
                border-top: 2px solid #4338ca;
            }
            .total-row td {
                padding: 16px;
                font-weight: 700;
                font-size: 16px;
            }
            .footer {
                margin-top: 50px;
                display: flex;
                justify-content: space-between;
                padding-top: 30px;
            }
            .sig-box {
                text-align: center;
                width: 150px;
            }
            .sig-line {
                border-top: 1px solid #94a3b8;
                margin-bottom: 5px;
            }
            .sig-label {
                font-size: 12px;
                font-weight: 700;
                color: #64748b;
            }
            @media print {
                body { background: white; padding: 0; }
                .container { border: none; box-shadow: none; width: 100%; max-width: 100%; }
                .no-print { display: none !important; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="title">পানধোয়া উন্মুক্ত পাঠাগার</div>
                <div style="font-family: 'Outfit', 'Hind Siliguri', sans-serif; font-size: 15px; color: #1e293b; margin: 10px 0; font-weight: 700; background: #f1f5f9; display: inline-block; padding: 4px 18px; border-radius: 10px; border: 1px solid #e2e8f0;">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার, ঢাকা।</div>
                <div class="subtitle">মাসিক অনুদান রিপোর্ট</div>
            </div>
            <div class="report-info">
                মাস: <strong>${monthName} ${yearConverted}</strong>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 10%">ক্রমিক</th>
                        <th style="width: 35%">সদস্যের নাম</th>
                        <th style="width: 25%">ফোন নম্বর</th>
                        <th style="width: 30%">অবস্থা (পেমেন্ট)</th>
                    </tr>
                </thead>
                <tbody>
                    ${printContent}
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">মোট সংগ্রহ (${monthName}):</td>
                        <td style="text-align: center; color: #4338ca; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 18px;">৳${grandTotalString}</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="footer" style="margin-top: 60px;">
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div class="sig-label">অর্থ সম্পাদক</div>
                </div>
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div class="sig-label">পরিচালক/সেক্রেটারি জেনারেল</div>
                </div>
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8;">
                রিপোর্ট জেনারেট করা হয়েছে: ${todayTimeConverted}
            </div>
        </div>
        <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="background: #4338ca; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-family: 'Noto Serif Bengali', serif; font-size: 14px; font-weight: 700; cursor: pointer;">
                প্রিন্ট করুন
            </button>
        </div>
    </body>
    </html>
    `);
    printWindow.document.close();
  };

  const downloadReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    const printContent = filtered.map((d, index) => {
      const p = payments.filter(pay => pay.donorId === d.id);
      const total = p.filter(pay => pay.status === 'Paid').reduce((sum, pay) => sum + Number(pay.amount), 0);
      const serialString = String(d.serial || (index + 1));
      const amountString = total.toString();
      const phoneString = d.phone || '';
      
      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 15px;">${serialString}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">${d.name}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-family: 'Outfit', sans-serif; color: #475569; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">${phoneString}</td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b; text-align: right; font-family: 'Outfit', sans-serif; font-size: 15px;">৳${amountString}</td>
      </tr>`;
    }).join('');

    const grandTotal = filtered.reduce((totalSum, d) => {
      const p = payments.filter(pay => pay.donorId === d.id);
      const total = p.filter(pay => pay.status === 'Paid').reduce((sum, pay) => sum + Number(pay.amount), 0);
      return totalSum + total;
    }, 0);
    const grandTotalString = grandTotal.toString();

    const todayDateConverted = new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
    const todayTimeConverted = new Date().toLocaleString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>দাতা সদস্য রিপোর্ট</title>
        
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
                max-width: 800px;
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
                background: #f1f5f9;
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
                margin-bottom: 8px;
                color: #0f172a;
            }
            .subtitle {
                color: #64748b;
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 15px;
                font-family: 'Noto Serif Bengali', serif;
            }
            th {
                background-color: #f1f5f9;
                padding: 16px;
                text-align: left;
                font-weight: 700;
                color: #334155;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            th:first-child { text-align: center; border-radius: 8px 0 0 8px; }
            th:last-child { text-align: right; border-radius: 0 8px 8px 0; }
            .total-row {
                background-color: #f8fafc;
                border-top: 2px solid #334155;
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
                color: #2563eb;
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
                <div class="logo-placeholder">📚</div>
                <div class="title">পানধোয়া উন্মুক্ত পাঠাগার</div>
                <div style="font-family: 'Outfit', 'Hind Siliguri', sans-serif; font-size: 15px; color: #1e293b; margin: 12px 0; font-weight: 700; background: #f1f5f9; display: inline-block; padding: 4px 18px; border-radius: 10px; border: 1px solid #e2e8f0;">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার, ঢাকা।</div>
                <div class="subtitle">দাতা সদস্য অনুদান রিপোর্ট — ${todayDateConverted}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>ক্রমিক</th>
                        <th>সদস্যের নাম</th>
                        <th>ফোন নম্বর</th>
                        <th>মোট প্রদান</th>
                    </tr>
                </thead>
                <tbody>
                    ${printContent}
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">সর্বমোট সংগ্রহ:</td>
                        <td style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 20px; color: #4338ca;">৳${grandTotalString}</td>
                    </tr>
                </tbody>
            </table>
            <div class="footer" style="margin-top: 80px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 2px solid #e2e8f0;">
                <div style="text-align: center; width: 170px;">
                    <div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>
                    <div style="font-size: 12px; font-weight: 700; color: #64748b;">অর্থ সম্পাদক</div>
                </div>
                <div style="text-align: center; width: 220px;">
                    <div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>
                    <div style="font-size: 12px; font-weight: 700; color: #64748b;">পরিচালক/সেক্রেটারি জেনারেল</div>
                </div>
            </div>
            <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8;">
                রিপোর্ট জেনারেট করা হয়েছে: ${todayTimeConverted}<br>
                © পানধোয়া উন্মুক্ত পাঠাগার
            </div>
        </div>
        <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-family: 'Noto Serif Bengali', serif; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); transition: all 0.2s;">
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
    printWindow.document.close();
  };

  const paymentsByDonor = React.useMemo(() => {
    const map = new Map<string, DonorPayment[]>();
    for (const p of payments) {
      const arr = map.get(p.donorId);
      if (arr) arr.push(p);
      else map.set(p.donorId, [p]);
    }
    return map;
  }, [payments]);

  const filtered = React.useMemo(() => {
    return donors.filter(d => 
      (d.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (d.phone || '').includes(search)
    ).filter(d => {
      if (filterOption === 'all') return true;
      const donorPayments = (paymentsByDonor.get(d.id) || []).filter(p => p.month === month);
      const hasUnpaid = donorPayments.some(p => p.status === 'Unpaid');
      if (filterOption === 'unpaid') return hasUnpaid || donorPayments.length === 0;
      if (filterOption === 'paid') return !hasUnpaid && donorPayments.length > 0;
      return true;
    }).sort((a, b) => {
      const serialA = a.serial ? parseInt(String(a.serial), 10) : Number.MAX_SAFE_INTEGER;
      const serialB = b.serial ? parseInt(String(b.serial), 10) : Number.MAX_SAFE_INTEGER;
      return serialA - serialB;
    });
  }, [donors, paymentsByDonor, search, filterOption, month]);

  const dashboardStats = React.useMemo(() => {
    let paidDonors = 0;
    let unpaidDonors = 0;
    let totalCollected = 0;

    for (const d of donors) {
      const pList = (paymentsByDonor.get(d.id) || []).filter(p => p.month === month);
      const hasPaid = pList.some(p => p.status === 'Paid');
      if (hasPaid) {
         paidDonors++;
      } else {
         unpaidDonors++;
      }
    }

    for (const [donorId, allPList] of paymentsByDonor.entries()) {
      if (donors.some(d => d.id === donorId)) {
         for (const p of allPList) {
            if (p.status === 'Paid' && p.month === month) {
               totalCollected += Number(p.amount);
            }
         }
      }
    }

    return [
      { label: 'মোট দাতা', count: donors.length, unit: 'জন', color: 'text-white' },
      { label: 'পরিশোধিত', count: paidDonors, unit: 'জন', color: 'text-emerald-400' },
      { label: 'বকেয়া', count: unpaidDonors, unit: 'জন', color: 'text-rose-400' },
      { label: 'মোট সংগ্রহ', count: totalCollected, unit: '৳', color: 'text-amber-400' }
    ];
  }, [donors, paymentsByDonor, month]);

  const recentPayments = React.useMemo(() => {
    const donorIds = new Set(donors.map(d => d.id));
    return payments
      .filter(p => p.status === 'Paid' && donorIds.has(p.donorId)) // Only show Paid payments
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 8);
  }, [payments, donors]);

  const overviewPaymentsModalByDonor = React.useMemo(() => {
    if (!overviewDonor) return [];
    return [...(paymentsByDonor.get(overviewDonor.id) || [])].sort((a,b) => b.month.localeCompare(a.month));
  }, [paymentsByDonor, overviewDonor]);

  return (
    <div className="space-y-6">
      <div className="hidden">
        {/* Placeholder for spacing if needed or keeping the structure if the user wants title elsewhere */}
      </div>

      {/* দাতা সদস্য ব্যবস্থাপনা Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Main Stats Card */}
        <div className="lg:col-span-8 bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>
          
          <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-1 font-bengali">দাতা সদস্য ব্যবস্থাপনা</h2>
              <p className="text-slate-400 font-bold font-bengali text-xs md:text-sm">পাঠাগারের পৃষ্ঠপোষক ও দাতা সদস্যদের কার্যক্রম নিয়ন্ত্রণ কেন্দ্র।</p>
            </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20 transition-all active:scale-95 font-bengali"
                >
                  <DollarSign className="w-4 h-4 text-indigo-200" /> 
                  পেমেন্ট আপডেট
                </button>
                {isAdminRole && (
                  <button
                    onClick={() => { setShowAddDonor(true); setEditingDonor(null); setDonorForm({ name: '', phone: '', address: '', serial: '', monthlyDonation: '200' }); }}
                    className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 font-bengali border border-white/10"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    নতুন সদস্য যোগ করুন
                  </button>
                )}
              </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {dashboardStats.map((stat, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 group hover:bg-white/10 transition-colors">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-bengali">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color} font-mono`}>
                  {stat.unit === '৳' ? stat.count.toLocaleString('bn-BD') : stat.count.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}
                  <span className="text-xs ml-1 opacity-60 font-bengali">{stat.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Updates Panel */}
        <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900 flex items-center gap-2 font-bengali">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
              লাইভ আপডেট
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</span>
          </div>
          
          <div className="space-y-3 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
            {recentPayments.map((p, i) => {
                const donor = donors.find(d => d.id === p.donorId);
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black bg-emerald-100 text-emerald-600">
                        ৳
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 font-bengali line-clamp-1">{donor?.name || ''}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[9px] text-slate-400 font-medium font-mono">{p.month}</p>
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase bg-emerald-500 text-white tracking-widest">Paid</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-700 font-mono">৳{p.amount}</p>
                      <p className="text-[8px] text-slate-400 font-bengali mt-0.5">{p.paymentMethod === 'Bkash' ? 'বিকাশ' : 'নগদ'}</p>
                    </div>
                  </div>
                );
              })}
            {payments.filter(p => p.status === 'Paid').length === 0 && (
               <div className="text-center py-10 opacity-50 font-bengali text-sm italic">কোনো সাম্প্রতিক আপডেট নেই</div>
            )}
          </div>

          <div className="mt-auto pt-6 grid grid-cols-2 gap-2">
            <button onClick={() => setShowInvoiceModal(true)} className="py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">Invoices</button>
            <button onClick={() => setShowReportMonthModal(true)} className="py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">Reports</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddDonor && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-2xl my-4 sm:my-8 overflow-hidden sticky top-4"
            >
              <div className="sticky top-0 bg-white z-10 p-8 pb-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-black text-2xl font-bengali text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  {editingDonor ? 'সদস্যের তথ্য আপডেট' : 'নতুন সদস্য যোগ করুন'}
                </h3>
                <button onClick={() => setShowAddDonor(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddDonor} className="p-8 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">ক্রমিক নং (Serial)</label>
                    <input type="text" value={donorForm.serial || ''} onChange={e => setDonorForm({...donorForm, serial: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono" placeholder="Ex: 01" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">নাম <span className="text-rose-500 font-bold">*</span></label>
                    <input type="text" required value={donorForm.name || ''} onChange={e => setDonorForm({...donorForm, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-bengali" placeholder="দাতার নাম লিখুন" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">মোবাইল নম্বর <span className="text-rose-500 font-bold">*</span></label>
                    <input type="text" required value={donorForm.phone || ''} onChange={e => setDonorForm({...donorForm, phone: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono" placeholder="01XXX-XXXXXX" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">মাসিক অনুদান (৳)</label>
                    <input type="number" value={donorForm.monthlyDonation || ''} onChange={e => setDonorForm({...donorForm, monthlyDonation: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono" placeholder="200" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">ঠিকানা (ঐচ্ছিক)</label>
                  <textarea value={donorForm.address || ''} onChange={e => setDonorForm({...donorForm, address: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-bengali" placeholder="ঠিকানা লিখুন..." rows={2}></textarea>
                </div>
                <div className="sticky bottom-0 bg-white pt-4 flex gap-4 border-t border-slate-50 py-4 mt-8">
                  <button type="button" disabled={isSubmitting} onClick={() => setShowAddDonor(false)} className="flex-1 px-4 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl text-base font-black hover:bg-slate-50 transition-all font-bengali disabled:opacity-50">বাতিল</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-4 bg-slate-900 text-white rounded-2xl text-base font-black hover:bg-black shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98] font-bengali disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentForm && (
          <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-2xl my-4 sm:my-8 overflow-hidden sticky top-4 font-bengali"
            >
              <div className="sticky top-0 bg-white z-10 px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="font-black text-2xl font-bengali text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  পেমেন্ট আপডেট করুন
                </h3>
                <button 
                  onClick={() => setShowPaymentForm(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 font-bengali">দাতা সদস্য নির্বাচন করুন <span className="text-rose-500">*</span></label>
                  <Select
                    options={donors.map(d => ({ value: d.id, label: `${d.name} (${d.phone})`, donation: d.monthlyDonation }))}
                    onChange={(option: any) => {
                      setSelectedDonorId(option?.value || '');
                      if (option?.donation) {
                        setAmount(option.donation);
                      }
                    }}
                    placeholder="সদস্যের নাম বা নম্বর লিখুন..."
                    className="text-base font-bold"
                    styles={reactSelectCustomStyles}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">শুরুর মাস (Start Month)</label>
                    <input type="month" value={paymentMonth} onChange={e => setPaymentMonth(e.target.value)} required className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">মাসের সংখ্যা (Months)</label>
                    <input type="number" min="1" max="24" value={paymentMonthCount} onChange={e => setPaymentMonthCount(Number(e.target.value) || 1)} required className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">টাকার পরিমাণ (Total ৳)</label>
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} required className="w-full px-6 py-4 border border-slate-200 rounded-xl text-xl font-black bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bengali">আদায়কারী (Collected By)</label>
                    <input type="text" value={collectedBy} onChange={e => setCollectedBy(e.target.value)} required className="w-full px-6 py-4 border border-slate-200 rounded-xl text-lg font-black bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-bengali" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700 font-bengali">পেমেন্ট মাধ্যম</label>
                    <div className="flex gap-2">
                      {['Cash', 'Bkash'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m as any)}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                            paymentMethod === m 
                              ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                              : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {m === 'Cash' ? 'নগদ টাকা' : 'বিকাশ'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700 font-bengali">পেমেন্ট স্ট্যাটাস</label>
                    <div className="flex gap-2">
                      {['Paid', 'Unpaid'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPaymentStatus(s)}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                            paymentStatus === s 
                              ? (s === 'Paid' ? 'bg-emerald-600 border-emerald-600' : 'bg-rose-600 border-rose-600') + ' text-white shadow-lg'
                              : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {s === 'Paid' ? 'পরিশোধিত' : 'বকেয়া'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white pt-4 flex gap-4 border-t border-slate-50 py-4 mt-4">
                  <button type="button" disabled={isSubmitting} onClick={() => setShowPaymentForm(false)} className="flex-1 px-4 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl text-base font-black hover:bg-slate-50 transition-all font-bengali disabled:opacity-50">বাতিল</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-4 bg-indigo-600 text-white rounded-2xl text-base font-black hover:bg-indigo-700 shadow-xl shadow-indigo-900/20 transition-all active:scale-[0.98] font-bengali disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    পেমেন্ট যুক্ত করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Table */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="সদস্যদের খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-[16px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-bengali shadow-sm text-slate-700"
              />
            </div>
            
            <div className="w-full sm:w-auto relative">
              <input 
                type="month" 
                value={month} 
                onChange={e => setMonth(e.target.value)}
                className="w-full sm:w-[180px] px-4 py-3 bg-white border border-slate-200 rounded-[16px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-mono shadow-sm text-slate-700"
              />
              <div className="absolute -top-2.5 left-3 bg-white px-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest border border-indigo-50 rounded font-sans">View Month</div>
            </div>
          </div>

          <Select
            value={{
              value: filterOption,
              label: filterOption === 'all' ? 'সকল দাতা' : filterOption === 'paid' ? 'পরিশোধিত' : 'বকেয়া রয়েছে'
            }}
            onChange={(selected: any) => setFilterOption(selected.value as any)}
            options={[
              { value: 'all', label: 'সকল দাতা' },
              { value: 'paid', label: 'পরিশোধিত' },
              { value: 'unpaid', label: 'বকেয়া রয়েছে' }
            ]}
            className="w-full sm:w-56 font-bengali text-sm font-bold z-10"
            classNamePrefix="react-select"
            styles={{
              ...reactSelectCustomStyles,
              control: (base: any, state: any) => ({
                 ...reactSelectCustomStyles.control(base, state),
                 minHeight: '48px',
                 borderRadius: '1rem',
                 border: '1px solid #e2e8f0',
                 boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }),
              menu: (base: any) => ({
                ...base,
                zIndex: 20
              })
            }}
          />
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold font-bengali text-lg animate-pulse flex flex-col items-center gap-3">
             <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
             লোড হচ্ছে...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center bg-white text-slate-400 font-bold font-bengali text-lg flex flex-col items-center gap-4">
              <span className="bg-slate-50 p-4 rounded-full">
                 <Search className="w-8 h-8 text-slate-300" />
              </span>
              কোনো তথ্য পাওয়া যায়নি।
          </div>
        ) : (
          <>
            {/* Mobile View (Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
              {filtered.map((d, index) => {
                const donorPayments = (paymentsByDonor.get(d.id) || []).filter(p => p.month === month);
                const isPaid = donorPayments.some(p => p.status === 'Paid');
                const totalPaid = donorPayments.reduce((s, p) => p.status === 'Paid' ? s + Number(p.amount) : s, 0);
                const currentStatus = isPaid ? 'Paid' : 'Due';

                return (
                   <div key={d.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-black text-sm border border-slate-200/80 font-bengali">
                              {d.serial || (index + 1).toString().replace(/[0-9]/g, function(w) { return String.fromCharCode(w.charCodeAt(0) + 2486) })}
                            </span>
                            <div>
                               <h4 className="font-bold text-slate-900 font-bengali text-lg leading-loose mb-2">{d.name}</h4>
                               <p 
                                 className="text-xs font-bold font-mono text-slate-500 tracking-widest cursor-pointer hover:text-indigo-600 hover:underline"
                                 onClick={() => setCallConfirmDonor(d)}
                               >
                                 {d.phone}
                               </p>
                            </div>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                         <div>
                           <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 font-bengali">মাসিক অনুদান</p>
                           <p className="font-bengali font-black text-indigo-600">৳{d.monthlyDonation ? d.monthlyDonation.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : '০'}</p>
                         </div>
                         <div>
                           <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 font-bengali">এই মাসে প্রদান</p>
                           <p className="font-bengali font-black text-slate-800">৳{totalPaid.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}</p>
                         </div>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                         {currentStatus === 'Due' ? (
                             <span className="inline-flex text-[11px] bg-rose-50 border border-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-md font-bengali shadow-sm">
                                বকেয়া আছে
                             </span>
                          ) : (
                             <span className="inline-flex text-[11px] bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold px-2.5 py-1 rounded-md font-bengali shadow-sm">
                                পরিশোধিত
                             </span>
                          )}
                         
                         <div className="flex items-center gap-2">
                           <button onClick={() => openOverview(d)} className="p-2 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white rounded-lg transition-all" title="বিস্তারিত">
                             <Eye className="w-4 h-4" />
                           </button>
                           {isAdminRole && (
                             <>
                               <button onClick={() => startEditDonor(d)} className="p-2 text-slate-500 bg-white border border-slate-200 hover:bg-slate-800 hover:text-white rounded-lg transition-all" title="এডিট">
                                 <Edit2 className="w-4 h-4" />
                               </button>
                               <button onClick={() => handleDeleteDonor(d.id)} className="p-2 text-rose-500 bg-white border border-slate-200 hover:bg-rose-500 hover:text-white rounded-lg transition-all" title="ডিলিট">
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </>
                           )}
                         </div>
                      </div>
                   </div>
                );
              })}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden lg:block overflow-x-auto shadow-sm ring-1 ring-black ring-opacity-5 md:rounded-2xl bg-white">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50/80 border-b border-slate-200/80">
                  <tr>
                    <th className="p-5 text-[11px] font-black tracking-widest text-slate-500 uppercase font-bengali pl-6 w-20">ক্রমিক</th>
                    <th className="p-5 text-[11px] font-black tracking-widest text-slate-500 uppercase font-bengali">দাতা সদস্য</th>
                    <th className="p-5 text-[11px] font-black tracking-widest text-slate-500 uppercase font-bengali">প্রদানকৃত অর্থ</th>
                    <th className="p-5 text-[11px] font-black tracking-widest text-slate-500 uppercase font-bengali">বর্তমান বকেয়া</th>
                    <th className="p-5 text-[11px] font-black tracking-widest text-slate-500 uppercase font-bengali text-right pr-6">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((d, index) => {
                    const donorPayments = (paymentsByDonor.get(d.id) || []).filter(p => p.month === month);
                    const isPaid = donorPayments.some(p => p.status === 'Paid');
                    const totalPaid = donorPayments.reduce((s, p) => p.status === 'Paid' ? s + Number(p.amount) : s, 0);
                    const hasUnpaid = !isPaid;

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-all group">
                        <td className="p-5 pl-6 align-middle text-center sm:text-left">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-black text-sm border border-slate-200/80 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors shadow-sm font-bengali">
                            {d.serial || (index + 1).toString().replace(/[0-9]/g, function(w) { return String.fromCharCode(w.charCodeAt(0) + 2486) })}
                          </span>
                        </td>
                        <td className="p-5 align-middle">
                          <div className="flex flex-col">
                            <p className="font-bold text-slate-900 font-bengali text-base leading-loose mb-2">{d.name}</p>
                            <div className="flex flex-wrap gap-2 items-center">
                              <p 
                                className="inline-flex max-w-max items-center px-2 py-0.5 rounded-md bg-slate-100/50 border border-slate-200/50 text-[12px] font-bold text-slate-500 font-mono tracking-widest mt-0.5 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                onClick={() => setCallConfirmDonor(d)}
                              >
                                {d.phone}
                              </p>
                              {d.monthlyDonation && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100/50 text-[10px] font-bold text-indigo-600 font-bengali">
                                  মাসিক: ৳{d.monthlyDonation.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-5 align-middle">
                          <span className="font-bengali font-black text-slate-700 bg-slate-100/80 px-3.5 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
                            ৳{totalPaid.toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}
                          </span>
                        </td>
                        <td className="p-5 align-middle">
                          {hasUnpaid ? (
                             <span className="inline-flex text-xs bg-rose-50 border border-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-lg font-bengali shadow-sm">
                               বকেয়া আছে
                             </span>
                          ) : (
                             <span className="inline-flex text-xs bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold px-3 py-1.5 rounded-lg font-bengali shadow-sm">
                               পরিশোধিত
                             </span>
                          )}
                        </td>
                        <td className="p-5 pr-6 align-middle text-right">
                         <div className="flex items-center justify-end gap-2">
                             <button onClick={() => openOverview(d)} className="px-3.5 py-2 text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 rounded-xl font-bengali text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm group/btn">
                               <Eye className="w-4 h-4 group-hover/btn:animate-pulse" /> <span>বিস্তারিত</span>
                             </button>
                             {isAdminRole && (
                               <>
                                 <button onClick={() => startEditDonor(d)} className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-800 hover:text-white rounded-xl transition-colors ring-1 ring-slate-200/60" title="এডিট">
                                   <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => handleDeleteDonor(d.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-colors ring-1 ring-rose-200/50" title="ডিলিট">
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </>
                             )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Overview Modal */}
      {showOverviewModal && overviewDonor && (
         <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
               <div className="flex items-start sm:items-center justify-between p-5 border-b border-slate-100 gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg font-bengali text-slate-900 leading-relaxed mb-1">{overviewDonor.name} - এর দানসমূহ</h3>
                      <p className="text-sm text-slate-500 font-mono">{overviewDonor.phone}</p>
                    </div>
                    <div className="flex gap-2">
                       {isAdminRole && (
                         <>
                           <button 
                            onClick={() => { setShowOverviewModal(false); startEditDonor(overviewDonor); }} 
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all shadow-sm bg-white"
                            title="এডিট করুন"
                           >
                             <Edit2 className="w-4 h-4" />
                           </button>
                           <button 
                            onClick={() => { setShowOverviewModal(false); handleDeleteDonor(overviewDonor.id); }} 
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-100 transition-all shadow-sm bg-white"
                            title="ডিলিট করুন"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </>
                       )}
                    </div>
                  </div>
                  <button onClick={() => setShowOverviewModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl flex-shrink-0"><X className="w-5 h-5"/></button>
               </div>
               <div className="p-3 sm:p-5 overflow-y-auto w-full">
                  <div className="overflow-x-auto sm:overflow-visible border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-sm sm:text-base">
                        <thead className="bg-[#f8fafc] border-b border-slate-200 text-[10px] sm:text-xs font-black tracking-widest text-[#64748B] uppercase font-bengali">
                           <tr>
                              <th className="px-2 sm:px-4 py-3 sm:py-4">মাস</th>
                              <th className="px-2 sm:px-4 py-3 sm:py-4">পরিমাণ</th>
                              <th className="px-2 sm:px-4 py-3 sm:py-4">স্ট্যাটাস</th>
                              {isAdminRole && <th className="px-2 sm:px-4 py-3 sm:py-4 text-right">ডিলিট</th>}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {overviewPaymentsModalByDonor.map(payment => (
                             <tr key={payment.id} className="hover:bg-slate-50">
                                <td className="px-2 sm:px-4 py-3 sm:py-4 font-mono font-medium text-slate-800 whitespace-nowrap text-xs sm:text-sm">{payment.month}</td>
                                <td className="px-2 sm:px-4 py-3 sm:py-4 font-mono font-bold text-slate-800 whitespace-nowrap text-xs sm:text-sm">৳{payment.amount}</td>
                                <td className="px-2 sm:px-4 py-3 sm:py-4">
                                   <button 
                                     onClick={() => handleTogglePaymentStatus(payment.id, payment.status)}
                                     className={`px-2 py-1 sm:px-3 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold font-bengali transition-colors whitespace-nowrap ${payment.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                                   >
                                     {payment.status === 'Paid' ? 'পরিশোধিত' : 'বকেয়া'}
                                   </button>
                                </td>
                                {isAdminRole && (
                                   <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                                     <button onClick={() => handleDeletePayment(payment.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1"><Trash2 className="w-4 h-4 sm:w-4 sm:h-4"/></button>
                                   </td>
                                )}
                             </tr>
                           ))}
                           {(paymentsByDonor.get(overviewDonor.id) || []).length === 0 && (
                             <tr><td colSpan={isAdminRole ? 4 : 3} className="p-6 sm:p-8 text-center text-slate-500 font-bengali text-sm sm:text-base">কোনো রেকর্ড পাওয়া যায়নি।</td></tr>
                           )}
                        </tbody>
                      </table>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Report Selection Modal */}
      {showReportMonthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animade-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white text-center">
               <FileDown className="w-12 h-12 mx-auto mb-3 opacity-80" />
               <h3 className="text-xl font-bold font-bengali">রিপোর্ট ডাউনলোড করুন</h3>
               <p className="text-indigo-100 text-sm mt-1">প্রয়োজনীয় রিপোর্টেররণ ধরণ নির্বাচন করুন</p>
            </div>
            
            <div className="p-6 space-y-4">
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-bengali">মাসিক রিপোর্ট (মাস নির্বাচন করুন)</label>
                  <div className="flex gap-2">
                    <input 
                      type="month" 
                      value={reportMonth} 
                      onChange={e => setReportMonth(e.target.value)}
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button 
                      onClick={() => { downloadMonthlyReport(reportMonth); setShowReportMonthModal(false); }}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition font-bengali"
                    >
                      ডাউনলোড
                    </button>
                  </div>
               </div>

               <button 
                 onClick={() => { downloadReport(); setShowReportMonthModal(false); }}
                 className="w-full flex items-center justify-between p-4 bg-white border-2 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 rounded-xl transition group"
               >
                  <div className="text-left">
                    <p className="font-bold text-slate-900 font-bengali">সর্বমোট প্রদান রিপোর্ট</p>
                    <p className="text-xs text-slate-500">সকল দাতা সদস্যের সর্বমোট প্রদানের তালিকা</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition" />
               </button>

               <button 
                 onClick={() => setShowReportMonthModal(false)}
                 className="w-full py-3 text-slate-500 font-bold text-sm hover:text-slate-700 font-bengali"
               >
                 বন্ধ করুন
               </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-600 p-6 text-white text-center">
               <Ticket className="w-12 h-12 mx-auto mb-3 opacity-80" />
               <h3 className="text-xl font-bold font-bengali">ইনভয়েজ জেনারেট করুন</h3>
               <p className="text-emerald-100 text-sm mt-1">এক ক্লিকেই সবার জন্য ইনভয়েজ তৈরি করুন</p>
            </div>
            
            <div className="p-6 space-y-4">
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-bengali">মাস নির্বাচন করুন</label>
                  <div className="flex flex-col gap-3">
                    <input 
                      type="month" 
                      value={invoiceMonth} 
                      onChange={e => setInvoiceMonth(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <button 
                      onClick={() => { generateBulkInvoices(); setShowInvoiceModal(false); }}
                      className="w-full bg-emerald-600 text-white px-5 py-3 rounded-lg text-sm font-bold hover:bg-emerald-700 transition font-bengali shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      <Ticket className="w-4 h-4" />
                      ইনভয়েজ তৈরি করুন
                    </button>
                  </div>
               </div>

               <button 
                 onClick={() => setShowInvoiceModal(false)}
                 className="w-full py-3 text-slate-500 font-bold text-sm hover:text-slate-700 font-bengali"
               >
                 বন্ধ করুন
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Call Modal */}
      {callConfirmDonor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Phone size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 font-bengali text-center">সদস্যকে কল করুন</h3>
            <p className="text-sm font-bold text-slate-500 mb-6 font-bengali text-center">আপনি কি <span className="text-indigo-600">{callConfirmDonor.name}</span> কে <span className="font-mono text-slate-700 bg-slate-100 px-1.5 rounded">{callConfirmDonor.phone}</span> নাম্বারে কল করতে চান?</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setCallConfirmDonor(null)}
                className="flex-1 py-3 rounded-xl font-bold font-bengali text-slate-500 border-2 border-slate-100 hover:bg-slate-50 transition-colors"
                disabled={callingDonor}
              >
                বাতিল
              </button>
              <button 
                onClick={() => {
                  window.location.href = `tel:${callConfirmDonor.phone}`;
                  setCallConfirmDonor(null);
                }}
                disabled={callingDonor}
                className="flex-1 py-3 rounded-xl font-bold font-bengali bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                Phone
              </button>
              <button 
                onClick={() => {
                  const iframe = document.createElement('iframe');
                  iframe.style.display = 'none';
                  iframe.src = `sip:${callConfirmDonor.phone}`;
                  document.body.appendChild(iframe);
                  setTimeout(() => document.body.removeChild(iframe), 2000);
                  setCallConfirmDonor(null);
                }}
                disabled={callingDonor}
                className="flex-1 py-3 rounded-xl font-bold font-bengali bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                Zoiper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
