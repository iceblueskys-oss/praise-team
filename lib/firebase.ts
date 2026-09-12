// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDi9jZ5a3q01LUqCiR6d-4OELjtpAFTLQo",
  authDomain: "praisesheet-66fe5.firebaseapp.com",
  projectId: "praisesheet-66fe5",
  storageBucket: "praisesheet-66fe5.firebasestorage.app",
  messagingSenderId: "921722710189",
  appId: "1:921722710189:web:52e992a5ce8daf5c5f3e24",
  measurementId: "G-DB4VV52N6L"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// 브라우저에서 실제 호출될 때만 동적으로 messaging 라이브러리를 로드
export const getFirebaseMessaging = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const { getMessaging, isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (supported) {
      return getMessaging(app);
    }
  } catch (err) {
    console.warn('FCM 초기화 실패:', err);
  }
  return null;
};
