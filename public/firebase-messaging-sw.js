// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 본인 프로젝트의 Firebase 설정값
firebase.initializeApp({
  apiKey: "AIzaSy...",
  authDomain: "praise-team.firebaseapp.com",
  projectId: "praise-team",
  storageBucket: "praise-team.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
});

const messaging = firebase.messaging();

// 백그라운드 푸시 수신 리스너
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || '찬양팀 알림';
  const notificationOptions = {
    body: payload.notification?.body || '새로운 소식이 등록되었습니다.',
    icon: '/praise-team/apple-touch-icon.png?v=3',
    badge: '/praise-team/apple-touch-icon.png?v=3',
    data: {
      url: payload.data?.url || '/praise-team/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 시 해당 앱/페이지 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/praise-team/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/praise-team/');
      }
    })
  );
});
