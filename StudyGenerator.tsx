import React, { useState, useRef } from 'react';
import { generateStudyMaterial } from '../services/aiService';
import { db, doc, updateDoc, setDoc, serverTimestamp } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { FileText, Zap, Scissors, Download, Plus, Settings2, BrainCircuit, X, GraduationCap, ListChecks, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface GenerationTask {
  id: string;
  type: string;
  status: 'loading' | 'completed' | 'error';
  result?: string;
  title: string;
  error?: string;
  originalPayload?: string;
}

export function StudyGenerator({ globalFiles, setGlobalFiles }: { globalFiles: File[], setGlobalFiles: React.Dispatch<React.SetStateAction<File[]>> }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [type, setType] = useState<'BONBONAYA' | 'EXTRACTS' | 'MCQ_MAKER' | 'CHEAT_SHEET' | 'NCLEX' | 'ZERO_KNOWLEDGE' | 'TERMINOLOGY'>('BONBONAYA');
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced Settings
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [questionCount, setQuestionCount] = useState(10);
  const [customStyle, setCustomStyle] = useState('');
  const [creatorName, setCreatorName] = useState(profile?.displayName || '');
  const [showSettings, setShowSettings] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setGlobalFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setGlobalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (overrideOptions: { count?: number; style?: string; length?: 'short' | 'normal' | 'long' } = {}) => {
    if (!content.trim() && globalFiles.length === 0) {
      // Replaced alert with early return to respect iFrame guidelines.
      return;
    }

    const taskId = Math.random().toString(36).substring(7);
    const taskTitle = content.split('\n')[0].substring(0, 30) || `ملف ${type}`;
    
    const newTask: GenerationTask = {
      id: taskId,
      type,
      status: 'loading',
      title: taskTitle
    };

    setTasks(prev => [newTask, ...prev]);

    let finalContent = content;
    const images: { mimeType: string, data: string }[] = [];
    
    if (globalFiles.length > 0) {
      try {
        const fileTexts = await Promise.all(globalFiles.map(async (file) => {
          if (file.type === 'text/plain') return await file.text();
          if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .filter((item): item is { str: string } => 'str' in item)
                .map((item) => item.str)
                .join(' ');
              fullText += pageText + '\n';
            }
            return fullText;
          }
          if (file.type.startsWith('image/')) {
            const buffer = await file.arrayBuffer();
            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            images.push({ mimeType: file.type, data: base64 });
            return `[Image Attached: ${file.name}]`;
          }
          return `[File: ${file.name}]`; 
        }));
        finalContent += '\n\n' + fileTexts.join('\n\n');
      } catch (error) {
        console.error('Error reading files:', error);
      }
    }

    try {
      const html = await generateStudyMaterial(finalContent, type, {
        difficulty: type === 'NCLEX' ? 'Extreme' : difficulty,
        count: overrideOptions.count || questionCount,
        style: overrideOptions.style || customStyle,
        length: overrideOptions.length || 'normal',
        creatorName: creatorName
      }, images);
      
      // Save to Firestore using setDoc so we can update it later
      if (user) {
        try {
          await setDoc(doc(db, 'files', taskId), {
            id: taskId,
            title: taskTitle,
            type,
            content: html,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            category: 'عام'
          });
        } catch (err) {
          console.error('Error saving file to Firestore:', err);
        }
      }

      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'completed', result: html, originalPayload: finalContent } : t
      ));
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'error', error: message } : t
      ));
    }
  };

  const downloadPDF = (result: string, taskType: string) => {
    const isRTL = taskType !== 'EXTRACTS';
    const typeLabel = types.find(t => t.id === taskType)?.label || taskType;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>tamrediano - ${typeLabel}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
              
              :root {
                --primary: #0891b2;
                --secondary: #0e7490;
                --accent: #22d3ee;
                --text: #0f172a;
                --bg: #ffffff;
              }

              body { 
                font-family: 'Cairo', sans-serif; 
                margin: 0; 
                padding: 0;
                background: var(--bg);
                color: var(--text);
                direction: ${isRTL ? 'rtl' : 'ltr'};
                text-align: ${isRTL ? 'right' : 'left'};
              }

              /* Cover Page Styling */
              .cover-page {
                height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 60px;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                position: relative;
                overflow: hidden;
                page-break-after: always;
                border: 20px solid white;
              }

              .cover-page::before {
                content: '✚';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 600px;
                color: rgba(8, 145, 178, 0.03);
                z-index: 0;
                pointer-events: none;
              }

              .cover-brand {
                font-size: 64px;
                font-weight: 800;
                color: var(--primary);
                margin-bottom: 10px;
                letter-spacing: -2px;
                z-index: 1;
              }

              .cover-subtitle {
                font-size: 22px;
                color: #64748b;
                margin-bottom: 80px;
                font-weight: 500;
                z-index: 1;
              }

              .cover-module-box {
                background: white;
                padding: 40px 80px;
                border-radius: 32px;
                box-shadow: 0 30px 60px rgba(8, 145, 178, 0.15);
                border: 1px solid rgba(8, 145, 178, 0.1);
                margin-bottom: 60px;
                z-index: 1;
              }

              .cover-module-label {
                font-size: 16px;
                text-transform: uppercase;
                color: var(--primary);
                letter-spacing: 3px;
                margin-bottom: 12px;
                font-weight: 700;
              }

              .cover-module-name {
                font-size: 42px;
                font-weight: 800;
                color: var(--text);
              }

              .cover-footer {
                position: absolute;
                bottom: 60px;
                font-size: 14px;
                color: #94a3b8;
              }

              /* Main Content Styling */
              .content-container {
                padding: 60px 50px;
              }

              header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid var(--primary);
                margin-bottom: 40px;
                padding-bottom: 15px;
              }

              .header-brand { 
                color: var(--primary); 
                font-weight: 800; 
                font-size: 20px; 
              }

              .header-info { 
                color: #64748b; 
                font-size: 13px; 
                font-weight: 500;
              }
              
              /* Fix Spacing and Visibility */
              * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              
              p, h1, h2, h3, h4, h5, h6 { margin-top: 0; margin-bottom: 1.2rem; line-height: 1.7; }
              
              .card, .question-card, .mcq-item, .study-block { 
                page-break-inside: avoid; 
                break-inside: avoid;
                margin-bottom: 25px;
                padding: 25px;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                background: #f8fafc;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }

              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              td, th { border: 1px solid #e2e8f0; padding: 14px; text-align: ${isRTL ? 'right' : 'left'}; }
              th { background: #f1f5f9; font-weight: 700; color: var(--primary); }
              
              .content-area { display: block !important; }
              
              @media print {
                body { background: white; }
                .cover-page { background: #f0f9ff !important; }
                .content-container { padding: 40px 30px; }
              }
            </style>
          </head>
          <body>
            <div class="cover-page">
              <div class="cover-brand">tamrediano</div>
              <div class="cover-subtitle">المنصة الأكاديمية الأولى لطلاب التمريض والطب</div>
              
              <div class="cover-module-box">
                <div class="cover-module-label">وحدة الدراسة الذكية</div>
                <div class="cover-module-name">${typeLabel}</div>
              </div>
              
              <div class="cover-footer">
                تم التوليد بواسطة مساعد tamrediano الذكي &copy; 2026
              </div>
            </div>

            <div class="content-container">
              <header>
                <div class="header-brand">tamrediano || تمريضيانو</div>
                <div class="header-info">العام الأكاديمي 2026 | ${typeLabel}</div>
              </header>
              <div class="content-area">
                ${result}
              </div>
            </div>

            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  // Optional: window.close();
                }, 1000);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleModifyTask = async (taskId: string, originalPayload: string, taskType: string, options: { count?: number; style?: string; length?: 'short' | 'normal' | 'long' }) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'loading' } : t));
    try {
      const html = await generateStudyMaterial(originalPayload, taskType as keyof typeof import('../services/aiService').PROMPTS, {
        difficulty: taskType === 'NCLEX' ? 'Extreme' : difficulty,
        ...options
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', result: html } : t));
      if (user) {
        await updateDoc(doc(db, 'files', taskId), { content: html });
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: msg } : t));
    }
  };

  const types = [
    { id: 'BONBONAYA', label: 'البونبوناية', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { id: 'EXTRACTS', label: 'المستخرجات', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'TERMINOLOGY', label: 'المصطلحات', icon: FileText, color: 'text-teal-400', bg: 'bg-teal-400/10' },
    { id: 'MCQ_MAKER', label: 'بنك الأسئلة', icon: ListChecks, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'NCLEX', label: 'N-CLEX Expert', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'CHEAT_SHEET', label: 'البرشامة', icon: Scissors, color: 'text-red-400', bg: 'bg-red-400/10' },
    { id: 'ZERO_KNOWLEDGE', label: 'مذاكرة من الصفر', icon: GraduationCap, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ] as const;

  const showAdvancedSettings = type === 'MCQ_MAKER' || type === 'NCLEX';
  const showDifficulty = type === 'MCQ_MAKER';

  return (
    <div className="space-y-8">
      <div className="glass p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
        
        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 shadow-inner">
                <Sparkles size={24} />
              </div>
              <h2 className="text-3xl font-black text-white font-cairo tracking-tight">محرك المذاكرة الذكي</h2>
            </div>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-3 rounded-2xl transition-all flex items-center gap-2 font-bold font-cairo text-sm",
                showSettings 
                  ? "bg-cyan-500 text-[#020617] shadow-lg shadow-cyan-500/20" 
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              )}
            >
              <Settings2 size={20} />
              {showSettings ? 'إخفاء الإعدادات' : 'إعدادات متقدمة'}
            </button>
          </div>

          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden"
              >
                {showAdvancedSettings && (
                  <>
                    {showDifficulty && (
                      <div className="space-y-3">
                        <label className="text-sm font-bold font-cairo text-slate-400 flex items-center gap-2">
                          <AlertCircle size={14} />
                          مستوى الصعوبة
                        </label>
                        <select 
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo appearance-none"
                        >
                          <option value="Beginner" className="bg-[#0f172a] text-white">مبتدئ (Beginner)</option>
                          <option value="Intermediate" className="bg-[#0f172a] text-white">متوسط (Intermediate)</option>
                          <option value="Advanced" className="bg-[#0f172a] text-white">متقدم (Advanced)</option>
                          <option value="NCLEX-RN" className="bg-[#0f172a] text-white">NCLEX-RN Level</option>
                        </select>
                      </div>
                    )}
                    <div className={cn("space-y-3", !showDifficulty && "md:col-span-1")}>
                      <label className="text-sm font-bold font-cairo text-slate-400 flex items-center gap-2">
                        <ListChecks size={14} />
                        عدد الأسئلة (حتى 300)
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="300"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </>
                )}
                {type === 'CHEAT_SHEET' && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold font-cairo text-slate-400 flex items-center gap-2">
                      <Sparkles size={14} />
                      اسم المنشئ (البرشامة)
                    </label>
                    <input 
                      type="text"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      placeholder="اترك فارغاً إن لم ترغب"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo"
                    />
                  </div>
                )}
                <div className={cn("space-y-3", (!showAdvancedSettings && type !== 'CHEAT_SHEET') && "md:col-span-3")}>
                  <label className="text-sm font-bold font-cairo text-slate-400 flex items-center gap-2">
                    <Sparkles size={14} />
                    تعديل الاستايل (اختياري)
                  </label>
                  <input 
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="مثلاً: أضف مربعات خضراء..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative group">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="انسخ محتوى المحاضرة هنا أو ارفع ملفاتك تحت..."
              className="w-full h-64 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 text-slate-200 focus:border-cyan-500 outline-none transition-all font-cairo text-lg leading-relaxed resize-none shadow-inner"
            />
            <div className="absolute bottom-6 left-6 flex items-center gap-3">
              <span className="text-xs text-slate-600 font-mono">{content.length} characters</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <AnimatePresence>
                {globalFiles.map((file, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-3 bg-cyan-500/10 px-4 py-2 rounded-2xl border border-cyan-500/20 text-sm"
                  >
                    <FileText className="text-cyan-400" size={16} />
                    <span className="text-cyan-100 font-bold truncate max-w-[200px]">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="text-cyan-400 hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-2xl border border-dashed border-white/10 text-sm text-slate-400 transition-all hover:border-cyan-500/50"
              >
                <Plus size={18} />
                إضافة ملفات / صور
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                multiple 
                className="hidden" 
                accept=".txt,.pdf,.png,.jpg,.jpeg"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-[2rem] border transition-all duration-500 group relative overflow-hidden",
                  type === t.id 
                    ? `border-cyan-500 ${t.bg} shadow-2xl shadow-cyan-500/10` 
                    : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                )}
              >
                {type === t.id && (
                  <motion.div 
                    layoutId="typeHighlight"
                    className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"
                  />
                )}
                <t.icon className={cn("w-8 h-8 transition-transform duration-500 group-hover:scale-110", type === t.id ? "text-cyan-400" : "text-slate-600")} />
                <span className={cn("font-cairo text-sm font-bold", type === t.id ? "text-cyan-400" : "text-slate-500")}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={!content.trim() && globalFiles.length === 0}
            className="w-full py-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-900 text-[#020617] font-black rounded-[2rem] transition-all flex items-center justify-center gap-4 font-cairo text-2xl shadow-2xl shadow-cyan-500/30 group"
          >
            <Zap className="group-hover:scale-125 transition-transform" size={28} />
            ابدأ السحر الذكي
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-8">
        <AnimatePresence>
          {tasks.map((task) => (
            <motion.div 
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-10 rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-6">
                  {task.status === 'loading' ? (
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-2xl" />
                      <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-2xl animate-spin" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-black text-white font-cairo truncate max-w-[200px] md:max-w-xl">
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold bg-white/5 px-3 py-1 rounded-full text-slate-400 uppercase tracking-widest">
                        {task.type}
                      </span>
                      {task.status === 'loading' && (
                        <span className="text-[10px] font-bold text-cyan-400 animate-pulse">جاري المعالجة...</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  {task.status === 'completed' && task.result && (
                    <button
                      onClick={() => downloadPDF(task.result!, task.type)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white text-[#020617] rounded-2xl font-black transition-all hover:bg-cyan-50 shadow-xl shadow-white/5 font-cairo"
                    >
                      <Download size={20} />
                      تحميل PDF
                    </button>
                  )}
                  <button 
                    onClick={() => removeTask(task.id)}
                    className="p-4 bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              {task.status === 'loading' && (
                <div className="flex flex-col items-center gap-6 py-20">
                  <div className="w-24 h-24 bg-cyan-500/5 rounded-[2.5rem] flex items-center justify-center relative">
                    <Sparkles className="text-cyan-400 animate-bounce" size={40} />
                    <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-[2.5rem] animate-ping" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-2xl font-black text-white font-cairo">جاري السحر... ✨</p>
                    <p className="text-slate-500 font-cairo text-lg">الذكاء الاصطناعي بيحلل المحتوى وبيصمم لك الملف بأعلى جودة</p>
                  </div>
                </div>
              )}

              {task.status === 'completed' && task.result && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button 
                      onClick={() => handleModifyTask(task.id, task.originalPayload || '', task.type, { count: questionCount + 10 })}
                      className="p-4 bg-green-500/5 hover:bg-green-500/10 text-green-400 border border-green-500/10 rounded-[1.5rem] text-sm font-bold font-cairo transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={18} />
                      توليد أسئلة أكثر
                    </button>
                    <button 
                      onClick={() => handleModifyTask(task.id, task.originalPayload || '', task.type, { length: 'long' })}
                      className="p-4 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 border border-blue-500/10 rounded-[1.5rem] text-sm font-bold font-cairo transition-all flex items-center justify-center gap-2"
                    >
                      <Zap size={18} />
                      شرح أطول وأعمق
                    </button>
                    <button 
                      onClick={() => handleModifyTask(task.id, task.originalPayload || '', task.type, { length: 'short' })}
                      className="p-4 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-400 border border-yellow-500/10 rounded-[1.5rem] text-sm font-bold font-cairo transition-all flex items-center justify-center gap-2"
                    >
                      <Scissors size={18} />
                      ملخص أسرع
                    </button>
                    <button 
                      onClick={() => {
                        const styleReq = prompt('اكتب التعديل اللي عايزه للاستايل (مثال: خلي الخلفية سودة، أو شكل كروت):');
                        if(styleReq) handleModifyTask(task.id, task.originalPayload || '', task.type, { style: styleReq });
                      }}
                      className="p-4 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 border border-purple-500/10 rounded-[1.5rem] text-sm font-bold font-cairo transition-all flex items-center justify-center gap-2"
                    >
                      <Settings2 size={18} />
                      تعديل الستايل
                    </button>
                  </div>
                  <div 
                    className="generated-content bg-white text-slate-900 rounded-[2.5rem] p-10 overflow-x-auto min-h-[400px] max-h-[800px] overflow-y-auto shadow-2xl border-8 border-slate-100"
                    dangerouslySetInnerHTML={{ __html: task.result }}
                  />
                </motion.div>
              )}
              
              {task.status === 'error' && (
                <div className="p-8 bg-red-500/5 border border-red-500/10 rounded-[2rem] text-red-400 text-center font-cairo flex flex-col items-center gap-4">
                  <AlertCircle size={48} />
                  <p className="text-xl font-bold">{task.error || 'حدث خطأ أثناء التوليد.. حاول مرة أخرى'}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
