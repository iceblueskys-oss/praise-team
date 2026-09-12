// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 🌟 본인의 Firebase 콘솔 설정값을 직접 입력해주세요 (GitHub Pages 정적 배포 필수)
const firebaseConfig = {
  apiKey: "AIzaSyDi9jZ5a3q01LUqCiR6d-4OELjtpAFTLQo",
  authDomain: "praisesheet-66fe5.firebaseapp.com",
  projectId: "praisesheet-66fe5",
  storageBucket: "praisesheet-66fe5.appspot.com",
  messagingSenderId: "921722710189",
  appId: "1:921722710189:web:52e992a5ce8daf5c5f3e24"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
