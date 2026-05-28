import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { onSnapshot, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Clock, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PreBooking {
  id: string;
  userId: string;
  userName: string;
  bookId: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  date: string;
  adminNote?: string;
  collectDate?: string;
}

export default function ManagePreBookings() {
  const [bookings, setBookings] = useState<PreBooking[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ adminNote: '', collectDate: '' });
  const { user } = useAuth();

  useEffect(() => {
    const unsubBookings = onSnapshot(collection(db, "pre-bookings"), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PreBooking[]);
    }, (error) => {
      console.error("ManagePreBookings bookings error:", error);
    });
    const unsubBooks = onSnapshot(collection(db, "books"), (snapshot) => {
      setBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl })));
    }, (error) => {
      console.error("ManagePreBookings books error:", error);
    });

    return () => {
      unsubBookings();
      unsubBooks();
    };
  }, []);

  const handleUpdateNotes = async (id: string) => {
    try {
      await updateDoc(doc(db, "pre-bookings", id), editData);
      setEditId(null);
      toast.success('Notes updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update notes');
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "pre-bookings", id), { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this pre-booking record?')) return;
    try {
      await deleteDoc(doc(db, "pre-bookings", id));
    } catch (err) {
      console.error(err);
      toast.error('Error deleting record');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight font-bengali">প্রিবুকিং রিকোয়েস্ট</h2>
          <p className="text-slate-500 font-medium mt-2 font-bengali">সদস্যদের প্রিবুকিং রিকোয়েস্ট পর্যালোচনা এবং পরিচালনা করুন।</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col">
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-5 bg-[#f8fafc] border-b border-slate-200">
            <div className="col-span-3 text-[11px] font-black tracking-widest text-[#64748B] uppercase font-bengali">সদস্য</div>
            <div className="col-span-3 text-[11px] font-black tracking-widest text-[#64748B] uppercase font-bengali">বই</div>
            <div className="col-span-2 text-[11px] font-black tracking-widest text-[#64748B] uppercase font-bengali">অনুরোধের তারিখ</div>
            <div className="col-span-2 text-[11px] font-black tracking-widest text-[#64748B] uppercase font-bengali">স্ট্যাটাস</div>
            <div className="col-span-2 text-[11px] font-black tracking-widest text-[#64748B] uppercase font-bengali text-right">অ্যাকশন</div>
          </div>
          
          <div className="divide-y divide-slate-100 flex flex-col">
              {bookings.map(b => {
                const book = books.find(bk => String(bk.id) === String(b.bookId));
                return (
                  <div key={b.id} className="grid grid-cols-1 md:grid-cols-12 gap-y-4 gap-x-4 p-5 hover:bg-slate-50 transition-colors group items-start md:items-center">
                    
                    <div className="col-span-1 border-b md:border-b-0 pb-4 md:pb-0 border-slate-100 md:col-span-3 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 mb-1 px-2 py-0.5 rounded md:hidden w-fit">সদস্য</span>
                            <div className="font-bold text-slate-900 font-bengali text-lg">{b.userName}</div>
                            <div className="text-[11px] font-bold text-slate-500 bg-slate-100 mt-1 px-2.5 py-1 rounded-md inline-flex font-mono tracking-widest border border-slate-200 uppercase w-fit">ID: {b.userId?.substring(0, 3)}</div>
                        </div>
                    </div>
                    
                    <div className="col-span-1 border-b md:border-b-0 pb-4 md:pb-0 border-slate-100 md:col-span-3 flex flex-col">
                         <span className="text-xs font-bold text-slate-500 bg-slate-100 mb-1 px-2 py-0.5 rounded md:hidden w-fit">বই</span>
                         <div className="font-bold text-slate-800 font-bengali text-base">{book?.title || 'অজানা বই'}</div>
                         <div className="mt-1.5 flex flex-wrap items-center gap-2">
                             <span className="text-[11px] font-mono text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 tracking-widest uppercase">
                             কোড: {book?.bookCode || 'N/A'}
                             </span>
                         </div>
                         {b.adminNote && (
                            <div className="mt-2 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md inline-block border border-emerald-100 font-bengali w-fit">
                                মেসেজ: {b.adminNote}
                            </div>
                         )}
                         {b.collectDate && (
                            <div className="mt-2 text-[11px] text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-md inline-block border border-blue-100 font-bengali block mt-1 w-fit">
                                সংগ্রহের তারিখ: {b.collectDate}
                            </div>
                         )}
                    </div>

                    <div className="col-span-1 border-b md:border-b-0 pb-4 md:pb-0 border-slate-100 md:col-span-2 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start text-sm font-bold text-slate-500 font-mono">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded md:hidden font-bengali">অনুরোধের তারিখ</span>
                        <span>{b.date ? (typeof b.date === 'string' ? new Date(b.date) : (b.date as any).toDate?.() || new Date((b.date as any).seconds * 1000)).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</span>
                    </div>

                    <div className="col-span-1 border-b md:border-b-0 pb-4 md:pb-0 border-slate-100 md:col-span-2 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded md:hidden">স্ট্যাটাস</span>
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border ${
                            b.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' :
                            b.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm' :
                            'bg-amber-50 text-amber-600 border-amber-200 animate-pulse shadow-sm'
                        }`}>
                            {b.status === 'Completed' ? 'সম্পন্ন' : b.status === 'Cancelled' ? 'বাতিল' : 'অপেক্ষমান'}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 md:col-span-2 pt-2 md:pt-0">
                        <div className="flex flex-col md:items-end gap-2.5 relative">
                        <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 w-full">
                            {b.status === 'Pending' && (
                            <>
                                <button 
                                onClick={() => handleStatus(b.id, 'Completed')}
                                className="flex-1 md:flex-none px-3 py-2 transition-all rounded-xl font-bold font-bengali text-[12px] flex items-center justify-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white ring-1 ring-emerald-200/60 shadow-sm"
                                title="সম্পন্ন করুন"
                                >
                                <Check className="w-3.5 h-3.5" /> <span className="md:hidden xl:inline">অনুমোদন</span>
                                </button>
                                <button 
                                onClick={() => handleStatus(b.id, 'Cancelled')}
                                className="flex-1 md:flex-none px-3 py-2 transition-all rounded-xl font-bold font-bengali text-[12px] flex items-center justify-center gap-1.5 text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white ring-1 ring-rose-200/60 shadow-sm"
                                title="বাতিল করুন"
                                >
                                <X className="w-3.5 h-3.5" /> <span className="md:hidden xl:inline">বাতিল</span>
                                </button>
                            </>
                            )}
                            <button 
                                onClick={() => {
                                    setEditId(b.id);
                                    setEditData({ adminNote: b.adminNote || '', collectDate: b.collectDate || '' });
                                }}
                                className="flex-1 md:flex-none px-3 py-2 text-slate-600 bg-slate-50 hover:bg-slate-800 hover:text-white rounded-xl transition-colors ring-1 ring-slate-200/60 shadow-sm font-bengali font-bold text-[12px] flex items-center justify-center gap-1.5"
                                title="এডিট তারিখ/নোট"
                            >
                                <Clock className="w-3.5 h-3.5" /> <span className="md:hidden lg:inline">নোট</span>
                            </button>
                            <button 
                               onClick={() => handleDelete(b.id)}
                               className="flex-1 md:flex-none px-3 py-2 text-rose-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-colors ring-1 ring-red-200/50 shadow-sm flex items-center justify-center gap-1.5 font-bengali font-bold text-[12px]"
                               title="ডিলিট করুন"
                            >
                               <Trash2 className="w-3.5 h-3.5" /> <span className="md:hidden lg:inline">ডিলিট</span>
                            </button>
                        </div>
                        {editId === b.id && (
                           <div className="mt-2 p-4 bg-white border border-slate-200 rounded-2xl space-y-3 w-full md:w-72 text-left shadow-xl md:scale-95 origin-top md:origin-top-right transition-all z-10 md:absolute md:top-full md:right-0">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 font-bengali">অ্যাডমিন মেসেজ</label>
                                <input 
                                  type="text" 
                                  placeholder="যেমন: বইটি সংগ্রহ করুন"
                                  className="w-full p-2.5 text-sm font-bengali font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                  value={editData.adminNote}
                                  onChange={e => setEditData({...editData, adminNote: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 font-bengali">সংগ্রহের সম্ভাব্য তারিখ</label>
                                <input 
                                  type="text" 
                                  placeholder="যেমন: ৩০ এপ্রিল"
                                  className="w-full p-2.5 text-sm font-bengali font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                  value={editData.collectDate}
                                  onChange={e => setEditData({...editData, collectDate: e.target.value})}
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button onClick={() => handleUpdateNotes(b.id)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-bold font-bengali transition-colors shadow-sm">সেভ করুন</button>
                                <button onClick={() => setEditId(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-xl text-sm font-bold font-bengali transition-colors border border-slate-200">বাতিল</button>
                              </div>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        {bookings.length === 0 && (
          <div className="p-16 text-center bg-[#f8fafc] text-slate-400 font-bold font-bengali text-lg flex flex-col items-center gap-4">
              <span className="bg-white p-4 rounded-full shadow-sm border border-slate-200/50">
                 <Clock className="w-8 h-8 text-slate-300" />
              </span>
              কোনো রিকোয়েস্ট পাওয়া যায়নি।
          </div>
        )}
      </div>
    </div>
  );
}
