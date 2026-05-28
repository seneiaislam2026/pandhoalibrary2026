import React, { useEffect, useState } from 'react';
import { ShieldAlert, Trash2, Check, User, Phone, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { onSnapshot, collection, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ResetRequest {
    id: string;
    userId: string;
    userName: string;
    username: string;
    phone: string;
    status: string;
    date: string;
    createdAt?: any;
}

export default function ManageResetRequests() {
    const [requests, setRequests] = useState<ResetRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "reset-requests"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResetRequest[]);
            setLoading(false);
        }, (err) => {
            console.error(err);
            // Fallback for docs without createdAt
            const unsub2 = onSnapshot(collection(db, "reset-requests"), (s) => {
                setRequests(s.docs.map(d => ({ id: d.id, ...d.data() })) as ResetRequest[]);
                setLoading(false);
            });
        });
        return () => unsubscribe();
    }, []);

    const deleteRequest = async (id: string) => {
        try {
            await deleteDoc(doc(db, "reset-requests", id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-amber-500" />
                    Password Reset Requests
                </h2>
                <p className="text-slate-500 font-medium mt-2">Manage users who forgot their passwords and requested a reset.</p>
            </div>

            <div className="grid gap-4">
                {loading ? <div className="p-20 text-center">Loading...</div> :
                 requests.length === 0 ? (
                     <div className="bg-white p-20 text-center border border-dashed border-slate-200 rounded-3xl">
                         <Check className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pending reset requests</p>
                     </div>
                 ) : (
                     requests.map(req => (
                         <motion.div layout key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                                    <User className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-slate-900">{req.userName} (@{req.username})</h4>
                                    <div className="flex items-center gap-4">
                                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                            <Phone className="w-3 h-3" /> {req.phone}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {new Date(req.date).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => deleteRequest(req.id)}
                                    className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700 transition shadow-lg shadow-emerald-50"
                                >
                                    Resolved
                                </button>
                                <button
                                    onClick={() => deleteRequest(req.id)}
                                    className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    title="Reject/Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                         </motion.div>
                     ))
                 )}
            </div>
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl text-amber-800 text-sm font-medium">
                <p>Note: Once you resolve a request, go to "Manage Members" and use the "Reset Password" button to set an initial password (e.g. 123456) for the user.</p>
            </div>
        </div>
    );
}
