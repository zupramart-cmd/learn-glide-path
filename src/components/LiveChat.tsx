import { useEffect, useMemo, useRef, useState } from "react";
import {
  ref,
  push,
  onValue,
  off,
  remove,
  set,
  update,
  query,
  limitToLast,
  serverTimestamp,
  runTransaction,
} from "firebase/database";
import { liveChatDb } from "@/lib/liveChatFirebase";
import {
  Send,
  Pin,
  Trash2,
  Hand,
  Reply,
  Power,
  Megaphone,
  X,
  ChevronDown,
  Smile,
  ShieldOff,
  Shield,
} from "lucide-react";

const MAX_MESSAGES = 30;
const COOLDOWN_MS = 1500;
const REACTIONS = ["👍", "❤️", "🔥", "😂", "👏"];
const BAD_WORDS = ["fuck", "shit", "bitch", "asshole", "bastard", "madarchod", "chutiya", "behenchod"];

const NAME_KEY = (videoId: string) => `liveChatName_${videoId}`;

interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  role?: "admin" | "student";
  pinned?: boolean;
  replyTo?: { name: string; text: string };
  reactions?: Record<string, number>;
  raiseHand?: boolean;
  announcement?: boolean;
}

interface ChatMeta {
  chatOn?: boolean;
  pinnedId?: string;
  mutedNames?: Record<string, true>;
}

function cleanText(s: string) {
  let out = s;
  BAD_WORDS.forEach((w) => {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    out = out.replace(re, "*".repeat(w.length));
  });
  return out;
}

function formatTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveChat({
  videoId,
  isAdmin,
  onClose,
}: {
  videoId: string;
  isAdmin: boolean;
  onClose?: () => void;
}) {
  const [name, setName] = useState<string>(() => sessionStorage.getItem(NAME_KEY(videoId)) || "");
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<ChatMeta>({});
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [lastSent, setLastSent] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Subscribe
  useEffect(() => {
    if (!videoId) return;
    const msgsQ = query(ref(liveChatDb, `chats/${videoId}/messages`), limitToLast(MAX_MESSAGES));
    const metaRef = ref(liveChatDb, `chats/${videoId}/meta`);
    const unsubM = onValue(msgsQ, (snap) => {
      const arr: ChatMessage[] = [];
      snap.forEach((c) => {
        arr.push({ id: c.key as string, ...(c.val() as any) });
        return undefined as any;
      });
      arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      setMessages((prev) => {
        if (!stickRef.current && arr.length > prev.length) {
          setNewCount((n) => n + (arr.length - prev.length));
        }
        return arr;
      });
    });
    const unsubMeta = onValue(metaRef, (s) => setMeta((s.val() as any) || {}));
    return () => {
      off(msgsQ);
      off(metaRef);
      unsubM();
      unsubMeta();
    };
  }, [videoId]);

  // Auto-scroll & auto-prune
  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setNewCount(0);
    }
    // Prune older than last 30 (admin or anyone runs once)
    if (messages.length > MAX_MESSAGES) {
      const extras = messages.slice(0, messages.length - MAX_MESSAGES);
      extras.forEach((m) => remove(ref(liveChatDb, `chats/${videoId}/messages/${m.id}`)));
    }
  }, [messages, videoId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    stickRef.current = near;
    setShowScrollBtn(!near);
    if (near) setNewCount(0);
  };

  const scrollDown = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      stickRef.current = true;
      setNewCount(0);
      setShowScrollBtn(false);
    }
  };

  const isMuted = !!(name && meta.mutedNames && meta.mutedNames[name]);
  const chatOn = meta.chatOn !== false;

  const joinChat = () => {
    const v = nameInput.trim().slice(0, 30);
    if (v.length < 2) return;
    sessionStorage.setItem(NAME_KEY(videoId), v);
    setName(v);
  };

  const sendMessage = async (extra?: Partial<ChatMessage>) => {
    if (!name || !chatOn || isMuted) return;
    const now = Date.now();
    if (now - lastSent < COOLDOWN_MS) return;
    const body = cleanText(text.trim()).slice(0, 500);
    if (!body && !extra?.raiseHand) return;
    setLastSent(now);
    const payload: any = {
      name,
      text: body,
      ts: serverTimestamp(),
      role: isAdmin ? "admin" : "student",
      ...(replyTo ? { replyTo: { name: replyTo.name, text: replyTo.text.slice(0, 80) } } : {}),
      ...(extra || {}),
    };
    await push(ref(liveChatDb, `chats/${videoId}/messages`), payload);
    setText("");
    setReplyTo(null);
  };

  const sendAnnouncement = async () => {
    const body = text.trim().slice(0, 500);
    if (!body) return;
    const r = await push(ref(liveChatDb, `chats/${videoId}/messages`), {
      name,
      text: body,
      ts: serverTimestamp(),
      role: "admin",
      announcement: true,
      pinned: true,
    });
    await set(ref(liveChatDb, `chats/${videoId}/meta/pinnedId`), r.key);
    setText("");
  };

  const raiseHand = () => sendMessage({ raiseHand: true, text: "✋ Raised hand" });

  const reactTo = (msgId: string, emoji: string) => {
    const r = ref(liveChatDb, `chats/${videoId}/messages/${msgId}/reactions/${emoji}`);
    runTransaction(r, (cur) => (cur || 0) + 1);
  };

  // Admin actions
  const deleteMsg = (id: string) => remove(ref(liveChatDb, `chats/${videoId}/messages/${id}`));
  const pinMsg = async (m: ChatMessage) => {
    await update(ref(liveChatDb, `chats/${videoId}/messages/${m.id}`), { pinned: true });
    await set(ref(liveChatDb, `chats/${videoId}/meta/pinnedId`), m.id);
  };
  const unpinMsg = async (m: ChatMessage) => {
    await update(ref(liveChatDb, `chats/${videoId}/messages/${m.id}`), { pinned: false });
    await remove(ref(liveChatDb, `chats/${videoId}/meta/pinnedId`));
  };
  const toggleMute = (n: string) => {
    const r = ref(liveChatDb, `chats/${videoId}/meta/mutedNames/${n}`);
    if (meta.mutedNames?.[n]) remove(r);
    else set(r, true);
  };
  const toggleChat = () => set(ref(liveChatDb, `chats/${videoId}/meta/chatOn`), !chatOn);
  const clearAll = () => {
    if (confirm("Clear all chat messages?")) remove(ref(liveChatDb, `chats/${videoId}`));
  };

  const pinnedMessage = useMemo(
    () => messages.find((m) => m.id === meta.pinnedId && m.pinned),
    [messages, meta.pinnedId]
  );

  // ── Name gate ──
  if (!name) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mb-3">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Join Live Chat</h3>
        <p className="text-xs text-muted-foreground mb-4">Enter your name to join the conversation.</p>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && joinChat()}
          placeholder="Your name"
          maxLength={30}
          className="w-full max-w-xs px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground"
        />
        <button
          onClick={joinChat}
          disabled={nameInput.trim().length < 2}
          className="mt-3 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-40"
        >
          Join Chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-accent/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-sm font-semibold text-foreground truncate">Live Chat</span>
          <span className="text-[11px] text-muted-foreground truncate">· {name}</span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <button
                onClick={toggleChat}
                title={chatOn ? "Turn chat off" : "Turn chat on"}
                className={`p-1.5 rounded hover:bg-accent ${chatOn ? "text-foreground" : "text-destructive"}`}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clearAll}
                title="Clear all chat"
                className="p-1.5 rounded hover:bg-accent text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground lg:hidden">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned */}
      {pinnedMessage && (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-start gap-2">
          <Pin className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {pinnedMessage.announcement ? "Announcement" : "Pinned"} · {pinnedMessage.name}
            </p>
            <p className="text-xs text-foreground break-words">{pinnedMessage.text}</p>
          </div>
          {isAdmin && (
            <button onClick={() => unpinMsg(pinnedMessage)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 relative"
      >
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Be the first!</p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              me={name}
              isAdmin={isAdmin}
              muted={!!meta.mutedNames?.[m.name]}
              onReply={() => setReplyTo(m)}
              onReact={(e) => reactTo(m.id, e)}
              onDelete={() => deleteMsg(m.id)}
              onPin={() => (m.pinned ? unpinMsg(m) : pinMsg(m))}
              onToggleMute={() => toggleMute(m.name)}
            />
          ))
        )}
        {showScrollBtn && (
          <button
            onClick={scrollDown}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <ChevronDown className="h-3 w-3" />
            {newCount > 0 ? `${newCount} new` : "Latest"}
          </button>
        )}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 py-1.5 border-t border-border bg-accent/30 flex items-start gap-2">
          <Reply className="h-3 w-3 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground">Replying to @{replyTo.name}</p>
            <p className="text-xs text-foreground truncate">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Input */}
      {!chatOn ? (
        <div className="px-3 py-3 border-t border-border text-center text-xs text-muted-foreground">
          Chat is currently turned off by the admin.
        </div>
      ) : isMuted ? (
        <div className="px-3 py-3 border-t border-border text-center text-xs text-destructive">
          You have been muted by the admin.
        </div>
      ) : (
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={raiseHand}
              title="Raise hand"
              className="p-2 rounded-md hover:bg-accent text-amber-600"
            >
              <Hand className="h-4 w-4" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Type a message…"}
              maxLength={500}
              className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground"
            />
            {isAdmin && (
              <button
                onClick={sendAnnouncement}
                title="Send as announcement (pinned)"
                className="p-2 rounded-md hover:bg-accent text-amber-600"
              >
                <Megaphone className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={!text.trim()}
              className="p-2 rounded-md bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 px-1">
            Press Enter to send · Be respectful
          </p>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  m,
  me,
  isAdmin,
  muted,
  onReply,
  onReact,
  onDelete,
  onPin,
  onToggleMute,
}: {
  m: ChatMessage;
  me: string;
  isAdmin: boolean;
  muted: boolean;
  onReply: () => void;
  onReact: (e: string) => void;
  onDelete: () => void;
  onPin: () => void;
  onToggleMute: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const mine = m.name === me;
  const adminMsg = m.role === "admin";

  if (m.announcement) return null; // shown only in pinned slot

  if (m.raiseHand) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1">
        <Hand className="h-3 w-3 text-amber-600" />
        <span className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{m.name}</span> raised hand · {formatTime(m.ts)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`group flex flex-col px-2 py-1.5 rounded-md hover:bg-accent/40 ${
        mine ? "bg-primary/5" : ""
      } ${m.pinned ? "border-l-2 border-amber-500" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => setShowActions((v) => !v)}
    >
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className={`text-xs font-semibold ${adminMsg ? "text-red-600 dark:text-red-400" : "text-primary"}`}
        >
          {m.name}
          {adminMsg && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-500/15">ADMIN</span>}
        </span>
        <span className="text-[10px] text-muted-foreground">{formatTime(m.ts)}</span>
      </div>
      {m.replyTo && (
        <div className="mt-0.5 pl-2 border-l-2 border-border">
          <p className="text-[10px] text-muted-foreground">↪ @{m.replyTo.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{m.replyTo.text}</p>
        </div>
      )}
      <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">{m.text}</p>

      {/* Reactions */}
      {m.reactions && Object.keys(m.reactions).length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {Object.entries(m.reactions).map(([emo, count]) => (
            <button
              key={emo}
              onClick={(e) => {
                e.stopPropagation();
                onReact(emo);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent border border-border hover:bg-primary/10"
            >
              {emo} {count}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-0.5 mt-1 flex-wrap">
          {REACTIONS.map((emo) => (
            <button
              key={emo}
              onClick={(e) => {
                e.stopPropagation();
                onReact(emo);
              }}
              className="text-xs px-1.5 py-0.5 rounded hover:bg-primary/15"
            >
              {emo}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReply();
            }}
            className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground flex items-center gap-0.5"
          >
            <Reply className="h-3 w-3" /> Reply
          </button>
          {isAdmin && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPin();
                }}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent text-amber-600 flex items-center gap-0.5"
              >
                <Pin className="h-3 w-3" /> {m.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground flex items-center gap-0.5"
              >
                {muted ? <Shield className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-destructive/15 text-destructive flex items-center gap-0.5"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
