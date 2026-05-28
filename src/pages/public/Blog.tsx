import React, { useEffect, useState, useRef } from 'react';
import { Bookmark, Image as ImageIcon, MessageSquare, Send, X, BookHeart, UserCircle2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { onSnapshot, collection, doc, query, orderBy, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../store/AuthContext';
import toast from 'react-hot-toast';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  date: string;
}

interface Post {
  id: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  bookName: string;
  authorName: string;
  content: string;
  image?: string;
  title?: string;
  date: string;
  likes?: string[];
  comments?: Comment[];
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Create Post State
  const [postContent, setPostContent] = useState('');
  const [postBookName, setPostBookName] = useState('');
  const [postAuthorName, setPostAuthorName] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments State
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const [deviceId] = useState(() => {
    let id = localStorage.getItem('anon_device_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('anon_device_id', id);
    }
    return id;
  });

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        setPostImage(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('রিভিও পোস্ট করতে আপনাকে লগিন করতে হবে।');
      return;
    }
    if (!postContent.trim()) {
      toast.error('রিভিও কিছু লিখুন।');
      return;
    }

    setIsPosting(true);
    try {
      const newDocRef = doc(collection(db, "posts"));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || null,
        bookName: postBookName || '',
        authorName: postAuthorName || '',
        content: postContent,
        image: postImage,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        likes: [],
        comments: []
      });
      
      setPostBookName('');
      setPostAuthorName('');
      setPostContent('');
      setPostImage(null);
      setIsCreateModalOpen(false);
      toast.success('আপনার বুক রিভিও পোস্ট হয়েছে!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('পোস্ট করতে সমস্যা হয়েছে।');
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId: string, currentLikes: string[] = []) => {
    const likerId = user?.id || deviceId;
    const postRef = doc(db, 'posts', postId);
    const hasLiked = currentLikes.includes(likerId);
    
    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(likerId)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(likerId)
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('রিয়েক্ট করতে সমস্যা হয়েছে।');
    }
  };

  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const guestId = deviceId;
    const newComment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      userId: user?.id || guestId,
      userName: user?.name || 'পাঠক',
      userAvatar: user?.avatar || null,
      content: commentText,
      date: new Date().toISOString()
    };

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('কমেন্ট করতে সমস্যা হয়েছে।');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('আপনি কি এই পোস্টটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, "posts", postId));
      toast.success('পোস্ট ডিলিট করা হয়েছে।');
    } catch (err) {
       toast.error('পোস্ট ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

  const handleCopyLink = async (postId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('লিংক কপি হয়েছে!');
    } catch (err) {
      toast.error('লিংক কপি করা যায়নি');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    if (postId && !loading) {
      setTimeout(() => {
        const element = document.getElementById(`post-${postId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-indigo-500/50');
          setTimeout(() => element.classList.remove('ring-4', 'ring-indigo-500/50'), 2000);
        }
      }, 500);
    }
  }, [loading]);

  return (
    <div className="bg-[#f0f2f5] dark:bg-slate-900 min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2 font-bengali">বুক রিভিও</h1>
          <p className="text-slate-500 font-medium font-bengali">নতুন বইয়ের রিভিউ পড়ুন, রিয়েক্ট দিন এবং আলোচনা করুন</p>
        </div>

        {/* Create Post Card */}
        {user ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.2)] border-0 p-4">
             <div className="flex gap-3 border-b border-slate-100 dark:border-slate-700 pb-3 mb-3">
               {user.avatar ? (
                  <img src={user.avatar} referrerPolicy="no-referrer" alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0" />
               ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                     <UserCircle2 className="w-6 h-6 text-slate-400" />
                  </div>
               )}
               <button 
                 onClick={() => setIsCreateModalOpen(true)}
                 className="flex-1 bg-[#f0f2f5] dark:bg-slate-700 hover:bg-[#e4e6e9] dark:hover:bg-slate-600 transition-colors rounded-full px-4 text-left text-[#65676b] dark:text-slate-300 text-[15px] font-bengali font-medium h-10 flex items-center"
               >
                 {user.name}, আপনার পড়া বইয়ের রিভিউ লিখুন...
               </button>
             </div>
             <div className="flex items-center justify-center">
                <button 
                  onClick={() => { setIsCreateModalOpen(true); setTimeout(() => fileInputRef.current?.click(), 100); }} 
                  className="flex items-center justify-center gap-2 hover:bg-[#f0f2f5] dark:hover:bg-slate-700 p-2 rounded-lg transition-colors flex-1 text-[#65676b] dark:text-slate-300 font-semibold text-[15px] font-bengali"
                >
                   <ImageIcon className="w-6 h-6 text-emerald-500" /> ছবি যুক্ত করুন
                </button>
             </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.2)] border-0 p-6 text-center">
            <h3 className="text-xl font-bold font-bengali text-slate-900 dark:text-white mb-2">রিভিও লিখতে চান?</h3>
            <p className="text-slate-500 font-bengali mb-4 text-[15px]">নিজে বই পড়ুন এবং অন্যদের জন্য রিভিও পোস্ট করুন।</p>
            <a href="/login" className="inline-block bg-indigo-600 text-white font-bold font-bengali px-8 py-2.5 rounded-lg hover:bg-indigo-700 transition shadow-sm">লগিন করুন</a>
          </div>
        )}

        {/* Feed */}
        {loading ? (
             <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
        ) : (
          <div className="space-y-6">
            {posts.map(post => {
              const likesCount = post.likes?.length || 0;
              const hasLiked = post.likes?.includes(user?.id || deviceId) ?? false;
              const commentsCount = post.comments?.length || 0;
              const showComments = activeCommentPost === post.id;
              const isMyPost = user && (user.id === post.userId || user.role === 'admin');

              return (
                <motion.article 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  id={`post-${post.id}`}
                  key={post.id} 
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-0 overflow-hidden transition-all"
                >
                  {/* Post Header */}
                  <div className="p-4 sm:p-5 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {post.userAvatar ? (
                         <img src={post.userAvatar} referrerPolicy="no-referrer" alt={post.userName} className="w-11 h-11 rounded-full object-cover shadow-sm bg-white" />
                      ) : (
                         <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shadow-sm">
                            <span className="font-bold text-slate-500 text-lg">{post.userName?.charAt(0) || 'A'}</span>
                         </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white font-bengali text-[15px] leading-none mb-1">{post.userName || 'পাঠক'}</h3>
                        <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                           <time>{new Date(post.date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                           <span>•</span>
                           <Bookmark className="w-[11px] h-[11px] text-indigo-500" />
                        </div>
                      </div>
                    </div>
                    
                    {isMyPost && (
                        <button onClick={() => handleDeletePost(post.id)} className="text-slate-400 hover:text-rose-500 bg-slate-50 rounded-full hover:bg-rose-50 transition-colors p-2">
                          <X className="w-4 h-4" />
                        </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="px-4 sm:px-5 pb-4">
                    {(post.bookName || post.title) && (
                       <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1 font-bengali">{post.bookName || post.title}</h4>
                    )}
                    {post.authorName && (
                       <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 font-bengali">লেখক: {post.authorName}</p>
                    )}
                    <div className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-bengali text-[15px] leading-relaxed">
                      {post.content}
                    </div>
                  </div>

                  {/* Post Image */}
                  {post.image && (
                    <div className="w-full bg-slate-100 dark:bg-slate-900/50 cursor-pointer">
                      <img src={post.image} alt="Review Image" className="w-full max-h-[600px] object-cover" />
                    </div>
                  )}

                  {/* Reaction Counts */}
                  <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-slate-500 text-sm font-bengali">
                    <div className="flex items-center gap-2">
                       {likesCount > 0 && (
                         <>
                           <div className="w-[22px] h-[22px] rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                              <BookHeart className="w-[12px] h-[12px] text-white fill-current" />
                           </div>
                           <span className="text-[13px]">{likesCount}</span>
                         </>
                       )}
                    </div>
                    {commentsCount > 0 && (
                      <div>
                         <span className="hover:underline cursor-pointer text-[13px]" onClick={() => setActiveCommentPost(showComments ? null : post.id)}>{commentsCount} মন্তব্য</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-2 py-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50">
                    <button 
                      onClick={() => toggleLike(post.id, post.likes)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors font-bold font-bengali text-sm
                        ${hasLiked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                    >
                      <BookHeart className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} /> 
                      পছন্দ
                    </button>
                    <button 
                      onClick={() => setActiveCommentPost(showComments ? null : post.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors font-bold font-bengali text-sm"
                    >
                      <MessageSquare className="w-5 h-5" /> 
                      কমেন্ট
                    </button>
                    <button 
                      onClick={() => handleCopyLink(post.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors font-bold font-bengali text-sm"
                    >
                      <Share2 className="w-5 h-5" /> 
                      শেয়ার
                    </button>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                    {showComments && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 dark:border-slate-700/50 overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 space-y-4">
                           {post.comments && post.comments.length > 0 ? (
                             post.comments.map(comment => (
                               <div key={comment.id} className="flex gap-2.5">
                                 {comment.userAvatar ? (
                                    <img src={comment.userAvatar} referrerPolicy="no-referrer" alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                 ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                       <span className="font-bold text-xs text-slate-500">{comment.userName?.charAt(0) || 'A'}</span>
                                    </div>
                                 )}
                                 <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-2.5 flex-1 inline-block shadow-sm">
                                    <h5 className="font-bold text-sm text-slate-900 dark:text-white font-bengali">{comment.userName}</h5>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm font-bengali mt-0.5">{comment.content}</p>
                                    <span className="text-[10px] text-slate-400 mt-1 block">{new Date(comment.date).toLocaleDateString('bn-BD', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' })}</span>
                                 </div>
                               </div>
                             ))
                           ) : (
                             <p className="text-center text-slate-500 font-bengali text-sm py-2">কোনো কমেন্ট নেই, প্রথম কমেন্ট করুন!</p>
                           )}
                           
                           {/* Add Comment Input */}
                           <form onSubmit={(e) => handleAddComment(post.id, e)} className="flex gap-2.5 pt-2">
                             {user?.avatar ? (
                                <img src={user.avatar} referrerPolicy="no-referrer" alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-1" />
                             ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                                   <UserCircle2 className="w-5 h-5 text-slate-400" />
                                </div>
                             )}
                             <div className="flex-1 relative">
                               <input 
                                 type="text" 
                                 placeholder="একটি মন্তব্য লিখুন..." 
                                 value={commentText}
                                 onChange={(e) => setCommentText(e.target.value)}
                                 className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2.5 pr-10 text-sm font-bengali outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all"
                               />
                               <button type="submit" disabled={!commentText.trim()} className="absolute right-2 top-1.5 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full disabled:opacity-50 transition-colors">
                                 <Send className="w-4 h-4" />
                               </button>
                             </div>
                           </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.article>
              );
            })}

            {posts.length === 0 && (
              <div className="text-center py-20 text-slate-500 bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 border-dashed font-bengali">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                   <BookHeart className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">এখনো কোনো রিভিউ নেই</p>
                <p>প্রথম বুক রিভিউ পোস্ট করুন!</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-[500px] overflow-hidden flex flex-col max-h-[90vh]"
             >
                <div className="relative border-b border-slate-200 dark:border-slate-700 p-4">
                   <h2 className="text-center text-[20px] font-bold text-slate-900 dark:text-white font-bengali">রিভিউ পোস্ট করুন</h2>
                   <button onClick={() => setIsCreateModalOpen(false)} className="absolute right-4 top-4 w-9 h-9 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors">
                      <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                   </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                   <div className="flex items-center gap-3 mb-4">
                     {user?.avatar ? (
                        <img src={user.avatar} referrerPolicy="no-referrer" alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0" />
                     ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                           <UserCircle2 className="w-6 h-6 text-slate-400" />
                        </div>
                     )}
                     <div>
                        <div className="font-semibold text-slate-900 dark:text-white font-bengali">{user?.name}</div>
                        <div className="text-[13px] text-slate-500 font-bengali mt-0.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded flex inline-block">পাবলিক</div>
                     </div>
                   </div>

                   <div className="space-y-3">
                     <div>
                       <input 
                         type="text"
                         required
                         placeholder="বইয়ের নাম"
                         className="w-full bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white font-bengali font-semibold placeholder-slate-500 border border-slate-200 dark:border-slate-700 outline-none p-3 rounded-xl transition-all text-[15px]"
                         value={postBookName}
                         onChange={(e) => setPostBookName(e.target.value)}
                       />
                     </div>
                     <div>
                       <input 
                         type="text"
                         required
                         placeholder="লেখকের নাম"
                         className="w-full bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white font-bengali font-semibold placeholder-slate-500 border border-slate-200 dark:border-slate-700 outline-none p-3 rounded-xl transition-all text-[15px]"
                         value={postAuthorName}
                         onChange={(e) => setPostAuthorName(e.target.value)}
                       />
                     </div>
                     <textarea
                       required
                       placeholder={`আপনার পড়া বইয়ের রিভিউ বা মতামত লিখুন...`}
                       className="w-full bg-transparent text-slate-800 dark:text-white font-bengali placeholder-slate-400 border-none outline-none resize-none min-h-[120px] text-[16px] leading-relaxed"
                       value={postContent}
                       onChange={(e) => setPostContent(e.target.value)}
                     ></textarea>
                     
                     {postImage && (
                       <div className="relative mt-2 rounded-xl overflow-hidden border border-slate-200 inline-block">
                         <img src={postImage} alt="Preview" className="max-h-64 object-contain" />
                         <button 
                           onClick={() => setPostImage(null)}
                           className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-900 rounded-full hover:bg-white shadow-sm transition-colors"
                         >
                           <X className="w-5 h-5" />
                         </button>
                       </div>
                     )}
                   </div>

                   <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-4 flex items-center justify-between shadow-sm flex-wrap gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white font-bengali text-[15px] ml-1">আপনার পোস্ট এ যুক্ত করুন</span>
                      <div className="flex items-center gap-1">
                         <button 
                           type="button"
                           onClick={() => fileInputRef.current?.click()}
                           className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors tooltip"
                           title="ছবি যুক্ত করুন"
                         >
                           <ImageIcon className="w-6 h-6 text-emerald-500" />
                         </button>
                         <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </div>
                   </div>
                   
                   <div className="mt-4">
                     <button 
                       onClick={handleCreatePost}
                       disabled={isPosting || !postBookName.trim() || !postAuthorName.trim() || !postContent.trim()}
                       className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#e4e6e9] disabled:text-[#bcc0c4] text-white font-bold font-bengali py-2.5 rounded-lg transition-colors text-[16px]"
                     >
                       {isPosting ? 'পোস্ট হচ্ছে...' : 'পোস্ট করুন'}
                     </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

