import React, { useEffect, useState } from 'react';
import { db, collection, query, orderBy, onSnapshot, handleFirestoreError, OperationType, Timestamp, deleteDoc, updateDoc, doc } from '../firebase';
import { Library, Download, Search, Filter, FileText, Clock, Trash2, Folder, ChevronRight, Edit2, Check, X } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

interface GeneratedFile {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: Timestamp | null;
  createdBy: string;
  category: string;
}

const TYPE_NAMES: Record<string, string> = {
  'BONBONAYA': 'البونبوناية',
  'EXTRACTS': 'المستخرجات',
  'TERMINOLOGY': 'المصطلحات',
  'MCQ_MAKER': 'بنك الأسئلة',
  'NCLEX': 'أسئلة NCLEX',
  'CHEAT_SHEET': 'البرشامة',
  'ZERO_KNOWLEDGE': 'من الصفر'
};

export const FileLibrary: React.FC = () => {
  const { user, profile } = useAuth();
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  
  // Renaming state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'files'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GeneratedFile[];
      setFiles(filesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'files');
    });

    return () => unsubscribe();
  }, []);

  const downloadFile = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteDoc(doc(db, 'files', fileId));
      setConfirmingId(null);
    } catch (e) {
      console.error(e);
      alert('خطأ في الحذف: ' + (e as Error).message);
    }
  };

  const handleRenameSubmit = async (file: GeneratedFile) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'files', file.id), {
        title: editTitle.trim()
      });
      setEditingId(null);
    } catch (error) {
      console.error("Rename error:", error);
      alert('حدث خطأ أثناء تغيير اسم الملف.');
    }
  };

  // Group files by type
  const folders = Object.keys(TYPE_NAMES).map(type => {
    return {
      type,
      name: TYPE_NAMES[type],
      files: files.filter(f => f.type === type)
    }
  });

  // Filter valid files for search or current folder
  const displayFiles = activeFolder 
    ? files.filter(f => f.type === activeFolder && f.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : (searchTerm ? files.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase())) : []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
             {activeFolder && (
                <button 
                  onClick={() => { setActiveFolder(null); setSearchTerm(''); }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronRight size={24} />
                </button>
             )}
            <h2 className="text-3xl font-black text-white font-cairo flex items-center gap-3">
              <Library className="text-cyan-400" size={32} />
              مكتبة الملفات {activeFolder && `> ${TYPE_NAMES[activeFolder]}`}
            </h2>
          </div>
          <p className="text-slate-400 font-cairo mt-2">كل الملفات اللي تم توليدها في المنصة محفوظة هنا ليك ولزمايلك</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text"
              placeholder={activeFolder ? "ابحث داخل المجلد..." : "ابحث في كل الملفات..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-white outline-none focus:border-cyan-500 transition-all font-cairo w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-white/5 rounded-[2rem] animate-pulse"></div>
          ))}
        </div>
      ) : (
        <>
          {/* Folders View */}
          {!activeFolder && !searchTerm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {folders.map((folder) => (
                  <motion.div
                    key={folder.type}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => setActiveFolder(folder.type)}
                    className="group cursor-pointer bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:bg-white/10 transition-all hover:border-amber-500/30 flex items-center gap-4"
                  >
                     <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                       <Folder size={32} className="fill-amber-500/20" />
                     </div>
                     <div>
                       <h3 className="text-xl font-bold text-white font-cairo group-hover:text-amber-400 transition-colors">
                         {folder.name}
                       </h3>
                       <p className="text-sm text-slate-400 font-cairo mt-1">
                         {folder.files.length} ملف
                       </p>
                     </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Files Grid View */}
          {(activeFolder || searchTerm) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {displayFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative bg-white/5 border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.08] transition-all hover:border-cyan-500/30 overflow-visible"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-cyan-500/10 transition-colors"></div>
                    
                    <div className="relative z-10 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400">
                          <FileText size={24} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full text-slate-400">
                          {TYPE_NAMES[file.type] || file.type}
                        </span>
                      </div>

                      <div className="min-h-[4rem]">
                        {editingId === file.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="flex-1 bg-[#020617] border border-cyan-500/50 rounded-xl px-3 py-1 font-cairo text-sm text-white outline-none"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(file)}
                            />
                            <button onClick={() => handleRenameSubmit(file)} className="p-1.5 bg-green-500 text-[#020617] rounded-lg">
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-red-500 text-white rounded-lg">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2 group/title">
                            <h3 className="text-lg font-bold text-white font-cairo line-clamp-2 group-hover:text-cyan-400 transition-colors">
                              {file.title}
                            </h3>
                            {(profile?.role === 'admin' || user?.uid === file.createdBy) && (
                               <button 
                                 onClick={() => { setEditingId(file.id); setEditTitle(file.title); }}
                                 className="text-slate-500 hover:text-cyan-400 opacity-0 group-hover/title:opacity-100 transition-opacity p-1"
                                 title="تسمية الملف"
                               >
                                 <Edit2 size={16} />
                               </button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 font-cairo">
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatDate(file.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => downloadFile(file)}
                          className="flex-1 py-3 bg-white/5 hover:bg-cyan-500 hover:text-[#020617] rounded-xl transition-all flex items-center justify-center gap-2 font-bold font-cairo text-sm"
                        >
                          <Download size={18} />
                          تحميل
                        </button>
                        {(profile?.role === 'admin' || user?.uid === file.createdBy) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirmingId === file.id) {
                                handleDeleteFile(file.id);
                              } else {
                                setConfirmingId(file.id);
                              }
                            }}
                            className={cn("p-3 rounded-xl transition-all", confirmingId === file.id ? "bg-red-500 text-white" : "bg-red-500/10 text-red-500 hover:bg-red-500/30")}
                          >
                            {confirmingId === file.id ? <span className="text-xs font-bold font-cairo">تأكيد</span> : <Trash2 size={18} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {(activeFolder || searchTerm) && displayFiles.length === 0 && (
            <div className="text-center py-20">
              <Library className="mx-auto text-slate-700 mb-4" size={64} />
              <h3 className="text-2xl font-bold text-slate-500 font-cairo">مفيش ملفات بالاسم ده حالياً</h3>
              <p className="text-slate-600 font-cairo">جرب تبحث بكلمة تانية</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
