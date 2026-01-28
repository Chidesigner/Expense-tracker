import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0OG3jokD1iEsoycD2Euvu3Qz_cETfse8",
  authDomain: "expensetracker-e3fb8.firebaseapp.com",
  projectId: "expensetracker-e3fb8",
  storageBucket: "expensetracker-e3fb8.firebasestorage.app",
  messagingSenderId: "1027137613808",
  appId: "1:1027137613808:web:7cbd8da111e35b11d1f735"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);