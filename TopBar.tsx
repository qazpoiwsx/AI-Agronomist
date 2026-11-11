import React from 'react';
import { 
  Bell, 
  User, 
  Settings as SettingsIcon, 
  Menu, 
  Globe, 
  ShieldCheck, 
  CloudSun,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../translations';
import { UserRole } from '../types';
import { TabRoute } from './Sidebar';

interface TopBarProps {
  activeTab: TabRoute;
  setActiveTab: (tab: TabRoute) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  unreadNotifsCount: number;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onToggleMobileSidebar: () => void;
  userName?: string;
  isAuthenticated?: boolean;
  onOpenAuth?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  userRole,
  setUserRole,
  unreadNotifsCount,
  onOpenNotifications,
  onOpenSettings,
  onToggleMobileSidebar,
  userName,
  isAuthenticated = false,
  onOpenAuth
}) => {
  const t = translations[lang];
  const displayUserName = userName || (lang === 'kz' ? 'Фермер' : lang === 'en' ? 'Farmer' : 'Фермер');

  const getPageTitle = (tab: TabRoute) => {
    switch (tab) {
      case 'dashboard': return t.dashboard || 'Панель управления';
      case 'fields': return t.fields || 'Поля и участки';
      case 'map': return t.map || 'Агрономическая ГИС Карта';
      case 'missions': return t.missions || 'Дрон-миссии и мониторинг';
      case 'analysis': return t.analyze || 'ИИ Диагностика болезней';
      case 'health': return t.health || 'Здоровье посевов и стресс';
      case 'weather': return t.weatherRisks || 'Метеоусловия и агрориски';
      case 'yield_loss': return t.yieldLoss || 'Прогноз урожайности и потерь';
      case 'recommendations': return t.recommendationsNav || 'Агрономические рекомендации';
      case 'assistant': return t.assistant || 'AI Агроном-Консультант';
      case 'history': return t.history || 'История фитосанитарных анализов';
      case 'notifications': return t.notificationsNav || 'Центр уведомлений';
      case 'reports': return t.reportsNav || 'Генератор отчётов (PDF)';
      case 'settings': return t.settings || 'Системные настройки';
      default: return 'AI Agronomist';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#F7F9F6]/90 backdrop-blur-md border-b border-emerald-950/10 px-4 py-3 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-200/60 lg:hidden"
          title="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest">
            <span>AI Agronomist</span>
            <span>/</span>
            <span className="text-[#2F7D4A] font-semibold">{getPageTitle(activeTab)}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-[#17251D] tracking-tight">
            {getPageTitle(activeTab)}
          </h2>
        </div>
      </div>

      {/* Right Controls: Engine Status, Role Switcher, Lang, Notifications, User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* System telemetry pill */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-[11px] font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Gemini Vision</span>
          <span className="text-emerald-400">•</span>
          <span>PostGIS Ready</span>
        </div>

        {/* Role Selector Badge */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
          {(['FARMER', 'AGRONOMIST', 'ADMIN'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setUserRole(r)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                userRole === r
                  ? "bg-[#163D2B] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {r === 'ADMIN' ? 'Admin' : r === 'AGRONOMIST' ? 'Agronomist' : 'Farmer'}
            </button>
          ))}
        </div>

        {/* Language Switcher */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
          {(['ru', 'kz', 'en'] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "w-7 h-7 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center",
                lang === l
                  ? "bg-[#2F7D4A] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-[#2F7D4A] hover:border-emerald-300 transition-all shadow-sm"
          title={t.notificationsNav}
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadNotifsCount}
            </span>
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-[#2F7D4A] hover:border-emerald-300 transition-all shadow-sm"
          title={t.settings}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* User profile / Login */}
        {isAuthenticated ? (
          <div 
            onClick={onOpenAuth || onOpenSettings}
            className="flex items-center gap-2 pl-1 cursor-pointer group"
            title={displayUserName}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2F7D4A] to-[#163D2B] text-white font-bold text-xs flex items-center justify-center shadow-sm group-hover:ring-2 group-hover:ring-emerald-400 transition-all">
              {displayUserName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-800 leading-none truncate max-w-[130px]">{displayUserName}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                {userRole === 'ADMIN' ? (lang === 'kz' ? 'Әкімші' : lang === 'en' ? 'Administrator' : 'Администратор') : 
                 userRole === 'AGRONOMIST' ? (lang === 'kz' ? 'Бас агроном' : lang === 'en' ? 'Head Agronomist' : 'Главный агроном') : 
                 (lang === 'kz' ? 'Жеке шаруашылық' : lang === 'en' ? 'Personal Farm' : 'Личное хозяйство')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-2 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
            >
              <User className="w-3.5 h-3.5" />
              <span>{t.login}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
