import React, { useEffect, useState } from 'react';
import { onSnapshot, collection, doc, updateDoc, query, orderBy, serverTimestamp, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Truck, Package, Clock, CheckCircle2, XCircle, Search, Calendar, Phone, MapPin, User, DollarSign, Printer, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  totalPrice: number;
  subTotal?: number;
  deliveryCharge?: number;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipping' | 'Delivered' | 'Cancelled' | 'Pre-booked';
  deliveryType: 'COD' | 'LibraryPickup';
  expectedDeliveryDate?: string;
  createdAt: any;
}

export default function ManageShopOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'shop-orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Deduct stock if moving to a "Confirmed" or later status and not already deducted
      const shouldDeduct = ['Confirmed', 'Processing', 'Shipping', 'Delivered'].includes(newStatus);
      const wasDeducted = (order as any).stockDeducted === true;

      if (shouldDeduct && !wasDeducted) {
        for (const item of order.items) {
          const bookRef = doc(db, 'shop-books', item.id);
          // Check if it's a normal book (not pre-order only)
          const bookSnap = await getDoc(bookRef);
          if (bookSnap.exists()) {
             await updateDoc(bookRef, {
               stock: increment(-item.quantity)
             });
          }
        }
        await updateDoc(doc(db, 'shop-orders', orderId), { 
          status: newStatus,
          stockDeducted: true 
        });
      } else {
        await updateDoc(doc(db, 'shop-orders', orderId), { status: newStatus });
      }
      
      toast.success('অর্ডার স্ট্যাটাস আপডেট করা হয়েছে');
    } catch (err: any) {
      toast.error('আপডেট করতে ব্যর্থ হয়েছে: ' + err.message);
    }
  };

  const setDeliveryDate = async (orderId: string, date: string) => {
    try {
      await updateDoc(doc(db, 'shop-orders', orderId), { expectedDeliveryDate: date });
      toast.success('ডেলিভারি তারিখ আপডেট করা হয়েছে');
    } catch (err: any) {
      toast.error('সেট করতে ব্যর্থ হয়েছে: ' + err.message);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে আপনি এই অর্ডারটি ডিলিট করতে চান? এটি চিরতরে মুছে যাবে।')) return;
    try {
      await deleteDoc(doc(db, 'shop-orders', orderId));
      toast.success('অর্ডার রেকর্ড মুছে ফেলা হয়েছে');
    } catch (err: any) {
      toast.error('ডিলিট করতে ব্যর্থ হয়েছে: ' + err.message);
    }
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.title}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">৳${item.price}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">৳${item.price * item.quantity}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Invoice - ${order.id}</title>
          <style>
            
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap');
                        * { box-sizing: border-box; }
            body { font-family: 'Hind Siliguri', sans-serif; padding: 0; margin: 0; color: #1e293b; background: #fff; }
            .container { padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 4px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 28px; font-weight: 800; color: #1e293b; }
            .invoice-label { background: #1e293b; color: #fff; padding: 5px 15px; border-radius: 5px; font-size: 14px; margin-top: 10px; display: inline-block; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-bottom: 10px; letter-spacing: 1px; }
            .info-value { font-size: 14px; font-weight: 600; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background: #f8fafc; padding: 12px 10px; font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
            td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; }
            .total-section { display: flex; justify-content: flex-end; }
            .total-box { background: #f8fafc; padding: 20px 30px; border-radius: 20px; min-width: 250px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .total-final { font-size: 24px; font-weight: 800; color: #e11d48; border-top: 2px solid #e2e8f0; pt: 10px; mt: 5px; }
            .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            @media print {
              .container { width: 100%; padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div>
                <div class="logo">পানধোয়া উন্মুক্ত পাঠাগার</div>
                <div class="invoice-label">অফিসিয়াল ইনভয়েস</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 18px;">ID: #${order.id}</div>
                <div style="color: #64748b; font-size: 12px;">অর্ডার তারিখ: ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('bn-BD') : 'N/A'}</div>
              </div>
            </div>

            <div class="info-grid">
              <div>
                <div class="section-title">কাস্টমার প্রোফাইল</div>
                <div class="info-value">
                  <span style="font-size: 18px; color: #0f172a;">${order.customerName}</span><br/>
                  📞 ${order.customerPhone}<br/>
                  📍 ${order.customerAddress}
                </div>
              </div>
              <div>
                <div class="section-title">ডেলিভারি মেথড</div>
                <div class="info-value">
                  ধরণ: ${order.deliveryType === 'COD' ? '📦 ক্যাশ অন ডেলিভারি' : '🏢 লাইব্রেরি পিকআপ'}<br/>
                  স্ট্যাটাস: ${order.status}<br/>
                  সম্ভাব্য তারিখ: <span style="color: #6366f1;">${order.expectedDeliveryDate || 'অনির্ধারিত'}</span>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>বইয়ের নাম</th>
                  <th style="text-align: center;">পরিমাণ</th>
                  <th style="text-align: right;">একক মূল্য</th>
                  <th style="text-align: right;">মোট</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="total-section">
              <div class="total-box">
                <div class="total-row">
                  <span style="color: #64748b;">সাব-টোটাল</span>
                  <span>৳${order.subTotal || order.totalPrice}</span>
                </div>
                <div class="total-row">
                  <span style="color: #64748b;">ডেলিভারি চার্জ</span>
                  <span>৳${order.deliveryCharge || (order.deliveryType === 'COD' ? '60' : '0')}</span>
                </div>
                <div class="total-row total-final">
                  <span>সর্বমোট</span>
                  <span>৳${order.totalPrice + (order.deliveryCharge === undefined && order.deliveryType === 'COD' ? 60 : 0)}</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>আপনার বই পড়ার এই যাত্রা সুন্দর হোক। আমাদের সাথে থাকার জন্য ধন্যবাদ।</p>
              <p style="font-weight: 700;">ফোন: ০১৫৭-০২০৬৯৫৩ | ফেসবুক: পানধোয়া উন্মুক্ত পাঠাগার</p>
            </div>
          </div>

          <script>
            window.onload = function() { 
              setTimeout(() => {
                window.print(); 
                window.close();
              }, 500); 
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintConfirmed = () => {
    const confirmedOrders = orders.filter(o => o.status === 'Confirmed');
    if (confirmedOrders.length === 0) {
      toast.error('প্রিন্ট করার মতো কোনো কনফার্মড অর্ডার নেই');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = confirmedOrders.map((order, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${order.id}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${order.customerName}</strong><br/>
          <small>${order.customerPhone}</small>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${order.customerAddress}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${order.items.map(item => `${item.title} (x${item.quantity})`).join(', ')}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">৳${order.totalPrice}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Confirmed Orders List</title>
          <style>
            
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap');
                        body { font-family: 'Hind Siliguri', sans-serif; padding: 30px; font-size: 14px; }
            h1 { text-align: center; color: #1e293b; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f1f5f9; padding: 12px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            .footer { margin-top: 30px; text-align: right; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>কনফার্মড অর্ডারের তালিকা</h1>
          <p>মোট অর্ডার: ${confirmedOrders.length} টি | তারিখ: ${new Date().toLocaleDateString('bn-BD')}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>আইডি</th>
                <th>কাস্টমার</th>
                <th>ঠিকানা</th>
                <th>আইটেমসমূহ</th>
                <th style="text-align: right;">মোট মূল্য</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">প্রিন্ট করা হয়েছে: ${new Date().toLocaleString('bn-BD')}</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filtered = orders.filter(o => 
    (o.customerName.toLowerCase().includes(search.toLowerCase()) || o.customerPhone.includes(search)) &&
    (filter === 'All' || o.status === filter)
  );

  return (
    <div className="space-y-8 font-bengali">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex-1">
            <h2 className="text-4xl font-black mb-6 tracking-tight">অর্ডার <span className="text-indigo-400">ব্যবস্থাপনা</span></h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">পেন্ডিং</p>
                  <p className="text-2xl font-black text-amber-400">{orders.filter(o => o.status === 'Pending').length}</p>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">শিপিং</p>
                  <p className="text-2xl font-black text-blue-400">{orders.filter(o => o.status === 'Shipping').length}</p>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">ডেলিভারড</p>
                  <p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === 'Delivered').length}</p>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">প্রি-বুকিং</p>
                  <p className="text-2xl font-black text-rose-400">{orders.filter(o => o.status === 'Pre-booked').length}</p>
               </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button 
              onClick={handlePrintConfirmed}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              CONFIRMED LIST PRINT
            </button>
            <div className="relative flex-1 sm:w-64">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="ফোন বা নাম..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3.5 focus:outline-none focus:border-indigo-500 transition-all font-bold text-sm"
               />
            </div>
            <select 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 focus:outline-none focus:border-indigo-500 transition-all font-bold text-sm"
            >
              <option value="All" className="bg-slate-900">সকল অর্ডার</option>
              <option value="Pending" className="bg-slate-900">পেন্ডিং</option>
              <option value="Pre-booked" className="bg-slate-900">প্রি-বুকিং</option>
              <option value="Shipping" className="bg-slate-900">শিপিং</option>
              <option value="Delivered" className="bg-slate-900">ডেলিভারড</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {filtered.map(order => (
          <div key={order.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-8 hover:shadow-xl transition-all group overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${
              order.status === 'Pending' ? 'bg-amber-400' : 
              order.status === 'Pre-booked' ? 'bg-rose-500' :
              order.status === 'Shipping' ? 'bg-indigo-500' :
              order.status === 'Delivered' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}></div>

            <div className="flex flex-col xl:flex-row justify-between gap-8 xl:gap-12">
              <div className="flex-1 min-w-0 space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-slate-100 px-4 py-2 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">অর্ডার আইডি</span>
                    <span className="font-mono text-sm font-black text-indigo-600">#{order.id}</span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    order.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                    order.status === 'Pre-booked' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    order.status === 'Shipping' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                    order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {order.status}
                  </div>
                  <span className="text-xs text-slate-400 font-bold">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('bn-BD') : 'তারিখ লোড হচ্ছে...'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <User className="w-4 h-4" />
                      <span className="font-black text-slate-900">{order.customerName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span className="font-bold">{order.customerPhone}</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-600">
                      <MapPin className="w-4 h-4 mt-1" />
                      <span className="font-bold text-sm leading-relaxed">{order.customerAddress}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">অর্ডার আইটেম</p>
                    <div className="space-y-2">
                       {order.items.map((item, idx) => (
                         <div key={idx} className="flex justify-between items-center text-xs font-bold">
                            <span className="text-slate-700">{item.title} (x{item.quantity})</span>
                            <span className="text-slate-900">৳{item.price * item.quantity}</span>
                         </div>
                       ))}
                       <div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center font-black">
                          <span className="text-slate-500 uppercase text-[10px]">মোট:</span>
                          <span className="text-rose-600 text-lg">৳{order.totalPrice}</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:w-80 flex-shrink-0 space-y-3 xl:border-l xl:border-slate-100 xl:pl-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">অ্যাকশন ও আপডেট</p>
                
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">সম্ভাব্য ডেলিভারি তারিখ</span>
                   </div>
                   <input 
                     type="text" 
                     placeholder="উদাঃ ১০ জুন ২০২৬"
                     defaultValue={order.expectedDeliveryDate || ''}
                     onBlur={(e) => {
                       if (e.target.value !== (order.expectedDeliveryDate || '')) {
                         setDeliveryDate(order.id, e.target.value);
                       }
                     }}
                     className="w-full bg-white border border-amber-200 px-3 py-2 rounded-xl text-xs font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                   />
                </div>

                 <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => updateStatus(order.id, 'Confirmed')} className="py-3 px-2 bg-slate-50 rounded-xl text-[10px] font-black hover:bg-indigo-50 hover:text-indigo-600 transition tracking-tighter">CONFIRM</button>
                   <button onClick={() => updateStatus(order.id, 'Pre-booked')} className="py-3 px-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition tracking-tighter">PRE-BOOK</button>
                   <button onClick={() => updateStatus(order.id, 'Processing')} className="py-3 px-2 bg-slate-50 rounded-xl text-[10px] font-black hover:bg-indigo-50 hover:text-indigo-600 transition tracking-tighter">PROCESS</button>
                   <button onClick={() => updateStatus(order.id, 'Shipping')} className="py-3 px-2 bg-slate-50 rounded-xl text-[10px] font-black hover:bg-indigo-50 hover:text-indigo-600 transition tracking-tighter">SHIP</button>
                   <button onClick={() => updateStatus(order.id, 'Delivered')} className="py-3 px-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black hover:bg-emerald-100 transition tracking-tighter col-span-2">DELIVERED</button>
                </div>
                <button 
                  onClick={() => handlePrint(order)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PRINT INVOICE
                </button>
                <div className="flex gap-2 w-full">
                  <button onClick={() => updateStatus(order.id, 'Cancelled')} className="flex-1 py-3 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black hover:bg-rose-100 transition tracking-tighter">CANCEL ORDER</button>
                  <button onClick={() => deleteOrder(order.id)} className="p-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-900/20 active:scale-95">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-24 text-center bg-white border-2 border-dashed border-slate-200 rounded-[3rem]">
             <Package className="w-16 h-16 mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-black">কোন অর্ডার পাওয়া যায়নি।</p>
          </div>
        )}
      </div>
    </div>
  );
}
