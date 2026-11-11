import React, { useState } from 'react';
import { X, LogIn, Mail, Lock, AlertCircle, LogOut, CheckCircle2, User as UserIcon } from 'lucide-react';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: FirebaseUser | null;
  onAuthSuccess?: (user: FirebaseUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  onAuthSuccess
}) => {
  const t = translations[lang];
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth) {
      setErrorMessage(
        lang === 'ru' 
          ? 'Firebase не настроен на клиенте.' 
          : lang === 'kz' 
          ? 'Firebase клиентте бапталмаған.' 
          : 'Firebase is not configured on the client.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        // If popup is blocked or failed on mobile device, try redirect flow
        const isMobileOrBlocked = popupErr?.code === 'auth/popup-blocked' || 
                                  popupErr?.code === 'auth/cancelled-popup-request' ||
                                  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobileOrBlocked) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }

      if (result?.user) {
        setSuccessMessage(
          lang === 'ru' 
            ? `Добро пожаловать, ${result.user.displayName || result.user.email}!` 
            : lang === 'kz' 
            ? `Қош келдіңіз, ${result.user.displayName || result.user.email}!` 
            : `Welcome, ${result.user.displayName || result.user.email}!`
        );
        if (onAuthSuccess) onAuthSuccess(result.user);
        setTimeout(() => onClose(), 800);
      }
    } catch (err: any) {
      console.warn("Google Sign-In Error:", err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setErrorMessage(
          lang === 'ru'
            ? 'Провайдер Google не включен. Включите Google в разделе Firebase Console → Authentication → Sign-in method.'
            : lang === 'kz'
            ? 'Google провайдері қосылмаған. Firebase Console → Authentication → Sign-in method бөлімінде Google қосыңыз.'
            : 'Google sign-in provider is disabled. Please enable Google in Firebase Console → Authentication → Sign-in method.'
        );
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage(
          lang === 'ru'
            ? 'Текущий домен не добавлен в список разрешенных в Firebase Console (Authorized Domains).'
            : lang === 'kz'
            ? 'Ағымдағы домен Firebase рұқсат етілген домендер тізіміне қосылмаған.'
            : 'This domain is not in the authorized domains list in Firebase Console.'
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage(
          lang === 'ru'
            ? 'Окно авторизации было закрыто пользователем.'
            : lang === 'kz'
            ? 'Авторизация терезесі пайдаланушымен жабылды.'
            : 'Sign-in window was closed by the user.'
        );
      } else {
        setErrorMessage(err.message || 'Ошибка авторизации Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured || !auth) {
      setErrorMessage('Firebase не настроен');
      return;
    }
    if (!email || !password) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let result;
      if (mode === 'signup') {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }

      if (result.user) {
        if (onAuthSuccess) onAuthSuccess(result.user);
        setTimeout(() => onClose(), 600);
      }
    } catch (err: any) {
      console.warn("Email Auth Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage(lang === 'ru' ? 'Этот email уже используется' : 'Email is already in use');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setErrorMessage(lang === 'ru' ? 'Неверный email или пароль' : 'Invalid email or password');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage(lang === 'ru' ? 'Пароль должен быть не менее 6 символов' : 'Password must be at least 6 characters');
      } else {
        setErrorMessage(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      setSuccessMessage(lang === 'ru' ? 'Вы успешно вышли' : 'Signed out');
      setTimeout(() => onClose(), 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-[32px] max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-[#2F7D4A] flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-slate-900">
                {currentUser ? (lang === 'ru' ? 'Профиль пользователя' : lang === 'kz' ? 'Пайдаланушы профилі' : 'User Profile') : t.login}
              </h3>
              <p className="text-[11px] text-slate-500">
                {currentUser ? currentUser.email : t.authInstructions}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {currentUser ? (
            /* Logged In View */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#2F7D4A] text-white font-bold text-base flex items-center justify-center">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {currentUser.displayName || (lang === 'ru' ? 'Фермер' : 'Farmer')}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 mt-1">
                    Firebase Authenticated
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.logout}</span>
              </button>
            </div>
          ) : (
            /* Not Logged In View */
            <div className="space-y-4">
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-xs active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{t.googleSignIn || "Войти через Google"}</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {lang === 'ru' ? 'Или по email' : lang === 'kz' ? 'Немесе email арқылы' : 'Or with Email'}
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">
                    {t.email}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="agronom@agro.kz"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]/20 focus:border-[#2F7D4A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">
                    {t.password}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]/20 focus:border-[#2F7D4A]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {mode === 'signup' 
                      ? (lang === 'ru' ? 'Зарегистрироваться' : lang === 'kz' ? 'Тіркелу' : 'Sign Up')
                      : t.login}
                  </span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold transition-colors"
                  >
                    {mode === 'signin'
                      ? (lang === 'ru' ? 'Нет аккаунта? Зарегистрироваться' : lang === 'kz' ? 'Тіркелгі жоқ па? Тіркелу' : 'Don\'t have an account? Sign Up')
                      : (lang === 'ru' ? 'Уже есть аккаунт? Войти' : lang === 'kz' ? 'Тіркелгі бар ма? Кіру' : 'Already have an account? Sign In')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
