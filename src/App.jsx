import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Heart, 
  Trash2, 
  User, 
  X, 
  Send, 
  Clock,
  MoreHorizontal,
  AlertCircle
} from 'lucide-react';

// Firebase imports
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  increment
} from "firebase/firestore";

// --- Firebase Initialization ---
// 環境変数から設定を読み込みます
// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAx0ovUagyDVAhNeIKIEe9AtuKbMrOC9Mo",
  authDomain: "final-sake.firebaseapp.com",
  projectId: "final-sake",
  storageBucket: "final-sake.firebasestorage.app",
  messagingSenderId: "977978625727",
  appId: "1:977978625727:web:c014149e58ed0f7140000a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Components ---

// Notification/Toast Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <div className={`fixed top-4 right-4 ${bgColors[type] || 'bg-gray-800'} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in-down`}>
      {type === 'error' && <AlertCircle size={20} />}
      <span>{message}</span>
    </div>
  );
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform transition-all scale-100">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', authorName: '' });
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // --- Auth & Data Fetching ---

  // 1. Authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setToast({ message: "認証に失敗しました", type: "error" });
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync (Firestore)
  useEffect(() => {
    if (!user) return;

    // PUBLIC collection path as per rules
    const postsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'posts');

    const unsubscribe = onSnapshot(postsCollection, 
      (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Handle potential missing timestamps
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));

        // Sort in memory (Rule: No complex queries in Firestore)
        postsData.sort((a, b) => b.createdAt - a.createdAt);

        setPosts(postsData);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setToast({ message: "データの読み込みに失敗しました", type: "error" });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) return;

    setSubmitting(true);
    try {
      const postsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
      await addDoc(postsCollection, {
        title: newPost.title,
        content: newPost.content,
        authorName: newPost.authorName || '匿名ユーザー',
        authorId: user.uid,
        createdAt: serverTimestamp(),
        likes: 0
      });
      
      setToast({ message: "投稿しました！", type: "success" });
      setNewPost({ title: '', content: '', authorName: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      setToast({ message: "投稿に失敗しました", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("本当にこの投稿を削除しますか？")) return;
    try {
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId);
      await deleteDoc(postRef);
      setToast({ message: "削除しました", type: "info" });
    } catch (error) {
      setToast({ message: "削除に失敗しました", type: "error" });
    }
  };

  const handleLike = async (post) => {
    try {
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id);
      await updateDoc(postRef, {
        likes: increment(1)
      });
    } catch (error) {
      console.error("Like error", error);
    }
  };

  // --- Filtering ---
  const filteredPosts = useMemo(() => {
    return posts.filter(post => 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [posts, searchTerm]);

  // --- Utility for dates ---
  const formatDate = (date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <MessageSquare size={20} fill="currentColor" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block">
              React Board
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="キーワードで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white w-32 sm:w-64 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium transition shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">投稿する</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {loading ? (
          // Loading Skeletons
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          // Empty State
          <div className="text-center py-20">
            <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <MessageSquare size={40} />
            </div>
            <h3 className="text-lg font-medium text-slate-600">まだ投稿がありません</h3>
            <p className="text-slate-500 mb-6">最初の投稿を作成して盛り上げましょう！</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-indigo-600 font-medium hover:underline"
            >
              投稿を作成する
            </button>
          </div>
        ) : (
          // Post List
          <div className="grid gap-6">
            {filteredPosts.map((post) => (
              <article 
                key={post.id} 
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                      {post.authorName.charAt(0) || <User size={14}/>}
                    </div>
                    <span className="font-medium text-slate-700">{post.authorName || '匿名'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                  
                  {/* Delete Button (Only for creator) */}
                  {user && post.authorId === user.uid && (
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <h2 className="text-xl font-bold text-slate-800 mb-2 leading-tight">
                  {post.title}
                </h2>
                
                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mb-6">
                  {post.content}
                </p>

                <div className="flex items-center gap-4 border-t border-slate-50 pt-4 mt-2">
                  <button 
                    onClick={() => handleLike(post)}
                    className="flex items-center gap-2 text-slate-500 hover:text-pink-500 transition group/like"
                  >
                    <div className="p-2 rounded-full group-hover/like:bg-pink-50 transition">
                      <Heart size={20} className={post.likes > 0 ? "fill-pink-500 text-pink-500" : ""} />
                    </div>
                    <span className="font-medium text-sm">{post.likes || 0}</span>
                  </button>
                  
                  <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition group/comment">
                     <div className="p-2 rounded-full group-hover/comment:bg-indigo-50 transition">
                      <MessageSquare size={20} />
                    </div>
                    <span className="font-medium text-sm">コメント</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button (Mobile) */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 sm:hidden bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition active:scale-90 z-40"
      >
        <Plus size={24} />
      </button>

      {/* Create Post Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="新しい投稿を作成"
      >
        <form onSubmit={handleCreatePost} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ニックネーム</label>
            <input
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="表示名（任意）"
              value={newPost.authorName}
              onChange={(e) => setNewPost({...newPost, authorName: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">タイトル <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="記事のタイトル"
              value={newPost.title}
              onChange={(e) => setNewPost({...newPost, title: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">本文 <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={5}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition resize-none"
              placeholder="ここに内容を書いてください..."
              value={newPost.content}
              onChange={(e) => setNewPost({...newPost, content: e.target.value})}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-200 transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? '送信中...' : (
                <>
                  <span>投稿する</span>
                  <Send size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}