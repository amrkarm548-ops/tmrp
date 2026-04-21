import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, handleFirestoreError, OperationType, addDoc, serverTimestamp, deleteDoc, doc, getDoc, setDoc } from '../firebase';
import { storage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from '../firebase';
import { Upload, FolderPlus, Trash2, ArrowRight, Folder, Loader2, FolderOpen, Image, Music, FileText, Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LibraryItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string;
  url?: string;
  mimeType?: string;
  createdAt: unknown;
  createdBy: string;
  isChunked?: boolean;
  chunksCount?: number;
}

export function TamredianoLibrary() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [currentPath, setCurrentPath] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : 'root';

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  useEffect(() => {
    const q = query(
      collection(db, 'tamrediano_library'), 
      where('parentId', '==', currentFolderId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LibraryItem[];
      // Sort: folders first, then alphabetically
      docs.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setItems(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tamrediano_library');
    });

    return () => unsubscribe();
  }, [currentFolderId]);

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }

    try {
      await addDoc(collection(db, 'tamrediano_library'), {
        name: newFolderName.trim(),
        type: 'folder',
        parentId: currentFolderId,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (e) {
      console.error(e);
    }
  };

  const CHUNK_SIZE = 700 * 1024; // 700KB

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Free chunked fallback implementation
      const base64Data = await fileToBase64(file);
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
      
      const fileDocRef = await addDoc(collection(db, 'tamrediano_library'), {
        name: file.name,
        type: 'file',
        parentId: currentFolderId,
        mimeType: file.type,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        isChunked: true,
        chunksCount: totalChunks
      });

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await setDoc(doc(db, 'tamrediano_library_chunks', `${fileDocRef.id}_${i}`), {
          fileId: fileDocRef.id,
          index: i,
          data: chunk,
          createdBy: user.uid
        });
        setUploadProgress(((i + 1) / totalChunks) * 100);
      }

      setUploading(false);
      setUploadProgress(0);
      
    } catch(err: any) {
      console.error(err);
      alert("حدث خطأ أثناء رفع الملف");
      setUploading(false);
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    if (!user || (item.createdBy !== user.uid && profile?.role !== 'admin')) {
      return;
    }

    try {
      if (item.type === 'file' && item.url) {
        // Try deleting from storage too (ignoring errors if not found to ensure DB doc deletes)
        try {
          const fileRef = ref(storage, item.url);
          await deleteObject(fileRef);
        } catch (e) {
          console.warn("Storage object not found or couldn't be deleted", e);
        }
      }

      if (item.isChunked && item.chunksCount) {
        for (let i = 0; i < item.chunksCount; i++) {
          await deleteDoc(doc(db, 'tamrediano_library_chunks', `${item.id}_${i}`));
        }
      }

      await deleteDoc(doc(db, 'tamrediano_library', item.id));
      setConfirmingId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileClick = async (item: LibraryItem) => {
    if (item.url) {
      window.open(item.url, '_blank');
      return;
    }

    if (item.isChunked) {
      try {
        setDownloadingId(item.id);
        let fullBase64 = "";
        const chunksCount = item.chunksCount || 0;
        for (let i = 0; i < chunksCount; i++) {
          const chunkDoc = await getDoc(doc(db, 'tamrediano_library_chunks', `${item.id}_${i}`));
          if (chunkDoc.exists()) {
            fullBase64 += chunkDoc.data().data;
          }
        }
        
        // Convert Base64 data URI to Blob to avoid string length limits on href
        const [meta, base64] = fullBase64.split(',');
        const mimeType = meta ? meta.split(':')[1].split(';')[0] : 'application/octet-stream';
        const binaryString = window.atob(base64 || fullBase64); // Fallback if no meta
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        
        // Trigger download via createObjectURL
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = item.name || 'file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup memory
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch (err) {
        console.error(err);
        alert("فشل تحميل أو فتح الملف");
      } finally {
        setDownloadingId(null);
      }
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText size={20} className="text-blue-400" />;
    if (mimeType.startsWith('image/')) return <Image size={20} className="text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <Music size={20} className="text-pink-400" />;
    return <FileText size={20} className="text-blue-400" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white font-cairo flex items-center gap-3">
            <FolderOpen className="text-cyan-400" size={32} />
            مكتبة تمريضيانو الشاملة
          </h2>
          <p className="text-slate-400 font-cairo mt-2">شارك زمايلك الملفات والريكوردات والصور، ونظموها لمواد.</p>
        </div>

        <div className="flex gap-4">
          {isCreatingFolder ? (
            <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <input 
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="اسم المجلد..."
                className="bg-transparent border-none outline-none px-4 py-2 font-cairo text-sm text-white w-32"
              />
              <button 
                onClick={handleCreateFolder}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-3 transition-colors flex items-center justify-center font-bold"
              >
                +
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsCreatingFolder(true)}
              className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all flex items-center gap-2 font-cairo"
            >
              <FolderPlus size={18} />
              مجلد جديد
            </button>
          )}
          
          <div className="relative">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label 
              htmlFor="file-upload"
              className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl transition-all flex items-center gap-2 font-cairo cursor-pointer"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? `جارِ الرفع ${Math.round(uploadProgress)}%` : 'رفع ملف'}
            </label>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 bg-white/5 p-4 rounded-xl overflow-x-auto whitespace-nowrap">
        <button 
          onClick={() => setCurrentPath([])}
          className={`font-cairo ${currentPath.length === 0 ? 'text-white font-bold' : 'text-cyan-400 hover:underline'}`}
        >
          الرئيسية
        </button>
        {currentPath.map((crumb, index) => (
          <React.Fragment key={crumb.id}>
            <ArrowRight size={14} className="text-slate-500 flex-shrink-0" />
            <button 
              onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
              className={`font-cairo ${index === currentPath.length - 1 ? 'text-white font-bold' : 'text-cyan-400 hover:underline'}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-cyan-500" size={48} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentPath.length > 0 && (
            <div 
              onClick={() => setCurrentPath(currentPath.slice(0, -1))}
              className="glass p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors border-white/5 border border-dashed"
            >
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                <ArrowRight size={24} />
              </div>
              <span className="font-cairo font-bold text-slate-300">الرجوع</span>
            </div>
          )}

          <AnimatePresence>
            {items.map(item => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={item.id}
                className="group glass p-4 rounded-2xl border-white/5 hover:border-cyan-500/30 transition-all flex items-center gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 blur-xl -mr-10 -mt-10 group-hover:bg-cyan-500/10 transition-colors"></div>
                
                {item.type === 'folder' ? (
                  <div 
                    onClick={() => setCurrentPath([...currentPath, { id: item.id, name: item.name }])}
                    className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 cursor-pointer flex-shrink-0"
                  >
                    <Folder size={24} />
                  </div>
                ) : (
                  <button 
                    onClick={() => handleFileClick(item)}
                    disabled={downloadingId === item.id}
                    className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    {downloadingId === item.id ? <Loader2 size={20} className="animate-spin" /> : getFileIcon(item.mimeType)}
                  </button>
                )}

                <div 
                  className="flex-1 cursor-pointer truncate"
                  onClick={() => item.type === 'folder' ? setCurrentPath([...currentPath, { id: item.id, name: item.name }]) : handleFileClick(item)}
                >
                  <p className="font-bold text-white font-cairo truncate text-sm" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    {formatDate(item.createdAt)}
                  </p>
                </div>

                {(item.createdBy === user?.uid || profile?.role === 'admin') && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (confirmingId === item.id) {
                        handleDelete(item);
                      } else {
                        setConfirmingId(item.id);
                      }
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      confirmingId === item.id 
                        ? "bg-red-500 text-white opacity-100" 
                        : "text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {confirmingId === item.id ? <span className="text-xs font-bold font-cairo">تأكيد</span> : <Trash2 size={16} />}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && items.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <FolderOpen size={64} className="mx-auto text-slate-700 mb-4" />
              <h3 className="text-xl font-bold text-slate-500 font-cairo">هذا المجلد فارغ</h3>
              <p className="text-slate-600 font-cairo mt-2 text-sm">ارفع ملفات أو قم بإنشاء مجلدات جديدة هنا</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
