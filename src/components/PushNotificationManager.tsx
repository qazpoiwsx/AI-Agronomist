import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, ShieldAlert, Loader2, Share } from 'lucide-react';
import { 
  checkPushPermission, 
  requestPushPermission, 
  subscribeUserToPush,
  unsubscribeUserFromPush 
} from '../lib/pushNotifications';
import { cn } from '../lib/utils';
import { Language } from '../translations';
import { motion } from 'motion/react';

interface Props {
  lang: Language;
}

export const PushNotificationManager: React.FC<Props> = ({ lang }) => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | 'loading'>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

  useEffect(() => {
    async function init() {
      try {
        const p = await checkPushPermission();
        setPermission(p);
      } catch (err) {
        console.error('Error checking permission:', err);
        setPermission('unsupported');
      }
    }
    init();
  }, []);

  const handleToggle = async () => {
    setIsProcessing(true);
    try {
      if (permission === 'default' || permission === 'denied') {
        const result = await requestPushPermission();
        if (result === 'granted') {
          await subscribeUserToPush();
        }
        setPermission(result as any);
      } else if (permission === 'granted') {
        const success = await unsubscribeUserFromPush();
        if (success) {
          setPermission('default');
        }
      }
    } catch (err) {
      console.error('Push toggle error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const t = {
    ru: {
      title: 'Уведомления',
      enable: 'Включить пуш-уведомления',
      disable: 'Выключить уведомления',
      granted: 'Уведомления включены',
      denied: 'Доступ заблокирован',
      unsupported: 'Браузер не поддерживает пуши',
      iosTitle: 'Уведомления на iPhone',
      iosDesc: 'Нажмите «Поделиться», затем «На экран Домой», чтобы включить уведомления.',
      descActive: 'Вы будете получать оповещения о завершении анализа и советы агронома.',
      descInactive: 'Включите, чтобы не пропустить важные результаты анализа урожая.'
    },
    kz: {
      title: 'Хабарландырулар',
      enable: 'Пуш-хабарландыруларды қосу',
      disable: 'Хабарландыруларды өшіру',
      granted: 'Хабарландырулар қосылған',
      denied: 'Қолжетімділік бұғатталған',
      unsupported: 'Браузер пуш-хабарландыруларды қолдамайды',
      iosTitle: 'iPhone-дағы хабарландырулар',
      iosDesc: 'Хабарландыруларды қосу үшін «Бөлісу», содан кейін «Басты экранға» түймесін басыңыз.',
      descActive: 'Талдау аяқталғаны туралы ескертулер мен агроном кеңестерін аласыз.',
      descInactive: 'Егіннің маңызды талдау нәтижелерін жіберіп алмау үшін қосыңыз.'
    }
  }[lang] || {
    title: 'Notifications',
    enable: 'Enable Push Notifications',
    disable: 'Disable Notifications',
    granted: 'Notifications Enabled',
    denied: 'Access Denied',
    unsupported: 'Not Supported',
    iosTitle: 'Push on iPhone',
    iosDesc: 'Tap Share -> Add to Home Screen to enable push notifications.',
    descActive: 'You will receive alerts about analysis completion and agronomy tips.',
    descInactive: 'Enable to stay updated on your crop health results.'
  };

  return (
    <div className={cn(
      "bg-yellow-400 rounded-3xl p-6 border-4 border-black transition-all duration-300 shadow-xl",
    )}>
      <div className="mb-4 p-2 bg-black text-yellow-400 font-bold rounded-lg text-center uppercase tracking-wider text-xs">
        Debug Info | Статус: {permission}
      </div>

      <div className="flex items-start gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors bg-white/20 text-black",
        )}>
          {permission === 'granted' ? <CheckCircle2 className="w-6 h-6" /> : 
           permission === 'denied' ? <ShieldAlert className="w-6 h-6" /> : 
           permission === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : 
           <Bell className="w-6 h-6" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-black text-black tracking-tight text-lg">
            {permission === 'granted' ? t.granted : 
             permission === 'denied' ? t.denied : 
             permission === 'unsupported' ? t.unsupported : t.title}
          </h3>
          <p className="text-[12px] text-black/80 mt-1 font-medium leading-relaxed">
            {permission === 'granted' ? t.descActive : t.descInactive}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleToggle}
          disabled={isProcessing || permission === 'loading' || permission === 'unsupported'}
          className={cn(
            "w-full py-4 rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 border-2 border-black",
            permission === 'granted' 
              ? "bg-white text-black hover:bg-slate-100" 
              : "bg-black text-white hover:bg-slate-900"
          )}
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 
           permission === 'granted' ? t.disable : t.enable}
        </button>
      </div>
      
      {permission === 'denied' && (
        <p className="mt-3 text-[10px] text-black text-center font-bold">
          {lang === 'ru' ? 'Сбросьте настройки разрешений в браузере' : 'Браузер параметрлерінде рұқсатты өзгертіңіз'}
        </p>
      )}

      {permission === 'unsupported' && isIOS && !isStandalone && (
        <div className="mt-4 p-3 bg-white/30 rounded-xl border border-black/10">
          <p className="text-[10px] text-black font-medium">
             {t.iosDesc}
          </p>
        </div>
      )}
    </div>
  );
};
