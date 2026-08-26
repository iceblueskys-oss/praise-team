import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDi9jZ5a3q01LUqCiR6d-4OELjtpAFTLQo",
  authDomain: "praisesheet-66fe5.firebaseapp.com",
  projectId: "praisesheet-66fe5",
  storageBucket: "praisesheet-66fe5.firebasestorage.app",
  messagingSenderId: "921722710189",
  appId: "1:921722710189:web:52e992a5ce8daf5c5f3e24"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
