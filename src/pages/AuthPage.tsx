import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { doc, addDoc, collection, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCachedCollection } from "@/lib/firestoreCache";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Course } from "@/types";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        className="w-full px-4 py-3 pr-12 rounded-md bg-card border border-border text-foreground text-sm"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const courseId = searchParams.get("courseId") || "";
  const navigate = useNavigate();
  const { user, userDoc, login, register, resetPassword } = useAuth();
  const settings = useAppSettings();

  const [isLogin, setIsLogin] = useState(mode === "login");
  const [showReset, setShowReset] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (user && userDoc) {
      if (userDoc.role === "admin") navigate("/admin");
      else if (!courseId) navigate("/content");
    }
  }, [user, userDoc]);

  useEffect(() => {
    // Load all courses for dropdown (cached)
    getCachedCollection<Course>(db, "courses").then((list) => {
      setAllCourses(list);
      if (courseId) {
        const found = list.find(c => c.id === courseId);
        if (found) setCourse(found);
      }
    });
  }, [courseId]);

  useEffect(() => {
    if (selectedCourseId && allCourses.length > 0) {
      const found = allCourses.find(c => c.id === selectedCourseId);
      if (found) setCourse(found);
    }
  }, [selectedCourseId, allCourses]);

  useEffect(() => { setIsLogin(mode === "login"); }, [mode]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Logged in successfully");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
    setSubmitting(false);
  };

  const validateTransactionId = (method: string, tnxId: string): string | null => {
    const id = tnxId.trim().toUpperCase();
    const m = method.toLowerCase();
    if (m.includes("bkash")) {
      if (!/^[A-Z0-9]{10}$/.test(id)) return "bKash transaction ID must be exactly 10 uppercase letters/digits (from payment SMS)";
    } else if (m.includes("nagad")) {
      if (!/^[A-Z0-9]{8,12}$/.test(id)) return "Nagad transaction ID must be 8–12 uppercase letters/digits (from payment SMS)";
    } else if (m.includes("rocket")) {
      if (!/^[A-Z0-9]{8,12}$/.test(id)) return "Rocket transaction ID must be 8–12 uppercase letters/digits";
    } else {
      if (id.length < 6) return "Transaction ID is too short";
    }
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !course) { toast.error("Please select a course first"); return; }
    if (!paymentMethod) { toast.error("Please select a payment method"); return; }
    const tnxId = transactionId.trim().toUpperCase();
    if (!tnxId) { toast.error("Transaction ID is required"); return; }
    const err = validateTransactionId(paymentMethod, tnxId);
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const userId = await register(email, password, name);
      await addDoc(collection(db, "enrollRequests"), {
        userId, name, email, courseId: selectedCourseId, courseName: course.courseName,
        paymentMethod, paymentNumber, transactionId: tnxId,
        status: "pending", createdAt: Timestamp.now(),
      });
      await updateDoc(doc(db, "users", userId), {
        enrolledCourses: arrayUnion({
          courseId: selectedCourseId, courseName: course.courseName,
          courseThumbnail: course.thumbnail || "", enrolledAt: Timestamp.now(),
        }),
        activeCourseId: selectedCourseId,
        paymentInfo: { method: paymentMethod, paymentNumber, transactionId: tnxId, screenshot: "" },
      });
      toast.success("Registration successful! Waiting for approval.");
      navigate("/profile");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    }
    setSubmitting(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resetPassword(email);
      toast.success("Password reset email sent");
      setShowReset(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  if (showReset) {
    return (
      <div className="p-4 max-w-md mx-auto mt-8 animate-fade-in">
        <h2 className="text-xl font-semibold text-foreground mb-4">Reset Password</h2>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
          <button type="submit" className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm">Send Reset Link</button>
          <button type="button" onClick={() => setShowReset(false)} className="w-full text-sm text-muted-foreground">Back to Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto mt-4 animate-fade-in">
      <div className="flex bg-card rounded-lg border border-border overflow-hidden mb-6">
        <button onClick={() => setIsLogin(true)} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Login</button>
        <button onClick={() => setIsLogin(false)} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${!isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Register</button>
      </div>

      {isLogin ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
          <PasswordInput value={password} onChange={setPassword} placeholder="Password" />
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">{submitting ? "Logging in..." : "Login"}</button>
          <button type="button" onClick={() => setShowReset(true)} className="w-full text-sm text-muted-foreground">Forgot Password?</button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
          <PasswordInput value={password} onChange={setPassword} placeholder="Password" />

          {/* Course Dropdown */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Select Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm"
            >
              <option value="">-- Select a Course --</option>
              {allCourses.map(c => (
                <option key={c.id} value={c.id}>{c.courseName} — ৳{c.price}</option>
              ))}
            </select>
          </div>

          {course && (
            <div className="p-3 bg-card border border-border rounded-lg flex items-center gap-3">
              {course.thumbnail && <img src={course.thumbnail} alt="" className="w-12 h-12 rounded-md object-cover" />}
              <div>
                <p className="text-sm font-medium text-foreground">{course.courseName}</p>
                <p className="text-xs text-muted-foreground">৳{course.price}</p>
              </div>
            </div>
          )}

          {settings.paymentMethods?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
              <div className="space-y-2">
                {settings.paymentMethods.map((pm, i) => (
                  <label key={i} className={`flex items-center justify-between p-3 rounded-md border cursor-pointer ${paymentMethod === pm.name ? "border-primary bg-accent" : "border-border bg-card"}`}>
                    <div className="flex items-center gap-2">
                      <input type="radio" name="payment" value={pm.name} checked={paymentMethod === pm.name} onChange={() => setPaymentMethod(pm.name)} className="accent-primary" />
                      <span className="text-sm text-foreground">{pm.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">{pm.number}</span>
                      <button type="button" onClick={() => handleCopy(pm.number)} className="p-1">
                        {copied === pm.number ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <input type="text" placeholder="Payment Number" value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
          <input
            type="text"
            required
            placeholder={
              paymentMethod.toLowerCase().includes("bkash") ? "bKash Transaction ID (e.g. 9A7B3C2D1E)" :
              paymentMethod.toLowerCase().includes("nagad") ? "Nagad Transaction ID (e.g. 75T2K6L9)" :
              "Transaction ID (from payment SMS)"
            }
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            maxLength={16}
            className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm tracking-wider"
          />
          <p className="text-[11px] text-muted-foreground -mt-2">
            {paymentMethod.toLowerCase().includes("bkash") && "bKash TrxID = 10 digits/letters (uppercase)। "}
            {paymentMethod.toLowerCase().includes("nagad") && "Nagad TrxID = 8–12 digits/letters (uppercase)। "}
            পেমেন্ট SMS এ আসা Transaction ID হুবহু কপি করে দিন।
          </p>

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">{submitting ? "Registering..." : "Register & Enroll"}</button>
        </form>
      )}
    </div>
  );
}
