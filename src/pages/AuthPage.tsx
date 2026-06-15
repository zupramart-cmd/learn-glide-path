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

// ── Validated Input ──────────────────────────────────────────────────────────
function ValidatedInput({
  type = "text",
  placeholder,
  value,
  onChange,
  onValidate,
  error,
  required,
  maxLength,
  className,
}: {
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onValidate: () => void;
  error: string | null;
  required?: boolean;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onValidate}
        required={required}
        maxLength={maxLength}
        className={`w-full px-4 py-3 rounded-md bg-card border text-foreground text-sm transition-colors ${
          error ? "border-destructive" : "border-border"
        } ${className ?? ""}`}
      />
      {error && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-destructive">
          {error}
        </span>
      )}
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

  // ── Validation errors ──────────────────────────────────────────────────────
  const [emailError, setEmailError] = useState<string | null>(null);
  const [paymentNumberError, setPaymentNumberError] = useState<string | null>(null);
  const [tnxError, setTnxError] = useState<string | null>(null);

  useEffect(() => {
    if (user && userDoc) {
      if (userDoc.role === "admin") navigate("/admin");
      else if (!courseId) navigate("/content");
    }
  }, [user, userDoc]);

  useEffect(() => {
    getCachedCollection<Course>(db, "courses").then((list) => {
      // Hide expired/inactive courses — students cannot enroll into them.
      const active = list.filter((c: any) => c.isActive !== false);
      setAllCourses(active);
      if (courseId) {
        const found = active.find((c) => c.id === courseId);
        if (found) setCourse(found);
      }
    });
  }, [courseId]);

  useEffect(() => {
    if (selectedCourseId && allCourses.length > 0) {
      const found = allCourses.find((c) => c.id === selectedCourseId);
      if (found) setCourse(found);
    }
  }, [selectedCourseId, allCourses]);

  useEffect(() => {
    setIsLogin(mode === "login");
  }, [mode]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Validators ─────────────────────────────────────────────────────────────

  /** Standard email format: something@domain.tld */
  const validateEmail = (v: string): string | null => {
    const trimmed = v.trim();
    if (!trimmed) return null; // required handled by HTML
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(trimmed) ? null : "Invalid";
  };

  /**
   * Bangladeshi mobile number validation.
   * Accepts: 01XXXXXXXXX (11 digits, operator prefix 3/4/5/6/7/8/9)
   * Operators: Grameenphone (017/013), Banglalink (019/014),
   *            Robi (018/016), Airtel (016), Teletalk (015), bKash/Nagad/Rocket all use same format
   */
  const validatePaymentNumber = (v: string): string | null => {
    const cleaned = v.trim().replace(/[-\s]/g, "");
    if (!cleaned) return "Required";
    const bdMobile = /^01[3-9]\d{8}$/;
    return bdMobile.test(cleaned) ? null : "Invalid";
  };

  const validateTransactionId = (method: string, tnxId: string): string | null => {
    const id = tnxId.trim().toUpperCase();
    const m = method.toLowerCase();
    if (m.includes("bkash")) {
      if (!/^[A-Z0-9]{10}$/.test(id))
        return "bKash transaction ID must be exactly 10 uppercase letters/digits (from payment SMS)";
    } else if (m.includes("nagad")) {
      if (!/^[A-Z0-9]{8,12}$/.test(id))
        return "Nagad transaction ID must be 8–12 uppercase letters/digits (from payment SMS)";
    } else if (m.includes("rocket")) {
      if (!/^[A-Z0-9]{8,12}$/.test(id))
        return "Rocket transaction ID must be 8–12 uppercase letters/digits";
    } else {
      if (id.length < 6) return "Transaction ID is too short";
    }
    return null;
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate email before submission
    const eErr = validateEmail(email);
    if (eErr) { setEmailError(eErr); return; }
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Logged in successfully");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
    setSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Run all validations before proceeding
    const eErr = validateEmail(email);
    const pErr = validatePaymentNumber(paymentNumber);
    const tnxId = transactionId.trim().toUpperCase();
    const tErr = tnxId ? validateTransactionId(paymentMethod, tnxId) : "Transaction ID is required";

    if (eErr) setEmailError(eErr);
    if (pErr) setPaymentNumberError(pErr);
    if (tErr) setTnxError("Invalid");

    if (eErr || pErr || tErr) return;

    if (!selectedCourseId || !course) { toast.error("Please select a course first"); return; }
    if ((course as any).isActive === false) { toast.error("এই কোর্সটি expired — enroll করা যাবে না"); return; }
    if (!paymentMethod) { toast.error("Please select a payment method"); return; }

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
    const eErr = validateEmail(email);
    if (eErr) { setEmailError(eErr); return; }
    try {
      await resetPassword(email);
      toast.success("Password reset email sent");
      setShowReset(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  // ── Reset Password view ────────────────────────────────────────────────────

  if (showReset) {
    return (
      <div className="p-4 max-w-md mx-auto mt-8 animate-fade-in">
        <h2 className="text-xl font-semibold text-foreground mb-4">Reset Password</h2>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <ValidatedInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(v) => { setEmail(v); setEmailError(null); }}
            onValidate={() => setEmailError(validateEmail(email))}
            error={emailError}
            required
          />
          <button type="submit" className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm">
            Send Reset Link
          </button>
          <button type="button" onClick={() => setShowReset(false)} className="w-full text-sm text-muted-foreground">
            Back to Login
          </button>
        </form>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-md mx-auto mt-4 animate-fade-in">
      <div className="flex bg-card rounded-lg border border-border overflow-hidden mb-6">
        <button
          onClick={() => setIsLogin(true)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Login
        </button>
        <button
          onClick={() => setIsLogin(false)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${!isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Register
        </button>
      </div>

      {/* ── Login Form ── */}
      {isLogin ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <ValidatedInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(v) => { setEmail(v); setEmailError(null); }}
            onValidate={() => setEmailError(validateEmail(email))}
            error={emailError}
            required
          />
          <PasswordInput value={password} onChange={setPassword} placeholder="Password" />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
          <button type="button" onClick={() => setShowReset(true)} className="w-full text-sm text-muted-foreground">
            Forgot Password?
          </button>
        </form>
      ) : (
        /* ── Register Form ── */
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm"
          />

          {/* Email with validation */}
          <ValidatedInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(v) => { setEmail(v); setEmailError(null); }}
            onValidate={() => setEmailError(validateEmail(email))}
            error={emailError}
            required
          />

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
              {allCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseName} — ৳{c.price}
                </option>
              ))}
            </select>
          </div>

          {course && (
            <div className="p-3 bg-card border border-border rounded-lg flex items-center gap-3">
              {course.thumbnail && (
                <img src={course.thumbnail} alt="" className="w-20 aspect-video rounded-md object-cover shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{course.courseName}</p>
                <p className="text-xs text-muted-foreground">৳{course.price}</p>
              </div>
            </div>
          )}

          {/* Payment Methods */}
          {settings.paymentMethods?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
              <div className="space-y-2">
                {settings.paymentMethods.map((pm, i) => (
                  <div
                    key={i}
                    onClick={() => setPaymentMethod(pm.name)}
                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer ${
                      paymentMethod === pm.name ? "border-primary bg-accent" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          paymentMethod === pm.name ? "border-primary" : "border-muted-foreground"
                        }`}
                      >
                        {paymentMethod === pm.name && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm text-foreground">{pm.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">{pm.number}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCopy(pm.number); }}
                        className="p-1"
                      >
                        {copied === pm.number ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Number with validation */}
          <ValidatedInput
            type="tel"
            placeholder="Payment Number"
            value={paymentNumber}
            onChange={(v) => {
              // Allow only digits, max 11
              const digits = v.replace(/\D/g, "").slice(0, 11);
              setPaymentNumber(digits);
              setPaymentNumberError(null);
            }}
            onValidate={() => setPaymentNumberError(validatePaymentNumber(paymentNumber))}
            error={paymentNumberError}
            maxLength={11}
          />

          {/* Transaction ID with validation */}
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Transaction ID"
              value={transactionId}
              onChange={(e) => {
                setTnxError(null);
                setTransactionId(e.target.value.toUpperCase().replace(/\s+/g, ""));
              }}
              onBlur={() => {
                if (transactionId.trim()) {
                  const err = validateTransactionId(paymentMethod, transactionId);
                  setTnxError(err ? "Invalid" : null);
                }
              }}
              maxLength={16}
              className={`w-full px-4 py-3 rounded-md bg-card border text-foreground text-sm tracking-wider transition-colors ${
                tnxError ? "border-destructive" : "border-border"
              }`}
            />
            {tnxError && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-destructive">
                {tnxError}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
          >
            {submitting ? "Registering..." : "Register & Enroll"}
          </button>
        </form>
      )}
    </div>
  );
}
