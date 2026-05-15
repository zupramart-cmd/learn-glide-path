import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  HelpCircle,
  UserPlus,
  CreditCard,
  Download,
  PlayCircle,
  ClipboardList,
  KeyRound,
  Phone,
  RefreshCw,
  ShieldQuestion,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const WHATSAPP_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const WELCOME_TEXT =
  "Hello everyone, this is Ashikuzzaman, your Ashik vaiya. কিভাবে সাহায্য করতে পারি?";

interface FAQ {
  id: string;
  icon: React.ReactNode;
  question: string;
  answer: string;
  keywords: string[];
}

const FAQS: FAQ[] = [
  {
    id: "enroll",
    icon: <UserPlus className="h-3.5 w-3.5" />,
    question: "কোর্সে কিভাবে যুক্ত হবো?",
    answer:
      "**কোর্সে যুক্ত হওয়ার ধাপ:**\n\n১. হোমপেজ থেকে আপনার পছন্দের কোর্স সিলেক্ট করুন\n২. **Enroll Now** বাটনে ক্লিক করুন\n৩. রেজিস্ট্রেশন ফর্মে নাম, ইমেইল ও পাসওয়ার্ড দিন\n৪. পেমেন্ট মেথড সিলেক্ট করে টাকা পাঠান\n৫. পেমেন্ট SMS এ আসা **Transaction ID** হুবহু কপি করে দিন\n৬. অ্যাডমিন Transaction ID ভেরিফাই করলেই কোর্স অ্যাক্সেস পাবেন ✅",
    keywords: ["এনরোল", "enroll", "ভর্তি", "যুক্ত", "join", "admission"],
  },
  {
    id: "payment",
    icon: <CreditCard className="h-3.5 w-3.5" />,
    question: "কিভাবে পেমেন্ট করব?",
    answer:
      "**পেমেন্ট প্রক্রিয়া:**\n\n• বিকাশ / নগদ / রকেট — যেকোনো একটি নাম্বারে **Send Money** করুন\n• Transaction ID টি কপি করে রাখুন\n• পেমেন্ট স্ক্রিনশট নিন\n• এনরোলমেন্ট ফর্মে দুটোই দিন\n\n📞 পেমেন্ট নাম্বার দেখতে এনরোলমেন্ট পেজে যান।",
    keywords: ["পেমেন্ট", "payment", "টাকা", "বিকাশ", "bkash", "নগদ", "nagad", "send money", "টাকা দিব"],
  },
  {
    id: "install",
    icon: <Download className="h-3.5 w-3.5" />,
    question: "অ্যাপ কিভাবে ইন্সটল করব?",
    answer:
      "**অ্যাপ ইন্সটল করার নিয়ম:**\n\n📱 **Android / iPhone:**\n১. Chrome / Safari ব্রাউজারে আমাদের ওয়েবসাইট খুলুন\n২. মেনু থেকে **Add to Home Screen** / **Install App** সিলেক্ট করুন\n৩. কনফার্ম করুন — হোম স্ক্রিনে আইকন যুক্ত হবে\n\n💻 **Desktop:** ব্রাউজারের অ্যাড্রেস বারে install আইকনে ক্লিক করুন।",
    keywords: ["ইন্সটল", "install", "অ্যাপ", "app", "download", "ডাউনলোড"],
  },
  {
    id: "class",
    icon: <PlayCircle className="h-3.5 w-3.5" />,
    question: "কিভাবে ক্লাস করব?",
    answer:
      "**ক্লাস করার ধাপ:**\n\n১. লগইন করে **Content** পেজে যান\n২. আপনার এনরোল করা কোর্স সিলেক্ট করুন\n৩. সাবজেক্ট ও চ্যাপ্টার থেকে ভিডিও বেছে নিন\n৪. ভিডিও প্লে করুন এবং PDF ডাউনলোড করুন\n\n📌 লাইভ ক্লাসের সময় Live ব্যাজ দেখাবে।",
    keywords: ["ক্লাস", "class", "ভিডিও", "video", "পড়াশোনা", "lecture", "কন্টেন্ট", "content"],
  },
  {
    id: "exam",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
    question: "কিভাবে এক্সাম দিব?",
    answer:
      "**এক্সাম দেওয়ার নিয়ম:**\n\n১. **Exams** পেজে যান (লগইন থাকতে হবে)\n২. উপলব্ধ এক্সাম থেকে একটি সিলেক্ট করুন\n৩. সময়সীমা ও নিয়ম পড়ে **Start** বাটনে ক্লিক করুন\n৪. সব প্রশ্নের উত্তর দিয়ে **Submit** করুন\n\n⚠️ এক্সাম চলাকালে ট্যাব পরিবর্তন বা স্ক্রিনশট নেওয়া যাবে না।",
    keywords: ["এক্সাম", "exam", "পরীক্ষা", "test", "কুইজ", "quiz"],
  },
  {
    id: "password",
    icon: <KeyRound className="h-3.5 w-3.5" />,
    question: "পাসওয়ার্ড ভুলে গেলে কী করব?",
    answer:
      "**পাসওয়ার্ড রিসেট:**\n\n১. লগইন পেজে **Forgot Password** এ ক্লিক করুন\n২. আপনার ইমেইল দিন\n৩. ইমেইলে আসা লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন\n\n📧 ইমেইল না পেলে Spam/Junk ফোল্ডার চেক করুন।",
    keywords: ["পাসওয়ার্ড", "password", "ভুলে", "forgot", "reset", "রিসেট"],
  },
  {
    id: "device",
    icon: <Smartphone className="h-3.5 w-3.5" />,
    question: "কতগুলো ডিভাইসে লগইন করা যাবে?",
    answer:
      "একটি অ্যাকাউন্ট থেকে সর্বোচ্চ **২টি ডিভাইসে** একসাথে লগইন করা যাবে। তৃতীয় ডিভাইসে লগইন করলে আগের একটি ডিভাইস স্বয়ংক্রিয়ভাবে লগআউট হবে। 🔒",
    keywords: ["ডিভাইস", "device", "লগইন", "login", "একাউন্ট", "account"],
  },
  {
    id: "refund",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    question: "রিফান্ড পলিসি কী?",
    answer:
      "এনরোলমেন্ট সম্পন্ন হওয়ার পর সাধারণত রিফান্ড দেওয়া হয় না। তবে বিশেষ পরিস্থিতিতে WhatsApp এ যোগাযোগ করলে আমরা সমাধানের চেষ্টা করব। 🤝",
    keywords: ["রিফান্ড", "refund", "ফেরত", "টাকা ফেরত"],
  },
  {
    id: "tech",
    icon: <ShieldQuestion className="h-3.5 w-3.5" />,
    question: "টেকনিক্যাল সমস্যা হলে?",
    answer:
      "**সমস্যা সমাধানের চেষ্টা করুন:**\n\n• ব্রাউজার Refresh করুন\n• Cache & Cookies ক্লিয়ার করুন\n• ভিন্ন ব্রাউজারে চেষ্টা করুন\n• ইন্টারনেট কানেকশন চেক করুন\n\nসমস্যা থাকলে WhatsApp এ স্ক্রিনশটসহ পাঠান। 💬",
    keywords: ["সমস্যা", "problem", "issue", "bug", "কাজ করছে না", "error"],
  },
  {
    id: "contact",
    icon: <Phone className="h-3.5 w-3.5" />,
    question: "যোগাযোগ কিভাবে করব?",
    answer:
      "**যোগাযোগের মাধ্যম:**\n\n💬 WhatsApp — সবচেয়ে দ্রুত\n📘 Facebook Page\n🎬 YouTube Channel\n📧 Email\n\nনিচের WhatsApp বাটনে ক্লিক করে সরাসরি মেসেজ করতে পারেন।",
    keywords: ["যোগাযোগ", "contact", "ফোন", "phone", "নাম্বার", "whatsapp", "হেল্প", "help"],
  },
];

interface ChatMessage {
  id: number;
  role: "bot" | "user";
  content: string;
  quickReplies?: FAQ[];
  timestamp: Date;
  animate?: boolean;
  quickRepliesReady?: boolean;
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

// Simple markdown-ish renderer for bold + bullets + line breaks
function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i} className="leading-relaxed">
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**") ? (
                <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{p}</span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

// Smooth streaming typewriter — token-by-token, natural rhythm
function TypewriterText({
  text,
  onTick,
  onDone,
}: {
  text: string;
  speed?: number;
  onTick?: () => void;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const doneRef = useRef(false);

  // Split into tokens: word + trailing space/punctuation kept together
  const tokens = text.match(/\S+\s*/g) ?? [];

  useEffect(() => {
    setShown("");
    setCursorVisible(true);
    doneRef.current = false;
    let i = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      i++;
      setShown(tokens.slice(0, i).join(""));
      onTick?.();
      if (i >= tokens.length) {
        doneRef.current = true;
        // fade cursor out after a short hold
        setTimeout(() => {
          if (!cancelled) setCursorVisible(false);
          onDone?.();
        }, 350);
        return;
      }
      // speed: base 55ms per token, slight jitter, brief pause after sentence-ending punctuation
      const token = tokens[i - 1];
      let delay = 52 + Math.random() * 35;
      if (/[।.!?]\s*$/.test(token)) delay = 260 + Math.random() * 120;
      else if (/[,;:—–]\s*$/.test(token)) delay = 110 + Math.random() * 60;
      // every ~8 tokens a micro-stutter to feel live
      if (i % 8 === 0) delay += 40 + Math.random() * 40;
      setTimeout(tick, delay);
    };

    const start = setTimeout(tick, 60);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const done = shown.length >= text.length;

  return (
    <>
      <FormattedText text={shown} />
      {cursorVisible && (
        <span
          className="inline-block w-[2px] h-[1em] bg-current align-middle ml-[1px]"
          style={{
            opacity: done ? 0 : 0.7,
            transition: done ? "opacity 0.4s ease" : "none",
            animation: done ? "none" : "blink 0.9s step-end infinite",
          }}
        />
      )}
      <style>{`@keyframes blink { 0%,100%{opacity:0.7} 50%{opacity:0} }`}</style>
    </>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
    </div>
  );
}

export function FloatingButtons() {
  const settings = useAppSettings();
  const { userDoc } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const isAdmin = userDoc?.role === "admin";

  const [chatOpen, setChatOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: "bot", content: WELCOME_TEXT, quickReplies: FAQS.slice(0, 6), timestamp: new Date(), animate: true, quickRepliesReady: false },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [whatsappInput, setWhatsappInput] = useState("");
  const [waHistory, setWaHistory] = useState<{ role: "user"; content: string; timestamp: Date }[]>([]);
  const [waWelcomeKey, setWaWelcomeKey] = useState(0);
  const [chatWelcomeKey, setChatWelcomeKey] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const waScrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(2);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    waScrollRef.current?.scrollTo({ top: waScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [waHistory]);

  // Replay WA welcome typing each time the window opens
  useEffect(() => {
    if (whatsappOpen) setWaWelcomeKey((k) => k + 1);
  }, [whatsappOpen]);

  // Replay chat welcome typing each time the chat opens
  useEffect(() => {
    if (chatOpen) setChatWelcomeKey((k) => k + 1);
  }, [chatOpen]);

  if (isAdmin || pathname.startsWith("/admin")) return null;

  const pushMessage = (msg: Omit<ChatMessage, "id" | "timestamp" | "animate"> & { timestamp?: Date }) => {
    setMessages((prev) => [...prev, { ...msg, id: idRef.current++, timestamp: msg.timestamp || new Date(), animate: msg.role === "bot" }]);
  };

  const markQuickRepliesReady = (id: number) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, quickRepliesReady: true } : m))
    );
  };

  const respondWithFaq = (faq: FAQ) => {
    pushMessage({ role: "user", content: faq.question });
    setIsTyping(true);
    // typing delay proportional to answer length, capped
    const delay = Math.min(400 + faq.answer.length * 0.8, 1800);
    setTimeout(() => {
      setIsTyping(false);
      pushMessage({
        role: "bot",
        content: faq.answer,
        quickReplies: FAQS.filter((f) => f.id !== faq.id).slice(0, 4),
      });
    }, delay);
  };

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    pushMessage({ role: "user", content: text });
    setChatInput("");

    const lower = text.toLowerCase();
    const matched = FAQS.find((f) => f.keywords.some((k) => lower.includes(k.toLowerCase())));

    setIsTyping(true);
    const replyDelay = (content: string) => Math.min(400 + content.length * 0.8, 1800);
    setTimeout(() => {
      setIsTyping(false);
      if (matched) {
        pushMessage({
          role: "bot",
          content: matched.answer,
          quickReplies: FAQS.filter((f) => f.id !== matched.id).slice(0, 4),
        });
      } else if (/হাই|hi|hello|হ্যালো|আসসালাম/i.test(text)) {
        const content = "ওয়ালাইকুম আসসালাম! 😊 নিচের যেকোনো প্রশ্নে ক্লিক করুন অথবা টাইপ করুন।";
        pushMessage({ role: "bot", content, quickReplies: FAQS.slice(0, 6) });
      } else if (/ধন্যবাদ|thanks|thank/i.test(text)) {
        pushMessage({ role: "bot", content: "আপনাকেও ধন্যবাদ! 🙏 আর কোনো প্রশ্ন থাকলে জানাবেন।" });
      } else {
        pushMessage({
          role: "bot",
          content:
            "দুঃখিত, আমি আপনার প্রশ্নটি ঠিক বুঝতে পারিনি। 😅 নিচের অপশন থেকে বেছে নিন অথবা WhatsApp এ যোগাযোগ করুন।",
          quickReplies: FAQS,
        });
      }
    }, replyDelay(matched?.answer ?? "short"));
  };

  const sendWhatsApp = () => {
    if (!whatsappInput.trim()) return;
    const whatsappNumber =
      settings.socialLinks?.find((s) => s.name.toLowerCase().includes("whatsapp"))?.link || "";
    const number = whatsappNumber.replace(/\D/g, "");
    setWaHistory((prev) => [...prev, { role: "user", content: whatsappInput, timestamp: new Date() }]);
    if (number) {
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(whatsappInput)}`, "_blank");
    }
    setWhatsappInput("");
  };

  const closeAll = () => {
    setChatOpen(false);
    setWhatsappOpen(false);
    setMenuOpen(false);
  };

  return (
    <div className={`fixed ${isMobile ? "bottom-20" : "bottom-6"} right-3 sm:right-4 z-40 flex flex-col gap-3 items-end`}>
      {/* Chatbot Window */}
      {chatOpen && (
        <div className="w-[calc(100vw-1.5rem)] max-w-96 h-[32rem] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground flex items-center gap-3 shrink-0">
            <div className="relative">
              <img src="/logo.png" alt="" className="h-9 w-9 rounded-full object-cover border-2 border-primary-foreground/20" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Ashik Vaiya</div>
              <div className="text-[11px] opacity-80">Online</div>
            </div>
            <button
              onClick={closeAll}
              className="p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gradient-to-b from-muted/30 to-background"
          >
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                  {msg.role === "bot" && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src="/logo.png" alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-2xl rounded-bl-md"
                    }`}
                  >
                    {msg.role === "bot" && msg.animate ? (
                      <TypewriterText
                        key={msg.id === 1 ? chatWelcomeKey : msg.id}
                        text={msg.content}
                        onTick={() =>
                          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
                        }
                        onDone={() => markQuickRepliesReady(msg.id)}
                      />
                    ) : (
                      <FormattedText text={msg.content} />
                    )}
                    <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>

                {msg.quickReplies && msg.quickReplies.length > 0 && (msg.quickRepliesReady || !msg.animate) && (
                  <div
                    className="flex flex-wrap gap-1.5 pl-9"
                    style={{ animation: "fadeSlideUp 0.3s ease both" }}
                  >
                    <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
                    {msg.quickReplies.map((faq) => (
                      <button
                        key={faq.id}
                        onClick={() => respondWithFaq(faq)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card border border-border hover:bg-accent hover:border-primary/40 transition-all shadow-sm"
                      >
                        <span className="text-primary">{faq.icon}</span>
                        <span>{faq.question}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start items-end gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/logo.png" alt="" className="h-full w-full object-cover" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-3 py-2 shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2.5 border-t border-border bg-card flex items-center gap-2 shrink-0">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="আপনার প্রশ্ন লিখুন..."
              className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-muted border border-transparent text-foreground text-sm focus:outline-none focus:border-primary focus:bg-background transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim()}
              className="shrink-0 p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Window */}
      {whatsappOpen && (
        <div className="w-[calc(100vw-1.5rem)] max-w-96 h-[30rem] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 bg-[#075E54] text-white flex items-center gap-3 shrink-0">
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="" className="h-full w-full object-cover" />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#075E54]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Ashik Vaiya</div>
              <div className="text-[11px] opacity-80">WhatsApp • Online</div>
            </div>
            <button
              onClick={() => setWhatsappOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* WhatsApp-style background */}
          <div
            ref={waScrollRef}
            className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
            style={{
              backgroundColor: "hsl(var(--muted))",
              backgroundImage:
                "radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.04) 0, transparent 50%), radial-gradient(circle at 80% 80%, hsl(var(--primary) / 0.04) 0, transparent 50%)",
            }}
          >
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg rounded-tl-none px-3 py-2 text-sm bg-card text-foreground shadow-sm">
                <TypewriterText
                  key={waWelcomeKey}
                  text={WELCOME_TEXT}
                  onTick={() =>
                    waScrollRef.current?.scrollTo({ top: waScrollRef.current.scrollHeight })
                  }
                />
                <div className="text-[10px] text-muted-foreground mt-1">{formatTime(new Date())}</div>
              </div>
            </div>
            {waHistory.map((msg, i) => (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-lg rounded-tr-none px-3 py-2 text-sm bg-[#DCF8C6] text-gray-900 shadow-sm">
                  {msg.content}
                  <div className="text-[10px] text-gray-600 mt-1 text-right">
                    {formatTime(msg.timestamp)} ✓✓
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 border-t border-border bg-card flex items-center gap-2">
            <input
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendWhatsApp()}
              placeholder="WhatsApp মেসেজ লিখুন..."
              className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-muted border border-transparent text-foreground text-sm focus:outline-none focus:border-[#25D366] focus:bg-background transition-colors"
            />
            <button
              onClick={sendWhatsApp}
              disabled={!whatsappInput.trim()}
              className="shrink-0 p-2.5 rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5a] disabled:opacity-40 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded buttons */}
      {menuOpen && !chatOpen && !whatsappOpen && (
        <div className="flex flex-col gap-3 items-end animate-fade-in">
          {(() => {
            const fbLink = settings.socialLinks?.find((s) => s.name.toLowerCase().includes("facebook"));
            return fbLink ? (
              <a
                href={fbLink.link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-full bg-[#1877F2] text-white shadow-lg hover:scale-105 transition-transform"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            ) : null;
          })()}
          <button
            onClick={() => {
              setWhatsappOpen(true);
              setMenuOpen(false);
            }}
            className="p-3.5 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 transition-transform"
          >
            {WHATSAPP_ICON}
          </button>
          <button
            onClick={() => {
              setChatOpen(true);
              setMenuOpen(false);
            }}
            className="p-3.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => {
          if (chatOpen || whatsappOpen) closeAll();
          else setMenuOpen(!menuOpen);
        }}
        className="p-3.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
      >
        {chatOpen || whatsappOpen || menuOpen ? <HelpCircle className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
