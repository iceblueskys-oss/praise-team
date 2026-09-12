// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 🌟 본인의 Firebase 콘솔 설정값을 직접 입력해주세요 (GitHub Pages 정적 배포 필수)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSy실제_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "본인프로젝트.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "본인프로젝트_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "본인프로젝트.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "발신자ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "앱ID",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
