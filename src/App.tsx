import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { 
  Home, 
  Trash2, 
  Scan, 
  User, 
  Mail, 
  Phone, 
  Share2, 
  CheckCircle2, 
  ArrowLeft,
  Calendar,
  Smartphone,
  Copy,
  Download,
  Layout,
  Plus,
  Database,
  Send,
  Hash,
  Users,
  Wallet,
  DollarSign,
  Lock,
  CreditCard,
  ArrowRight,
  LogOut,
  ShieldAlert,
  KeyRound,
  LogIn,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { domToPng } from 'modern-screenshot';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  referral: string;
  teamCode: string;
  cashback: string;
  amountPaid: string;
  gateway: 'Bkash' | 'Nagad' | 'Rocket' | 'Upay' | 'Google Pay' | 'UPI';
  verifiedDate: string;
  transactionId: string;
  logoUrl?: string;
}

const INITIAL_DATA: ProfileData = {
  fullName: '',
  email: '',
  phone: '',
  referral: '',
  teamCode: '336251',
  cashback: '300',
  amountPaid: '1200',
  gateway: 'Bkash',
  verifiedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  transactionId: '#TR-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.floor(100+Math.random()*900),
  logoUrl: undefined
};

// Firebase Operation Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  // States
  const [data, setData] = useState<ProfileData>(INITIAL_DATA);
  const [showPreview, setShowPreview] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Auth & Access States
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem('partner_access_granted') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [correctPin, setCorrectPin] = useState<string | null>(null);
  const [globalLogoUrl, setGlobalLogoUrl] = useState<string | undefined>(undefined);
  const [pinError, setPinError] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Global Settings (PIN & Logo) from Firebase
  useEffect(() => {
    const path = 'settings/global';
    const unsub = onSnapshot(doc(db, path), (docSnap) => {
      if (docSnap.exists()) {
        const settings = docSnap.data();
        setCorrectPin(settings.accessPin);
        setGlobalLogoUrl(settings.logoUrl);
      } else {
        setCorrectPin('1122');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsub();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const path = `admins/${user.uid}`;
        try {
          // Check if user is in admins collection
          const adminDoc = await getDoc(doc(db, path));
          if (adminDoc.exists()) {
            setIsAdmin(true);
            // Automatically authorize admins to bypass PIN screen
            setIsAuthorized(true);
            sessionStorage.setItem('partner_access_granted', 'true');
          } else {
            // Check by email if needed (bootstrap)
            if (user.email === 'kazih6684@gmail.com') {
              try {
                await setDoc(doc(db, path), {
                  email: user.email,
                  role: 'superadmin'
                }, { merge: true });
              } catch (e) {
                console.warn("Bootstrap admin doc creation failed, but continuing as admin state is set locally", e);
              }
              setIsAdmin(true);
              setIsAuthorized(true);
              sessionStorage.setItem('partner_access_granted', 'true');
            } else {
              setIsAdmin(false);
            }
          }
        } catch (error) {
          console.error("Admin check failed", error);
          // If we can't check admin status, we don't grant it
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  const handlePinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pinInput === correctPin) {
      setIsAuthorized(true);
      sessionStorage.setItem('partner_access_granted', 'true');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const handleAdminLogin = async () => {
    if (isAdminLoading) return;
    setIsAdminLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if ((err as any).code !== 'auth/cancelled-popup-request') {
        console.error('Admin login failed:', err);
      }
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAuthorized(false);
    sessionStorage.removeItem('partner_access_granted');
  };

  const handleUpdatePin = async () => {
    const pin = newPin.trim();
    if (pin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }
    const path = 'settings/global';
    try {
      await setDoc(doc(db, path), { accessPin: pin }, { merge: true });
      setIsChangingPin(false);
      setNewPin('');
      alert('PIN Updated Successfully!');
    } catch (err: any) {
      console.error('PIN Update failed:', err);
      if (err.message?.includes('insufficient permissions')) {
        alert('Permission Denied: Admin privileges required.');
      } else {
        alert('Failed to update PIN. Please try again.');
      }
    }
  };


  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const logoDataUrl = reader.result as string;
        setData(prev => ({ ...prev, logoUrl: logoDataUrl }));
        
        // If admin is logged in, also update the global logo
        if (isAdmin) {
          const path = 'settings/global';
          try {
            // Use setDoc with merge to handle cases where the document might not exist yet
            await setDoc(doc(db, path), { 
              logoUrl: logoDataUrl,
              accessPin: correctPin || '1122' // Ensure accessPin is present to satisfy security rules if creating
            }, { merge: true });
          } catch (err) {
            console.error('Failed to update global logo:', err);
            handleFirestoreError(err, OperationType.WRITE, path);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateData = () => {
    const lines = pastedText.split('\n');
    const newData = { ...data };
    lines.forEach(line => {
      const lower = line.toLowerCase();
      if (lower.includes('name')) newData.fullName = line.split(':')[1]?.trim() || newData.fullName;
      if (lower.includes('email')) newData.email = line.split(':')[1]?.trim() || newData.email;
      if (lower.includes('phone') || lower.includes('whatsapp')) newData.phone = line.split(':')[1]?.trim() || newData.phone;
      if (lower.includes('ref')) newData.referral = line.split(':')[1]?.trim() || newData.referral;
    });
    setData(newData);
  };

  const handleDownload = async () => {
    if (previewRef.current) {
      try {
        setIsExporting(true);
        const dataUrl = await domToPng(previewRef.current, {
          scale: 3,
          backgroundColor: '#0F172A',
          quality: 1,
          features: { removeControlCharacter: true }
        });
        const link = document.createElement('a');
        link.download = `unity-activation-${data.fullName.toLowerCase().replace(/\s+/g, '-') || 'card'}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        setIsExporting(false);
      }
    }
  };

  // Render Gatekeeper if not authorized
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-4 text-white">
        <div className="w-full max-w-sm space-y-8 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="h-20 w-20 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
               <ShieldCheck size={40} />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight uppercase">Access Locked</h1>
              <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">Enter Counsellor PIN to Continue</p>
            </div>
          </motion.div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="relative">
              <input 
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className={cn(
                  "w-full rounded-2xl bg-white/5 border border-white/10 py-5 text-center text-3xl font-black tracking-[1em] text-white outline-none transition-all focus:bg-white/10 focus:border-indigo-500/50",
                  pinError && "border-rose-500 animate-shake"
                )}
                autoFocus
              />
              {pinError && (
                <div className="absolute inset-x-0 -bottom-6 text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                  Incorrect Security PIN
                </div>
              )}
            </div>
            <button 
              type="submit"
              className="w-full rounded-2xl bg-indigo-600 py-4 font-black tracking-[0.2em] text-white shadow-xl transition-all hover:bg-indigo-700 active:scale-95"
            >
              UNLOCK DASHBOARD
            </button>
          </form>

          <footer className="pt-8 opacity-20 transition-opacity hover:opacity-100">
             <button 
              onClick={handleAdminLogin}
              disabled={isAdminLoading}
              className="flex items-center gap-2 mx-auto text-[10px] font-bold tracking-widest uppercase hover:text-indigo-400 disabled:opacity-50"
             >
               {isAdminLoading ? (
                 <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
               ) : (
                 <LogIn size={14} />
               )}
               {isAdminLoading ? 'Authenticating...' : 'Admin Access'}
             </button>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AnimatePresence mode="wait">
        {!showPreview ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-auto max-w-2xl px-4 py-8"
          >
            {/* Header */}
            <header className="mb-8 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <Home size={22} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800">Counsellor Dashboard</h1>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsChangingPin(!isChangingPin)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                        isChangingPin ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <KeyRound size={16} />
                      {isChangingPin ? 'Cancel' : 'PIN'}
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleAdminLogin}
                    disabled={isAdminLoading}
                    className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {isAdminLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    ) : (
                      <LogIn size={16} />
                    )}
                    {isAdminLoading ? 'Wait...' : 'Admin'}
                  </button>
                )}
                <button 
                  onClick={() => setData(INITIAL_DATA)}
                  className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">Remove All</span>
                </button>
              </div>
            </header>

            {/* Admin PIN Change UI */}
            <AnimatePresence>
              {isChangingPin && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-8 overflow-hidden"
                >
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 space-y-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <ShieldAlert size={20} />
                      <h3 className="font-bold">Security Management</h3>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="New Access PIN"
                        className="flex-1 rounded-xl border-amber-200 bg-white px-4 py-2 text-sm font-bold outline-none ring-amber-500/20 focus:ring-4"
                      />
                      <button 
                        onClick={handleUpdatePin}
                        className="rounded-xl bg-amber-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-amber-200"
                      >
                        Update
                      </button>
                    </div>
                    <p className="text-[10px] font-medium text-amber-700/60 uppercase tracking-widest">Changing this will instantly lock all sessions until the new PIN is entered.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dashboard Form Container */}
            <main className="space-y-8 rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl shadow-slate-200/60 border border-slate-100 backdrop-blur-3xl">
              <div className="flex flex-col items-center gap-2 text-center pb-2">
                 <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                    <Smartphone size={24} />
                 </div>
                 <h1 className="text-2xl font-bold tracking-tight text-slate-900 capitalize">Counsellor Dashboard</h1>
                 <p className="text-xs font-medium text-slate-400">Manage activation cards & platform data</p>
              </div>
              {/* Logo Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Layout size={14} className="text-indigo-500" />
                   <label className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Organization Logo</label>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleLogoUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition-all hover:border-indigo-300 hover:bg-slate-50"
                >
                   <div className="relative h-20 w-20 overflow-hidden rounded-full bg-white shadow-lg group-hover:scale-105 transition-transform p-1">
                      {(data.logoUrl || globalLogoUrl) ? (
                         <img src={data.logoUrl || globalLogoUrl} alt="Logo" className="h-full w-full object-cover rounded-full" />
                      ) : (
                         <div className="h-full w-full bg-slate-50 rounded-full flex items-center justify-center">
                            <User className="h-10 w-10 text-slate-300" />
                         </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                         <div className="opacity-0 group-hover:opacity-100 bg-white p-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                            <Plus size={12} className="text-indigo-600" />
                         </div>
                      </div>
                   </div>
                   <p className="mt-4 text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors tracking-widest uppercase">
                     {(data.logoUrl || globalLogoUrl) ? 'Change Identity' : 'Upload Identity'}
                   </p>
                </div>
              </div>

              {/* Quick Parse Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-indigo-500" />
                    <label className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Auto Import Data</label>
                  </div>
                  <button 
                    onClick={handleUpdateData}
                    className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-[10px] font-bold text-white transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-200"
                  >
                    <Send size={10} />
                    PARSE DATA
                  </button>
                </div>
                <div className="relative">
                  <textarea 
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste login info here..."
                    className="h-28 w-full rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs font-mono text-slate-600 outline-none ring-indigo-500/10 transition-all focus:ring-4 focus:bg-white focus:border-indigo-100"
                  />
                  <div className="absolute right-3 bottom-3 opacity-20">
                     <Hash size={14} />
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {[
                  { key: 'fullName', label: 'Full Name', icon: User, placeholder: 'John Doe' },
                  { key: 'email', label: 'Email ID', icon: Mail, placeholder: 'john@example.com' },
                  { key: 'phone', label: 'Phone', icon: Phone, placeholder: '01700000000' },
                  { key: 'referral', label: 'Referral', icon: Users, placeholder: 'REF123' },
                  { key: 'teamCode', label: 'Team Code', icon: Lock, placeholder: '336251' },
                  { key: 'transactionId', label: 'Transaction ID', icon: Hash, placeholder: 'TRX123456' },
                  { key: 'verifiedDate', label: 'Activation Date', icon: Calendar, placeholder: 'Date' },
                  { key: 'cashback', label: 'Cashback (৳)', icon: Wallet, placeholder: '300' },
                  { key: 'amountPaid', label: 'Paid (৳)', icon: DollarSign, placeholder: '200' },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1 font-bold">
                       <field.icon size={12} className="text-slate-400" />
                       <label className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase">{field.label}</label>
                    </div>
                    <input 
                      type="text" 
                      value={data[field.key as keyof ProfileData] as string}
                      onChange={(e) => handleInputChange(field.key as keyof ProfileData, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 border border-slate-100 outline-none ring-indigo-500/10 transition-all focus:ring-4 focus:bg-white focus:border-indigo-200"
                    />
                  </div>
                ))}
              </div>

              {/* Gateway Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 px-1">
                   <CreditCard size={14} className="text-indigo-500" />
                   <label className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase">Payment Processor</label>
                </div>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2">
                  {(['Bkash', 'Nagad', 'Rocket', 'Upay', 'Google Pay', 'UPI'] as const).map(gate => (
                    <button
                      key={gate}
                      onClick={() => handleInputChange('gateway', gate)}
                      className={cn(
                        "rounded-xl py-3 text-[10px] font-black tracking-widest transition-all uppercase border",
                        data.gateway === gate 
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 border-indigo-600 scale-[1.02]" 
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      {gate}
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Action */}
              <div className="pt-4">
                <button 
                  onClick={() => setShowPreview(true)}
                  className="group relative w-full overflow-hidden rounded-2xl bg-indigo-600 py-4 font-black tracking-[0.2em] text-white shadow-2xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98]"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    GENERATE PREMIUM CARD
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-x-0 -bottom-1 h-1 bg-white/20" />
                </button>
              </div>
            </main>
          </motion.div>
        ) : (
          <motion.div 
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-screen flex-col items-center bg-[#0F172A] pb-8 pt-4 overflow-hidden"
          >
            {/* Top Toolbar */}
            <div className="mb-4 flex w-full max-w-[340px] items-center justify-between px-2">
               <button 
                onClick={() => setShowPreview(false)}
                className="flex items-center gap-2 rounded-full bg-white/5 pr-4 pl-2 py-1.5 text-[10px] font-bold tracking-widest text-white/60 transition-colors hover:bg-white/10"
               >
                 <ArrowLeft size={14} />
                 BACK
               </button>
               <div className="flex items-center gap-4">
                 <button 
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="flex items-center gap-2 rounded-full bg-indigo-500/20 px-4 py-1.5 text-[10px] font-bold tracking-widest text-indigo-400 transition-all hover:bg-indigo-500 hover:text-white"
                 >
                   {isExporting ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" /> : <Download size={14} />}
                   {isExporting ? '...' : 'SAVE'}
                 </button>
                 <div className="flex items-center gap-1.5">
                   <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                   <span className="text-[8px] font-bold tracking-[0.2em] text-emerald-400">LIVE</span>
                 </div>
               </div>
            </div>

            {/* The Professional Mobile Screen Capture */}
            <div 
              ref={previewRef} 
              className="relative w-full max-w-[340px] aspect-[9/15] shrink-0 bg-[#0F172A] p-2 flex flex-col overflow-hidden"
            >
              <div className="relative flex-1 flex flex-col mt-2">
                <div className="flex-1 rounded-[2rem] bg-white p-1 shadow-2xl overflow-hidden">
                  <div className="h-full rounded-[1.8rem] bg-white overflow-hidden flex flex-col pt-0">
                    {/* Premium Header */}
                    <div className="relative h-24 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 pt-6 overflow-hidden">
                      <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                      <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-indigo-400/20 blur-lg" />
                      
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="h-9 w-9 overflow-hidden rounded-lg bg-white p-0.5 shadow-md">
                             <div className="h-full w-full bg-slate-50 rounded-md flex items-center justify-center">
                                {(data.logoUrl || globalLogoUrl) ? (
                                   <img src={data.logoUrl || globalLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                                ) : (
                                   <Smartphone className="text-indigo-600" size={18} />
                                )}
                             </div>
                           </div>
                           <div>
                             <h2 className="font-display text-[11px] font-bold tracking-tight text-white leading-none uppercase">UNITY EARNING</h2>
                             <p className="mt-0.5 text-[6px] font-bold tracking-[0.2em] text-white/40 uppercase">E-Learning Platform</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 shadow-sm border border-white/10 backdrop-blur-md">
                              <ShieldCheck size={7} className="text-emerald-400" />
                              <span className="text-[6px] font-extrabold tracking-[0.15em] text-white uppercase">Secured</span>
                           </div>
                           <div className="mt-1 font-display text-[8px] font-bold text-white/70 tracking-tighter">{data.verifiedDate}</div>
                        </div>
                      </div>
                    </div>

                    {/* Activation Banner */}
                    <div className="relative -mt-5 px-4 z-20">
                      <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 text-slate-800 shadow-xl border border-slate-100/50">
                         <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                           <CheckCircle2 size={16} />
                           <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/30 -z-10" />
                         </div>
                         <div>
                           <div className="text-xs font-bold leading-tight tracking-tight">Activation Success</div>
                           <div className="text-[6px] font-bold tracking-widest text-slate-400 uppercase">System Verified ID</div>
                         </div>
                      </div>
                    </div>

                    {/* Data Container - Removed flex-1 to prevent stretching */}
                    <div className="mt-2.5 px-4 flex flex-col space-y-1.5">
                      <div className="space-y-1.5 rounded-2xl bg-slate-900 px-4 py-3 shadow-2xl border border-slate-800/50">
                         <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-500 uppercase">ID Holder</span>
                           <span className="font-display text-[10px] font-bold text-white tracking-tight">{data.fullName || '---'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-500 uppercase">Email ID</span>
                           <span className="font-display text-[8px] font-bold text-slate-300 truncate max-w-[130px]">{data.email || '---'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-500 uppercase">Status</span>
                           <span className="text-[8px] font-bold text-emerald-400 px-2 py-0.5 bg-emerald-400/10 rounded-full border border-emerald-400/20 tracking-tighter">ACTIVE</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-500 uppercase">Phone</span>
                           <span className="font-display text-[9px] font-bold text-white tracking-tight">{data.phone || '---'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-500 uppercase">Ref. ID</span>
                           <span className="font-display text-[9px] font-bold text-slate-300">{data.referral || '---'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-500 uppercase">Team Code</span>
                           <span className="font-display text-[9px] font-bold text-indigo-400">{data.teamCode}</span>
                         </div>
                         
                         <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-800/50">
                           <span className="text-[6px] font-bold tracking-[0.2em] text-slate-400 uppercase">Cashback</span>
                           <div className="flex items-baseline gap-0.5">
                             <span className="font-display text-sm font-bold text-amber-400">{data.cashback}</span>
                             <span className="text-[6px] font-bold text-amber-600">৳</span>
                           </div>
                         </div>
                      </div>

                      {/* Payment */}
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-2">
                         <div className="flex items-center gap-1.5">
                           <div className="h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                           <span className="text-[6px] font-bold tracking-widest text-slate-400 uppercase">Method: {data.gateway}</span>
                         </div>
                         <div className="flex items-baseline gap-1">
                           <span className="text-[6px] font-bold text-slate-400">PAID</span>
                           <span className="font-display text-xs font-bold tracking-tighter text-slate-800">{data.amountPaid}</span>
                           <span className="text-[7px] font-bold text-slate-500">৳</span>
                         </div>
                      </div>
                    </div>

                    {/* Bengali Notice Section */}
                    <div className="mt-2.5 px-4 space-y-1.5 mb-2">
                       <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 text-center shadow-sm">
                          <p className="text-[8px] font-bold leading-snug text-emerald-800 px-2">
                             ইউনিটি আর্নিং ই-লার্নিং প্ল্যাটফর্মে আপনার আইডি সফলভাবে সক্রিয় হয়েছে।
                          </p>
                       </div>
                       
                       <div className="rounded-xl border border-red-100 bg-red-50/40 p-2 text-center shadow-sm">
                          <p className="text-[7px] font-bold leading-tight text-red-600 px-2">
                             আপনার অ্যাকাউন্টের পাসওয়ার্ড সুরক্ষিত রাখুন, পাসওয়ার্ড কাউকে শেয়ার করবেন না।
                          </p>
                       </div>
                    </div>

                    {/* Footer Branding */}
                    <div className="mt-auto px-5 py-2.5 flex items-end justify-between bg-white border-t border-slate-50">

                       <div className="mb-0.5">
                          <div className="text-[5px] font-extrabold tracking-widest text-slate-300 uppercase mb-0.5">TRANSACTION ID</div>
                          <div className="font-mono text-[6px] font-bold text-slate-400 leading-none">{data.transactionId}</div>
                       </div>
                       <div className="text-right">
                          <div className="font-display text-[8px] font-extrabold tracking-tight text-indigo-600/60 lowercase">www.unityearning.com</div>
                          <div className="mt-1 flex justify-end gap-1">
                             {[1,2,3].map(i => <div key={i} className="h-0.5 w-0.5 rounded-full bg-slate-200" />)}
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
