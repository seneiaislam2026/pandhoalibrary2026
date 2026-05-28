import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Search, Plus, Trash2, Edit2, FileDown, Eye, X, ArrowRight, DollarSign, CheckCircle, Phone, GraduationCap, Clock, AlertCircle } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, updateDoc, query, orderBy, serverTimestamp, onSnapshot, where, getDocs, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface ScholarshipRecipient {
  id: string;
  name: string;
  phone: string;
  fatherName?: string;
  institution?: string;
  class?: string;
  bloodGroup?: string;
  address?: string;
  role: 'scholarship';
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  applicationId?: string | number;
  memberId?: string;
  scholarshipAmount?: number;
  startDate?: string;
  lastPaymentDate?: string;
  totalPaid?: number;
  notes?: string;
  createdAt: any;
}

export default function ManageScholarships() {
  const { user } = useAuth();
  const isAdminRole = user?.role === 'admin';

  const [recipients, setRecipients] = useState<ScholarshipRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_hold' | 'completed'>('all');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<ScholarshipRecipient | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    status: 'active' as any,
    scholarshipAmount: 0,
    notes: '',
    institution: '',
    class: '',
    memberId: ''
  });

  const [selectedRecipient, setSelectedRecipient] = useState<ScholarshipRecipient | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'scholarship')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScholarshipRecipient[];
      
      setRecipients(docs.sort((a, b) => {
          const idA = (a.memberId || '').toString();
          const idB = (b.memberId || '').toString();
          return idA.localeCompare(idB);
      }));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipient) return;

    try {
      const toastId = toast.loading('আপডেট করা হচ্ছে...');
      const ref = doc(db, 'users', editingRecipient.id);
      await updateDoc(ref, {
        ...editFormData,
        updatedAt: serverTimestamp()
      });
      toast.success('সফলভাবে আপডেট করা হয়েছে!', { id: toastId });
      setShowEditModal(false);
    } catch (err) {
      toast.error('আপডেট করতে সমস্যা হয়েছে।');
      console.error(err);
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই সদস্যকে ডিলিট করতে চান? এটি চিরতরে মুছে যাবে।')) return;

    try {
      const toastId = toast.loading('ডিলিট করা হচ্ছে...');
      await deleteDoc(doc(db, 'users', id));
      toast.success('সফলভাবে ডিলিট করা হয়েছে!', { id: toastId });
    } catch (err) {
      toast.error('ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

  const filteredRecipients = recipients.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(search.toLowerCase()) || 
      r.phone.includes(search) || 
      (r.memberId || '').toString().includes(search);
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && r.status === statusFilter;
  });

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black font-bengali text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <GraduationCap size={32} />
            </div>
            বৃত্তি সদস্য ব্যবস্থাপনা
          </h1>
          <p className="text-slate-500 font-medium font-bengali mt-3 text-lg">বৃত্তির সদস্যদের তথ্য, ফান্ড এবং স্ট্যাটাস পরিচালনা করুন।</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="নাম, আইডি বা মোবাইল নম্বর দিয়ে খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bengali"
              />
            </div>
         <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'on_hold', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2 rounded-xl font-bold font-bengali text-sm transition-all flex-1 sm:flex-none text-center ${
                    statusFilter === s 
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s === 'all' ? 'সব' : s === 'active' ? 'সক্রিয়' : s === 'on_hold' ? 'স্থগিত' : 'সম্পন্ন'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bengali">অপেক্ষা করুন...</div>
          ) : filteredRecipients.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bengali">কোনো সদস্য পাওয়া যায়নি।</div>
          ) : (
            filteredRecipients.map((r, index) => (
              <div key={r.id} className="p-4 sm:p-5 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/20 shrink-0">
                      {r.memberId ? r.memberId.toString().slice(-2) : (index + 1).toString().padStart(2, '0')}
                    </div>
                    <div>
                      <div className="font-black text-slate-800 text-[17px] font-bengali leading-tight mb-1.5">{r.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-100 font-sans">ID: {r.memberId || 'N/A'}</span>
                        {r.applicationId && <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest border border-slate-200 font-sans">App: {r.applicationId}</span>}
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase shrink-0 border ${
                    r.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-500/10' :
                    r.status === 'on_hold' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-500/10' :
                    r.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm shadow-blue-500/10' :
                    'bg-rose-50 text-rose-700 border-rose-200 shadow-sm shadow-rose-500/10'
                  }`}>
                    {r.status === 'active' ? 'সক্রিয়' : r.status === 'on_hold' ? 'স্থগিত' : r.status === 'completed' ? 'সম্পন্ন' : 'বাতিল'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 text-sm mb-5 bg-slate-50 rounded-2xl border border-slate-100/60 overflow-hidden shadow-sm">
                  <div className="p-3.5 border-r border-b border-slate-100/60 flex items-start gap-2.5 bg-white/50">
                    <div className="p-1.5 bg-sky-50 text-sky-500 rounded-lg shrink-0">
                      <Phone size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-bengali mb-0.5">মোবাইল</div>
                      <div className="font-bold text-slate-700 font-sans">{r.phone}</div>
                    </div>
                  </div>
                  <div className="p-3.5 border-b border-slate-100/60 flex items-start gap-2.5 bg-white/50">
                    <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg shrink-0">
                      <DollarSign size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-bengali mb-0.5">বৃত্তি পরিমাণ</div>
                      <div className="font-black text-emerald-600 font-sans">৳{r.scholarshipAmount || 0}</div>
                    </div>
                  </div>
                  <div className="p-3.5 col-span-2 flex items-start gap-2.5">
                    <div className="p-1.5 bg-violet-50 text-violet-500 rounded-lg shrink-0">
                      <GraduationCap size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-bengali mb-0.5">ইনস্টিটিউট ও ক্লাস</div>
                      <div className="font-bold text-slate-700 font-bengali leading-snug">{r.institution || '---'}, {r.class || '---'}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedRecipient(r)} className="flex-1 py-2.5 text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 rounded-xl transition-all text-xs font-bold font-bengali flex items-center justify-center gap-1.5 border border-indigo-100 hover:shadow-sm hover:shadow-indigo-500/10">
                    <Eye size={16} /> দেখুন
                  </button>
                  <button onClick={() => {
                    setEditingRecipient(r);
                    setEditFormData({
                      name: r.name,
                      phone: r.phone,
                      status: r.status,
                      scholarshipAmount: r.scholarshipAmount || 0,
                      notes: r.notes || '',
                      institution: r.institution || '',
                      class: r.class || '',
                      memberId: r.memberId || ''
                    });
                    setShowEditModal(true);
                  }} className="flex-1 py-2.5 text-emerald-600 bg-emerald-50/80 hover:bg-emerald-100 rounded-xl transition-all text-xs font-bold font-bengali flex items-center justify-center gap-1.5 border border-emerald-100 hover:shadow-sm hover:shadow-emerald-500/10">
                    <Edit2 size={16} /> এডিট
                  </button>
                  {isAdminRole && (
                    <button onClick={() => handleDeleteRecipient(r.id)} className="flex-1 py-2.5 text-rose-600 bg-rose-50/80 hover:bg-rose-100 rounded-xl transition-all text-xs font-bold font-bengali flex items-center justify-center gap-1.5 border border-rose-100 hover:shadow-sm hover:shadow-rose-500/10">
                      <Trash2 size={16} /> ডিলিট
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left border-b border-slate-100">
                <th className="p-5 font-black text-slate-600 text-sm font-bengali whitespace-nowrap">আইডি ও নাম</th>
                <th className="p-5 font-black text-slate-600 text-sm font-bengali whitespace-nowrap text-center">ইনস্টিটিউট ও ক্লাস</th>
                <th className="p-5 font-black text-slate-600 text-sm font-bengali whitespace-nowrap text-center">মোবাইল</th>
                <th className="p-5 font-black text-slate-600 text-sm font-bengali whitespace-nowrap text-center">বৃত্তি পরিমাণ</th>
                <th className="p-5 font-black text-slate-600 text-sm font-bengali whitespace-nowrap text-center">স্ট্যাটাস</th>
                <th className="p-5 font-black text-slate-600 text-sm font-bengali whitespace-nowrap text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-bengali">অপেক্ষা করুন...</td>
                </tr>
              ) : filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-bengali">কোনো সদস্য পাওয়া যায়নি।</td>
                </tr>
              ) : (
                filteredRecipients.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold font-sans">
                          {r.memberId?.toString().slice(-2) || 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 font-bengali">#{r.memberId} - {r.name}</div>
                          <div className="text-xs text-slate-400 font-sans">{r.applicationId ? `App ID: ${r.applicationId}` : 'Manual Entry'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                       <div className="text-center">
                          <div className="font-bold text-slate-700 font-bengali text-sm">{r.institution || '---'}</div>
                          <div className="text-xs text-slate-400 font-bengali">{r.class || '---'}</div>
                       </div>
                    </td>
                    <td className="p-5 font-sans text-center text-slate-600 font-bold">{r.phone}</td>
                    <td className="p-5 font-sans text-center">
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold text-sm">
                        ৳{r.scholarshipAmount || 0}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold font-bengali ${
                        r.status === 'active' ? 'bg-green-100 text-green-700' :
                        r.status === 'on_hold' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.status === 'active' ? 'সক্রিয়' : r.status === 'on_hold' ? 'স্থগিত' : r.status === 'completed' ? 'সম্পন্ন' : 'বাতিল'}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedRecipient(r)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                          >
                             <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingRecipient(r);
                              setEditFormData({
                                name: r.name,
                                phone: r.phone,
                                status: r.status,
                                scholarshipAmount: r.scholarshipAmount || 0,
                                notes: r.notes || '',
                                institution: r.institution || '',
                                class: r.class || '',
                                memberId: r.memberId || ''
                              });
                              setShowEditModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all"
                          >
                             <Edit2 size={18} />
                          </button>
                          {isAdminRole && (
                            <button 
                              onClick={() => handleDeleteRecipient(r.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                            >
                               <Trash2 size={18} />
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      <AnimatePresence>
        {selectedRecipient && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedRecipient(null)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
             >
                <div className="bg-emerald-600 p-8 text-white relative">
                   <button 
                     onClick={() => setSelectedRecipient(null)}
                     className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                   >
                     <X size={20} />
                   </button>
                   <div className="flex items-end gap-6">
                      <div className="w-24 h-24 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center text-4xl border border-white/30">
                        🎓
                      </div>
                      <div className="mb-2">
                         <div className="text-sm font-bold text-white/70 font-sans uppercase tracking-widest">Scholarship Recipient</div>
                         <h3 className="text-2xl font-black font-bengali leading-tight">{selectedRecipient.name}</h3>
                      </div>
                   </div>
                </div>

                <div className="p-8 space-y-6">
                   <div className="grid grid-cols-2 gap-6">
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">ID Number</label>
                         <div className="font-black text-slate-800 font-sans">#{selectedRecipient.memberId}</div>
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                           selectedRecipient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                         }`}>
                           {selectedRecipient.status}
                         </span>
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Institution</label>
                         <div className="font-bold text-slate-800 font-bengali">{selectedRecipient.institution || '---'}</div>
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Class</label>
                         <div className="font-bold text-slate-800 font-bengali">{selectedRecipient.class || '---'}</div>
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mobile</label>
                         <div className="font-bold text-slate-800 font-sans">{selectedRecipient.phone}</div>
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Monthly Amount</label>
                         <div className="font-black text-emerald-600 font-sans">৳{selectedRecipient.scholarshipAmount || 0}</div>
                      </div>
                   </div>

                   {selectedRecipient.notes && (
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <label className="text-xs font-bold text-slate-400 mb-2 block">Admin Notes</label>
                        <p className="text-sm text-slate-600 font-bengali leading-relaxed">{selectedRecipient.notes}</p>
                     </div>
                   )}

                   <div className="flex gap-3 pt-2">
                      <a 
                        href={`tel:${selectedRecipient.phone}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold font-bengali hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                      >
                         <Phone size={18} />
                         কল করুন
                      </a>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowEditModal(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
             >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                   <h3 className="text-xl font-black font-bengali text-slate-800">বৃত্তি সদস্য তথ্য আপডেট</h3>
                   <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                     <X size={20} />
                   </button>
                </div>
                <form onSubmit={handleUpdateRecipient} className="p-6 space-y-5">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">সদস্যের নাম</label>
                         <input
                           type="text"
                           value={editFormData.name}
                           onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">সদস্য আইডি</label>
                         <input
                           type="text"
                           value={editFormData.memberId}
                           onChange={e => setEditFormData({...editFormData, memberId: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">মোবাইল নম্বর</label>
                         <input
                           type="text"
                           value={editFormData.phone}
                           onChange={e => setEditFormData({...editFormData, phone: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">বৃত্তি স্ট্যাটাস</label>
                         <select
                           value={editFormData.status}
                           onChange={e => setEditFormData({...editFormData, status: e.target.value as any})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali"
                         >
                           <option value="active">সক্রিয় (Active)</option>
                           <option value="on_hold">স্থগিত (On Hold)</option>
                           <option value="completed">সম্পন্ন (Completed)</option>
                           <option value="cancelled">বাতিল (Cancelled)</option>
                         </select>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">বৃত্তি পরিমাণ (মাসিক/এককালীন)</label>
                         <input
                           type="number"
                           value={editFormData.scholarshipAmount}
                           onChange={e => setEditFormData({...editFormData, scholarshipAmount: parseInt(e.target.value) || 0})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">শ্রেণি</label>
                         <input
                           type="text"
                           value={editFormData.class}
                           onChange={e => setEditFormData({...editFormData, class: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">শিক্ষাপ্রতিষ্ঠান</label>
                      <input
                        type="text"
                        value={editFormData.institution}
                        onChange={e => setEditFormData({...editFormData, institution: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali"
                      />
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 font-bengali">অতিরিক্ত নোট</label>
                      <textarea
                        value={editFormData.notes}
                        onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali h-24 resize-none"
                      ></textarea>
                   </div>

                   <div className="pt-4 flex gap-4">
                      <button 
                         type="button"
                         onClick={() => setShowEditModal(false)}
                         className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold font-bengali hover:bg-slate-200"
                      >
                         বাতিল
                      </button>
                      <button 
                         type="submit"
                         className="flex-[2] px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold font-bengali shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                      >
                         আপডেট সেভ করুন
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
