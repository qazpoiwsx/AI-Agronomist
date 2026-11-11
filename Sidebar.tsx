import React from 'react';
import { 
  LayoutDashboard, 
  Sprout, 
  Map as MapIcon, 
  Camera, 
  Activity, 
  CloudSun, 
  TrendingDown, 
  CheckSquare, 
  MessageSquare, 
  History, 
  Bell, 
  FileText, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Wheat
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations, Language } from '../translations';
import { UserRole } from '../types';

export type TabRoute = 
  | 'dashboard' 
  | 'fields' 
  | 'map' 
  | 'missions' 
  | 'analysis' 
  | 'health' 
  | 'weather' 
  | 'yield_loss' 
  | 'recommendations' 
  | 'assistant' 
  | 'history' 
  | 'notifications' 
  | 'reports' 
  | 'settings';

interface SidebarProps {
  activeTab: TabRoute;
  setActiveTab: (tab: TabRoute) => void;
  lang: Language;
  userRole: UserRole;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  unreadNotifsCount: number;
  user?: { email?: string | null; displayName?: string | null } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  lang,
  userRole,
  collapsed,
  setCollapsed,
  unreadNotifsCount,
  user
}) => {
  const t = translations[lang];

  const navItems: { id: TabRoute; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: t.dashboard || 'Dashboard', icon: LayoutDashboard },
    { id: 'fields', label: t.fields || 'Fields', icon: Sprout },
    { id: 'map', label: t.map || 'Agricultural Map', icon: MapIcon },
    { id: 'analysis', label: t.analyze || 'Image Analysis', icon: Camera },
    { id: 'health', label: t.health || 'Crop Health', icon: Activity },
    { id: 'weather', label: t.weatherRisks || 'Weather & Risks', icon: CloudSun },
    { id: 'yield_loss', label: t.yieldLoss || 'Loss Forecast', icon: TrendingDown },
    { id: 'recommendations', label: t.recommendationsNav || 'Recommendations', icon: CheckSquare },
    { id: 'assistant', label: t.assistant || 'AI Agronomist', icon: MessageSquare },
    { id: 'history', label: t.history || 'Analysis History', icon: History },
    { id: 'notifications', label: t.notificationsNav || 'Notifications', icon: Bell, badge: unreadNotifsCount },
    { id: 'reports', label: t.reportsNav || 'Reports (PDF)', icon: FileText },
    { id: 'settings', label: t.settings || 'Settings', icon: Settings },
  ];

  return (
    <aside className={cn(
      "h-screen sticky top-0 bg-[#163D2B] text-white flex flex-col justify-between transition-all duration-300 z-40 border-r border-emerald-950/40 select-none",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Brand Header */}
      <div>
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group overflow-hidden"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/50 group-hover:scale-105 transition-transform">
              <Wheat className="w-5 h-5 text-[#163D2B]" />
            </div>
            {!collapsed && (
              <div className="transition-opacity duration-200">
                <h1 className="font-serif font-bold text-base leading-tight tracking-tight text-white flex items-center gap-1.5">
                  AI Agronomist
                </h1>
                <p className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-widest">
                  Enterprise Ag GIS
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-emerald-300/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors hidden lg:flex"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group",
                  isActive
                    ? "bg-[#2F7D4A] text-white shadow-md shadow-emerald-950/40"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn(
                  "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-white" : "text-emerald-300/70"
                )} />
                {!collapsed && (
                  <span className="truncate tracking-wide text-left flex-1">{item.label}</span>
                )}
                {item.badge && item.badge > 0 ? (
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white shrink-0",
                    collapsed && "absolute top-1.5 right-1.5"
                  )}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/10">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[10px] text-emerald-300/60 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Online • PostGIS Ready
            </span>
            <span>v2.5</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="System Online"></span>
          </div>
        )}
      </div>
    </aside>
  );
};
