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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzePlantImage, chatWithAssistant } from './services/geminiService';
import { fetchWeather, WeatherData } from './services/weatherService';
import { AnalysisResult, PlantCulture, CULTURES, ChatMessage, Currency, UnitSystem } from './types';
import { cn } from './lib/utils';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { translations, Language } from './translations';
import { Settings as SettingsModal } from './components/Settings';
import { auth, db, isFirebaseConfigured } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

type Tab = 'analyze' | 'history' | 'map' | 'assistant';

// Map controller to handle bounds and centering
function MapController({ markers, userLocation, onMapClick, mapRef }: { markers: AnalysisResult[], userLocation?: { lat: number, lng: number }, onMapClick: (lat: number, lng: number) => void, mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  
  useEffect(() => {
    mapRef.current = map;
    return () => { mapRef.current = null; };
  }, [map, mapRef]);

  useEffect(() => {
    // Invalidate size to fix rendering issues on tab switch/resize
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.filter(m => m.location).map(m => [m.location!.lat, m.location!.lng]));
      const isMobile = window.innerWidth < 640;
      map.fitBounds(bounds, { padding: isMobile ? [20, 20] : [50, 50], maxZoom: 18 });
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [markers, userLocation, map]);

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analyze');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
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
  const [lang, setLang] = useState<Language>('ru');
  const [currency, setCurrency] = useState<Currency>('KZT');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showSettings, setShowSettings] = useState(false);
  const [infoModal, setInfoModal] = useState<'privacy' | 'help' | 'contacts' | null>(null);
  const [mapMode, setMapMode] = useState<'map' | 'satellite' | 'hybrid'>('hybrid');
  const [highlightedHistoryId, setHighlightedHistoryId] = useState<string | null>(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  
  const t = translations[lang];

  const getWeatherCondition = (code: number) => {
    const conditions = t.weatherConditions as any;
    if (code === 0) return conditions.clear;
    if (code === 1) return conditions.mostlyClear;
    if (code === 2) return conditions.partlyCloudy;
    if (code === 3) return conditions.overcast;
    if (code === 45 || code === 48) return conditions.fog;
    if (code === 51 || code === 53 || code === 55) return conditions.drizzle;
    if (code === 61) return conditions.lightRain;
    if (code === 63) return conditions.moderateRain;
    if (code === 65) return conditions.heavyRain;
    if (code === 71) return conditions.lightSnow;
    if (code === 73) return conditions.moderateSnow;
    if (code === 75) return conditions.heavySnow;
    if (code === 80 || code === 81 || code === 82) return conditions.rainShowers;
    if (code === 95 || code === 96 || code === 99) return conditions.thunderstorm;
    return conditions.unknown;
  };
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const historyRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const mapRef = useRef<L.Map | null>(null);

  const scrollToHistoryItem = (id: string) => {
    setActiveTab('history');
    setHighlightedHistoryId(id);
    
    // Give time for tab switch
    setTimeout(() => {
      const element = historyRefs.current[id];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedHistoryId(null);
    }, 3000);
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setLocation(loc);
        fetchWeather(loc.lat, loc.lng).then(setWeather);
      }, (err) => {
        console.error("Geolocation error:", err);
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    
    if (isFirebaseConfigured && auth) {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        if (user) {
          // Load history from Firestore if user is logged in
          loadUserHistory(user.uid);
        } else {
          // Load from local API for anonymous users
          fetch('/api/history?userId=anonymous')
            .then(res => res.ok ? res.json() : [])
            .then(localHistory => {
              if (localHistory.length > 0) {
                setHistory(localHistory.sort((a: any, b: any) => b.timestamp - a.timestamp));
              } else {
                // Fallback to local storage
                const savedHistory = localStorage.getItem('plant_health_history');
                if (savedHistory) setHistory(JSON.parse(savedHistory));
              }
            })
            .catch(() => {
              const savedHistory = localStorage.getItem('plant_health_history');
              if (savedHistory) setHistory(JSON.parse(savedHistory));
            });
        }
      });
    } else {
      // Fallback for local storage if Firebase is not configured
      const savedHistory = localStorage.getItem('plant_health_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    }
    
    requestLocation();
    return () => unsubscribe();
  }, []);

  const loadUserHistory = async (uid: string) => {
    // Try local API first
    try {
      const response = await fetch(`/api/history?userId=${uid}`);
      if (response.ok) {
        const localHistory = await response.json();
        if (localHistory.length > 0) {
          setHistory(localHistory.sort((a: any, b: any) => b.timestamp - a.timestamp));
          return; // If we have local history, we can stop here or merge
        }
      }
    } catch (err) {
      console.error("Error loading local history:", err);
    }

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
        
        // Sync to local API
        for (const item of sortedHistory) {
          fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, userId: uid })
          }).catch(console.error);
        }
      }
    } catch (err) {
      console.error("Error loading history from Firebase:", err);
    }
  };

  const saveToHistory = async (result: AnalysisResult) => {
    const newHistory = [result, ...history];
    setHistory(newHistory);
    
    // Always save to local API if possible
    const userId = user?.uid || 'anonymous';
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, userId })
    }).catch(console.error);

    if (user && isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'history', result.id), {
          ...result,
          userId: user.uid
        });
      } catch (err) {
        console.error("Error saving to Firestore:", err);
      }
    } else {
      localStorage.setItem('plant_health_history', JSON.stringify(newHistory));
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
    
    // Add title
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
      headStyles: { fillColor: [45, 90, 39] }, // Sage green-ish
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
      // Refresh weather before analysis if location is available
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
    } catch (err) {
      setError(lang === 'ru' ? 'Не удалось проанализировать фото. Попробуйте еще раз.' : lang === 'kz' ? 'Фотоны талдау мүмкін болмады. Қайталап көріңіз.' : 'Failed to analyze photo. Please try again.');
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
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: lang === 'ru' ? 'Ошибка связи с ассистентом.' : lang === 'kz' ? 'Көмекшімен байланыс қатесі.' : 'Error communicating with assistant.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen pb-32 sm:pb-20 selection:bg-brand-200 selection:text-brand-800 overflow-x-hidden w-full">
      {/* Navigation Header */}
      <header className="sticky top-0 z-[100] px-4 py-4 sm:px-8">
        <nav className="max-w-7xl mx-auto glass-card rounded-[24px] sm:rounded-[32px] px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer" onClick={() => setActiveTab('analyze')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/20 group-hover:scale-105 transition-transform">
              <Sprout className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-serif font-semibold text-brand-800 leading-none mb-1 tracking-tight">AI Agronomist</h1>
              <p className="hidden sm:block text-[8px] font-bold text-brand-300 uppercase tracking-[0.2em]">v2.1 • Smart Farming</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-brand-100/50 p-1 rounded-2xl border border-brand-100/50">
            {[
              { id: 'analyze', icon: Camera, label: t.analyze },
              { id: 'history', icon: History, label: t.history },
              { id: 'map', icon: MapIcon, label: t.map },
              { id: 'assistant', icon: MessageSquare, label: t.assistant }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300",
                  activeTab === tab.id 
                    ? "bg-white text-brand-800 shadow-sm" 
                    : "text-brand-300 hover:text-brand-600 hover:bg-white/50"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-brand-600" : "text-brand-200")} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1 bg-brand-100/50 p-1 rounded-xl border border-brand-100/50">
              {(['ru', 'kz', 'en'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all",
                    lang === l ? "bg-white text-brand-800 shadow-sm" : "text-brand-300 hover:text-brand-600"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            
            <div className="hidden sm:block h-8 w-px bg-brand-100 mx-1" />
            
            <button 
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white border border-brand-100 flex items-center justify-center text-brand-300 hover:text-brand-600 hover:border-brand-300 transition-all shadow-sm shrink-0"
              title={t.settings}
            >
              <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'analyze' && (
            <motion.div 
              key="analyze"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left Column: Input & Controls */}
              <div className="lg:col-span-4 space-y-8">
                <section className="soft-card p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-serif font-medium text-brand-800">{t.newAnalysis}</h2>
                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-brand-600" />
                    </div>
                  </div>

                  <div className="mt-8 space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-brand-300 uppercase tracking-[0.2em] mb-3 block">{t.cultureLabel}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CULTURES.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setCulture(c.id as PlantCulture)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border",
                              culture === c.id 
                                ? "bg-brand-800 text-white border-brand-800 shadow-lg shadow-brand-800/10" 
                                : "bg-white text-brand-600 border-brand-100 hover:border-brand-300"
                            )}
                          >
                            <span className="text-lg">{c.icon}</span>
                            <span className="truncate">{(t.cultures as any)[c.id]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {culture === 'other' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <label className="text-[10px] font-bold text-brand-300 uppercase tracking-[0.2em] mb-3 block">{t.customCulture}</label>
                        <input 
                          type="text"
                          value={customCultureName}
                          onChange={(e) => setCustomCultureName(e.target.value)}
                          placeholder={t.enterCulture}
                          className="w-full px-5 py-4 bg-white border border-brand-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition-all"
                        />
                      </motion.div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold text-brand-300 uppercase tracking-[0.2em]">{t.ageDays}</label>
                        <span className="text-xs font-bold text-brand-800">{ageDays} {t.days}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="180" 
                        value={ageDays} 
                        onChange={(e) => setAgeDays(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-brand-100 rounded-full appearance-none cursor-pointer accent-brand-600"
                      />
                    </div>
                  </div>

                  {/* Image Upload Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative aspect-square rounded-[32px] border-2 border-dashed transition-all cursor-pointer overflow-hidden group",
                      image ? "border-brand-600" : "border-brand-100 hover:border-brand-300 bg-brand-50/30"
                    )}
                  >
                    {image ? (
                      <>
                        <img src={image} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30">
                            <RefreshCcw className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <Upload className="w-8 h-8 text-brand-200" />
                        </div>
                        <p className="text-sm font-bold text-brand-800 uppercase tracking-widest mb-2">{t.uploadPhoto}</p>
                        <p className="text-xs text-brand-300 font-medium leading-relaxed">{t.uploadInstructions}</p>
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
                    disabled={isAnalyzing}
                    className={cn(
                      "w-full mt-10 py-5 rounded-[24px] font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all shadow-xl",
                      isAnalyzing 
                        ? "bg-brand-100 text-brand-300 cursor-not-allowed" 
                        : "bg-brand-800 text-white hover:bg-brand-700 active:scale-[0.98] shadow-brand-800/20"
                    )}
                  >
                    {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Maximize className="w-4 h-4" />}
                    {isAnalyzing ? t.analyzing : t.runAnalysis}
                  </button>
                </section>
              </div>

              {/* Results */}
              <div className="lg:col-span-8">
                {result ? (
                  <div className="space-y-6">
                    {/* Main Result Header - Bento Style */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Diagnosis & Severity */}
                      <div className="md:col-span-8 bg-white rounded-[32px] p-8 shadow-sm border border-brand-100 relative overflow-hidden group">
                        <div className={cn(
                          "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-10 transition-colors duration-500",
                          result.severity === 'high' ? "bg-red-500" : result.severity === 'medium' ? "bg-orange-500" : "bg-emerald-500"
                        )} />
                        
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-8">
                            <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm",
                              result.severity === 'high' ? "bg-red-500" : result.severity === 'medium' ? "bg-orange-500" : "bg-emerald-500"
                            )}>
                              {result.severity === 'high' ? t.high : result.severity === 'medium' ? t.medium : t.low}
                            </div>
                            <div className="h-px flex-1 bg-brand-100/50" />
                            <div className="flex items-center gap-2 text-brand-300">
                              <span className="text-[10px] font-bold uppercase tracking-widest">{t.confidence}</span>
                              <div className="w-24 h-1 bg-brand-50 rounded-full overflow-hidden border border-brand-100">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${result.confidence * 100}%` }}
                                  className={cn(
                                    "h-full rounded-full",
                                    result.confidence > 0.8 ? "bg-emerald-500" : result.confidence > 0.5 ? "bg-orange-500" : "bg-red-500"
                                  )}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-brand-600">{Math.round(result.confidence * 100)}%</span>
                            </div>
                          </div>

                          <h3 className="text-4xl sm:text-5xl font-serif font-medium text-slate-900 mb-6 leading-tight tracking-tight">
                            {result.diagnosis}
                          </h3>

                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-2 px-4 py-2 bg-brand-800 text-white rounded-2xl shadow-lg shadow-brand-800/10">
                              {result.issueType === 'pest' ? <Bug className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                              <span className="text-[10px] font-bold uppercase tracking-widest">
                                {result.issueType === 'pest' ? t.pest : 
                                 result.issueType === 'disease' ? t.disease : 
                                 result.issueType === 'healthy' ? t.healthy : t.other}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-100 text-brand-600 rounded-2xl shadow-sm">
                              <Sprout className="w-4 h-4 text-brand-300" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">
                                {CULTURES.find(c => c.id === result.culture)?.name || result.customCultureName || result.culture}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-100 text-brand-600 rounded-2xl shadow-sm">
                              <RefreshCcw className="w-4 h-4 text-brand-300" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">
                                {result.ageDays} {t.days}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Weather Context Widget */}
                      <div className="md:col-span-4 bg-brand-800 rounded-[32px] p-8 text-white flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                          <CloudSun className="w-24 h-24" />
                        </div>
                        
                        <div className="relative z-10">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300 mb-8">{t.weather}</p>
                          {result.weatherContext ? (
                            <div className="space-y-8">
                              <div className="flex items-end gap-2">
                                <span className="text-5xl font-serif font-medium">{result.weatherContext.temp}°</span>
                                <span className="text-brand-400 text-lg mb-1">C</span>
                              </div>
                              <div className="space-y-4">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-400 uppercase tracking-widest font-bold">{lang === 'ru' ? 'Влажность' : lang === 'kz' ? 'Ылғалдылық' : 'Humidity'}</span>
                                  <span className="font-bold">{result.weatherContext.humidity}%</span>
                                </div>
                                <div className="h-px bg-white/5 w-full" />
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-400 uppercase tracking-widest font-bold">{t.forecast}</span>
                                  <span className="font-bold">{getWeatherCondition(result.weatherContext.conditionCode)}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-brand-400 italic">{t.locating}</p>
                          )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                              <LocateFixed className="w-4 h-4 text-brand-400" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-400">
                              {result.location ? `${result.location.lat.toFixed(2)}, ${result.location.lng.toFixed(2)}` : 'Location Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Economic Impact - Premium Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        </div>
                        <p className="text-[9px] font-bold text-brand-300 uppercase tracking-widest mb-2">{t.potentialLoss}</p>
                        <div className="flex items-baseline gap-1">
                          <h4 className="text-3xl font-serif font-medium text-slate-900">{result.economicImpact.potentialLossPercentage}</h4>
                          <span className="text-lg font-bold text-red-400">%</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Package className="w-5 h-5 text-accent-600" />
                        </div>
                        <p className="text-[9px] font-bold text-brand-300 uppercase tracking-widest mb-2">
                          {t.weightLoss}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-3xl font-serif font-medium text-slate-900">{result.economicImpact.estimatedLossWeight}</h4>
                          <span className="text-[9px] font-bold text-accent-600 uppercase tracking-widest">
                            {result.unitSystem === 'metric' ? (lang === 'ru' ? 'т/га' : lang === 'kz' ? 'т/га' : 't/ha') : 'bu/ac'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-brand-800 rounded-[24px] p-5 sm:p-6 shadow-xl shadow-brand-800/10 hover:shadow-brand-800/20 transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <p className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mb-2">
                          {t.financialLoss}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-3xl font-serif font-medium text-white">{result.economicImpact.estimatedLossPerArea.toLocaleString()}</h4>
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{result.currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations & Advice */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Action List */}
                      <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-lg font-serif font-medium text-slate-900 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-brand-600" />
                            </div>
                            {t.actionOptions}
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {result.recommendations.map((rec, i) => (
                            <div key={i} className="p-4 bg-brand-50/30 rounded-xl border border-brand-100 hover:border-brand-300 transition-all group">
                              <div className="flex items-start justify-between mb-3">
                                <div className={cn(
                                  "px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest text-white",
                                  rec.costEffectiveness === 'high' ? "bg-emerald-500" : rec.costEffectiveness === 'medium' ? "bg-orange-500" : "bg-red-400"
                                )}>
                                  {t.effectiveness}: {rec.costEffectiveness}
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-slate-900">
                                    {rec.estimatedCost.toLocaleString()} {result.currency}
                                  </span>
                                  <span className="text-[9px] text-brand-300 font-bold ml-1 uppercase">/{result.unitSystem === 'metric' ? t.ha : 'ac'}</span>
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">{rec.action}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Advice */}
                      <div className="bg-brand-50/50 rounded-[24px] p-5 sm:p-6 border border-brand-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5">
                          <MessageSquare className="w-24 h-24 text-brand-200" />
                        </div>
                        
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-lg font-serif font-medium text-slate-900 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                <Languages className="w-4 h-4 text-brand-600" />
                              </div>
                              {t.agronomistAdvice}
                            </h4>
                            <button 
                              onClick={() => setActiveTab('assistant')}
                              className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-brand-600 hover:bg-brand-600 hover:text-white transition-all shadow-sm group"
                            >
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                          
                          <div className="prose prose-brand max-w-none">
                            <div className="markdown-body bg-transparent p-0 border-none shadow-none text-slate-600 text-xs leading-relaxed max-h-[200px] overflow-y-auto no-scrollbar">
                              <Markdown>{result.localizedAdvice}</Markdown>
                            </div>
                          </div>

                          <div className="mt-6 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/40 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-600/20">
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-brand-300 uppercase tracking-widest mb-0.5">{t.needHelp}</p>
                              <button 
                                onClick={() => setActiveTab('assistant')}
                                className="text-[10px] font-bold text-brand-700 hover:text-brand-800 transition-colors"
                              >
                                {t.discussWithAI}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-white/30 rounded-[48px] border-2 border-dashed border-brand-100">
                    <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center mb-8 animate-pulse">
                      <Sprout className="w-12 h-12 text-brand-200" />
                    </div>
                    <h3 className="text-2xl font-serif font-medium text-brand-800 mb-3 tracking-tight">{t.readyToAnalyze}</h3>
                    <p className="text-brand-300 max-w-xs text-sm font-medium">
                      {t.uploadInstructions}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <h2 className="text-3xl font-serif font-medium text-slate-900 tracking-tight">{t.history}</h2>
                  {history.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-100 text-brand-800 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-50 transition-all shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        CSV {selectedHistoryIds.size > 0 ? `(${selectedHistoryIds.size})` : ''}
                      </button>
                      <button 
                        onClick={exportToPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-100 text-brand-800 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-50 transition-all shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        PDF {selectedHistoryIds.size > 0 ? `(${selectedHistoryIds.size})` : ''}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  {history.length > 0 && (
                    <button 
                      onClick={toggleSelectAll}
                      className="text-[10px] font-bold text-brand-400 hover:text-brand-800 uppercase tracking-[0.2em] flex items-center gap-3 transition-colors"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                        selectedHistoryIds.size === history.length ? "bg-brand-800 border-brand-800" : "bg-white border-brand-200"
                      )}>
                        {selectedHistoryIds.size === history.length && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      {selectedHistoryIds.size === history.length ? t.deselectAll : t.selectAll}
                    </button>
                  )}
                  <button 
                    onClick={() => { setHistory([]); localStorage.removeItem('plant_health_history'); setSelectedHistoryIds(new Set()); }}
                    className="text-[10px] font-bold text-red-500/60 hover:text-red-500 uppercase tracking-[0.2em] flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.clearHistory}
                  </button>
                </div>
              </div>
              
              {history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {history.map(item => (
                    <div 
                      key={item.id} 
                      ref={el => { historyRefs.current[item.id] = el; }}
                      className={cn(
                        "bg-white p-8 rounded-[40px] border transition-all group relative",
                        highlightedHistoryId === item.id 
                          ? "border-brand-800 ring-8 ring-brand-800/5 shadow-2xl scale-[1.02] z-10" 
                          : "border-brand-100 shadow-sm hover:shadow-xl hover:border-brand-200 hover:-translate-y-1",
                        selectedHistoryIds.has(item.id) && "border-brand-800 bg-brand-50/20"
                      )}
                    >
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelectItem(item.id); }}
                        className="absolute top-8 left-8 z-10 cursor-pointer"
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all shadow-sm",
                          selectedHistoryIds.has(item.id) ? "bg-brand-800 border-brand-800" : "bg-white border-brand-200 group-hover:border-brand-400"
                        )}>
                          {selectedHistoryIds.has(item.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </div>

                      <div 
                        onClick={() => { setResult(item); setActiveTab('analyze'); }}
                        className="cursor-pointer pl-12"
                      >
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <p className="text-[10px] font-bold text-brand-300 uppercase tracking-[0.2em] mb-3">
                              {new Date(item.timestamp).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'kz' ? 'kk-KZ' : 'en-US')} • {new Date(item.timestamp).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : lang === 'kz' ? 'kk-KZ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <h4 className="text-2xl font-serif font-medium text-slate-900 group-hover:text-brand-800 transition-colors tracking-tight leading-tight">{item.diagnosis}</h4>
                          </div>
                          <div className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-lg",
                            item.severity === 'high' ? "bg-red-500 shadow-red-500/20" : item.severity === 'medium' ? "bg-orange-500 shadow-orange-500/20" : "bg-emerald-500 shadow-emerald-500/20"
                          )}>
                            {item.severity === 'high' ? t.high : item.severity === 'medium' ? t.medium : t.low}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-brand-400">
                          <div className="flex items-center gap-6">
                            <span className="flex items-center gap-2"><Sprout className="w-4 h-4" /> {item.culture}</span>
                            <span className="flex items-center gap-2"><TrendingDown className="w-4 h-4" /> -{item.economicImpact.potentialLossPercentage}%</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-brand-200 group-hover:translate-x-2 transition-transform" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-32 bg-white rounded-[48px] border-2 border-dashed border-brand-100 shadow-sm">
                  <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-8">
                    <History className="w-12 h-12 text-brand-200" />
                  </div>
                  <h3 className="text-2xl font-serif font-medium text-slate-900 mb-3 tracking-tight">{t.historyEmpty}</h3>
                  <p className="text-brand-300 text-sm max-w-xs mx-auto leading-relaxed">{lang === 'ru' ? 'Ваши анализы появятся здесь после первой проверки.' : lang === 'kz' ? 'Бірінші тексеруден кейін талдауларыңыз осында пайда болады.' : 'Your analyses will appear here after the first check.'}</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 max-w-full"
            >
              <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border-[12px] border-white h-[500px] sm:h-[700px] relative w-full box-border group">
                <MapContainer 
                  center={location ? [location.lat, location.lng] : [43.2389, 76.8897]} 
                  zoom={location ? 15 : 12} 
                  maxZoom={22}
                  zoomControl={false}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <ScaleControl position="bottomleft" />
                  {/* Base Layers */}
                  {mapMode === 'map' && (
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      maxZoom={22}
                      maxNativeZoom={19}
                    />
                  )}
                  
                  {(mapMode === 'satellite' || mapMode === 'hybrid') && (
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                      opacity={1}
                      maxZoom={22}
                      maxNativeZoom={19}
                    />
                  )}

                  {mapMode === 'hybrid' && (
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      zIndex={1000}
                      maxZoom={22}
                      maxNativeZoom={19}
                    />
                  )}

                  <MapController 
                    markers={history.filter(h => h.location)} 
                    userLocation={location} 
                    onMapClick={(lat, lng) => setLocation({ lat, lng, accuracy: 0 })}
                    mapRef={mapRef}
                  />

                  {location && (
                    <>
                      <Circle 
                        center={[location.lat, location.lng]} 
                        radius={location.accuracy || 0} 
                        pathOptions={{ 
                          fillColor: '#10b981', 
                          fillOpacity: 0.05, 
                          color: '#10b981', 
                          weight: 1,
                          dashArray: '5, 5'
                        }} 
                      />
                      <Marker 
                        position={[location.lat, location.lng]}
                        icon={L.divIcon({
                          className: 'user-location-icon',
                          html: `
                            <div class="relative w-8 h-8 flex items-center justify-center">
                              <div class="w-5 h-5 bg-brand-600 rounded-full border-[3px] border-white shadow-xl"></div>
                              <div class="absolute inset-0 bg-brand-400 rounded-full animate-ping opacity-40"></div>
                            </div>
                          `,
                          iconSize: [32, 32],
                          iconAnchor: [16, 16],
                        })}
                      >
                        <Popup>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-800">
                            {t.youAreHere}
                            {location.accuracy ? (
                              <div className="text-[8px] text-brand-400 mt-1 font-bold">
                                ±{Math.round(location.accuracy)}M
                              </div>
                            ) : (
                              <div className="text-[8px] text-emerald-500 mt-1 font-bold">
                                {t.precisePoint}
                              </div>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    </>
                  )}

                  {/* Manual Locate & Layer Switcher */}
                  <div className="absolute top-8 right-8 z-[1000] flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="flex flex-col bg-white/90 backdrop-blur-md rounded-[24px] shadow-2xl border border-white/50 p-2 gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); mapRef.current?.zoomIn(); }}
                        className="w-12 h-12 bg-white rounded-2xl text-brand-800 flex items-center justify-center hover:bg-brand-50 transition-all active:scale-90 shadow-sm"
                        title={lang === 'ru' ? 'Увеличить' : 'Zoom In'}
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); mapRef.current?.zoomOut(); }}
                        className="w-12 h-12 bg-white rounded-2xl text-brand-800 flex items-center justify-center hover:bg-brand-50 transition-all active:scale-90 shadow-sm"
                        title={lang === 'ru' ? 'Уменьшить' : 'Zoom Out'}
                      >
                        <Minus className="w-6 h-6" />
                      </button>
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); requestLocation(); }}
                      className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center hover:bg-brand-700 transition-all active:scale-90 shadow-xl shadow-brand-600/20"
                      title={lang === 'ru' ? 'Мое местоположение' : 'My Location'}
                    >
                      <Navigation className="w-6 h-6" />
                    </button>

                    <div className="flex flex-col bg-white/90 backdrop-blur-md rounded-[24px] shadow-2xl border border-white/50 p-2 gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMapMode('map'); }}
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm",
                          mapMode === 'map' ? "bg-brand-800 text-white" : "bg-white text-brand-300 hover:text-brand-600"
                        )}
                        title={lang === 'ru' ? 'Карта' : 'Map'}
                      >
                        <MapIcon className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMapMode('satellite'); }}
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm",
                          mapMode === 'satellite' ? "bg-brand-800 text-white" : "bg-white text-brand-300 hover:text-brand-600"
                        )}
                        title={lang === 'ru' ? 'Спутник' : 'Satellite'}
                      >
                        <Globe className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMapMode('hybrid'); }}
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm",
                          mapMode === 'hybrid' ? "bg-brand-800 text-white" : "bg-white text-brand-300 hover:text-brand-600"
                        )}
                        title={lang === 'ru' ? 'Гибрид' : 'Hybrid'}
                      >
                        <Layers className="w-6 h-6" />
                      </button>
                    </div>

                  </div>

                  {history.filter(h => h.location).map(item => (
                    <Marker 
                      key={item.id}
                      position={[item.location!.lat, item.location!.lng]}
                      eventHandlers={{
                        click: () => scrollToHistoryItem(item.id)
                      }}
                      icon={L.divIcon({
                        className: 'custom-div-icon',
                        html: `
                          <div class="relative w-10 h-10 flex items-center justify-center">
                            <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-lg" style="background-color: ${item.severity === 'high' ? '#ef4444' : item.severity === 'medium' ? '#f97316' : '#10b981'}">
                              ${item.issueType === 'pest' ? '🐞' : item.issueType === 'disease' ? '🦠' : '🌱'}
                            </div>
                            <div class="absolute inset-0 rounded-full animate-ping opacity-20" style="background-color: ${item.severity === 'high' ? '#f87171' : item.severity === 'medium' ? '#fb923c' : '#34d399'}"></div>
                          </div>
                        `,
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                      })}
                    >
                      <Popup className="custom-popup">
                        <div className="p-3 min-w-[180px]">
                          <h4 className="font-serif font-medium text-slate-900 mb-2">{item.diagnosis}</h4>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-white shadow-sm",
                              item.severity === 'high' ? "bg-red-500" : item.severity === 'medium' ? "bg-orange-500" : "bg-emerald-500"
                            )}>
                              {item.severity}
                            </span>
                            <span className="text-[8px] text-brand-300 font-bold uppercase tracking-widest">{item.culture}</span>
                          </div>
                          <p className="text-[10px] text-brand-400 font-bold mb-4 uppercase tracking-widest">
                            {new Date(item.timestamp).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                          </p>
                          <button 
                            onClick={() => { setResult(item); setActiveTab('analyze'); }}
                            className="w-full py-2 bg-brand-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-brand-900 transition-colors shadow-lg shadow-brand-800/20"
                          >
                            {t.details}
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>

                {/* Overlay for empty state */}
                {history.filter(h => h.location).length === 0 && (
                  <div className="absolute inset-0 z-[1000] bg-brand-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white p-10 rounded-[48px] border border-white/20 shadow-2xl text-center w-full max-w-sm">
                      <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MapIcon className="w-10 h-10 text-brand-200" />
                      </div>
                      <h3 className="text-2xl font-serif font-medium text-slate-900 mb-3 tracking-tight">{t.fieldMap}</h3>
                      
                      {history.length === 0 ? (
                        <div className="space-y-6">
                          <p className="text-brand-300 text-sm leading-relaxed">
                            {t.uploadInstructions}
                          </p>
                          <button 
                            onClick={() => {
                              const demoData: any = [
                                {
                                  id: 'demo-1',
                                  diagnosis: lang === 'en' ? 'Wheat Rust' : 'Ржавчина пшеницы',
                                  issueType: 'disease',
                                  severity: 'high',
                                  culture: 'wheat',
                                  timestamp: Date.now() - 86400000,
                                  location: { lat: 43.2389, lng: 76.8897 },
                                  confidence: 0.92,
                                  currency: 'KZT',
                                  unitSystem: 'metric',
                                  economicImpact: { potentialLossPercentage: 30, estimatedLossPerArea: 45000, estimatedLossWeight: 0.5 },
                                  recommendations: [],
                                  localizedAdvice: 'Demo data'
                                },
                                {
                                  id: 'demo-2',
                                  diagnosis: lang === 'en' ? 'Spider Mite' : 'Паутинный клещ',
                                  issueType: 'pest',
                                  severity: 'medium',
                                  culture: 'apple',
                                  timestamp: Date.now() - 43200000,
                                  location: { lat: 43.2450, lng: 76.9000 },
                                  confidence: 0.88,
                                  currency: 'KZT',
                                  unitSystem: 'metric',
                                  economicImpact: { potentialLossPercentage: 15, estimatedLossPerArea: 25000, estimatedLossWeight: 0.2 },
                                  recommendations: [],
                                  localizedAdvice: 'Demo data'
                                }
                              ];
                              setHistory(demoData);
                            }}
                            className="bg-brand-800 text-white px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-900 transition-all shadow-xl shadow-brand-800/20 active:scale-95"
                          >
                            {t.demoData}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-6 p-6 bg-accent-50 border border-accent-100 rounded-3xl">
                          <p className="text-accent-600 text-xs font-bold leading-relaxed uppercase tracking-widest">
                            {t.gpsWarning}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'assistant' && (
            <motion.div 
              key="assistant"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-[calc(100vh-220px)] flex flex-col bg-white rounded-[48px] shadow-sm border border-brand-100 overflow-hidden"
            >
              {/* Chat Header */}
              <div className="px-5 py-3 border-b border-brand-100 flex items-center justify-between bg-brand-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-800 rounded-lg flex items-center justify-center shadow-md shadow-brand-800/10">
                    <MessageSquare className="text-white w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-medium text-base text-slate-900 tracking-tight">{t.assistant}</h3>
                    <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> {t.online}
                    </p>
                  </div>
                </div>
                {result && (
                  <div className="hidden sm:block text-right">
                    <p className="text-[8px] font-bold text-brand-300 uppercase tracking-widest">{t.context}</p>
                    <p className="text-[9px] font-bold text-brand-700">{result.diagnosis}</p>
                  </div>
                )}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-brand-200" />
                    </div>
                    <div>
                      <h4 className="text-lg font-serif font-medium text-slate-900 mb-1 tracking-tight">{t.chatPlaceholder}</h4>
                      <p className="text-[11px] text-brand-300 max-w-xs mx-auto leading-relaxed">
                        {lang === 'ru' ? 'Например: "Как предотвратить ржавчину в следующем году?"' : lang === 'kz' ? 'Мысалы: "Келесі жылы тат ауруын қалай болдырмауға болады?"' : 'Example: "How to prevent rust next year?"'}
                      </p>
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex w-full",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[85%] p-3 sm:p-4 rounded-[18px] text-xs sm:text-sm leading-relaxed shadow-sm",
                      msg.role === 'user' 
                        ? "bg-brand-800 text-white rounded-tr-none shadow-brand-800/10" 
                        : "bg-white text-slate-700 rounded-tl-none border border-brand-100"
                    )}>
                      <div className="markdown-body prose-invert">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-[18px] rounded-tl-none border border-brand-100 flex items-center gap-2 shadow-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                      <span className="text-[8px] text-brand-400 font-bold uppercase tracking-[0.2em] italic">{t.analyzing}</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 sm:p-4 border-t border-brand-100 bg-brand-50/20">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={t.chatPlaceholder}
                    className="flex-1 bg-white border border-brand-100 rounded-xl px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-800/5 focus:border-brand-800 transition-all shadow-sm"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md",
                      !chatInput.trim() || isChatLoading
                        ? "bg-brand-100 text-brand-300"
                        : "bg-brand-800 text-white hover:bg-brand-700 shadow-brand-800/10 active:scale-95"
                    )}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        currency={currency}
        setCurrency={setCurrency}
        unitSystem={unitSystem}
        setUnitSystem={setUnitSystem}
        location={location || null}
        setLocation={setLocation}
        lang={lang}
      />

      {/* Info Modals */}
      <AnimatePresence>
        {infoModal && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoModal(null)}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[48px] shadow-2xl overflow-hidden"
            >
              <div className="px-10 py-8 border-b border-brand-100 flex items-center justify-between bg-brand-50/30">
                <h3 className="font-serif font-medium text-2xl text-slate-900 tracking-tight">
                  {infoModal === 'privacy' ? t.privacyPolicy : infoModal === 'help' ? t.help : t.contacts}
                </h3>
                <button 
                  onClick={() => setInfoModal(null)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-brand-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-brand-400" />
                </button>
              </div>
              
              <div className="p-10">
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                  {infoModal === 'privacy' ? t.privacyContent : infoModal === 'help' ? t.helpContent : t.contactsContent}
                </div>
                <div className="pt-10">
                  <button 
                    onClick={() => setInfoModal(null)}
                    className="w-full py-5 bg-brand-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-800/20 hover:bg-brand-900 transition-all active:scale-[0.98]"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[48px] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="text-center mb-10">
                  <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="w-10 h-10 text-brand-600" />
                  </div>
                  <h3 className="text-3xl font-serif font-medium text-slate-900 mb-3 tracking-tight">{t.authRequired}</h3>
                  <p className="text-sm text-brand-300 leading-relaxed">{t.authInstructions}</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-300 uppercase tracking-widest ml-1">{t.email}</label>
                    <div className="relative">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
                      <input 
                        type="email" 
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-brand-50 border border-brand-100 rounded-2xl pl-14 pr-6 py-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-600/5 focus:border-brand-600 transition-all"
                        placeholder="example@mail.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-300 uppercase tracking-widest ml-1">{t.password}</label>
                    <div className="relative">
                      <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
                      <input 
                        type="password" 
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-brand-50 border border-brand-100 rounded-2xl pl-14 pr-6 py-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-600/5 focus:border-brand-600 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-xs font-bold text-red-600 uppercase tracking-widest">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {authError}
                    </div>
                  )}

                  {!isFirebaseConfigured && (
                    <div className="p-4 bg-accent-50 border border-accent-100 rounded-2xl flex items-center gap-3 text-xs font-bold text-accent-600 uppercase tracking-widest">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      {lang === 'ru' ? 'Firebase не настроен' : 'Firebase not configured'}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full py-5 bg-brand-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-800/20 hover:bg-brand-900 transition-all flex items-center justify-center gap-3"
                  >
                    {isAuthLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                    {t.login}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-white border-t border-brand-100 py-12 pb-32 sm:pb-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-800 rounded-xl flex items-center justify-center shadow-lg shadow-brand-800/10">
              <Sprout className="text-white w-5 h-5" />
            </div>
            <span className="font-serif font-medium text-xl text-slate-900 tracking-tight">{t.title} Predictor</span>
          </div>
          <div className="flex items-center gap-8 text-[10px] font-bold text-brand-300 uppercase tracking-[0.2em]">
            <button onClick={() => setInfoModal('privacy')} className="hover:text-brand-600 transition-colors">{t.privacyPolicy}</button>
            <button onClick={() => setInfoModal('help')} className="hover:text-brand-600 transition-colors">{t.help}</button>
            <button onClick={() => setInfoModal('contacts')} className="hover:text-brand-600 transition-colors">{t.contacts}</button>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent">
        <nav className="max-w-md mx-auto glass-card rounded-[32px] p-2 flex items-center justify-between shadow-2xl border border-brand-100/50">
          {[
            { id: 'analyze', icon: Camera, label: t.analyze },
            { id: 'history', icon: History, label: t.history },
            { id: 'map', icon: MapIcon, label: t.map },
            { id: 'assistant', icon: MessageSquare, label: t.assistant }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl transition-all duration-300 relative",
                activeTab === tab.id 
                  ? "text-brand-800" 
                  : "text-brand-300 hover:text-brand-600"
              )}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="mobile-tab-bg"
                  className="absolute inset-0 bg-brand-50 rounded-2xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-brand-600" : "text-brand-200")} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
