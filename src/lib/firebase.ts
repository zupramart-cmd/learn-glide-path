import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPjq4947rnal0icObju1o-y1PGrfAUCTI",
  authDomain: "hsciantv.firebaseapp.com",
  projectId: "hsciantv",
  storageBucket: "hsciantv.firebasestorage.app",
  messagingSenderId: "615677953836",
  appId: "1:615677953836:web:e69b936a255a71a34dce89",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
