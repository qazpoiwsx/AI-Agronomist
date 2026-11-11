import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Sprout, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  Info, 
  ChevronRight,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Bug,
  MessageSquare,
  History,
  Map as MapIcon,
  Send,
  Droplets,
  Thermometer,
  CloudSun,
  LocateFixed,
  Languages,
  DollarSign,
  Package,
  Download,
  LogIn,
  LogOut,
  User,
  Mail,
  Lock,
  Maximize,
  X,
  Plus,
  Minus,
  Trash2,
  Navigation,
  Globe,
  Layers,
  Settings as SettingsIcon,
  Radar,
  FileCheck2,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzePlantImage, chatWithAssistant } from './services/geminiService';
import { fetchWeather, WeatherData } from './services/weatherService';
import { 
  AnalysisResult, 
  PlantCulture, 
  CULTURES, 
  ChatMessage, 
  Currency, 
  UnitSystem, 
  UserRole, 
  Field, 
  DroneMission, 
  Recommendation, 
  AgroNotification, 
  AgronomistReview 
} from './types';
import { cn } from './lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { translations, Language } from './translations';
import { auth, db, isFirebaseConfigured } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

import { triggerPushNotification, registerServiceWorker } from './lib/pushNotifications';

// Enterprise Platform Navigation & Modular Components
import { Sidebar, TabRoute } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { FieldsView } from './components/FieldsView';
import { AgroMapView } from './components/AgroMapView';
import { CropHealthView } from './components/CropHealthView';
import { WeatherRiskView } from './components/WeatherRiskView';
import { YieldLossView } from './components/YieldLossView';
import { RecommendationsView } from './components/RecommendationsView';
import { AgronomistReviewModal } from './components/AgronomistReviewModal';
import { NotificationsView } from './components/NotificationsView';
import { ReportsView } from './components/ReportsView';
import { Settings as SettingsComponent } from './components/Settings';
import { AuthModal } from './components/AuthModal';
import { 
  getDemoDataEnabled, 
  setDemoDataEnabled as saveDemoDataEnabled, 
  isSeedField, 
  isSeedMission, 
  isSeedRecommendation, 
  isSeedAnalysis,
  isSeedNotification
} from './lib/demoData';

export default function App() {
  // Navigation & Platform States
  const [activeTab, setActiveTab] = useState<TabRoute>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('AGRONOMIST');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Demo Data State (default false for clean database)
  const [demoDataEnabled, setDemoDataEnabledState] = useState<boolean>(getDemoDataEnabled());

  const handleSetDemoDataEnabled = (enabled: boolean) => {
    setDemoDataEnabledState(enabled);
    saveDemoDataEnabled(enabled);
  };

  // Agricultural Domain Entities State
  const [fields, setFields] = useState<Field[]>([]);
  const [missions, setMissions] = useState<DroneMission[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [notifications, setNotifications] = useState<AgroNotification[]>([]);
  const [selectedFieldForMap, setSelectedFieldForMap] = useState<Field | null>(null);
  const [reviewModalAnalysis, setReviewModalAnalysis] = useState<AnalysisResult | null>(null);

  // Auth & User States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Analysis State
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [culture, setCulture] = useState<PlantCulture>('wheat');
  const [customCultureName, setCustomCultureName] = useState('');
  const [ageDays, setAgeDays] = useState<number>(30);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | undefined>();
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Filtered collections: only known seed records with IDs field-1..field-4/org-1 are filtered out when demoDataEnabled is false.
  // New user created records are never filtered out!
  const displayedFields = demoDataEnabled ? fields : fields.filter(f => !isSeedField(f));
  const displayedMissions = demoDataEnabled ? missions : missions.filter(m => !isSeedMission(m));
  const displayedRecommendations = demoDataEnabled ? recommendations : recommendations.filter(r => !isSeedRecommendation(r));
  const displayedHistory = demoDataEnabled ? history : history.filter(h => !isSeedAnalysis(h));
  const displayedNotifications = demoDataEnabled ? notifications : notifications.filter(n => !isSeedNotification(n));
  
  // App Preferences
  const [lang, setLang] = useState<Language>('ru');
  const [currency, setCurrency] = useState<Currency>('KZT');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [infoModal, setInfoModal] = useState<'privacy' | 'help' | 'contacts' | null>(null);
  const [highlightedHistoryId, setHighlightedHistoryId] = useState<string | null>(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const historyRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const t = translations[lang];

  const unreadNotifsCount = displayedNotifications.filter(n => !n.read).length;

  const DEFAULT_COORDS = { lat: 43.2389, lng: 76.8897, accuracy: 500 };

  const applyFallbackLocation = () => {
    setLocation((prev) => {
      if (!prev) {
        fetchWeather(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng).then(setWeather).catch(() => {});
        return DEFAULT_COORDS;
      }
      return prev;
    });
  };

  const requestLocation = (highAccuracy = false) => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          setLocation(loc);
          fetchWeather(loc.lat, loc.lng).then(setWeather).catch(() => {});
        },
        (err) => {
          if (highAccuracy && (err.code === 3 || err.code === 2)) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const loc = { 
                  lat: pos.coords.latitude, 
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy
                };
                setLocation(loc);
                fetchWeather(loc.lat, loc.lng).then(setWeather).catch(() => {});
              },
              () => {
                applyFallbackLocation();
              },
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
            );
          } else {
            applyFallbackLocation();
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      applyFallbackLocation();
    }
  };

  // Initial Data Fetching from Local SQLite & Services
  useEffect(() => {
    registerServiceWorker();
    requestLocation(false);

    // Load initial agricultural datasets
    fetch('/api/fields')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setFields(data); })
      .catch(console.warn);

    fetch('/api/missions')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setMissions(data); })
      .catch(console.warn);

    fetch('/api/recommendations')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setRecommendations(data); })
      .catch(console.warn);

    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setNotifications(data); })
      .catch(console.warn);

    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHistory(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load history from server, falling back to localStorage:", err);
        const saved = localStorage.getItem('plant_health_history');
        if (saved) {
          try { setHistory(JSON.parse(saved)); } catch (e) {}
        }
      });
  }, []);

  // Firebase auth state subscription
  useEffect(() => {
    let unsubscribe = () => {};
    if (isFirebaseConfigured && auth) {
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          loadFirebaseHistory(currentUser.uid);
        }
      });
    }
    return () => unsubscribe();
  }, []);

  const loadFirebaseHistory = async (uid: string) => {
    if (!isFirebaseConfigured || !db) return;
    try {
      const q = query(collection(db, 'history'), where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      const userHistory: AnalysisResult[] = [];
      querySnapshot.forEach((doc) => {
        userHistory.push(doc.data() as AnalysisResult);
      });
      if (userHistory.length > 0) {
        const sortedHistory = userHistory.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(sortedHistory);
      }
    } catch (err) {
      console.warn("Notice loading history from Firebase:", err);
    }
  };

  const saveToHistory = async (newResult: AnalysisResult) => {
    const newHistory = [newResult, ...history];
    setHistory(newHistory);
    localStorage.setItem('plant_health_history', JSON.stringify(newHistory));

    if (user && isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'history', newResult.id), {
          ...newResult,
          userId: user.uid
        });
      } catch (err) {
        console.error("Error saving to Firestore:", err);
      }
    }
  };

  // Domain CRUD Operations
  const handleAddField = async (fieldData: Partial<Field>) => {
    try {
      const fieldId = fieldData.id || `field-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const polygon = Array.isArray(fieldData.polygon) ? fieldData.polygon : [];
      
      let center = fieldData.center;
      if ((!center || !Array.isArray(center) || center.length < 2) && polygon.length > 0) {
        const latAvg = polygon.reduce((acc, pt) => acc + (pt[0] || 0), 0) / polygon.length;
        const lngAvg = polygon.reduce((acc, pt) => acc + (pt[1] || 0), 0) / polygon.length;
        center = [latAvg, lngAvg];
      } else if (!center || !Array.isArray(center) || center.length < 2) {
        center = [0, 0];
      }

      const payload = {
        ...fieldData,
        id: fieldId,
        name: fieldData.name?.trim() || 'Новое поле',
        polygon,
        center,
        organizationId: fieldData.organizationId || (user?.uid ? `user-${user.uid.slice(0, 8)}` : 'user-farm')
      };

      let token: string | null = null;
      if (user) {
        try {
          token = await user.getIdToken();
        } catch (e) {
          console.warn("Could not get Firebase token for field creation:", e);
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log("[handleAddField] Sending field to /api/fields:", payload);

      const res = await fetch('/api/fields', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Server responded with status ${res.status}`);
      }

      const created = await res.json();
      console.log("[handleAddField] Field successfully created on server:", created);
      setFields(prev => [created, ...prev.filter(f => f.id !== created.id)]);
      return created;
    } catch (err: any) {
      console.error("[handleAddField] Error creating field:", err);
      throw err;
    }
  };

  const handleUpdateField = async (id: string, updates: Partial<Field>) => {
    try {
      let token: string | null = null;
      if (user) {
        try { token = await user.getIdToken(); } catch {}
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/fields/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates, ...updated } : f));
      }
    } catch (err) {
      console.error("Failed to update field:", err);
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
      let token: string | null = null;
      if (user) {
        try { token = await user.getIdToken(); } catch {}
      }
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/fields/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setFields(prev => prev.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete field:", err);
    }
  };

  const handleCreateMission = async (missionData: Partial<DroneMission>) => {
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missionData)
    });
    if (res.ok) {
      const created = await res.json();
      setMissions(prev => [created, ...prev]);
    }
  };

  const handleUpdateMissionStatus = async (id: string, status: DroneMission['status'], progress?: number) => {
    const res = await fetch(`/api/missions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, progress })
    });
    if (res.ok) {
      const updated = await res.json();
      setMissions(prev => prev.map(m => m.id === id ? updated : m));
    }
  };

  const handleDeleteMission = async (id: string) => {
    const res = await fetch(`/api/missions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMissions(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleUpdateRecommendationStatus = async (id: string, status: Recommendation['status']) => {
    const res = await fetch(`/api/recommendations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      const updated = await res.json();
      setRecommendations(prev => prev.map(r => r.id === id ? updated : r));
    }
  };

  const handleCreateRecommendation = async (recData: Partial<Recommendation>) => {
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recData)
    });
    if (res.ok) {
      const created = await res.json();
      setRecommendations(prev => [created, ...prev]);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    if (res.ok) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    if (res.ok) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleSubmitReview = async (reviewData: Partial<AgronomistReview>) => {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });
    if (res.ok) {
      const created = await res.json();
      if (reviewModalAnalysis) {
        const updatedAnalysis = { ...reviewModalAnalysis, agronomistReview: created };
        setResult(updatedAnalysis);
        setHistory(prev => prev.map(h => h.id === updatedAnalysis.id ? updatedAnalysis : h));
      }
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setNotifications(data); })
        .catch(() => {});
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured || !auth) {
      setAuthError("Firebase is not configured. Please add API keys in settings.");
      return;
    }
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
    setHistory([]);
    localStorage.removeItem('plant_health_history');
  };

  const toggleSelectAll = () => {
    if (selectedHistoryIds.size === history.length) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(history.map(item => item.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedHistoryIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedHistoryIds(newSelected);
  };

  const exportToCSV = () => {
    const itemsToExport = selectedHistoryIds.size > 0 
      ? history.filter(item => selectedHistoryIds.has(item.id))
      : history;

    if (itemsToExport.length === 0) return;
    
    const headers = ['ID', 'Date', 'Diagnosis', 'Culture', 'Severity', 'Loss %', 'Loss Value', 'Currency', 'Area Unit', 'Loss Weight', 'Weight Unit', 'Lat', 'Lng'];
    const rows = itemsToExport.map(item => [
      item.id,
      new Date(item.timestamp).toISOString(),
      item.diagnosis,
      item.culture,
      item.severity,
      item.economicImpact.potentialLossPercentage,
      item.economicImpact.estimatedLossPerArea,
      item.currency,
      item.unitSystem === 'metric' ? 'ha' : 'ac',
      item.economicImpact.estimatedLossWeight,
      item.unitSystem === 'metric' ? 't' : 'bu',
      item.location?.lat || '',
      item.location?.lng || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plant_health_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const itemsToExport = selectedHistoryIds.size > 0 
      ? history.filter(item => selectedHistoryIds.has(item.id))
      : history;

    if (itemsToExport.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(t.title + ' - ' + t.history, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 30);
    
    const tableColumn = ["Date", "Diagnosis", "Culture", "Severity", "Loss %", "Loss Value", "Loss Weight"];
    const tableRows: any[] = [];

    itemsToExport.forEach(item => {
      const areaUnit = item.unitSystem === 'metric' ? 'ha' : 'ac';
      const weightUnit = item.unitSystem === 'metric' ? 't' : 'bu';
      
      const rowData = [
        new Date(item.timestamp).toLocaleDateString(),
        item.diagnosis,
        item.culture,
        item.severity.toUpperCase(),
        `${item.economicImpact.potentialLossPercentage}%`,
        `${item.economicImpact.estimatedLossPerArea.toLocaleString()} ${item.currency}/${areaUnit}`,
        `${item.economicImpact.estimatedLossWeight} ${weightUnit}/${areaUnit}`
      ];
      tableRows.push(rowData);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [45, 90, 39] },
      styles: { fontSize: 8 },
    });

    doc.save(`plant_health_history_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    if (culture === 'other' && !customCultureName.trim()) {
      setError(t.enterPlantName);
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      let currentWeather = weather;
      if (location) {
        currentWeather = await fetchWeather(location.lat, location.lng);
        setWeather(currentWeather);
      }

      const analysisResult = await analyzePlantImage(
        image, 
        culture, 
        ageDays, 
        location, 
        customCultureName,
        currentWeather || undefined,
        lang,
        currency,
        unitSystem
      );

      if (analysisResult.isPlantRelated === false) {
        setError(lang === 'ru' ? 'ИИ не обнаружил растений на фото. Пожалуйста, загрузите фото пораженного листа.' : lang === 'kz' ? 'ИИ фотодан өсімдіктерді таппады. Ауру жапырақтың фотосын жүктеңіз.' : 'AI did not detect plants in the photo. Please upload a photo of an affected leaf.');
        setIsAnalyzing(false);
        return;
      }

      setResult(analysisResult);
      saveToHistory(analysisResult);

      if (analysisResult.issueType !== 'healthy') {
        triggerPushNotification(
          lang === 'ru' ? 'Обнаружена проблема!' : lang === 'kz' ? 'Мәселе табылды!' : 'Problem detected!',
          lang === 'ru' 
            ? `${analysisResult.diagnosis}. Угроза: ${analysisResult.severity}` 
            : lang === 'kz' 
              ? `${analysisResult.diagnosis}. Қауіп: ${analysisResult.severity}` 
              : `${analysisResult.diagnosis}. Threat: ${analysisResult.severity}`,
          '/'
        );
      }
    } catch (err: any) {
      if (err.message === 'SERVER_OVERLOAD') {
        setError(lang === 'ru' ? 'ИИ перегружен. Пожалуйста, попробуйте еще раз через минуту.' : lang === 'kz' ? 'ИИ шамадан тыс жүктелген. Бір минуттан кейін қайталап көріңіз.' : 'AI is overloaded. Please try again in a minute.');
      } else {
        setError(lang === 'ru' ? 'Не удалось проанализировать фото. Попробуйте еще раз.' : lang === 'kz' ? 'Фотоны талдау мүмкін болмады. Қайталап көріңіз.' : 'Failed to analyze photo. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const newUserMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      const response = await chatWithAssistant([...chatMessages, newUserMessage], result || undefined, lang, currency, unitSystem);
      setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      const errorMsg = err.message === 'SERVER_OVERLOAD'
        ? (lang === 'ru' ? 'Ассистент временно недоступен из-за высокой нагрузки.' : lang === 'kz' ? 'Көмекші жоғары жүктемеге байланысты уақытша қолжетімсіз.' : 'Assistant is temporarily unavailable due to high load.')
        : (lang === 'ru' ? 'Ошибка связи с ассистентом.' : lang === 'kz' ? 'Көмекшімен байланыс қатесі.' : 'Error communicating with assistant.');
      setChatMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDiscussWithAI = (currentResult?: AnalysisResult | null) => {
    // 1. Resolve analysis object: passed explicitly, or from result state, or latest history item
    const analysis = currentResult || result || (history && history.length > 0 ? history[0] : null);

    if (analysis) {
      setResult(analysis);
    }

    const cultureName = analysis
      ? (CULTURES.find(c => c.id === analysis.culture)?.name || (t.cultures as any)?.[analysis.culture] || analysis.culture || 'Растение')
      : 'Растение';
    const diagnosis = analysis?.diagnosis || 'Не определено';

    const promptMessage = analysis
      ? (lang === 'kz'
          ? `Мен жаңа ғана фотоны талдадым. Диагноз: ${diagnosis}. Дақыл: ${cultureName}. Осы ауру туралы толығырақ айтып беріңіз және оны қалай алдын алуға болады?`
          : lang === 'en'
          ? `I just analyzed a photo. Diagnosis: ${diagnosis}. Crop: ${cultureName}. Please tell me more about this disease and how to prevent it.`
          : `Я только что проанализировал фото. Диагноз: ${diagnosis}. Культура: ${cultureName}. Расскажи подробнее об этой болезни и как ее предотвратить.`)
      : (lang === 'kz'
          ? `Сәлеметсіз бе! Маған өсімдік аурулары мен егін қорғау шаралары бойынша агрономиялық кеңес беріңізші.`
          : lang === 'en'
          ? `Hello! Please provide me with agronomic advice on crop protection and disease prevention.`
          : `Здравствуйте! Проконсультируйте меня по защите посевов и диагностике болезней растений.`);

    const newUserMessage: ChatMessage = { role: 'user', text: promptMessage };
    
    // Clear any input text and immediately append the user message
    setChatInput('');
    setChatMessages(prev => [...prev, newUserMessage]);
    setActiveTab('assistant');
    setIsChatLoading(true);

    // Call chat API with new message and context
    chatWithAssistant([...chatMessages, newUserMessage], analysis || undefined, lang, currency, unitSystem)
      .then(reply => {
        setChatMessages(prev => [...prev, { role: 'model', text: reply }]);
      })
      .catch((err: any) => {
        console.error("AI Assistant error:", err);
        const errorMsg = err.message === 'SERVER_OVERLOAD'
          ? (lang === 'ru' ? 'Ассистент временно недоступен из-за высокой нагрузки.' : lang === 'kz' ? 'Көмекші жоғары жүктемеге байланысты уақытша қолжетімсіз.' : 'Assistant is temporarily unavailable due to high load.')
          : (lang === 'ru' ? 'Ошибка связи с ассистентом.' : lang === 'kz' ? 'Көмекшімен байланыс қатесі.' : 'Error communicating with assistant.');
        setChatMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
      })
      .finally(() => {
        setIsChatLoading(false);
      });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F9F6] selection:bg-emerald-200 selection:text-emerald-900 font-sans">
      {/* Desktop & Collapsible Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lang={lang}
          userRole={userRole}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          unreadNotifsCount={unreadNotifsCount}
          user={user}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 w-72 h-full bg-[#163D2B]"
            >
              <Sidebar
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  setMobileSidebarOpen(false);
                }}
                lang={lang}
                userRole={userRole}
                collapsed={false}
                setCollapsed={() => {}}
                unreadNotifsCount={unreadNotifsCount}
                user={user}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lang={lang}
          setLang={setLang}
          userRole={userRole}
          setUserRole={setUserRole}
          unreadNotifsCount={unreadNotifsCount}
          onOpenNotifications={() => setActiveTab('notifications')}
          onOpenSettings={() => setShowSettingsModal(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          userName={user?.displayName || user?.email?.split('@')[0] || (lang === 'kz' ? 'Фермер' : lang === 'en' ? 'Farmer' : 'Фермер')}
          isAuthenticated={Boolean(user)}
          onOpenAuth={() => setShowAuthModal(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-12">
          <AnimatePresence mode="wait">
            {/* 1. DASHBOARD */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <DashboardView
                  fields={displayedFields}
                  missions={displayedMissions}
                  analyses={displayedHistory}
                  recommendations={displayedRecommendations}
                  notifications={displayedNotifications}
                  setActiveTab={setActiveTab}
                  lang={lang}
                  onSelectField={(f) => {
                    setSelectedFieldForMap(f);
                    setActiveTab('map');
                  }}
                  onSelectAnalysis={(a) => {
                    setResult(a);
                    setActiveTab('analysis');
                  }}
                />
              </motion.div>
            )}

            {/* 2. FIELDS & PLOTS */}
            {activeTab === 'fields' && (
              <motion.div
                key="fields"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <FieldsView
                  fields={fields}
                  lang={lang}
                  onAddField={handleAddField}
                  onUpdateField={handleUpdateField}
                  onDeleteField={handleDeleteField}
                  setActiveTab={setActiveTab}
                  onSelectFieldOnMap={(f) => {
                    setSelectedFieldForMap(f);
                    setActiveTab('map');
                  }}
                  userLocation={location || null}
                  demoDataEnabled={demoDataEnabled}
                />
              </motion.div>
            )}

            {/* 3. AGRO MAP (GIS) */}
            {activeTab === 'map' && (
              <motion.div
                key="map"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <AgroMapView
                  fields={displayedFields}
                  analyses={displayedHistory}
                  missions={displayedMissions}
                  lang={lang}
                  selectedField={selectedFieldForMap}
                  onSelectAnalysis={(a) => {
                    setResult(a);
                    setActiveTab('analysis');
                  }}
                />
              </motion.div>
            )}

            {/* 5. IMAGE ANALYSIS WORKFLOW */}
            {activeTab === 'analysis' && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              >
                {/* Left Column: Input & Controls */}
                <div className="lg:col-span-4 space-y-6">
                  <section className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-serif font-bold text-[#17251D]">{t.newAnalysis}</h2>
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#2F7D4A] flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 block">{t.cultureLabel}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {CULTURES.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setCulture(c.id as PlantCulture)}
                              className={cn(
                                "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border",
                                culture === c.id 
                                  ? "bg-[#163D2B] text-white border-[#163D2B] shadow-md shadow-emerald-950/20" 
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <span className="text-base">{c.icon}</span>
                              <span className="truncate">{(t.cultures as any)[c.id]}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {culture === 'other' && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">{t.customCulture}</label>
                          <input 
                            type="text"
                            value={customCultureName}
                            onChange={(e) => setCustomCultureName(e.target.value)}
                            placeholder={t.enterCulture}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2F7D4A] outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.ageDays}</label>
                          <span className="text-xs font-bold text-[#163D2B]">{ageDays} {t.days}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="180" 
                          value={ageDays} 
                          onChange={(e) => setAgeDays(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#2F7D4A]"
                        />
                      </div>
                    </div>

                    {/* Image Upload Area */}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "relative aspect-square rounded-[24px] border-2 border-dashed transition-all cursor-pointer overflow-hidden mt-6 group",
                        image ? "border-emerald-600" : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                      )}
                    >
                      {image ? (
                        <>
                          <img src={image} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/30 text-white">
                              <RefreshCcw className="w-6 h-6" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                            <Upload className="w-7 h-7 text-[#2F7D4A]" />
                          </div>
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">{t.uploadPhoto}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{t.uploadInstructions}</p>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />

                    <button 
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !image}
                      className={cn(
                        "w-full mt-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/10",
                        isAnalyzing || !image
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                          : "bg-[#163D2B] text-white hover:bg-[#2F7D4A] active:scale-[0.98]"
                      )}
                    >
                      {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize className="w-4 h-4" />}
                      {isAnalyzing ? t.analyzing : t.runAnalysis}
                    </button>
                  </section>
                </div>

                {/* Right Column: Error & Diagnostics Result */}
                <div className="lg:col-span-8 space-y-6">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3"
                    >
                      <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                      <div className="flex-1 text-xs">
                        <p className="font-bold uppercase tracking-wider mb-1">Ошибка анализа</p>
                        <p>{error}</p>
                      </div>
                      <button onClick={() => setError(null)} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}

                  {result ? (
                    <div className="space-y-6">
                      {/* Main Result Card */}
                      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between gap-3 mb-6">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm",
                              result.severity === 'high' ? "bg-red-500" : result.severity === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                            )}>
                              {result.severity === 'high' ? t.high : result.severity === 'medium' ? t.medium : t.low}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              Достоверность: {Math.round(result.confidence * 100)}%
                            </span>
                          </div>

                          {/* Agronomist Validation Button */}
                          {(userRole === 'AGRONOMIST' || userRole === 'ADMIN') && (
                            <button
                              onClick={() => setReviewModalAnalysis(result)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-[#163D2B] text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors shadow-sm"
                            >
                              <ShieldCheck className="w-4 h-4 text-[#2F7D4A]" />
                              <span>{result.agronomistReview ? 'Обновить верификацию' : 'Экспертная валидация'}</span>
                            </button>
                          )}
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mb-4 leading-tight">
                          {result.diagnosis}
                        </h3>

                        {/* Agronomist Stamp if already reviewed */}
                        {result.agronomistReview && (
                          <div className="mb-6 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                            <div className="flex items-center gap-2 text-[#163D2B] font-bold text-xs uppercase tracking-wider mb-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Верифицировано главным агрономом: {result.agronomistReview.reviewerName}</span>
                            </div>
                            <p className="text-xs text-slate-700 italic mb-2">"{result.agronomistReview.comments}"</p>
                            {result.agronomistReview.recommendations && (
                              <p className="text-xs text-emerald-900 font-medium"><b>Предписание:</b> {result.agronomistReview.recommendations}</p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium">
                              {result.issueType === 'pest' ? <Bug className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                              <span>{result.issueType === 'pest' ? t.pest : result.issueType === 'disease' ? t.disease : t.healthy}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium">
                              <Sprout className="w-3.5 h-3.5" />
                              <span>{CULTURES.find(c => c.id === result.culture)?.name || result.culture}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium">
                              <span>Возраст: {result.ageDays} дней</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDiscussWithAI(result)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#163D2B] text-white hover:bg-[#1f523a] text-xs font-bold rounded-xl transition-all shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                            <span>{t.discussWithAI || 'Обсудить с ИИ'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Economic Loss Forecast Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.potentialLoss}</p>
                          <p className="text-2xl font-serif font-bold text-red-600">{result.economicImpact.potentialLossPercentage}%</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.weightLoss}</p>
                          <p className="text-2xl font-serif font-bold text-slate-900">
                            {result.economicImpact.estimatedLossWeight} <span className="text-xs text-slate-500 font-sans">{result.unitSystem === 'metric' ? 'т/га' : 'bu/ac'}</span>
                          </p>
                        </div>
                        <div className="bg-[#163D2B] p-5 rounded-2xl text-white shadow-md shadow-emerald-950/20">
                          <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">{t.financialLoss}</p>
                          <p className="text-2xl font-serif font-bold text-emerald-200">
                            {result.economicImpact.estimatedLossPerArea.toLocaleString()} <span className="text-xs font-sans">{result.currency}</span>
                          </p>
                        </div>
                      </div>

                      {/* Action Plan & Expert Advice */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm space-y-3">
                          <h4 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#2F7D4A]" />
                            <span>{t.actionOptions}</span>
                          </h4>
                          <div className="space-y-2.5">
                            {result.recommendations.map((rec, i) => (
                              <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                                  <span className="text-emerald-700">Эффективность: {rec.costEffectiveness}</span>
                                  <span className="text-slate-700 font-mono">{rec.estimatedCost.toLocaleString()} {result.currency}</span>
                                </div>
                                <p className="text-xs text-slate-600">{rec.action}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
                              <Languages className="w-4 h-4 text-[#2F7D4A]" />
                              <span>{t.agronomistAdvice}</span>
                            </h4>
                            <button
                              onClick={() => handleDiscussWithAI(result)}
                              className="text-xs text-[#2F7D4A] font-bold hover:underline flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>{t.discussWithAI || 'Обсудить с ИИ'}</span>
                            </button>
                          </div>
                          <div className="text-xs text-slate-600 leading-relaxed max-h-60 overflow-y-auto no-scrollbar">
                            <Markdown>{result.localizedAdvice}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-[#2F7D4A] flex items-center justify-center mb-4">
                        <Sprout className="w-8 h-8" />
                      </div>
                      <h3 className="font-serif font-bold text-xl text-slate-800 mb-2">{t.readyToAnalyze}</h3>
                      <p className="text-xs text-slate-500 max-w-sm">{t.uploadInstructions}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 6. CROP HEALTH & VEGETATION INDEX (NDVI) */}
            {activeTab === 'health' && (
              <motion.div
                key="health"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <CropHealthView
                  fields={displayedFields}
                  analyses={displayedHistory}
                  lang={lang}
                  setActiveTab={setActiveTab}
                  onSelectField={(f) => {
                    setSelectedFieldForMap(f);
                    setActiveTab('map');
                  }}
                />
              </motion.div>
            )}

            {/* 7. WEATHER & AGRO RISKS */}
            {activeTab === 'weather' && (
              <motion.div
                key="weather"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <WeatherRiskView fields={displayedFields} lang={lang} />
              </motion.div>
            )}

            {/* 8. YIELD & LOSS FORECAST */}
            {activeTab === 'yield_loss' && (
              <motion.div
                key="yield_loss"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <YieldLossView
                  fields={displayedFields}
                  analyses={displayedHistory}
                  currency={currency}
                  unitSystem={unitSystem}
                  lang={lang}
                />
              </motion.div>
            )}

            {/* 9. RECOMMENDATIONS & TASK MANAGEMENT */}
            {activeTab === 'recommendations' && (
              <motion.div
                key="recommendations"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <RecommendationsView
                  recommendations={displayedRecommendations}
                  fields={displayedFields}
                  lang={lang}
                  onUpdateStatus={handleUpdateRecommendationStatus}
                  onCreateRecommendation={handleCreateRecommendation}
                />
              </motion.div>
            )}

            {/* 10. AI AGRONOMIST CHAT */}
            {activeTab === 'assistant' && (
              <motion.div 
                key="assistant"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                className="h-[calc(100vh-170px)] flex flex-col bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#163D2B] text-white flex items-center justify-center shadow-md shadow-emerald-950/20">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-slate-900">{t.assistant}</h3>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {t.online} • Gemini 1.5 Agronomy Specialist
                      </p>
                    </div>
                  </div>
                  {result && (
                    <div className="hidden sm:block text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.context}</p>
                      <p className="text-xs font-bold text-emerald-800">{result.diagnosis}</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-8">
                      <div className="w-14 h-14 bg-emerald-50 text-[#2F7D4A] rounded-2xl flex items-center justify-center">
                        <MessageSquare className="w-7 h-7" />
                      </div>
                      <h4 className="text-lg font-serif font-bold text-slate-900">{t.chatPlaceholder}</h4>
                      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                        {t.assistantChatHelp}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center pt-2">
                        <button
                          onClick={() => {
                            setChatInput(t.assistantPromptBrownRustPrevent);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-xs text-slate-600 transition-colors"
                        >
                          {t.assistantPromptBrownRustPrevent}
                        </button>
                        <button
                          onClick={() => {
                            setChatInput(t.assistantPromptBrownRustSymptoms);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-xs text-slate-600 transition-colors"
                        >
                          {t.assistantPromptBrownRustSymptoms}
                        </button>
                      </div>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm",
                        msg.role === 'user'
                          ? "bg-[#163D2B] text-white rounded-tr-none shadow-emerald-950/10"
                          : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-200"
                      )}>
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  ))}

                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-200 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#2F7D4A]" />
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.analyzing}</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={t.chatPlaceholder}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isChatLoading}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md shrink-0",
                        !chatInput.trim() || isChatLoading
                          ? "bg-slate-200 text-slate-400"
                          : "bg-[#163D2B] text-white hover:bg-[#2F7D4A] active:scale-95"
                      )}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 11. PHYTOSANITARY ANALYSIS HISTORY */}
            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900">{t.history}</h2>
                    <p className="text-xs text-slate-500 mt-1">Архив фитосанитарных обследований и верифицированных диагнозов</p>
                  </div>
                  {history.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={exportToCSV}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV {selectedHistoryIds.size > 0 ? `(${selectedHistoryIds.size})` : ''}
                      </button>
                      <button 
                        onClick={exportToPDF}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF {selectedHistoryIds.size > 0 ? `(${selectedHistoryIds.size})` : ''}
                      </button>
                    </div>
                  )}
                </div>

                {history.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {history.map(item => (
                      <div 
                        key={item.id} 
                        className={cn(
                          "bg-white p-6 rounded-[28px] border transition-all relative",
                          selectedHistoryIds.has(item.id) ? "border-[#2F7D4A] bg-emerald-50/20" : "border-slate-200 hover:shadow-md"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white",
                            item.severity === 'high' ? "bg-red-500" : item.severity === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                          )}>
                            {item.severity}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-serif font-bold text-lg text-slate-900 mb-1">{item.diagnosis}</h4>
                        <p className="text-xs text-slate-500 mb-4">{item.culture} • Возраст: {item.ageDays} дн.</p>

                        {item.agronomistReview && (
                          <div className="mb-4 p-3 bg-emerald-50 rounded-xl text-xs text-[#163D2B] border border-emerald-200">
                            <span className="font-bold">Верифицировано агрономом:</span> {item.agronomistReview.reviewerName}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div className="text-xs text-slate-600">
                            Потери: <span className="font-bold text-red-600">{item.economicImpact.potentialLossPercentage}%</span> ({item.economicImpact.estimatedLossPerArea.toLocaleString()} {item.currency})
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDiscussWithAI(item)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-emerald-200"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t.discussWithAI || 'Обсудить с ИИ'}</span>
                            </button>
                            <button
                              onClick={() => {
                                setResult(item);
                                setActiveTab('analysis');
                              }}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-[#163D2B] hover:text-white rounded-xl text-xs font-semibold transition-colors"
                            >
                              Подробнее
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-white rounded-[32px] border border-slate-200">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700">История анализов пуста</p>
                    <p className="text-xs text-slate-400 mt-1">Проведите диагностику пораженных растений во вкладке "Диагностика"</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* 12. NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <NotificationsView
                  notifications={displayedNotifications}
                  lang={lang}
                  onMarkAsRead={handleMarkNotificationRead}
                  onMarkAllAsRead={handleMarkAllNotificationsRead}
                  setActiveTab={setActiveTab}
                />
              </motion.div>
            )}

            {/* 13. REPORTS (PDF) */}
            {activeTab === 'reports' && (
              <motion.div
                key="reports"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <ReportsView
                  fields={displayedFields}
                  analyses={displayedHistory}
                  recommendations={displayedRecommendations}
                  lang={lang}
                />
              </motion.div>
            )}

            {/* 14. SETTINGS */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <SettingsComponent
                  showSettings={true}
                  isInlineView={true}
                  currency={currency}
                  setCurrency={setCurrency}
                  unitSystem={unitSystem}
                  setUnitSystem={setUnitSystem}
                  location={location || null}
                  setLocation={setLocation}
                  lang={lang}
                  demoDataEnabled={demoDataEnabled}
                  setDemoDataEnabled={handleSetDemoDataEnabled}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Agronomist Review Modal */}
      {reviewModalAnalysis && (
        <AgronomistReviewModal
          analysis={reviewModalAnalysis}
          isOpen={!!reviewModalAnalysis}
          onClose={() => setReviewModalAnalysis(null)}
          onSubmitReview={handleSubmitReview}
        />
      )}

      {/* Settings Modal (invoked from TopBar) */}
      <SettingsComponent 
        showSettings={showSettingsModal}
        setShowSettings={setShowSettingsModal}
        currency={currency}
        setCurrency={setCurrency}
        unitSystem={unitSystem}
        setUnitSystem={setUnitSystem}
        location={location || null}
        setLocation={setLocation}
        lang={lang}
        demoDataEnabled={demoDataEnabled}
        setDemoDataEnabled={handleSetDemoDataEnabled}
      />

      {/* Firebase Auth Modal (Google Sign-In & Email) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        lang={lang}
        currentUser={user}
        onAuthSuccess={(u) => {
          setUser(u);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}
