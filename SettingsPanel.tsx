import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Settings, User, Globe, BookOpen, MessageSquare, LogOut, Shield, CheckCircle2, Key, Edit3, Image as ImageIcon, Check, X, Volume2, Type, Eye, Clock, Zap, Database, Trash2, Cpu, Sparkles, Bell, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SettingsPanel: React.FC = () => {
  const { profile, updateProfile, logout } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoData, setEditPhotoData] = useState('');

  const startEditing = () => {
    setEditName(profile?.displayName || '');
    setEditPhotoData(profile?.photoURL || '');
    setIsEditingProfile(true);
  };

  const cancelEditing = () => {
    setIsEditingProfile(false);
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            // Forces React to re-render with the new photo string
            setEditPhotoData(dataUrl);
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    setIsSubmitting(true);
    try {
      if (editName.trim()) {
        await updateProfile({ displayName: editName, photoURL: editPhotoData });
      }
      setIsEditingProfile(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminUnlock = async () => {
    if (adminSecret === 'admin123') {
      try {
        await updateProfile({ role: 'admin' });
        setAdminSecret('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (err) {
        console.error("Unlock error", err);
      }
    } else {
      alert("كلمة المرور غير صحيحة");
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || !profile) return;

    setIsSubmitting(true);
    try {
      // 1. Save feedback to user's profile
      const currentFeedback = profile.feedback || [];
      await updateProfile({
        feedback: [...currentFeedback, feedback]
      });

      // 2. Save to global prompt reports collection for admin review
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      await addDoc(collection(db, 'prompt_reports'), {
        userId: profile.uid,
        userName: profile.displayName,
        userEmail: profile.email,
        promptSuggestion: feedback,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      setFeedback('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Feedback Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-white font-cairo flex items-center gap-4">
            <Settings className="text-cyan-400" size={40} />
            إعدادات الحساب
          </h2>
          <p className="text-slate-400 font-cairo mt-2 text-lg">خصص تجربتك في تمريضيانو زي ما تحب</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass p-8 rounded-[2.5rem] text-center space-y-4 border-white/5 relative">
            
            {isEditingProfile ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="relative inline-block group">
                  <img 
                    src={editPhotoData || profile?.photoURL || 'https://via.placeholder.com/150'} 
                    alt="Preview" 
                    className="w-32 h-32 rounded-[2.5rem] object-cover mx-auto border-4 border-cyan-500/50 shadow-2xl transition-all"
                  />
                  <label className="absolute inset-0 bg-black/60 rounded-[2.5rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer z-10">
                    <div className="flex flex-col items-center">
                      <ImageIcon className="text-white mb-1" size={24} />
                      <span className="text-[10px] text-white font-bold font-cairo">تغيير الصورة</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" />
                  </label>
                </div>
                
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="اسم المستخدم"
                    className="w-full bg-white/5 border border-cyan-500/30 rounded-xl p-3 text-white text-center outline-none focus:border-cyan-500 font-cairo text-lg"
                  />
                </div>

                <div className="flex gap-2 justify-center pt-2">
                  <button 
                    onClick={saveProfile}
                    disabled={isSubmitting || !editName.trim()}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-2 rounded-xl font-bold font-cairo flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Check size={18} /> حفظ
                  </button>
                  <button 
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl font-bold font-cairo flex items-center justify-center gap-2 transition-all"
                  >
                    <X size={18} /> إلغاء
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <button 
                  onClick={startEditing}
                  className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 rounded-xl transition-all"
                  title="تعديل الحساب"
                >
                  <Edit3 size={18} />
                </button>
                <div className="relative inline-block">
                  <img 
                    src={profile?.photoURL} 
                    alt={profile?.displayName} 
                    className="w-32 h-32 rounded-[2.5rem] object-cover mx-auto border-4 border-white/5 shadow-2xl"
                  />
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-cyan-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-lg">
                    <User size={20} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white font-cairo">{profile?.displayName}</h3>
                  <p className="text-slate-500 text-sm font-cairo break-all px-2">{profile?.email}</p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-bold uppercase tracking-widest">
                  <Shield size={14} />
                  {profile?.role}
                </div>
              </motion.div>
            )}
          </div>

          <button 
            onClick={logout}
            className="w-full p-6 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-[2rem] border border-red-500/10 transition-all flex items-center justify-center gap-3 font-bold font-cairo text-lg"
          >
            <LogOut size={24} />
            تسجيل الخروج
          </button>
        </div>

        {/* Settings Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* 1. General Preferences - Box 1 */}
          <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-10 -mt-10"></div>
            <div className="flex items-center gap-4 border-b border-white/5 pb-6 relative z-10">
              <Layout className="text-cyan-400" size={28} />
              <h3 className="text-2xl font-bold text-white font-cairo">المظهر والواجهة</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Globe size={16} />
                  اللغة المفضلة
                </label>
                <select 
                  value={profile?.settings?.preferredLanguage || 'Arabic'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, preferredLanguage: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Arabic" className="bg-[#0f172a] text-white">العامية المصرية (وواجهة عربي)</option>
                  <option value="Fusha" className="bg-[#0f172a] text-white">العربية الفصحى</option>
                  <option value="English" className="bg-[#0f172a] text-white">English Only</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Type size={16} />
                  حجم الخط الافتراضي للملفات
                </label>
                <select 
                  value={profile?.settings?.fontSize || 'Medium'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, fontSize: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Small" className="bg-[#0f172a] text-white">صغير (مساحة أكبر)</option>
                  <option value="Medium" className="bg-[#0f172a] text-white">متوسط (الافتراضي)</option>
                  <option value="Large" className="bg-[#0f172a] text-white">كبير (مريح للعين)</option>
                  <option value="ExtraLarge" className="bg-[#0f172a] text-white">عملاق (للقراءة عن بعد)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Eye size={16} />
                  التباين العالي (High Contrast)
                </label>
                <select 
                  value={profile?.settings?.highContrast ? '1' : '0'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, highContrast: e.target.value === '1' } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="0" className="bg-[#0f172a] text-white">معطل (ألوان هادئة)</option>
                  <option value="1" className="bg-[#0f172a] text-white">مفعل (ألوان حادة للرؤية)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  خط عسر القراءة (Dyslexia)
                </label>
                <select 
                  value={profile?.settings?.dyslexiaFont ? '1' : '0'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, dyslexiaFont: e.target.value === '1' } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="0" className="bg-[#0f172a] text-white">خط تمريضيانو الأساسي</option>
                  <option value="1" className="bg-[#0f172a] text-white">تفعيل خط عسر القراءة المفتوح</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. AI & Study Box */}
          <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-10 -mt-10"></div>
            <div className="flex items-center gap-4 border-b border-white/5 pb-6 relative z-10">
              <Cpu className="text-blue-400" size={28} />
              <h3 className="text-2xl font-bold text-white font-cairo">الذكاء الاصطناعي والمذاكرة</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <BookOpen size={16} />
                  وضع المذاكرة الافتراضي
                </label>
                <select 
                  value={profile?.settings?.defaultStudyMode || 'BONBONAYA'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, defaultStudyMode: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="BONBONAYA" className="bg-[#0f172a] text-white">البونبوناية (يفضل للمراجعة)</option>
                  <option value="CHEAT_SHEET" className="bg-[#0f172a] text-white">البرشامة</option>
                  <option value="NCLEX" className="bg-[#0f172a] text-white">NCLEX Expert (احترافي)</option>
                  <option value="ZERO_KNOWLEDGE" className="bg-[#0f172a] text-white">تحت الصفر (من الصفر)</option>
                  <option value="EXTRACTS" className="bg-[#0f172a] text-white">المستخرجات</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Sparkles size={16} />
                  سلوك شخصية الذكاء الاصطناعي
                </label>
                <select 
                  value={profile?.settings?.aiPersona || 'Friendly'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, aiPersona: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Friendly" className="bg-[#0f172a] text-white">ودود ومرح (الافتراضي)</option>
                  <option value="Strict" className="bg-[#0f172a] text-white">أكاديمي صارم (للمراجعة الجادة)</option>
                  <option value="Sarcastic" className="bg-[#0f172a] text-white">ساخر ومحفز (للخروج من الملل)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Shield size={16} />
                  مستوى صعوبة الأسئلة (MCQ)
                </label>
                <select 
                  value={profile?.settings?.mcqDifficulty || 'Medium'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, mcqDifficulty: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Easy" className="bg-[#0f172a] text-white">مباشر ومبسط (للفهم الأولي)</option>
                  <option value="Medium" className="bg-[#0f172a] text-white">متوسط (المستوى الجامعي العادي)</option>
                  <option value="Hard" className="bg-[#0f172a] text-white">صعب جداً ومركب (للعباقرة والـ NCLEX)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <BookOpen size={16} />
                  طول الملخصات المنتجة (Summaries)
                </label>
                <select 
                  value={profile?.settings?.summaryLength || 'Medium'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, summaryLength: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Short" className="bg-[#0f172a] text-white">مقتضب (زتونة الزتونة)</option>
                  <option value="Medium" className="bg-[#0f172a] text-white">متوسط (توازن بين الشرح والاختصار)</option>
                  <option value="Detailed" className="bg-[#0f172a] text-white">مفصل (شامل لكل النقط الفرعية)</option>
                </select>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Globe size={16} />
                  ترجمة المصطلحات الطبية
                </label>
                <select 
                  value={profile?.settings?.medicalTermTranslation || 'Auto'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, medicalTermTranslation: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Auto" className="bg-[#0f172a] text-white">ترجمة تلقائية بجوار الكلمة</option>
                  <option value="Hover" className="bg-[#0f172a] text-white">عند التحديد فقط (للتدريب على الإنجليزي)</option>
                  <option value="None" className="bg-[#0f172a] text-white">دون ترجمة إطلاقاً</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Audio & Focus */}
          <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full -mr-10 -mt-10"></div>
            <div className="flex items-center gap-4 border-b border-white/5 pb-6 relative z-10">
              <Volume2 className="text-purple-400" size={28} />
              <h3 className="text-2xl font-bold text-white font-cairo">الصوت وتركيز المذاكرة</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Volume2 size={16} />
                  المؤثرات الصوتية للواجهة
                </label>
                <select 
                  value={profile?.settings?.soundEffects ? '1' : '0'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, soundEffects: e.target.value === '1' } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-purple-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="1" className="bg-[#0f172a] text-white">مفعل (أصوات تفاعلية لذيذة)</option>
                  <option value="0" className="bg-[#0f172a] text-white">معطل (وضع الهدوء التام)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Bell size={16} />
                  إشعارات النظام والتحفيز
                </label>
                <select 
                  value={profile?.settings?.pushNotifications ? '1' : '0'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, pushNotifications: e.target.value === '1' } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-purple-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="1" className="bg-[#0f172a] text-white">مفعل (تذكير وتشجيع)</option>
                  <option value="0" className="bg-[#0f172a] text-white">معطل (لا تزعجني)</option>
                </select>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Clock size={16} />
                  مؤقت التركيز التلقائي (Pomodoro)
                </label>
                <select 
                  value={profile?.settings?.focusTimerLength?.toString() || '0'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, focusTimerLength: parseInt(e.target.value) } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-purple-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="0" className="bg-[#0f172a] text-white">معطل</option>
                  <option value="25" className="bg-[#0f172a] text-white">جلسة خفيفة (25 دقيقة مذاكرة / 5 راحة)</option>
                  <option value="45" className="bg-[#0f172a] text-white">جلسة متوسطة (45 دقيقة مذاكرة / 10 راحة)</option>
                  <option value="60" className="bg-[#0f172a] text-white">جلسة وحش (60 دقيقة متواصلة)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Performance & Storage */}
          <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-10 -mt-10"></div>
            <div className="flex items-center gap-4 border-b border-white/5 pb-6 relative z-10">
              <Zap className="text-emerald-400" size={28} />
              <h3 className="text-2xl font-bold text-white font-cairo">الأداء والبيانات</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Zap size={16} />
                  سرعة الحركات (Animations)
                </label>
                <select 
                  value={profile?.settings?.animationSpeed || 'Full'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, animationSpeed: e.target.value } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-emerald-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="Full" className="bg-[#0f172a] text-white">كاملة (أقصى متعة بصرية)</option>
                  <option value="Reduced" className="bg-[#0f172a] text-white">مخفضة (لتوفير البطارية والأجهزة الضعيفة)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                  <Database size={16} />
                  وضع توفير البيانات (Data Saver)
                </label>
                <select 
                  value={profile?.settings?.dataSaver ? '1' : '0'}
                  onChange={(e) => updateProfile({ settings: { ...profile!.settings, dataSaver: e.target.value === '1' } })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-emerald-500 font-cairo text-lg hover:border-white/20 transition-all cursor-pointer"
                >
                  <option value="0" className="bg-[#0f172a] text-white">إيقاف (تحميل أعلى جودة)</option>
                  <option value="1" className="bg-[#0f172a] text-white">مفعل (يمنع التحميل التلقائي للصور الكبيرة)</option>
                </select>
              </div>

              <div className="space-y-3 md:col-span-2 pt-4">
                <button 
                  onClick={() => {
                    if (window.confirm("هل أنت متأكد من مسح الملفات المؤقتة؟ لن يتم مسح بيانات حسابك الأساسية، بل فقط الملفات المؤقتة المخزنة في المتصفح لتسريع الأداء.")) {
                      localStorage.clear();
                      alert("تم مسح الملفات المؤقتة للبرنامج بنجاح");
                    }
                  }}
                  className="w-full p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-2xl transition-all font-bold font-cairo flex items-center justify-center gap-3"
                >
                  <Trash2 size={20} />
                  مسح ذاكرة التخزين المؤقت (Clear Cache)
                </button>
                <p className="text-xs text-slate-500 font-cairo text-center mt-2">
                  استخدم هذا الخيار إذا واجهت بطئاً أو مشاكل في عرض الملفات القديمة
                </p>
              </div>
            </div>

            {/* Admin Secret */}
            <div className="border-t border-white/5 pt-8 space-y-4">
              <label className="text-sm font-bold text-slate-400 font-cairo flex items-center gap-2">
                <Key size={16} />
                تفعيل الإدارة (سري)
              </label>
              <div className="flex gap-4">
                <input 
                  type="password"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  placeholder="أدخل الرمز السري للإدارة..."
                  className="flex-1 bg-[#0f172a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-500 font-cairo"
                />
                <button 
                  onClick={handleAdminUnlock}
                  className="px-8 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-2xl font-bold font-cairo transition-all border border-amber-500/20"
                >
                  تفعيل
                </button>
              </div>
            </div>
          </div>

          {/* Problem Report Box (Dynamic Feedback) */}
          <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
            
            <div className="flex items-center gap-4 border-b border-white/5 pb-6 relative z-10">
              <MessageSquare className="text-amber-400" size={28} />
              <h3 className="text-2xl font-bold text-white font-cairo">صندوق الإبلاغ عن المشاكل</h3>
            </div>

            <p className="text-slate-400 font-cairo text-lg leading-relaxed relative z-10">
              لو فيه حاجة مش عاجباك في طريقة استخراج الملفات أو الأسئلة، قولنا هنا والنظام هيتعلم يتفاداها المرة الجاية تلقائياً!
            </p>

            <form onSubmit={handleFeedbackSubmit} className="space-y-6 relative z-10">
              <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="مثال: مش عايز شرح الأدوية يكون طويل زيادة عن اللزوم..."
                className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white outline-none focus:border-amber-500 font-cairo text-lg min-h-[150px] transition-all"
              />
              
              <button 
                type="submit"
                disabled={isSubmitting || !feedback.trim()}
                className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-[#020617] font-bold rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 font-cairo text-xl"
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-2 border-[#020617] border-t-transparent animate-spin rounded-full"></div>
                ) : (
                  <>
                    إرسال البلاغ
                    <CheckCircle2 size={24} />
                  </>
                )}
              </button>

              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 text-green-400 font-cairo justify-center bg-green-500/10 p-4 rounded-2xl border border-green-500/20"
                >
                  <CheckCircle2 size={20} />
                  تم استلام بلاغك بنجاح.. النظام هيتحدث فوراً!
                </motion.div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
