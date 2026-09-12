// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/firestore'; // 또는 'firebase/app'
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  // 기존 설정 내용 유지
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// 브라우저 지원 시에만 Messaging 인스턴스 반환
export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (supported && typeof window !== 'undefined') {
    return getMessaging(app);
  }
  return null;
};
