/**
 * Утилиты для управления Push-уведомлениями в браузере
 */

export async function checkPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return await Notification.requestPermission();
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('SW Registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('SW Registration failed:', error);
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
