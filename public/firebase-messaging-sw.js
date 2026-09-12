// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 🌟 본인 Firebase 콘솔에 있는 실제 키 값 6개 입력 필수
firebase.initializeApp({
  apiKey: "AIzaSyDi9jZ5a3q01LUqCiR6d-4OELjtpAFTLQo",
  authDomain: "praisesheet-66fe5.firebaseapp.com",
  projectId: "praisesheet-66fe5",
  storageBucket: "praisesheet-66fe5.firebasestorage.app",
  messagingSenderId: "921722710189",
  appId: "1:921722710189:web:52e992a5ce8daf5c5f3e24"
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

// 알림 클릭 시 앱 열기
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
