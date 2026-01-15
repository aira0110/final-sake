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
  AlertCircle
} from 'lucide-react';
import './App.css'; // CSSファイルを読み込み

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

  return (
    <div className={`toast toast-${type}`}>
      {type === 'error' && <AlertCircle size={20} />}
      <span>{message}</span>
    </div>
  );
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="btn-close">
            <X size={24} />
          </button>
        </div>
        <div className="modal-body">
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
    const appId = "1:977978625727:web:c014149e58ed0f7140000a"; // Using appId from config for path
    
    // collection path as per previous code
    const postsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'posts');

    const unsubscribe = onSnapshot(postsCollection, 
      (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));

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
    const appId = "1:977978625727:web:c014149e58ed0f7140000a";
    
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
    const appId = "1:977978625727:web:c014149e58ed0f7140000a";
    try {
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId);
      await deleteDoc(postRef);
      setToast({ message: "削除しました", type: "info" });
    } catch (error) {
      setToast({ message: "削除に失敗しました", type: "error" });
    }
  };

  const handleLike = async (post) => {
    const appId = "1:977978625727:web:c014149e58ed0f7140000a";
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
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-logo">
            <div className="logo-icon-bg">
              <MessageSquare size={20} fill="currentColor" />
            </div>
            <h1 className="logo-text">
              React Board
            </h1>
          </div>
          
          <div className="header-actions">
            <div className="search-wrapper">
              <div className="search-icon-wrapper">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="キーワードで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <Plus size={18} />
              <span>投稿する</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        
        {loading ? (
          // Loading Skeletons
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line" style={{ width: '75%' }}></div>
                <div className="skeleton-line" style={{ width: '100%', height: '0.8rem' }}></div>
                <div className="skeleton-line" style={{ width: '50%', height: '0.8rem' }}></div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          // Empty State
          <div className="empty-state">
            <div className="empty-icon">
              <MessageSquare size={40} />
            </div>
            <h3 className="empty-title">まだ投稿がありません</h3>
            <p className="empty-desc">最初の投稿を作成して盛り上げましょう！</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-text"
            >
              投稿を作成する
            </button>
          </div>
        ) : (
          // Post List
          <div className="posts-grid">
            {filteredPosts.map((post) => (
              <article key={post.id} className="post-card">
                <div className="post-header">
                  <div className="author-info">
                    <div className="avatar">
                      {post.authorName.charAt(0) || <User size={14}/>}
                    </div>
                    <span className="author-name">{post.authorName || '匿名'}</span>
                    <span>•</span>
                    <span className="post-date">
                      <Clock size={12} />
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                  
                  {/* Delete Button (Only for creator) */}
                  {user && post.authorId === user.uid && (
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="btn-delete"
                      title="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <h2 className="post-title">
                  {post.title}
                </h2>
                
                <p className="post-content">
                  {post.content}
                </p>

                <div className="post-footer">
                  <button 
                    onClick={() => handleLike(post)}
                    className="btn-action"
                  >
                    <div className="btn-icon-wrapper like">
                      <Heart size={20} className={post.likes > 0 ? "icon-heart-filled" : ""} />
                    </div>
                    <span>{post.likes || 0}</span>
                  </button>
                  
                  <button className="btn-action comment">
                     <div className="btn-icon-wrapper comment">
                      <MessageSquare size={20} />
                    </div>
                    <span>コメント</span>
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
        className="fab-btn"
      >
        <Plus size={24} />
      </button>

      {/* Create Post Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="新しい投稿を作成"
      >
        <form onSubmit={handleCreatePost}>
          <div className="form-group">
            <label className="form-label">ニックネーム</label>
            <input
              type="text"
              className="form-input"
              placeholder="表示名（任意）"
              value={newPost.authorName}
              onChange={(e) => setNewPost({...newPost, authorName: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">タイトル <span className="required">*</span></label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="記事のタイトル"
              value={newPost.title}
              onChange={(e) => setNewPost({...newPost, title: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">本文 <span className="required">*</span></label>
            <textarea
              required
              rows={5}
              className="form-textarea"
              placeholder="ここに内容を書いてください..."
              value={newPost.content}
              onChange={(e) => setNewPost({...newPost, content: e.target.value})}
            />
          </div>
          
          <div className="modal-footer">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-cancel"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-submit"
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