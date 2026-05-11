import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserDoc } from "@/types";

interface AuthContextType {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<string>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserDoc: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const USER_DOC_TTL = 5 * 60 * 1000; // 5 min
  const userDocCacheKey = (uid: string) => `userDoc_${uid}`;

  const fetchUserDoc = async (uid: string) => {
    const cacheKey = userDocCacheKey(uid);
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.timestamp && Date.now() - parsed.timestamp < USER_DOC_TTL && parsed.data) {
          setUserDoc(parsed.data as UserDoc);
          return;
        }
      }
    } catch { /* ignore */ }

    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as UserDoc;
      setUserDoc(data);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } else {
      setUserDoc(null);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchUserDoc(u.uid);
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will fetchUserDoc
  };

  const register = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const newUser: UserDoc = {
      name,
      email,
      role: "student",
      status: "pending",
      enrolledCourses: [],
      activeCourseId: "",
      paymentInfo: { method: "", paymentNumber: "", transactionId: "", screenshot: "" },
      createdAt: Timestamp.now(),
    };
    await setDoc(doc(db, "users", cred.user.uid), newUser);
    setUserDoc(newUser);
    return cred.user.uid;
  };

  const logout = async () => {
    if (user) {
      try { sessionStorage.removeItem(userDocCacheKey(user.uid)); } catch {}
    }
    await signOut(auth);
    setUserDoc(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshUserDoc = async () => {
    if (user) {
      try { sessionStorage.removeItem(userDocCacheKey(user.uid)); } catch {}
      await fetchUserDoc(user.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, login, register, logout, resetPassword, refreshUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
}
