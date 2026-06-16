import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, Unsubscribe, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserDoc } from "@/types";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<string>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserDoc: () => Promise<void>;
  /** True only when account status === "approved". Use to block any course/exam/video access. */
  hasAccess: boolean;
  /** True if a specific courseId is in user's enrolled list AND status is approved. */
  hasCourseAccess: (courseId?: string | null) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

// ── Single-device session token (no extra Firestore reads) ──
// Token is stored on the user doc; an onSnapshot listener detects mismatches
// when another device logs in and logs this device out instantly.
const SESSION_TOKEN_KEY = "lms_session_token";
const getLocalToken = () => { try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch { return null; } };
const setLocalToken = (t: string) => { try { localStorage.setItem(SESSION_TOKEN_KEY, t); } catch {} };
const clearLocalToken = () => { try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch {} };
const generateToken = () => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const snapshotUnsub = useRef<Unsubscribe | null>(null);
  const pendingTokenWrite = useRef<string | null>(null);

  const USER_DOC_TTL = 5 * 60 * 1000;
  const userDocCacheKey = (uid: string) => `userDoc_${uid}`;

  const stopSnapshot = () => {
    if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null; }
  };

  const forceLogout = async (reason: string) => {
    stopSnapshot();
    clearLocalToken();
    try { sessionStorage.clear(); } catch {}
    await signOut(auth);
    toast.error(reason);
  };

  // Subscribe to user doc via realtime listener — 1 read on subscribe + 1 per change.
  const subscribeUserDoc = (uid: string) => {
    stopSnapshot();
    snapshotUnsub.current = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) { setUserDoc(null); return; }
      const data = snap.data() as UserDoc;
      setUserDoc(data);
      try { sessionStorage.setItem(userDocCacheKey(uid), JSON.stringify({ data, timestamp: Date.now() })); } catch {}

      // Strict single-device enforcement.
      // Skip while a pending token write from this device hasn't echoed back yet.
      const local = getLocalToken();
      const remote = data.sessionToken;
      const writingNow = pendingTokenWrite.current && pendingTokenWrite.current === local;
      if (remote && !writingNow) {
        if (!local || remote !== local) {
          forceLogout("Logged out: signed in on another device");
        }
      }
    });
  };

  const hydrateFromCache = (uid: string) => {
    try {
      const raw = sessionStorage.getItem(userDocCacheKey(uid));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.timestamp && Date.now() - parsed.timestamp < USER_DOC_TTL && parsed.data) {
          setUserDoc(parsed.data as UserDoc);
        }
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        hydrateFromCache(u.uid);
        subscribeUserDoc(u.uid);
      } else {
        stopSnapshot();
        setUserDoc(null);
      }
      setLoading(false);
    });
    return () => { unsub(); stopSnapshot(); };
  }, []);

  // Re-fetch userDoc when window regains focus, but at most once per 2 min.
  // Cheap admin-update propagation without a persistent listener cost.
  useEffect(() => {
    let lastFetch = 0;
    const onFocus = async () => {
      if (!auth.currentUser) return;
      if (Date.now() - lastFetch < 2 * 60 * 1000) return;
      lastFetch = Date.now();
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (snap.exists()) {
          const data = snap.data() as UserDoc;
          setUserDoc(data);
          try { sessionStorage.setItem(`userDoc_${auth.currentUser.uid}`, JSON.stringify({ data, timestamp: Date.now() })); } catch {}
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) onFocus(); });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);


  // Issue + persist a new token on this device, write it to the user doc.
  const issueDeviceToken = async (uid: string) => {
    const token = generateToken();
    pendingTokenWrite.current = token;
    setLocalToken(token);
    try {
      await updateDoc(doc(db, "users", uid), { sessionToken: token });
    } catch {
      // ignore — snapshot will reconcile
    }
    // clear pending flag shortly after — snapshot echo handled
    setTimeout(() => { if (pendingTokenWrite.current === token) pendingTokenWrite.current = null; }, 10000);
  };

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await issueDeviceToken(cred.user.uid);
  };

  const register = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const token = generateToken();
    pendingTokenWrite.current = token;
    setLocalToken(token);
    const newUser: UserDoc = {
      name,
      email,
      role: "student",
      status: "pending",
      enrolledCourses: [],
      activeCourseId: "",
      paymentInfo: { method: "", paymentNumber: "", transactionId: "", screenshot: "" },
      sessionToken: token,
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
    stopSnapshot();
    clearLocalToken();
    await signOut(auth);
    setUserDoc(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshUserDoc = async () => {
    if (!user) return;
    try { sessionStorage.removeItem(userDocCacheKey(user.uid)); } catch {}
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) setUserDoc(snap.data() as UserDoc);
  };

  const hasAccess = !!userDoc && userDoc.status === "approved";
  const hasCourseAccess = (courseId?: string | null) => {
    if (!hasAccess || !courseId) return false;
    return !!userDoc!.enrolledCourses?.some(c => c.courseId === courseId);
  };

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, login, register, logout, resetPassword, refreshUserDoc, hasAccess, hasCourseAccess }}>
      {children}
    </AuthContext.Provider>
  );
}
