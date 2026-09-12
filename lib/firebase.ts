// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

// 기존에 등록되어 있던 본인의 설정값 그대로 유지
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "기존_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "기존_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "기존_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "기존_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "기존_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "기존_APP_ID",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// 🌟 추가할 부분: 브라우저가 푸시를 지원할 때만 Messaging 객체 반환
export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (supported && typeof window !== 'undefined') {
    return getMessaging(app);
  }
  return null;
};
