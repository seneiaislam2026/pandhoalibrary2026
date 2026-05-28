import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from 'react-hot-toast';
import { useAuth } from "../../store/AuthContext";
import { onSnapshot, collection, doc, query, where, updateDoc, deleteDoc, setDoc, serverTimestamp, getDocs, addDoc, orderBy } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType, firebaseConfig } from "../../lib/firebase";
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from "motion/react";

const availableSubadminRoutes = [
  { name: 'সদস্য ব্যবস্থাপনা (Users)', path: '/dashboard/users' },
  { name: 'বইয়ের তালিকা (Inventory)', path: '/dashboard/books' },
  { name: 'ইস্যু ও ফেরত (Issues)', path: '/dashboard/issues' },
  { name: 'সদস্যদের বকেয়া (Dues)', path: '/dashboard/dues' },
  { name: 'দাতা সদস্য (Donors)', path: '/dashboard/donors' },
  { name: 'হিসাব-নিকাশ (Finances)', path: '/dashboard/finances' },
  { name: 'নোটিশ', path: '/dashboard/notices' },
  { name: 'মেসেজসমূহ', path: '/dashboard/messages' },
  { name: 'বইয়ের অনুরোধ (Requests)', path: '/dashboard/book-requests' },
  { name: 'প্রি-বুকিং', path: '/dashboard/pre-bookings' },
  { name: 'শপ বই ব্যবস্থাপনা', path: '/dashboard/shop-books' },
  { name: 'বই বিক্রয় অর্ডার', path: '/dashboard/shop-orders' },
  { name: 'বই কিনুন (Shop)', path: '/buy-books' },
  { name: 'বারকোড স্ক্যানার', path: '/dashboard/barcode-scanner' },
  { name: 'স্টিকার ও QR', path: '/dashboard/stickers' },
  { name: 'বুক রিভিও', path: '/dashboard/manageblog' },
  { name: 'ইভেন্ট পরিচালনা', path: '/dashboard/events' }
];

import {
  Check,
  X,
  ShieldAlert,
  BadgeCheck,
  Search,
  ShieldCheck,
  User2,
  Plus,
  Trash2,
  BookmarkMinus,
  CheckCircle2,
  Pencil,
  MoreVertical,
  Ban,
  UserPlus,
  ArrowRight,
  ShieldX,
  LogOut,
  Key,
  MessageCircle,
  Phone,
  BookOpen
} from "lucide-react";

import { sendSMS } from "../../lib/sms";

interface LibUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
  memberId?: string;
  phone?: string;
  isMonthlyDonor?: boolean;
  borrowBlocked?: boolean;
  blockedReason?: string;
  password?: string;
  hasGiftSubscription?: boolean;
  giftSubscriptionExpiry?: string | null;
  giftSubscriptionDuration?: number | null;
  subadminAccess?: string[];
  dob?: string;
  class?: string;
  fatherName?: string;
  institution?: string;
  address?: string;
}

export default function ManageUsers() {
  const location = useLocation();
  const [users, setUsers] = useState<LibUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user: currentUser } = useAuth();

  const [showModal, setShowModal] = useState(location.search.includes("add=true"));
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "123456",
    role: "reader",
    status: "active",
    isMonthlyDonor: false,
    phone: "",
    memberId: "",
    hasGiftSubscription: false,
    giftSubscriptionDuration: 0,
    subadminAccess: [] as string[],
    dob: "",
    class: "",
    fatherName: "",
    institution: "",
    address: ""
  });

  const [editUser, setEditUser] = useState<LibUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    role: "",
    status: "",
    phone: "",
    isMonthlyDonor: false,
    password: "",
    borrowBlocked: false,
    blockedReason: "",
    memberId: "",
    hasGiftSubscription: false,
    giftSubscriptionDuration: 0,
    subadminAccess: [] as string[],
    dob: "",
    class: "",
    fatherName: "",
    institution: "",
    address: ""
  });

  const [selectedUser, setSelectedUser] = useState<LibUser | null>(null);
  const [callConfirmUser, setCallConfirmUser] = useState<LibUser | null>(null);
  const [callingUser, setCallingUser] = useState(false);
  const [userIssues, setUserIssues] = useState<any[]>([]);
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [preBookings, setPreBookings] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

        const [booksSnap, usersSnap, issuesSnap, reqSnap, preBSnap] = await Promise.all([
          checkCache('admin_books_cache') ? null : getDocs(collection(db, "books")),
          getDocs(collection(db, "users")),
          checkCache('admin_issues_cache') ? null : getDocs(collection(db, "issues")),
          checkCache('admin_memberreqs_cache') ? null : getDocs(collection(db, "member-requests")),
          checkCache('admin_preb_cache') ? null : getDocs(collection(db, "pre-bookings"))
        ]);

        if (booksSnap) {
          const docs = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl }));
          setBooks(docs);
          setCache('admin_books_cache', docs);
        } else setBooks(checkCache('admin_books_cache'));

        if (usersSnap) {
          const docs = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LibUser[];
          const regularDocs = docs.filter(u => u.role !== 'scholarship');
          setUsers(regularDocs);
          setCache('admin_users_cache', docs);
        } else {
          const cached = checkCache('admin_users_cache');
          if (cached) {
            setUsers(cached.filter((u: any) => u.role !== 'scholarship'));
          } else {
            setUsers([]);
          }
        }

        if (issuesSnap) {
          const docs = issuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllIssues(docs);
          setCache('admin_issues_cache', docs);
        } else setAllIssues(checkCache('admin_issues_cache'));

        if (reqSnap) {
          const docs = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllRequests(docs);
          setCache('admin_memberreqs_cache', docs);
        } else setAllRequests(checkCache('admin_memberreqs_cache'));
        
        if (preBSnap) {
          const docs = preBSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setPreBookings(docs);
          setCache('admin_preb_cache', docs);
        } else setPreBookings(checkCache('admin_preb_cache'));

        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const updateUsersCache = (newUsers: LibUser[]) => {
    try {
      sessionStorage.setItem('admin_users_cache', JSON.stringify(newUsers));
      sessionStorage.setItem('admin_users_cache_time', Date.now().toString());
    } catch (e) {
      console.warn('Quota exceeded for sessionStorage', e);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      const user = users.find(u => u.id === selectedUser.id);
      setUserIssues(allIssues.filter((i: any) => 
        String(i.userId) === String(selectedUser.id) || 
        (user?.memberId && String(i.userId) === String(user.memberId))
      ));
      setUserRequests(allRequests.filter((r: any) => 
        String(r.userId) === String(selectedUser.id)
      ));
    }
  }, [selectedUser, allIssues, allRequests, users]);

  const downloadLibraryCard = (usr: LibUser) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    const todayDateConverted = new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
    const memberIdConverted = usr.memberId ? usr.memberId.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486)) : 'অনির্ধারিত';
    
    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>সদস্য আইডি কার্ড - ${usr.name || 'খালি'}</title>
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
            
            .no-print { position: fixed; top: 20px; right: 20px; z-index: 1000; text-align: center; }
            .print-btn {
                background: var(--primary); 
                color: white; border: none; padding: 12px 24px; border-radius: 8px; font-family: 'Hind Siliguri', sans-serif; font-weight: bold; cursor: pointer; font-size: 16px; box-shadow: 0 4px 6px rgba(21, 128, 61, 0.2); transition: all 0.2s;
            }
            .print-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="id-card-wrapper card-wrapper">
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
                        ${usr.memberId || usr.username ? '<img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=' + (usr.memberId || usr.username) + '&scale=3&height=8&includetext=false" alt="Barcode" />' : ''}
                        <div class="barcode-text">LC-${usr.memberId || '000000'}</div>
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
                        <td><div class="info-value-box font-bengali">${usr.memberId ? usr.memberId : (usr.id ? usr.id.substring(0, 6).toUpperCase() : '&nbsp;')}</div></td>
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
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.name || '&nbsp;'}</div></td>
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
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.phone || '01570206953'}</div></td>
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
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.username || (usr.email ? usr.email.split('@')[0] : '&nbsp;')}</div></td>
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
                        <td><div class="info-value-dotted font-bengali" style="font-family: 'Hind Siliguri', sans-serif;">${usr.password || '******'}</div></td>
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
                        <td><div class="info-value-dotted font-bengali">${todayDateConverted}</div></td>
                    </tr>
                </table>
                </div>
            </div>
            
            <div class="footer-banner">এই কার্ডটি হস্তান্তরযোগ্য নয়</div>
        </div>

        <div class="no-print">
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <button onclick="window.print()" class="print-btn">
                  🖨️ প্রিন্ট / পিডিএফ সেভ করুন
              </button>
              <button onclick="saveAsJPG()" class="print-btn" style="background: #10b981; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                  🖼️ জেপিজি (JPG) সেভ করুন
              </button>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-top: 12px; font-weight: bold;">পিডিএফ হিসেবে সেভ করতে প্রিন্ট অপশন থেকে <strong>'Save as PDF'</strong> নির্বাচন করুন</p>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script>
            function saveAsJPG() {
                const card = document.querySelector('.card-wrapper');
                html2canvas(card, { 
                  scale: 6, 
                  useCORS: true,
                  backgroundColor: '#ffffff'
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = \`library-card-\${'${usr.memberId || usr.name}'}.jpg\`;
                    link.href = canvas.toDataURL('image/jpeg', 0.95);
                    link.click();
                });
            }
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

  const fetchUserIssues = (userId: string) => {
    const user = users.find(u => u.id === userId);
    setUserIssues(allIssues.filter((i: any) => 
      String(i.userId) === String(userId) || 
      (user?.memberId && String(i.userId) === String(user.memberId))
    ));
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status, updatedAt: serverTimestamp() };
      const targetUser = users.find(u => u.id === id);
      
      const uName = (targetUser?.name || "").toLowerCase().trim();
      const uEmail = (targetUser?.email || "").toLowerCase().trim();
      const isSpecialUser = uName === "system admin" || uName === "seneia islam" || uName === "seneiya islam" || uEmail === "seneiaislam@gmail.com";

      if (status === 'active' && !isSpecialUser) {
        // If user already has a memberId, don't re-generate
        if (targetUser?.memberId) {
          updates.memberId = targetUser.memberId;
        } else {
          let maxId = 0;
          users.forEach((data) => {
            const dName = (data.name || "").toLowerCase().trim();
            const dEmail = (data.email || "").toLowerCase().trim();
            // Skip special users from ID calculation
            if (dName === "system admin" || dName === "seneia islam" || dName === "seneiya islam" || dEmail === "seneiaislam@gmail.com") return;
            
            const mid = parseInt(data.memberId || "0", 10);
            if (!isNaN(mid) && mid > maxId) maxId = mid;
          });
          updates.memberId = String(maxId + 1).padStart(3, '0');
        }
      } else if (isSpecialUser) {
        updates.memberId = ""; // No member ID for special users
      }
      
      await updateDoc(doc(db, "users", id), updates);
      setUsers(prev => {
        const updatedUsers = prev.map(u => (u.id === id ? { ...u, ...updates } : u));
        updateUsersCache(updatedUsers);
        return updatedUsers;
      });
    } catch (error: any) {
      toast.error("Failed to update status");
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleDelete = async (id: string, confirmed: boolean = false) => {
    if (currentUser?.email !== 'seneiaislam@gmail.com' && currentUser?.username !== 'admin') {
      return toast.success("Only the Main Admin can delete members.");
    }
    if (id === currentUser?.id) return toast.error("You cannot delete yourself.");
    
    if (!confirmed) {
      setDeletingId(id);
      return;
    }

    try {
      const deletedUser = users.find(u => u.id === id);
      const deletedMemberId = deletedUser?.memberId ? parseInt(deletedUser.memberId, 10) : null;

      await deleteDoc(doc(db, "users", id));
      
      // Auto-correct serial numbers (memberId) to avoid gaps
      if (deletedMemberId !== null && !isNaN(deletedMemberId)) {
        const usersToUpdate = users.filter(u => {
          if (!u.memberId) return false;
          const currentId = parseInt(u.memberId, 10);
          return !isNaN(currentId) && currentId > deletedMemberId;
        });
        
        usersToUpdate.sort((a, b) => parseInt(a.memberId, 10) - parseInt(b.memberId, 10));
        
        for (const u of usersToUpdate) {
            const currentId = parseInt(u.memberId, 10);
            const newMemberId = String(currentId - 1).padStart(3, '0');
            await updateDoc(doc(db, "users", u.id), { memberId: newMemberId });
        }
      }

      setUsers(prev => {
        let updated = prev.filter(u => u.id !== id);
        if (deletedMemberId !== null && !isNaN(deletedMemberId)) {
          updated = updated.map(u => {
            if (u.memberId) {
               const currentId = parseInt(u.memberId, 10);
               if (!isNaN(currentId) && currentId > deletedMemberId) {
                 return { ...u, memberId: String(currentId - 1).padStart(3, '0') };
               }
            }
            return u;
          });
        }
        updateUsersCache(updated);
        return updated;
      });

      setDeletingId(null);
      toast.success("সদস্য ডিলিট করা হয়েছে এবং সিরিয়াল আপডেট করা হয়েছে।");
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

const handleAddUser = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
    const normalizedUsername = formData.username.toLowerCase().trim();
    const memberId = formData.memberId.trim();

    // check duplicate username locally from state
    if (users.some(u => u.username.toLowerCase() === normalizedUsername)) {
      toast.error("এই ইউজারনেমটি ইতিপূর্বে ব্যবহার করা হয়েছে। দয়া করে ভিন্ন ইউজারনেম ব্যবহার করুন।");
      setLoading(false);
      return;
    }

    // check duplicate memberId locally from state
    if (memberId && users.some(u => u.memberId === memberId)) {
        toast.error(`সদস্য আইডি "${memberId}" ইতিপূর্বে অন্য একজন সদস্যকে প্রদান করা হয়েছে। দয়া করে ভিন্ন আইডি ব্যবহার করুন।`);
        setLoading(false);
        return;
    }

    const uName = (formData.name || "").toLowerCase().trim();
    const isSpecialUser = uName === "system admin" || uName === "seneia islam" || uName === "seneiya islam" || formData.username.toLowerCase() === "seneiaislam" || formData.username.toLowerCase() === "admin";
    
    let finalMemberId = memberId;

    if (!isSpecialUser && !finalMemberId) {
      let maxId = 0;
      users.forEach((data) => {
        const dName = (data.name || "").toLowerCase().trim();
        const dEmail = (data.email || "").toLowerCase().trim();
        if (dName === "system admin" || dName === "seneia islam" || dName === "seneiya islam" || dEmail === "seneiaislam@gmail.com") return;
        
        const mid = parseInt(data.memberId || "0", 10);
        if (!isNaN(mid) && mid > maxId) maxId = mid;
      });
      finalMemberId = String(maxId + 1).padStart(3, '0');
    }
      
      let giftSubscriptionExpiry = null;
      if (formData.hasGiftSubscription && formData.giftSubscriptionDuration) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + Number(formData.giftSubscriptionDuration));
        giftSubscriptionExpiry = expiry.toISOString();
      }

      const emailToSet = `${normalizedUsername}@library.com`;
      const passwordToSet = formData.password.trim() || "123456";
      let actualUserId = doc(collection(db, "users")).id;

      try {
        // Create Auth User first using secondary app
        const secondaryApp = getApps().length > 1 ? getApp('Secondary') : initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToSet, passwordToSet);
          actualUserId = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
             // If email exists in Auth, we check if it exists in Firestore
             const existingUser = users.find(u => u.email === emailToSet);
             if (existingUser) {
               toast.error("এই ইমেইল বা ইউজারনেম দিয়ে ইতিমধ্যেই একজন সদস্য আছে।");
               setLoading(false);
               return;
             }
             // If it exists in Auth but not in Firestore, we can't get the UID easily without Admin SDK.
             // We'll use the randomly generated one as secondary backup or proceed if we found the UID.
             console.warn("Auth account exists but not in Firestore.");
          } else {
            throw authError;
          }
        }
        await signOut(secondaryAuth);
      } catch (authError) {
        console.warn("Secondary Auth Process Error:", authError);
      }

      const newUserObj: LibUser = {
        ...formData,
        username: normalizedUsername,
        giftSubscriptionExpiry,
        password: passwordToSet,
        id: actualUserId,
        memberId: finalMemberId,
        email: emailToSet,
        createdAt: new Date().toISOString(),
        status: formData.status
      };

      // Final Firestore write
      await setDoc(doc(db, "users", actualUserId), {
        ...newUserObj,
        serverCreatedAt: serverTimestamp(),
        verified: true 
      });

      setUsers(prev => {
         const updated = [...prev, newUserObj];
         updateUsersCache(updated);
         return updated;
      });

      if (formData.phone) {
        const smsMessage = `অভিনন্দন ${formData.name}! পানধোয়া উন্মুক্ত পাঠাগারে আপনাকে স্বাগতম। আপনার সদস্য নং: ${finalMemberId}, ইউজার আইডি: ${normalizedUsername}, পাসওয়ার্ড: ${passwordToSet} | ওয়েবসাইট: www.pandhoalibrary.org`;
        
        // Send SMS in background
        (async () => {
          try {
            const success = await sendSMS(formData.phone, smsMessage);
            if (!success) {
              toast.error("সদস্যের মোবাইলে স্বাগতম SMS পাঠানো সম্ভব হয়নি।", { icon: '⚠️' });
            }
          } catch (e) {
            console.error("SMS Error:", e);
          }
        })();
      }

      toast.success("নতুন সদস্য সফলভাবে যুক্ত করা হয়েছে।");
      setShowModal(false);
      setFormData({ name: "", username: "", password: "123456", role: "reader", status: "active", isMonthlyDonor: false, phone: "", memberId: "", hasGiftSubscription: false, giftSubscriptionDuration: 0, subadminAccess: [], dob: "", class: "", fatherName: "", institution: "", address: "" });
    } catch (error) {
      console.error("Registration full error:", error);
      toast.error("সদস্য যুক্ত করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || loading) return;
    setLoading(true);
    try {
      const data: any = { ...editFormData };
      if (!data.password) delete data.password;

      // Check for duplicate memberId if it's being changed
      if (data.memberId && data.memberId !== editUser.memberId) {
        if (users.some(u => u.id !== editUser.id && u.memberId === data.memberId)) {
          toast.error(`সদস্য আইডি "${data.memberId}" ইতিপূর্বে অন্য একজন সদস্যকে প্রদান করা হয়েছে।`);
          return;
        }
      }

      await updateDoc(doc(db, "users", editUser.id), data);
      setUsers(prev => {
        const updated = prev.map(u => (u.id === editUser.id ? { ...u, ...data } : u));
        updateUsersCache(updated);
        return updated;
      });
      setEditUser(null);
      toast.success("সদস্যের তথ্য সফলভাবে আপডেট করা হয়েছে।");
    } catch (error) {
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  };

  let filtered = users.filter((u) => {
    // Exclude special admin accounts from the list
    const name = (u.name || "").toLowerCase().trim();
    const email = (u.email || "").toLowerCase().trim();
    const isExclude = name === "system admin" || name === "seneia islam" || name === "seneiya islam" || email === "seneiaislam@gmail.com";
    if (isExclude) return false;

    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.memberId && u.memberId.includes(search));

    if (!matchesSearch) return false;

    const uIssues = allIssues.filter((i) => String(i.userId) === String(u.id));
    const lateReturnCount = uIssues.filter(
      (i) => String(i.status).toLowerCase() === "returned" && new Date(i.returnDate || i.issueDate) > new Date(i.expectedReturnDate)
    ).length;
    const hasOverdueBooks = uIssues.some(
      (i) => String(i.status).toLowerCase() === "issued" && new Date() > new Date(i.expectedReturnDate)
    );

    if (filterType === "overdue") return hasOverdueBooks;
    if (filterType === "active") return String(u.status).toLowerCase() === "active";
    if (filterType === "inactive") return String(u.status).toLowerCase() === "inactive";
    if (filterType === "pending") return String(u.status).toLowerCase() === "pending";
    if (filterType === "frequent-late") return lateReturnCount >= 5;
    if (filterType === "blocked") return u.borrowBlocked || hasOverdueBooks || lateReturnCount >= 5;
    
    if (filterType === "best") {
      const issues = allIssues.filter(i => String(i.userId) === String(u.id) && String(i.status).toLowerCase() === 'returned').length;
      if (issues === 0) return false;
    }

    return true;
  }).sort((a, b) => {
    if (filterType === 'best') {
        const aIssues = allIssues.filter((i) => String(i.userId) === String(a.id) && String(i.status).toLowerCase() === 'returned').length;
        const bIssues = allIssues.filter((i) => String(i.userId) === String(b.id) && String(i.status).toLowerCase() === 'returned').length;
        if (bIssues !== aIssues) return bIssues - aIssues; // Highest first
    }
    const getNum = (id?: string) => {
      if (!id) return 999999;
      const enId = id.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
      const match = enId.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };
    return getNum(a.memberId) - getNum(b.memberId);
  });

  if (filterType === 'best') {
    filtered = filtered.slice(0, 5);
  }

  // make call removed as per user request

  const printUsersData = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error('Pop-up blocked.');
    
    // Filter out specific names and the owner's email (case-insensitive and trimmed)
    const usersToPrint = filtered.filter(u => {
      const name = (u.name || "").toLowerCase().trim();
      const email = (u.email || "").toLowerCase().trim();
      const isExcludeName = name === "system admin" || name === "seneia islam" || name === "seneiya islam";
      const isExcludeEmail = email === "seneiaislam@gmail.com";
      return !isExcludeName && !isExcludeEmail && String(u.status).toLowerCase() !== 'pending';
    });

    let tableRows = usersToPrint.map((u, idx) => `
      <tr>
        <td class="td-sl">${idx + 1}</td>
        <td class="td-id">${u.memberId || "-"}</td>
        <td class="td-name">${u.name}</td>
        <td class="td-phone">${u.phone || "-"}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>সদস্য তালিকা - পানধোয়া উন্মুক্ত পাঠাগার</title>
        
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
          :root {
            --primary: #4338ca;
            --border: #e2e8f0;
            --text-main: #0f172a;
            --text-muted: #64748b;
          }
          body { 
            font-family: 'Hind Siliguri', sans-serif; 
            padding: 50px; 
            max-width: 900px; 
            margin: 0 auto; 
            color: var(--text-main);
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 50px;
            padding-bottom: 30px;
            border-bottom: 2px double var(--primary);
            position: relative;
          }
          .header::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 20%;
            right: 20%;
            height: 1px;
            background: var(--primary);
            opacity: 0.3;
          }
          .library-logo {
            width: 60px;
            height: 60px;
            margin: 0 auto 15px;
            color: var(--primary);
          }
          .header h1 { 
            font-size: 32px; 
            color: var(--primary); 
            margin: 0 0 5px 0;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .header .info {
            margin: 5px 0;
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 500;
          }
          .header .title-badge {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 4px 20px;
            border-radius: 99px;
            font-size: 14px;
            font-weight: 700;
            margin-top: 15px;
            text-transform: uppercase;
          }
          table { 
            width: 100%; 
            border-collapse: separate; 
            border-spacing: 0;
            margin-top: 10px;
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
          }
          th { 
            background: #f8fafc; 
            padding: 16px; 
            text-align: left; 
            border-bottom: 2px solid var(--border);
            font-weight: 700;
            color: #475569;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          td {
            padding: 16px; 
            border-bottom: 1px solid var(--border);
            font-size: 14px;
          }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background-color: #fcfdfe; }
          
          .td-sl { width: 10%; font-weight: 800; color: var(--primary); font-family: 'Hind Siliguri', sans-serif; font-size: 15px; }
          .td-id { width: 20%; font-weight: 800; color: var(--primary); font-family: 'Hind Siliguri', sans-serif; font-size: 15px; }
          .td-name { width: 45%; font-weight: 600; color: #1e293b; }
          .td-phone { width: 25%; color: var(--text-muted); font-family: 'Hind Siliguri', sans-serif; font-weight: 600; font-size: 15px; letter-spacing: 0.5px; }
          
          .footer-section {
            margin-top: 80px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 1px solid #cbd5e1;
            margin-bottom: 8px;
          }
          .signature-label {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
          }

          .print-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            margin-bottom: 40px;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 10px 15px -3px rgba(67, 56, 202, 0.2);
            transition: all 0.2s;
          }
          .print-btn:hover { transform: translateY(-1px); box-shadow: 0 15px 20px -5px rgba(67, 56, 202, 0.3); }

          @media print {
            body { padding: 0; }
            .print-btn { display: none; }
            @page { margin: 2cm; }
            table { border: 1px solid #e2e8f0; }
          }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          তালিকা প্রিন্ট করুন
        </button>
        
        <div class="header">
          <div class="library-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
          </div>
          <h1>পানধোয়া উন্মুক্ত পাঠাগার</h1>
          <div class="info" style="font-family: 'Outfit', 'Hind Siliguri', sans-serif; font-size: 15px; color: #1e293b; margin: 10px 0; font-weight: 700; background: #f8fafc; display: inline-block; padding: 4px 15px; border-radius: 8px; border: 1px solid #e2e8f0;">ঠিকানা: পানধোয়া, সেনওয়ালিয়া-1344, আশুলিয়া, সাভার, ঢাকা।</div>
          <div class="info">স্থাপিত: ২০২০ | ইমেইল: info@pandhoalibrary.com</div>
          <div class="title-badge">সাধারণ সদস্য তালিকা</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ক্রমিক নং (SL)</th>
              <th>সদস্য নং (MEMBER ID)</th>
              <th>নাম (NAME)</th>
              <th>ফোন নম্বর (CONTACT)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer-section" style="margin-top: 100px;">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">লাইব্রেরি সম্পাদক</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">পরিচালক/সেক্রেটারি জেনারেল</div>
          </div>
        </div>

        <script>
          setTimeout(() => window.print(), 1000);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Stats Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-slate-900 rounded-[2.5rem] p-8 sm:p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2 font-bengali">সদস্য <span className="text-indigo-400">ব্যবস্থাপনা</span></h2>
              <p className="text-slate-400 font-bold font-bengali">লাইব্রেরির সদস্যদের প্রোফাইল এবং কার্যক্রম নিয়ন্ত্রণ কেন্দ্র।</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  sessionStorage.removeItem('admin_users_cache');
                  sessionStorage.removeItem('admin_users_cache_time');
                  window.location.reload();
                }}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 group font-bengali"
              >
                🔄 রিফ্রেশ
              </button>
              <button
                onClick={printUsersData}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 group font-bengali"
              >
                🖨️ ডাটা প্রিন্ট
              </button>
              {currentUser?.role !== 'visitor_admin' && (
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 group font-bengali"
                >
                  <UserPlus className="w-5 h-5" /> 
                  সদস্য যোগ করুন
                </button>
              )}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
            {(() => {
              const displayUsers = users.filter(u => {
                const name = (u.name || "").toLowerCase().trim();
                const email = (u.email || "").toLowerCase().trim();
                const isExclude = name === "system admin" || name === "seneia islam" || name === "seneiya islam" || email === "seneiaislam@gmail.com";
                return !isExclude;
              });
              return (
                <>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট</p>
                    <p className="text-2xl font-black">{displayUsers.length}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">সক্রিয়</p>
                    <p className="text-2xl font-black text-emerald-400">{displayUsers.filter(u => String(u.status).toLowerCase() === 'active').length}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ব্লকড</p>
                    <p className="text-2xl font-black text-amber-400">{displayUsers.filter(u => u.borrowBlocked).length}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">অপেক্ষমান</p>
                    <p className="text-2xl font-black text-indigo-400">{displayUsers.filter(u => String(u.status).toLowerCase() === 'pending').length}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-black text-slate-900 flex items-center gap-2 font-bengali">
              <Search className="w-5 h-5 text-indigo-500" /> দ্রুত অনুসন্ধান
            </h3>
            <div className="relative group">
              <input
                type="text"
                placeholder="নাম বা আইডি দিয়ে খুঁজুন..."
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white text-sm font-bengali transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-6">
            {[{id:'all',l:'সব'},{id:'active',l:'সক্রিয়'},{id:'inactive',l:'নিষ্ক্রিয়'},{id:'pending',l:'অপেক্ষমান'},{id:'overdue',l:'মেয়াদোত্তীর্ণ (বই)'},{id:'blocked',l:'ব্লকড'},{id:'best',l:'সেরা পাঠক'}].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterType(btn.id)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  filterType === btn.id ? "bg-indigo-600 text-white border-indigo-600 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {btn.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((u, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              key={u.id}
              className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 overflow-hidden relative flex flex-col"
            >
              {/* Deletion Overlay */}
              {deletingId === u.id && (
                <div className="absolute inset-0 z-20 bg-rose-600/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
                  <ShieldAlert className="w-12 h-12 mb-4 animate-bounce" />
                  <h4 className="text-xl font-black mb-2 font-bengali">আপনি কি নিশ্চিত?</h4>
                  <p className="text-sm font-medium mb-6 opacity-90 font-bengali">এই অ্যাকশনটি "{u.name}"-কে স্থায়ীভাবে মুছে ফেলবে।</p>
                  <div className="flex gap-3 w-full">
                    <button onClick={() => handleDelete(u.id, true)} className="flex-1 bg-white text-rose-600 py-3 rounded-xl font-black text-xs tracking-widest shadow-lg font-bengali">নিশ্চিত করুন</button>
                    <button onClick={() => setDeletingId(null)} className="flex-1 bg-black/20 text-white py-3 rounded-xl font-black text-xs tracking-widest border border-white/20 font-bengali">বাতিল</button>
                  </div>
                </div>
              )}

              <div className="p-6 flex-1 relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        #{u.memberId || "PEND"}
                      </span>
                    </div>
                    <h3 className="font-bengali font-black text-xl text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {u.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-tight uppercase">@{u.username}</p>
                  </div>
                  <div 
                    className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center shadow-lg transition-all duration-500 cursor-pointer ${u.borrowBlocked ? "bg-amber-500 text-white rotate-12" : "bg-slate-50 text-slate-300 hover:bg-indigo-600 hover:text-white hover:-rotate-6"}`}
                    onClick={(e) => {
                       e.stopPropagation();
                       setSelectedUser(u);
                       fetchUserIssues(u.id);
                    }}
                    title="বিস্তারিত দেখুন"
                  >
                    {u.borrowBlocked ? <Ban className="w-6 h-6" /> : <User2 className="w-6 h-6" />}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-bengali ${u.role === "admin" ? "bg-purple-600 text-white" : u.role === "subadmin" ? "bg-indigo-500 text-white" : u.role === "visitor_admin" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {u.role === 'reader' ? 'পাঠক সদস্য' : u.role === 'donor' ? 'সম্মানিত দাতা' : u.role === 'subadmin' ? 'সাব-অ্যাডমিন' : u.role === 'visitor_admin' ? 'ভিজিটর অ্যাডমিন' : u.role === 'admin' ? 'অ্যাডমিন' : u.role}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-bengali ${String(u.status).toLowerCase() === "active" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
                      {String(u.status).toLowerCase() === 'active' ? 'সক্রিয়' : String(u.status).toLowerCase() === 'pending' ? 'অপেক্ষমান' : String(u.status).toLowerCase() === 'inactive' ? 'নিষ্ক্রিয়' : u.status}
                    </span>
                    {u.isMonthlyDonor && (
                      <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase">Donor</span>
                    )}
                    {u.hasGiftSubscription && (
                      <div className="flex flex-col gap-1 items-end">
                        <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase font-bengali">সাবস্ক্রিপশন গিফট করা হয়েছে</span>
                        {u.giftSubscriptionExpiry && (
                          <span className="text-[8px] font-bold text-indigo-600 font-bengali">
                            {new Date(u.giftSubscriptionExpiry).toLocaleDateString()} পর্যন্ত
                          </span>
                        )}
                      </div>
                    )}
                    {(() => {
                      const extendReqs = allIssues.filter(i => i.userId === u.id && i.extendRequested && (i.status === 'ISSUED' || i.status === 'Issued')).length;
                      const newIssueReqs = allRequests.filter(r => r.userId === u.id && String(r.status).toLowerCase() === 'pending' && r.type === 'Issue').length;
                      return (
                        <>
                          {newIssueReqs > 0 && <span className="text-[9px] bg-indigo-600 text-white font-black px-3 py-1 rounded-full shadow-md font-bengali uppercase tracking-widest">{newIssueReqs} নিউ ইস্যু</span>}
                          {extendReqs > 0 && <span className="text-[9px] bg-amber-500 text-white font-black px-3 py-1 rounded-full shadow-md font-bengali uppercase tracking-widest">{extendReqs} সময় বৃদ্ধি</span>}
                        </>
                      );
                    })()}
                  </div>
                  
                  <div className="bg-slate-50/50 rounded-2xl p-4 space-y-2 border border-slate-50">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-bengali">মোবাইল</span>
                      <span 
                        className={`text-xs font-bold ${u.phone ? 'text-indigo-600 cursor-pointer hover:underline' : 'text-slate-700'}`}
                        onClick={() => u.phone && setCallConfirmUser(u)}
                      >
                        {u.phone || 'N/A'}
                      </span>
                    </div>
                    {u.borrowBlocked && (
                      <div className="pt-2 border-t border-slate-100">
                         <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block mb-1 font-bengali">ব্লক করার কারণ</span>
                         <p className="text-[10px] font-bold text-slate-600 font-bengali line-clamp-2">{u.blockedReason || 'কোনো কারণ উল্লেখ করা হয়নি'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 flex gap-2 group-hover:bg-indigo-50 transition-colors">
                <button
                  onClick={() => { setSelectedUser(u); fetchUserIssues(u.id); }}
                  className="flex-1 bg-white border border-slate-200 p-2.5 rounded-2xl flex items-center justify-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 font-bengali"
                >
                   বিস্তারিত
                </button>
                <div className="flex gap-1">
                  {currentUser?.role !== 'visitor_admin' && (
                    <>
                      <button
                        onClick={async () => {
                          const newStatus = !u.borrowBlocked;
                          if (!confirm(newStatus ? 'আপনি কি নিশ্চিত যে এই সদস্যকে ব্লক করবেন?' : 'আপনি কি নিশ্চিত যে এই সদস্যকে আনব্লক করবেন?')) return;
                          await updateDoc(doc(db, "users", u.id), { 
                            borrowBlocked: newStatus,
                            ...(newStatus ? {} : { blockedReason: "" })
                          });
                          toast.success(newStatus ? 'সদস্য ব্লক করা হয়েছে!' : 'সদস্য আনব্লক করা হয়েছে!');
                        }}
                        className={`aspect-square p-3 rounded-2xl border transition-all shadow-sm active:scale-90 ${u.borrowBlocked ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200"}`}
                        title={u.borrowBlocked ? "সদস্য আনব্লক করুন" : "সদস্য ব্লক করুন"}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <a
                        href={u.phone ? `sms:${u.phone}` : '#'}
                        className={`aspect-square bg-white border border-slate-200 p-3 rounded-2xl transition-all shadow-sm active:scale-90 flex items-center justify-center ${u.phone ? 'text-slate-400 hover:text-emerald-600 hover:border-emerald-200' : 'text-slate-200 cursor-not-allowed'}`}
                        title="SMS পাঠান"
                        onClick={(e) => { if(!u.phone) e.preventDefault(); }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => { setEditUser(u); setEditFormData({ name: u.name, role: u.role, status: String(u.status).toLowerCase() === 'pending' ? 'active' : u.status, phone: u.phone || "", isMonthlyDonor: !!u.isMonthlyDonor, password: "", borrowBlocked: !!u.borrowBlocked, blockedReason: u.blockedReason || "", memberId: u.memberId || "", hasGiftSubscription: !!u.hasGiftSubscription, giftSubscriptionDuration: u.giftSubscriptionDuration || 0, subadminAccess: u.subadminAccess || [], dob: u.dob || "", class: u.class || "", fatherName: u.fatherName || "", institution: u.institution || "", address: u.address || "" }); }}
                        className="aspect-square bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-90"
                        title="প্রোফাইল সম্পাদন করুন"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        className="aspect-square bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm active:scale-90"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
           <Search className="w-8 h-8 text-slate-300 mb-4" />
           <p className="text-slate-400 font-bold font-bengali">দুঃখিত, কোনো সদস্য পাওয়া যায়নি।</p>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 relative my-4 sm:my-8 overflow-hidden sticky top-4">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <div className="sticky top-0 bg-white z-10 px-8 sm:px-10 py-6 border-b border-slate-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><UserPlus className="w-7 h-7" /></div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-bengali">নতুন সদস্য</h3>
            </div>
            <form onSubmit={handleAddUser} className="p-8 sm:p-10 pt-4 sm:pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="নাম (বাংলা বা ইংরেজি)" required value={formData.name || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => {
                      const newData = { ...prev, name: val };
                      // Auto-generate username from English characters if it matches the current pattern
                      const autoUser = val.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                      if (!prev.username || prev.username === prev.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')) {
                        newData.username = autoUser;
                      }
                      return newData;
                    });
                  }} 
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"
                />
                <input type="text" placeholder="সদস্য আইডি (ঐচ্ছিক)" value={formData.memberId || ''} onChange={e=>setFormData({...formData, memberId:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
              </div>
              <input type="text" placeholder="ইউজারনেম (ইংরেজি)" required value={formData.username || ''} onChange={e=>setFormData({...formData, username:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
              <input type="text" placeholder="মোবাইল নম্বর" required value={formData.phone || ''} onChange={e=>setFormData({...formData, phone:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
              <input type="password" placeholder="পাসওয়ার্ড (ডিফল্ট: 123456)" value={formData.password || ''} onChange={e=>setFormData({...formData, password:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
              <div className="grid grid-cols-2 gap-4">
                <select value={formData.role || 'reader'} onChange={e=>setFormData({...formData, role:e.target.value})} className="border border-slate-200 p-3 rounded-xl bg-slate-50 font-bengali">
                  <option value="reader">পাঠক (Reader)</option><option value="donor">দাতা (Donor)</option><option value="subadmin">সাব-অ্যাডমিন (Subadmin)</option><option value="visitor_admin">ভিজিটর অ্যাডমিন (Visitor Admin)</option><option value="admin">অ্যাডমিন (Admin)</option>
                </select>
                <select value={formData.status || 'active'} onChange={e=>setFormData({...formData, status:e.target.value})} className="border border-slate-200 p-3 rounded-xl bg-slate-50 font-bengali">
                  <option value="active">সক্রিয় (Active)</option><option value="inactive">নিষ্ক্রিয় (Inactive)</option><option value="pending">অপেক্ষমান (Pending)</option>
                </select>
              </div>
              {formData.role === 'reader' && (
                <div className="space-y-4 border border-indigo-100 bg-indigo-50/30 p-4 rounded-xl">
                   <h4 className="font-bold text-indigo-900 text-sm font-bengali">পাঠক সদস্যের অতিরিক্ত তথ্য</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1 font-bengali">জন্ম তারিখ</label>
                       <input type="date" value={formData.dob || ''} onChange={e=>setFormData({...formData, dob:e.target.value})} className="w-full border border-slate-200 p-2 rounded-xl focus:ring-2 focus:ring-indigo-500 font-sans text-sm outline-none"/>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1 font-bengali">বয়স</label>
                       <div className="w-full border border-slate-200 bg-slate-100 px-3 rounded-xl font-sans text-sm font-bold text-slate-600 flex items-center h-[38px] font-bengali">
                          {formData.dob ? `${Math.max(0, new Date(Date.now() - new Date(formData.dob).getTime()).getUTCFullYear() - 1970)} বছর` : '০ বছর'}
                       </div>
                     </div>
                   </div>
                   <input type="text" placeholder="শ্রেণি (Class)" value={formData.class || ''} onChange={e=>setFormData({...formData, class:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
                   <input type="text" placeholder="পিতার নাম" value={formData.fatherName || ''} onChange={e=>setFormData({...formData, fatherName:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
                   <input type="text" placeholder="শিক্ষাপ্রতিষ্ঠান বা কর্মস্থলের নাম" value={formData.institution || ''} onChange={e=>setFormData({...formData, institution:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali"/>
                   <textarea placeholder="বর্তমান ঠিকানা" value={formData.address || ''} onChange={e=>setFormData({...formData, address:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bengali h-20 resize-none"></textarea>
                </div>
              )}



              <div className="flex flex-col gap-2 px-1 pt-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="hasGiftSubscription" 
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={!!formData.hasGiftSubscription} 
                    onChange={e=>setFormData({...formData, hasGiftSubscription:e.target.checked})} 
                  />
                  <label htmlFor="hasGiftSubscription" className="text-sm font-bold text-slate-700 font-bengali">ফ্রি সাবস্ক্রিপশন গিফট করুন</label>
                </div>
                {formData.hasGiftSubscription && (
                  <div className="flex items-center gap-2 mt-1 ml-6">
                    <span className="text-xs font-bold text-slate-500 font-bengali">সময়সীমা:</span>
                    <select 
                      value={formData.giftSubscriptionDuration || 0} 
                      onChange={e=>setFormData({...formData, giftSubscriptionDuration: Number(e.target.value)})}
                      className="text-xs border border-slate-200 p-1.5 rounded-lg bg-indigo-50 font-bengali font-bold outline-none ring-indigo-500 focus:ring-1"
                    >
                      <option value="0">বাছাই করুন</option>
                      <option value="1">১ মাস</option>
                      <option value="2">২ মাস</option>
                      <option value="3">৩ মাস</option>
                      <option value="6">৬ মাস</option>
                      <option value="12">১ বছর (১২ মাস)</option>
                    </select>
                  </div>
                )}
              </div>
              {(formData.role === 'subadmin' || formData.role === 'visitor_admin') && (
                <div className="mt-4 p-4 border border-indigo-100 bg-indigo-50/50 rounded-2xl">
                  <h4 className="text-sm font-bold text-indigo-900 mb-3 font-bengali">{formData.role === 'subadmin' ? 'সাব-অ্যাডমিন এক্সেস' : 'ভিজিটর অ্যাডমিন এক্সেস'}</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableSubadminRoutes.map((route, idx) => (
                      <label key={idx} className="flex items-center gap-2 p-2 rounded relative bg-white border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50 relative z-10">
                        <input
                           type="checkbox"
                           checked={formData.subadminAccess?.includes(route.path)}
                           onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData(prev => ({
                                  ...prev,
                                  subadminAccess: checked 
                                    ? [...(prev.subadminAccess || []), route.path]
                                    : (prev.subadminAccess || []).filter(p => p !== route.path)
                              }));
                           }}
                           className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700 font-bengali select-none">{route.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="sticky bottom-0 bg-white z-10 flex justify-end gap-3 py-6 border-t border-slate-50">
                <button type="button" disabled={loading} className="font-bengali px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-xl disabled:opacity-50" onClick={()=>setShowModal(false)}>বাতিল</button>
                <button type="submit" disabled={loading} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold font-bengali disabled:opacity-50 flex items-center gap-2">
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  যুক্ত করুন
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-8 sm:p-10 text-white flex justify-between items-start">
              <div>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="bg-indigo-600 px-3 py-1 rounded-lg text-xs font-black">ID: #{selectedUser.memberId || "PEND"}</span>
                </div>
                <h3 className="text-3xl font-black mt-3 font-sans leading-tight">{selectedUser.name}</h3>
                <p className="text-indigo-400 font-bold mt-1">@{selectedUser.username}</p>
              </div>
              <button onClick={()=>setSelectedUser(null)} className="p-2 hover:bg-white/10 rounded-xl transition"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
               {selectedUser.borrowBlocked && (
                 <div className="p-5 bg-amber-50 border border-amber-200 rounded-[2rem] flex items-start gap-5">
                   <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
                     <Ban className="w-6 h-6" />
                   </div>
                   <div>
                     <h5 className="font-black text-amber-800 text-xs uppercase tracking-widest mb-1">Account Suspended</h5>
                     <p className="text-sm font-bold text-amber-700 font-bengali leading-relaxed">{selectedUser.blockedReason || 'সদস্যের বই ধার নেওয়ার সুবিধা সাময়িকভাবে বন্ধ আছে।'}</p>
                   </div>
                 </div>
               )}
               
               <div className="flex flex-wrap gap-2 mb-2">
                 {(() => {
                    const extendReqs = allIssues.filter(i => i.userId === selectedUser.id && i.extendRequested && (i.status === 'ISSUED' || i.status === 'Issued')).length;
                    const newIssueReqs = allRequests.filter(r => r.userId === selectedUser.id && String(r.status).toLowerCase() === 'pending' && r.type === 'Issue').length;
                    return (
                      <>
                        {newIssueReqs > 0 && <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md font-bengali animate-pulse">{newIssueReqs} নিউ ইস্যু</span>}
                        {extendReqs > 0 && <span className="bg-amber-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md font-bengali animate-pulse">{extendReqs} সময় বৃদ্ধি</span>}
                      </>
                    );
                 })()}
               </div>

                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
                     <div><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">মোবাইল</p><p className="font-bold">{selectedUser.phone || 'N/A'}</p></div>
                     <div><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">সদস্যের ধরন</p><p className="font-bold capitalize font-bengali">{selectedUser.role === 'reader' ? 'পাঠক সদস্য' : selectedUser.role === 'donor' ? 'সম্মানিত দাতা' : selectedUser.role === 'subadmin' ? 'সাব-অ্যাডমিন' : selectedUser.role === 'visitor_admin' ? 'ভিজিটর অ্যাডমিন' : selectedUser.role === 'admin' ? 'অ্যাডমিন' : selectedUser.role}</p></div>
                     <div><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">স্ট্যাটাস</p><p className="font-bold capitalize font-bengali">{selectedUser.status === 'active' ? 'সক্রিয়' : selectedUser.status === 'pending' ? 'অপেক্ষমান' : selectedUser.status === 'inactive' ? 'নিষ্ক্রিয়' : selectedUser.status}</p></div>
                     <div><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">যোগদান</p><p className="font-bold">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}</p></div>
                   </div>
                   
                   {selectedUser.role === 'reader' && (selectedUser.dob || selectedUser.class || selectedUser.fatherName || selectedUser.institution || selectedUser.address) && (
                     <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
                       {selectedUser.dob && <div className="min-w-0"><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">জন্ম তারিখ (বয়স)</p><p className="font-bold break-words">{selectedUser.dob} ({Math.max(0, new Date(Date.now() - new Date(selectedUser.dob).getTime()).getUTCFullYear() - 1970)} বছর)</p></div>}
                       {selectedUser.class && <div className="min-w-0"><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">শ্রেণি</p><p className="font-bold font-bengali break-words">{selectedUser.class}</p></div>}
                       {selectedUser.fatherName && <div className="min-w-0"><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">পিতার নাম</p><p className="font-bold font-bengali break-words">{selectedUser.fatherName}</p></div>}
                       {selectedUser.institution && <div className="min-w-0"><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">শিক্ষাপ্রতিষ্ঠান/কর্মস্থল</p><p className="font-bold font-bengali break-words">{selectedUser.institution}</p></div>}
                       {selectedUser.address && <div className="col-span-2 lg:col-span-4 min-w-0"><p className="text-slate-400 font-bold text-[10px] uppercase font-bengali">ঠিকানা</p><p className="font-bold font-bengali break-all whitespace-normal">{selectedUser.address}</p></div>}
                     </div>
                   )}

               {selectedUser.hasGiftSubscription && (
                 <div className="flex flex-col gap-2 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                   <div className="flex items-center gap-2">
                     <BadgeCheck className="w-5 h-5 text-indigo-600" />
                     <span className="text-sm font-bold text-indigo-700 font-bengali">এই সদস্যকে ফ্রি সাবস্ক্রিপশন গিফট করা হয়েছে।</span>
                   </div>
                   {selectedUser.giftSubscriptionExpiry && (
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-7">
                        Expires: {new Date(selectedUser.giftSubscriptionExpiry).toLocaleDateString()}
                      </p>
                   )}
                 </div>
               )}

               <div className="pt-2">
                 <button 
                   onClick={() => downloadLibraryCard(selectedUser)}
                   className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-200 transition-colors"
                 >
                   🪪 লাইব্রেরি কার্ড তৈরি করুন
                 </button>
               </div>

               <div className="space-y-4">
                 <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2 font-bengali">
                   <BookmarkMinus className="w-4 h-4 text-amber-500" /> পেন্ডিং রিকোয়েস্ট (ইস্যু / ফেরত)
                 </h4>
                 <div className="space-y-2">
                   {userRequests.filter((r: any) => r.status === 'Pending').length === 0 ? (
                     <p className="text-center text-slate-400 py-4 text-xs italic bg-slate-50 rounded-xl font-bengali">কোনো পেন্ডিং রিকোয়েস্ট নেই</p>
                   ) : (
                     userRequests.filter((r: any) => r.status === 'Pending').map(r => (
                       <div key={r.id} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 shadow-sm transition-all hover:border-amber-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${r.type === 'Issue' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {r.type}
                              </span>
                              <p className="font-bold text-sm text-slate-800 mt-1 font-bengali">{r.bookName}</p>
                            </div>
                            <div className="flex gap-2">
                              {r.type === 'Issue' && (
                                <button 
                                  onClick={async () => {
                                    if (window.confirm("আপনি কি নিশ্চিত যে এই রিকোয়েস্টটি বাতিল করতে চান?")) {
                                      await updateDoc(doc(db, "member-requests", r.id), { status: "Rejected", resolvedAt: serverTimestamp() });
                                      toast.success("রিকোয়েস্টটি বাতিল করা হয়েছে।");
                                    }
                                  }}
                                  className="px-3 py-1 bg-white border border-red-200 text-red-600 font-bold text-xs rounded-lg hover:bg-red-50 transition shadow-sm"
                                >
                                  Reject
                                </button>
                              )}
                              <button 
                                onClick={async () => {
                                  if (r.type === 'Issue' && r.bookId) {
                                    const expectedReturn = new Date();
                                    expectedReturn.setDate(expectedReturn.getDate() + 14); // default 14 days
                                    await addDoc(collection(db, 'issues'), {
                                      bookId: r.bookId,
                                      userId: r.userId,
                                      issueDate: new Date().toISOString(),
                                      expectedReturnDate: expectedReturn.toISOString(),
                                      status: 'ISSUED',
                                      returned: false
                                    });
                                    await updateDoc(doc(db, "books", r.bookId), { status: "ISSUED" });
                                    toast.success("Request approved and book issued successfully!");
                                  } else {
                                    toast.success("Request marked as resolved!");
                                  }
                                  await updateDoc(doc(db, "member-requests", r.id), { status: "Resolved", resolvedAt: serverTimestamp() });
                                }}
                                className="px-3 py-1 bg-white border border-amber-200 text-amber-600 font-bold text-xs rounded-lg hover:bg-amber-50 transition shadow-sm"
                              >
                                {r.type === 'Issue' ? 'Approve' : 'Resolve'}
                              </button>
                            </div>
                          </div>
                          {r.note && (
                            <p className="text-xs text-slate-600 font-bengali bg-white p-2 rounded-lg border border-slate-100 italic">" {r.note} "</p>
                          )}
                       </div>
                     ))
                   )}
                 </div>
               </div>
               
               <div className="space-y-4">
                 <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2 font-bengali">
                   <BookmarkMinus className="w-4 h-4 text-indigo-600" /> বর্তমান পঠিত বইসমূহ
                 </h4>
                 <div className="space-y-2">
                   {userIssues.filter(i => String(i.status).toLowerCase() === 'issued').length === 0 ? (
                     <p className="text-center text-slate-400 py-4 text-xs italic bg-slate-50 rounded-xl font-bengali">কোনো বই ইস্যু করা নেই</p>
                   ) : (
                     userIssues.filter(i => String(i.status).toLowerCase() === 'issued').map(i => {
                       const book = books.find(b => b.id === i.bookId);
                       return (
                         <div key={i.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-indigo-200">
                            <div className="flex gap-3 items-center">
                              <div className="w-10 h-14 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100 shrink-0">
                                 {book?.cover ? (
                                    <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                                 ) : (
                                    <BookOpen className="w-4 h-4 text-slate-300" />
                                 )}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-slate-800">{book?.title || 'Unknown'}</p>
                                <p className="text-[10px] text-indigo-600 font-black">CODE: {book?.bookCode}</p>
                              </div>
                            </div>
                            <button 
                              onClick={async () => {
                                if(!confirm("আপনি কি নিশ্চিত যে বইটি ফেরত দেওয়া হয়েছে?")) return;
                                await updateDoc(doc(db, "issues", i.id), { status: "Returned", returnDate: new Date().toISOString() });
                                await updateDoc(doc(db, "books", i.bookId), { status: "Available" });
                                toast.success("বই সফলভাবে ফেরত নেওয়া হয়েছে!");
                              }}
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                         </div>
                       )
                     })
                   )}
                 </div>
               </div>

               <div className="space-y-6">
                 <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2 font-bengali">
                   <CheckCircle2 className="w-4 h-4 text-emerald-500" /> ফেরত হিস্ট্রি
                 </h4>
                 <div className="space-y-3">
                   {userIssues.filter(i => String(i.status).toLowerCase() === 'returned').length === 0 ? (
                     <p className="text-center text-slate-400 py-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-xs italic font-bengali">কোনো ফেরত হিস্ট্রি নেই</p>
                   ) : (
                     userIssues.filter(i => String(i.status).toLowerCase() === 'returned')
                       .sort((a:any,b:any) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())
                       .slice(0, 5)
                       .map(i => {
                         const book = books.find(b => b.id === i.bookId);
                         return (
                           <div key={i.id} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                             <div>
                               <p className="font-bold text-sm text-slate-700">{book?.title || 'Unknown'}</p>
                               <p className="text-[9px] text-slate-400 font-bold uppercase">Returned: {i.returnDate ? new Date(i.returnDate).toLocaleDateString() : 'N/A'}</p>
                             </div>
                             <div className="flex flex-col items-end">
                               <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Completed</span>
                             </div>
                           </div>
                         )
                       })
                   )}
                 </div>
               </div>
            </div>
            <div className="bg-slate-50 p-6 flex justify-end"><button onClick={()=>setSelectedUser(null)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm font-bengali">বন্ধ করুন</button></div>
          </motion.div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 relative my-4 sm:my-8 overflow-hidden sticky top-4">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            <div className="sticky top-0 bg-white z-10 px-8 sm:px-10 py-6 border-b border-slate-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Pencil className="w-7 h-7" /></div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-bengali">সদস্য তথ্য আপডেট</h3>
            </div>
            <form onSubmit={handleEditUser} className="p-8 sm:p-10 pt-4 sm:pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="পুরো নাম" required value={editFormData.name || ''} onChange={e=>setEditFormData({...editFormData, name:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl font-bengali"/>
                <input type="text" placeholder="সদস্য আইডি" value={editFormData.memberId || ''} onChange={e=>setEditFormData({...editFormData, memberId:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl font-bengali"/>
              </div>
              <input type="text" placeholder="মোবাইল" required value={editFormData.phone || ''} onChange={e=>setEditFormData({...editFormData, phone:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl font-bengali"/>
              <input type="password" placeholder="নতুন পাসওয়ার্ড (ঐচ্ছিক)" value={editFormData.password || ''} onChange={e=>setEditFormData({...editFormData, password:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl font-bengali"/>
              <div className="grid grid-cols-2 gap-4">
                <select value={editFormData.role || 'reader'} onChange={e=>setEditFormData({...editFormData, role:e.target.value})} className="border border-slate-200 p-3 rounded-xl bg-slate-50 font-bengali">
                  <option value="reader">পাঠক</option><option value="donor">দাতা</option><option value="subadmin">সাব-অ্যাডমিন</option><option value="visitor_admin">ভিজিটর অ্যাডমিন</option><option value="admin">অ্যাডমিন</option>
                </select>
                <select value={editFormData.status || 'active'} onChange={e=>setEditFormData({...editFormData, status:e.target.value})} className="border border-slate-200 p-3 rounded-xl bg-slate-50 font-bengali">
                  <option value="active">সক্রিয়</option><option value="inactive">নিষ্ক্রিয়</option><option value="pending">অপেক্ষমান</option>
                </select>
              </div>
              {editFormData.role === 'reader' && (
                <div className="space-y-4 border border-emerald-100 bg-emerald-50/30 p-4 rounded-xl">
                   <h4 className="font-bold text-emerald-900 text-sm font-bengali">পাঠক সদস্যের অতিরিক্ত তথ্য</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1 font-bengali">জন্ম তারিখ</label>
                       <input type="date" value={editFormData.dob || ''} onChange={e=>setEditFormData({...editFormData, dob:e.target.value})} className="w-full border border-slate-200 p-2 rounded-xl focus:ring-2 focus:ring-emerald-500 font-sans text-sm outline-none"/>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1 font-bengali">বয়স</label>
                       <div className="w-full border border-slate-200 bg-slate-100 px-3 rounded-xl font-sans text-sm font-bold text-slate-600 flex items-center h-[38px] font-bengali">
                          {editFormData.dob ? `${Math.max(0, new Date(Date.now() - new Date(editFormData.dob).getTime()).getUTCFullYear() - 1970)} বছর` : '০ বছর'}
                       </div>
                     </div>
                   </div>
                   <input type="text" placeholder="শ্রেণি (Class)" value={editFormData.class || ''} onChange={e=>setEditFormData({...editFormData, class:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bengali"/>
                   <input type="text" placeholder="পিতার নাম" value={editFormData.fatherName || ''} onChange={e=>setEditFormData({...editFormData, fatherName:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bengali"/>
                   <input type="text" placeholder="শিক্ষাপ্রতিষ্ঠান বা কর্মস্থলের নাম" value={editFormData.institution || ''} onChange={e=>setEditFormData({...editFormData, institution:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bengali"/>
                   <textarea placeholder="বর্তমান ঠিকানা" value={editFormData.address || ''} onChange={e=>setEditFormData({...editFormData, address:e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bengali h-20 resize-none"></textarea>
                </div>
              )}



              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isMonthlyDonor_edit" checked={!!editFormData.isMonthlyDonor} onChange={e=>setEditFormData({...editFormData, isMonthlyDonor:e.target.checked})} />
                  <label htmlFor="isMonthlyDonor_edit" className="text-sm font-bold font-bengali">ডোনার (মাসে)</label>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="hasGiftSubscription_edit" checked={!!editFormData.hasGiftSubscription} onChange={e=>setEditFormData({...editFormData, hasGiftSubscription:e.target.checked})} />
                    <label htmlFor="hasGiftSubscription_edit" className="text-sm font-bold text-indigo-600 font-bengali">ফ্রি সাবস্ক্রিপশন গিফট</label>
                  </div>
                  {editFormData.hasGiftSubscription && (
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-[10px] font-bold text-slate-500 font-bengali">সময়সীমা:</span>
                      <select 
                        value={editFormData.giftSubscriptionDuration || 0} 
                        onChange={e=>setEditFormData({...editFormData, giftSubscriptionDuration: Number(e.target.value)})}
                        className="text-[10px] border border-slate-200 p-1 rounded-lg bg-indigo-50 font-bengali font-bold"
                      >
                        <option value="0">বাছাই করুন</option>
                        <option value="1">১ মাস</option>
                        <option value="2">২ মাস</option>
                        <option value="3">৩ মাস</option>
                        <option value="6">৬ মাস</option>
                        <option value="12">১ বছর (১২ মাস)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="borrowBlocked_edit" checked={!!editFormData.borrowBlocked} onChange={e=>setEditFormData({...editFormData, borrowBlocked:e.target.checked})} />
                  <label htmlFor="borrowBlocked_edit" className="text-sm font-bold text-amber-600 font-bengali">ব্লকড</label>
                </div>
              </div>
              {editFormData.borrowBlocked && (
                <textarea 
                  placeholder="ব্লক করার কারণ (Reason for blocking)..." 
                  value={editFormData.blockedReason || ''} 
                  onChange={e=>setEditFormData({...editFormData, blockedReason:e.target.value})} 
                  className="w-full border border-slate-200 p-3 rounded-xl font-bengali text-sm"
                  rows={2}
                />
              )}
              {(editFormData.role === 'subadmin' || editFormData.role === 'visitor_admin') && (
                <div className="mt-4 p-4 border border-indigo-100 bg-indigo-50/50 rounded-2xl">
                  <h4 className="text-sm font-bold text-indigo-900 mb-3 font-bengali">{editFormData.role === 'subadmin' ? 'সাব-অ্যাডমিন এক্সেস' : 'ভিজিটর অ্যাডমিন এক্সেস'}</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableSubadminRoutes.map((route, idx) => (
                      <label key={idx} className="flex items-center gap-2 p-2 rounded relative bg-white border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50">
                        <input
                           type="checkbox"
                           checked={editFormData.subadminAccess?.includes(route.path)}
                           onChange={(e) => {
                              const checked = e.target.checked;
                              setEditFormData(prev => ({
                                  ...prev,
                                  subadminAccess: checked 
                                    ? [...(prev.subadminAccess || []), route.path]
                                    : (prev.subadminAccess || []).filter(p => p !== route.path)
                              }));
                           }}
                           className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700 font-bengali select-none">{route.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="sticky bottom-0 bg-white z-10 flex justify-end gap-3 py-6 border-t border-slate-50">
                <button type="button" disabled={loading} onClick={()=>setEditUser(null)} className="font-bengali px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-xl disabled:opacity-50">বাতিল</button>
                <button type="submit" disabled={loading} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold font-bengali disabled:opacity-50 flex items-center gap-2">
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  আপডেট
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {callConfirmUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl relative">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Phone size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 font-bengali text-center">সদস্যকে কল করুন</h3>
            <p className="text-sm font-bold text-slate-500 mb-6 font-bengali text-center">আপনি কি <span className="text-indigo-600">{callConfirmUser.name}</span> কে <span className="font-mono text-slate-700 bg-slate-100 px-1.5 rounded">{callConfirmUser.phone}</span> নাম্বারে কল করতে চান?</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setCallConfirmUser(null)}
                className="flex-1 py-3 rounded-xl font-bold font-bengali text-slate-500 border-2 border-slate-100 hover:bg-slate-50 transition-colors"
                disabled={callingUser}
              >
                বাতিল
              </button>
              <button 
                onClick={() => {
                  window.location.href = `tel:${callConfirmUser.phone}`;
                  setCallConfirmUser(null);
                }}
                disabled={callingUser}
                className="flex-1 py-3 rounded-xl font-bold font-bengali bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                Phone
              </button>
              <button 
                onClick={() => {
                  const iframe = document.createElement('iframe');
                  iframe.style.display = 'none';
                  iframe.src = `sip:${callConfirmUser.phone}`;
                  document.body.appendChild(iframe);
                  setTimeout(() => document.body.removeChild(iframe), 2000);
                  setCallConfirmUser(null);
                }}
                disabled={callingUser}
                className="flex-1 py-3 rounded-xl font-bold font-bengali bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                Zoiper
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
