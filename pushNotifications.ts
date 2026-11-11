/**
 * Safe detection for AI Studio preview iframe, development mode, or cloud sandbox
 */
export function isPreviewOrDevEnvironment(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const isIframe = window.self !== window.top;
    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isAiStudioPreview = window.location.hostname.includes('ais-dev-') || 
                              window.location.hostname.includes('ais-pre-') || 
                              window.location.hostname.includes('.run.app');
    return isIframe || isDev || isAiStudioPreview;
  } catch (e) {
    return true;
  }
}

export async function checkPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isPreviewOrDevEnvironment()) {
    return 'unsupported';
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isPreviewOrDevEnvironment()) {
    return 'unsupported';
  }
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return await Notification.requestPermission();
}

export async function registerServiceWorker() {
  if (isPreviewOrDevEnvironment()) {
    // Service Worker registration is skipped in AI Studio preview / dev iframe to prevent security and MIME errors
    return null;
  }
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      return registration;
    } catch (error) {
      console.warn('SW registration skipped or unsupported in current environment:', error);
      return null;
    }
  }
  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Получаем публичный ключ из переменных окружения
    const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    
    if (!publicVapidKey) {
      throw new Error('VITE_VAPID_PUBLIC_KEY is not defined in UI environment');
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    // Отправляем подписку на сервер через API
    const response = await fetch('/api/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to server');
    }

    return subscription;
  } catch (error) {
    console.error('Error during push subscription:', error);
    return null;
  }
}

export async function unsubscribeUserFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      // Опционально: уведомить сервер об удалении подписки
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return false;
  }
}

export async function triggerPushNotification(title: string, body: string, url: string = '/') {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url })
    });
    return response.ok;
  } catch (error) {
    console.error('Error triggering notification:', error);
    return false;
  }
}
