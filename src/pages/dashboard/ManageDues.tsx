import React, { useEffect, useState } from "react";
import { useAuth } from "../../store/AuthContext";
import toast from 'react-hot-toast';
import { onSnapshot, collection, doc, query, where, updateDoc, deleteDoc, setDoc, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Select from "react-select";
import {
  Check,
  Search,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";

interface LibUser {
  id: string;
  name: string;
  username: string;
  memberId?: string;
  role: string;
  status: string;
  createdAt: string;
  hasGiftSubscription?: boolean;
  giftSubscriptionExpiry?: string | null;
}

interface Payment {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  month: string;
  trxId?: string;
  status: string; // Pending, Approved
  date: string;
}

export default function ManageDues() {
  const [users, setUsers] = useState<LibUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [trxSearch, setTrxSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const { user: currentUser } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [amount, setAmount] = useState(50);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    setLoading(true);
    
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as LibUser[];
      const filteredUsers = usersData.filter((u: any) => {
        if (u.role === "admin" || u.status !== "active") return false;
        if (u.hasGiftSubscription) {
          if (!u.giftSubscriptionExpiry || new Date(u.giftSubscriptionExpiry).getTime() > Date.now()) {
            return false; // Hide from Dues if gift subscription is active
          }
        }
        return true;
      });
      setUsers(filteredUsers);
      setLoading(false);
    });

    const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payment[];
      setPayments(paymentsData);
    });

    return () => {
      unsubUsers();
      unsubPayments();
    };
  }, []);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return toast.success("Select a user");

    try {
      const user = users.find((u) => u.id === selectedUserId);
      const newDocRef = doc(collection(db, "payments"));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        userId: selectedUserId,
        userName: user?.name,
        amount,
        month,
        status: "Approved",
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // Auto-add to finances
      const financeRef = doc(collection(db, 'finances'));
      const [year, mNum] = month.split('-');
      const monthsBn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
      const actualMonthTitle = monthsBn[parseInt(mNum) - 1];

      await setDoc(financeRef, {
        id: financeRef.id,
        type: 'income',
        amount: amount,
        description: `সদস্য ফি: ${user?.name || 'অজানা'} (${actualMonthTitle}, ${year})`,
        date: new Date().toISOString(),
        paymentId: newDocRef.id
      });

      setShowForm(false);
      setAmount(50);
      toast.success("পেমেন্ট সফলভাবে সংরক্ষণ করা হয়েছে।");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return;
    try {
      await deleteDoc(doc(db, "payments", id));
      // Delete from finances too
      const financeSnap = await getDocs(query(collection(db, 'finances'), where('paymentId', '==', id)));
      for (const doc of financeSnap.docs) {
        await deleteDoc(doc.ref);
      }
      toast.success("রেকর্ড ডিলিট করা হয়েছে।");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete record.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const { id, ...data } = editingPayment;
      await updateDoc(doc(db, "payments", id), data);
      setEditingPayment(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update payment");
    }
  };

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "payments", id), { status: "Approved" });
      
      // Auto-add to finances
      const p = payments.find(pay => pay.id === id);
      const user = users.find(u => u.id === p?.userId);
      if (p) {
        const financeRef = doc(collection(db, 'finances'));
        const [year, mNum] = p.month.split('-');
        const monthsBn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
        const actualMonthTitle = monthsBn[parseInt(mNum) - 1];

        await setDoc(financeRef, {
          id: financeRef.id,
          type: 'income',
          amount: p.amount,
          description: `সদস্য ফি: ${user?.name || 'অজানা'} (${actualMonthTitle}, ${year})`,
          date: new Date().toISOString(),
          paymentId: id
        });
      }
      toast.success("পেমেন্ট সফলভাবে এপ্রুভ করা হয়েছে।");
    } catch (error) {
      console.error("Error approving payment:", error);
      toast.error("এপ্রুভ করতে সমস্যা হয়েছে।");
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset ALL payment records? This cannot be undone.")) return;
    try {
      const q = query(collection(db, "payments"));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error resetting payments:", error);
      toast.error("Failed to reset records");
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.memberId || '').toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-bengali text-slate-900">
            সদস্যদের বকেয়া এবং ফি (Dues)
          </h2>
          <p className="text-sm text-slate-500 font-medium font-bengali mt-1">
            পাঠক এবং দাতা সদস্যদের মাসিক ফি এর ট্র্যাক রাখুন।
          </p>
        </div>
        {currentUser?.role !== 'visitor_admin' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-tight hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/20 transition-all font-bengali active:scale-95"
          >
            <Plus className="w-4 h-4" />
            পেমেন্ট যুক্ত করুন
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 font-bengali text-slate-800">নতুন পেমেন্ট রেকর্ড করুন</h3>
          <form
            onSubmit={handleAddPayment}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">
                সদস্য
              </label>
              <Select
                options={users.map(u => ({ value: u.id, label: `${u.name} [ID: #${u.memberId || 'N/A'}]` }))}
                onChange={(selected) => setSelectedUserId(selected?.value || "")}
                placeholder="সদস্য নির্বাচন করুন"
                isClearable
                isSearchable
                required
                className="text-sm font-medium font-bengali text-slate-700"
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '0.75rem',
                    padding: '0.25rem',
                    borderColor: '#e2e8f0',
                    boxShadow: 'none',
                    '&:hover': {
                      borderColor: '#cbd5e1'
                    }
                  })
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">
                মাস (YYYY-MM)
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">
                পরিমান (৳)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-700"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors font-bengali active:scale-95"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm hover:shadow-indigo-600/20 transition-all font-bengali active:scale-95"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#f8fafc]">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="সদস্যদের খুঁজুন..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bengali shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bengali font-medium">
            রেকর্ড লোড হচ্ছে...
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Desktop Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-5 bg-[#f8fafc] border-b border-slate-200">
              <div className="col-span-4 text-xs font-black text-[#64748B] uppercase tracking-widest font-sans">
                সদস্যের তথ্য
              </div>
              <div className="col-span-5 text-xs font-black text-[#64748B] uppercase tracking-widest text-center font-sans">
                সাম্প্রতিক পেমেন্টসমূহ
              </div>
              <div className="col-span-3 text-xs font-black text-[#64748B] uppercase tracking-widest text-right font-sans">
                সর্বমোট জমাকৃত
              </div>
            </div>

            <div className="divide-y divide-slate-100 flex flex-col">
              {filtered.map((user) => {
                const userPayments = payments
                  .filter((p) => p.userId === user.id)
                  .sort((a, b) => b.month.localeCompare(a.month));
                const total = userPayments.reduce(
                  (sum, p) => sum + Number(p.amount),
                  0,
                );

                return (
                  <div key={user.id} className="grid grid-cols-1 md:grid-cols-12 gap-y-4 gap-x-4 p-5 hover:bg-slate-50 transition-colors group items-center">
                    <div className="col-span-1 border-b md:border-b-0 pb-4 md:pb-0 border-slate-100 md:col-span-4">
                      <div className="font-bold text-[15px] font-bengali text-slate-800 mb-1.5 flex flex-wrap items-center gap-2">
                        {user.name}
                        {user.hasGiftSubscription && (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight w-fit font-bengali">সাবস্ক্রিপশন গিফট করা হয়েছে</span>
                            {user.giftSubscriptionExpiry && (
                              <span className="text-[10px] font-bold text-indigo-600 font-bengali">
                                {new Date(user.giftSubscriptionExpiry).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric', year: '2-digit' })} পর্যন্ত
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-slate-500 text-xs font-medium bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100 mt-2 sm:mt-0 w-fit sm:w-max">
                        <span className="font-bold text-slate-600">ID: #{user.memberId || 'N/A'}</span> • Joined{" "}
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-5 md:text-center">
                      <div className="flex flex-wrap gap-2 justify-start md:justify-center">
                        {userPayments.length === 0 && (
                          <span className="text-xs bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg font-bold font-bengali">
                            কোন পেমেন্ট নেই
                          </span>
                        )}
                        {userPayments.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 shadow-sm"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <div className="flex flex-col text-left">
                              <span>{new Date(p.month).toLocaleString('default', { month: 'short' })}</span>
                              <span>{p.month.split('-')[0]}</span>
                            </div>
                            <span className="ml-1 text-emerald-600 bg-emerald-100/50 px-1.5 rounded">(৳{p.amount})</span>
                          </span>
                        ))}
                        {userPayments.length > 3 && (
                          <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 shadow-sm">
                            +{userPayments.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3 text-left md:text-right font-black text-lg text-slate-800 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg border border-slate-100 md:border-transparent flex items-center justify-between md:block">
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded md:hidden">সর্বমোট জমাকৃত</span>
                      <span>৳{total}</span>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-medium font-bengali">
                  আপনার অনুসন্ধানের সাথে মিলে এমন কোনো সদস্য পাওয়া যায়নি।
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-5 border-b border-slate-100 bg-[#f8fafc] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-[15px] font-bengali text-slate-800">
            সকল পেমেন্ট রেকর্ড (Trx History)
          </span>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-4 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bengali text-slate-700 cursor-pointer shadow-sm"
            >
              <option value="All">সকল স্ট্যাটাস</option>
              <option value="Approved">পেইড (Approved)</option>
              <option value="Unpaid">আনপেইড</option>
              <option value="Pending">পেন্ডিং</option>
            </select>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ট্রানজেকশন, সদস্য অথবা মাস খুঁজুন..."
                value={trxSearch}
                onChange={(e) => setTrxSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bengali text-slate-700 shadow-sm"
              />
            </div>
            {currentUser?.role !== "visitor_admin" && (
              <button
                onClick={handleReset}
                className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white hover:shadow-md hover:shadow-rose-600/20 px-4 py-2.5 rounded-xl font-bold border border-rose-200 transition-all whitespace-nowrap active:scale-95 font-bengali"
              >
                রিসেট করুন
              </button>
            )}
          </div>
        </div>
        <div className="md:overflow-x-auto w-full">
          <table className="w-full text-left">
            <thead className="bg-[#f8fafc] border-b border-slate-200 hidden md:table-header-group">
              <tr>
                <th className="p-5 text-xs font-black tracking-widest text-[#64748B] uppercase">
                  সদস্য
                </th>
                <th className="p-5 text-xs font-black tracking-widest text-[#64748B] uppercase">
                  মাস
                </th>
                <th className="p-5 text-xs font-black tracking-widest text-[#64748B] uppercase">
                  পরিমান
                </th>
                <th className="p-5 text-xs font-black tracking-widest text-[#64748B] uppercase">
                  ট্রানজেকশন / স্ট্যাটাস
                </th>
                {currentUser?.role !== "visitor_admin" && (
                  <th className="p-5 text-xs font-black tracking-widest text-[#64748B] uppercase text-right">
                    অ্যাকশন
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y md:divide-slate-100 flex flex-col md:table-row-group">
              {payments
                .filter(
                  (p) =>
                    (p.userName?.toLowerCase() || "").includes(
                      trxSearch.toLowerCase(),
                    ) ||
                    (p.trxId?.toLowerCase() || "").includes(
                      trxSearch.toLowerCase(),
                    ) ||
                    (p.month?.toLowerCase() || "").includes(
                      trxSearch.toLowerCase(),
                    ),
                )
                .filter(
                  (p) =>
                    statusFilter === "All" ||
                    p.status === statusFilter ||
                    (statusFilter === "Paid (Approved)" &&
                      p.status === "Approved"),
                )
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
                .map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group flex flex-col md:table-row py-4 md:py-0 border-b border-slate-200 md:border-0 px-4 md:px-0">
                    <td className="p-2 md:p-5 flex justify-between items-center md:table-cell">
                      <span className="md:hidden font-black text-[10px] uppercase text-slate-500 font-bengali">সদস্য</span>
                      <div className="text-right md:text-left">
                        <div className="font-bold text-slate-800 text-[15px] font-bengali tracking-tight mb-1">
                          {p.userName || "Member"}
                        </div>
                        <div className="text-xs text-slate-500 font-medium font-sans">
                          {new Date(p.date).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 md:p-5 flex justify-between items-center md:table-cell border-t border-slate-50 md:border-0">
                       <span className="md:hidden font-black text-[10px] uppercase text-slate-500 font-bengali">মাস</span>
                       <div className="flex flex-col text-sm font-bold text-slate-800 text-right md:text-left">
                          <span>{new Date(p.month).toLocaleString('default', { month: 'short' })}</span>
                          <span>{p.month.split('-')[0]}</span>
                       </div>
                    </td>
                    <td className="p-2 md:p-5 flex justify-between items-center md:table-cell border-t border-slate-50 md:border-0 font-black text-lg text-emerald-600 tracking-tight">
                      <span className="md:hidden font-black text-[10px] uppercase text-slate-500 font-bengali">পরিমান</span>
                      <span>৳{p.amount}</span>
                    </td>
                    <td className="p-2 md:p-5 flex justify-between items-start md:items-center md:table-cell border-t border-slate-50 md:border-0">
                      <span className="md:hidden font-black text-[10px] uppercase text-slate-500 font-bengali pt-1">স্ট্যাটাস</span>
                      <div className="flex flex-col gap-2 items-end md:items-start text-right md:text-left">
                        <div className="flex flex-wrap justify-end md:justify-start items-center gap-1.5">
                          <span className="text-[10px] font-bold tracking-widest uppercase bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 w-fit">
                            {p.trxId || "CASH/ADMIN"}
                          </span>
                          {(p as any).paymentMethod && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                              {(p as any).paymentMethod}
                            </span>
                          )}
                        </div>
                        {(p as any).paymentNumber && (
                           <div className="text-xs text-indigo-600 font-bold bg-white px-2 py-1 rounded inline-block border border-indigo-100">Num: {(p as any).paymentNumber}</div>
                        )}
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg w-fit border ${p.status === "Approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : p.status === "Unpaid" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-amber-50 text-amber-600 animate-pulse border-amber-200"}`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </td>
                    {currentUser?.role !== "visitor_admin" && (
                      <td className="p-4 md:p-5 md:text-right align-middle border-t border-slate-100 md:border-0 mt-2 md:mt-0">
                        <div className="flex justify-center md:justify-end gap-2.5 relative z-0 group-hover:z-10">
                          {(p.status && p.status !== "Approved" && p.status !== "Paid" && p.status !== "Unpaid") && (
                            <button
                              type="button"
                              onClick={() => handleApprove(p.id)}
                              className="bg-emerald-500 text-white text-[10px] px-3.5 py-2 font-black uppercase tracking-wider rounded-lg shadow-sm shadow-emerald-500/20 hover:bg-emerald-600 transition flex items-center gap-1.5 active:scale-95 flex-1 md:flex-none justify-center"
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingPayment(p)}
                            className="bg-white text-indigo-600 border border-indigo-200 text-[10px] px-4 py-2.5 font-black uppercase tracking-wider rounded-lg shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center active:scale-95 flex-1 md:flex-none"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2.5 rounded-lg hover:bg-rose-600 hover:text-white hover:border-rose-600 transition flex items-center justify-center shadow-sm active:scale-95 flex-1 md:flex-none"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              {payments.length === 0 && (
                <tr className="flex md:table-row">
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium font-bengali w-full">
                    কোনো পেমেন্ট হিস্ট্রি নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold mb-5 font-bengali text-slate-800">পেমেন্ট এডিট করুন</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">
                  পরিমান (৳)
                </label>
                <input
                  type="number"
                  value={editingPayment.amount ?? ''}
                  onChange={(e) =>
                    setEditingPayment({
                      ...editingPayment,
                      amount: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">
                  স্ট্যাটাস
                </label>
                <select
                  value={editingPayment.status || 'Pending'}
                  onChange={(e) =>
                    setEditingPayment({
                      ...editingPayment,
                      status: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-700"
                  required
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={
                    editingPayment.date ? new Date(editingPayment.date).toISOString().split("T")[0] : ''
                  }
                  onChange={(e) =>
                    setEditingPayment({
                      ...editingPayment,
                      date: new Date(e.target.value).toISOString(),
                    })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-700"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors font-bengali active:scale-95"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm hover:shadow-indigo-600/20 transition-all font-bengali active:scale-95"
                >
                  সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
