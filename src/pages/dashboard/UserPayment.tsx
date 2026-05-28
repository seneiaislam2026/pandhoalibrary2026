import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { CreditCard, AlertCircle, ShieldAlert } from 'lucide-react';
import { onSnapshot, collection, doc, query, where, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

export default function UserPayment() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [dues, setDues] = useState<any[]>([]);
  const [payFormData, setPayFormData] = useState({ month: '', amount: '30', paymentMethod: 'online', paymentNumber: '', trxId: '' });
  const [payLoading, setPayLoading] = useState(false);

  const isSubscriptionGiftedAndActive = user?.hasGiftSubscription && (!user.giftSubscriptionExpiry || new Date(user.giftSubscriptionExpiry).getTime() > Date.now());
  const totalPaid = payments.filter((p:any) => p.status === 'Approved' || p.status === 'Paid' || !p.status).reduce((acc, p) => acc + Number(p.amount), 0);
  const totalDues = isSubscriptionGiftedAndActive ? 0 : dues.filter(d => d.userId === user?.id && d.status === 'Unpaid').reduce((acc, d) => acc + Number(d.amount), 0);

  useEffect(() => {
    if (!user) return;

    const qPay = query(collection(db, "payments"), where("userId", "==", user.id));
    const qDues = query(collection(db, "dues"), where("userId", "==", user.id));

    const unsubPay = onSnapshot(qPay, (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDues = onSnapshot(qDues, (snap) => {
      setDues(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPay();
      unsubDues();
    };
  }, [user]);

  const handleBkashCheckout = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!payFormData.month || !payFormData.amount) {
          toast.error('দয়া করে মাস এবং পরিমাণ প্রদান করুন');
          return;
      }
      
      if (payFormData.paymentMethod === 'online' && !payFormData.trxId) {
          toast.error('দয়া করে আপনার TrxID প্রদান করুন');
          return;
      }

      setPayLoading(true);
      try {
          const newPaymentRef = doc(collection(db, "payments"));
          await setDoc(newPaymentRef, {
            ...payFormData,
            userId: user?.id,
            userName: user?.name,
            status: payFormData.paymentMethod === 'library' ? 'Pending' : 'Pending Verification',
            date: new Date().toISOString(),
            type: 'monthly',
            createdAt: serverTimestamp()
          });
          
          toast.success('পেমেন্ট সফলভাবে জমা দেওয়া হয়েছে! ভেরিফিকেশনের জন্য অপেক্ষা করুন।');
          setPayFormData({ month: '', amount: '30', paymentMethod: 'online', paymentNumber: '', trxId: '' });
      } catch (err) {
          console.error(err);
          toast.error('পেমেন্টে সমস্যা হয়েছে');
      } finally {
          setPayLoading(false);
      }
  };

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const bengaliMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const currentYear = new Date().getFullYear();

  const monthOptions = months.map((m, index) => ({
    value: `${m} ${currentYear}`,
    label: `${bengaliMonths[index]} ${currentYear}`
  }));

  if (user?.role === 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-800 font-bengali">অ্যাডমিন প্রোফাইলে পেমেন্ট অপশন নেই</h2>
        <p className="text-slate-500 font-bengali">কর্তৃপক্ষ হিসেবে আপনার কোনো মাসিক ফি প্রদান করার প্রয়োজন নেই।</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 font-bengali">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-pink-100/50 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-50 rounded-full -ml-16 -mb-16 blur-3xl opacity-50"></div>
        
        <div className="flex items-center gap-4 mb-8 border-b border-slate-50 pb-6 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-pink-200">
            <CreditCard className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 font-bengali">
               মাসিক ফি প্রদান করুন
            </h3>
            <p className="text-slate-500 font-medium font-bengali text-sm">আপনার মাসিক মেম্বারশিপ ফি সহজে পরিশোধ করুন</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 relative z-10">
           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট বকেয়া</p>
              <p className="text-3xl font-black text-rose-600">৳{totalDues}</p>
           </div>
           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট জমা</p>
              <p className="text-3xl font-black text-emerald-600">৳{totalPaid}</p>
           </div>
        </div>

        <form onSubmit={handleBkashCheckout} className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide ml-1">মাস বাছাই করুন</label>
              <select 
                value={payFormData.month}
                onChange={e => setPayFormData({...payFormData, month: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-pink-500 font-bengali text-slate-700 font-bold transition-all"
                required
              >
                <option value="" disabled>চিহ্নিত করুন</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide ml-1">পরিমাণ (৳)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black">৳</span>
                </div>
                <input 
                    type="number" 
                    min="0"
                    placeholder="পরিমাণ"
                    value={isSubscriptionGiftedAndActive ? '0' : payFormData.amount}
                    disabled={!!isSubscriptionGiftedAndActive}
                    onChange={e => setPayFormData({...payFormData, amount: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-pink-500 font-black text-slate-900 transition-all disabled:bg-indigo-50"
                    required
                />
              </div>
            </div>
          </div>

          {isSubscriptionGiftedAndActive && (
            <div className="flex items-center gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
              <p className="text-xs font-bold text-indigo-700 font-bengali">
                আপনার জন্য সাবস্ক্রিপশন ফি ফ্রি! আপনাকে কোনো টাকা দিতে হবে না।
              </p>
            </div>
          )}

          <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-6 space-y-6">
              <div className="flex items-center justify-between bg-white border border-pink-100 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-pink-50 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <p className="text-[10px] text-pink-500 uppercase tracking-widest font-black font-bengali mb-1.5">বিকাশ পেমেন্ট নাম্বার</p>
                  <div className="font-mono text-2xl font-black text-slate-800 tracking-tight">01570206953</div>
                </div>
                <div className="flex flex-col items-center relative z-10">
                   <div className="bg-pink-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md shadow-pink-200">বিকাশ</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 font-bengali">আপনার নম্বর</label>
                    <input
                      type="text"
                      required
                      value={payFormData.paymentNumber}
                      onChange={e => setPayFormData({...payFormData, paymentNumber: e.target.value})}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500 font-mono shadow-sm transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 font-bengali">TrxID (ট্রানজ্যাকশন আইডি)</label>
                    <input
                      type="text"
                      required
                      value={payFormData.trxId}
                      onChange={e => setPayFormData({...payFormData, trxId: e.target.value})}
                      placeholder="8NXXXXXXX"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500 font-mono uppercase shadow-sm transition-all"
                    />
                </div>
              </div>
          </div>

          <button 
              type="submit" 
              disabled={payLoading}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-[15px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 font-bengali mt-4 active:scale-95 disabled:opacity-70"
          >
              {payLoading ? 'প্রক্রিয়াধীন...' : <><CreditCard className="w-5 h-5 translate-y-[-1px]" /> পেমেন্ট কনফার্ম করুন</>}
          </button>
        </form>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-xl font-black tracking-tight text-slate-900 mb-6 flex items-center gap-3 font-bengali">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
               <ShieldAlert className="w-4 h-4" />
            </div>
            পেমেন্ট হিস্ট্রি
        </h3>
        {payments.length === 0 ? (
          <div className="py-20 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-bengali">
            এখনো কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
              {payments.sort((a,b) => b.month.localeCompare(a.month)).map(p => (
              <div key={p.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition rounded-2xl border border-slate-100 group">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {p.month.substring(0,3)}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-lg">{p.month}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400 font-mono uppercase">{new Date(p.date || p.createdAt?.toDate?.() || new Date()).toLocaleDateString()}</p>
                          {(p.status && p.status !== 'Approved' && p.status !== 'Paid') && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                              {p.status}
                            </span>
                          )}
                        </div>
                      </div>
                  </div>
                  <div className={`text-xl font-black ${(p.status && p.status !== 'Approved' && p.status !== 'Paid') ? 'text-slate-400' : 'text-emerald-600'}`}>৳{p.amount}</div>
              </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
