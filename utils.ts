import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

interface ExamSecurityOptions {
  enabled: boolean;
  onSuspiciousActivity: () => void;
  onFullscreenExit: () => void;
  maxTabSwitches?: number;
  isUploadingWritten?: boolean;
  isWrittenExam?: boolean; // If true, skip all security
}

interface SecurityLog {
  type: string;
  timestamp: number;
  detail?: string;
}

export function useExamSecurity({ enabled, onSuspiciousActivity, onFullscreenExit, maxTabSwitches = 2, isUploadingWritten = false, isWrittenExam = false }: ExamSecurityOptions) {
  const tabSwitchCount = useRef(0);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const addLog = useCallback((type: string, detail?: string) => {
    setSecurityLogs(prev => [...prev, { type, timestamp: Date.now(), detail }]);
  }, []);

  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!enabled || isWrittenExam) return;

    // Tab switch / visibility detection
    const handleVisibilityChange = () => {
      if (document.hidden && !isUploadingWritten) {
        tabSwitchCount.current++;
        addLog("tab_switch", `Switch #${tabSwitchCount.current}`);
        toast.warning(`⚠️ ট্যাব সুইচ ডিটেক্ট হয়েছে! (${tabSwitchCount.current}/${maxTabSwitches})`, {
          description: tabSwitchCount.current >= maxTabSwitches
            ? "আপনার পরীক্ষা অটো-সাবমিট হচ্ছে!"
            : "পরীক্ষার ট্যাব থেকে বের হবেন না।",
        });
        if (tabSwitchCount.current >= maxTabSwitches) {
          onSuspiciousActivity();
        }
      }
    };

    // Window blur
    const handleBlur = () => {
      if (!isUploadingWritten) {
        addLog("window_blur");
      }
    };

    // Fullscreen change - show confirmation instead of auto-submit
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs && enabled && !isUploadingWritten) {
        addLog("fullscreen_exit");
        onFullscreenExit();
      }
    };

    // Copy/Paste disable
    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      addLog("copy_paste_attempt");
      toast.warning("⚠️ পরীক্ষা চলাকালীন কপি/পেস্ট নিষিদ্ধ!");
    };

    // Right click disable
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      addLog("right_click_attempt");
    };

    // Keyboard shortcuts disable
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        addLog("screenshot_attempt");
        toast.warning("⚠️ পরীক্ষা চলাকালীন স্ক্রিনশট নেওয়া যাবে না!");
      }
      if (e.ctrlKey && ["c", "v", "a", "s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        addLog("shortcut_blocked", e.key);
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))) {
        e.preventDefault();
        addLog("devtools_attempt");
      }
    };

    // Select disable
    const handleSelect = (e: Event) => {
      e.preventDefault();
    };

    // Block Escape key - trigger confirmation instead
    const handleKeydownEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        addLog("escape_blocked");
        onFullscreenExit(); // This will show the confirmation dialog
        return false;
      }
    };

    // Prevent beforeunload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "পরীক্ষা চলছে! বের হতে চাইলে এক্সাম সাবমিট করুন।";
      return e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("keydown", handleKeydownEscape, true);
    document.addEventListener("selectstart", handleSelect);
    window.addEventListener("beforeunload", handleBeforeUnload);

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("keydown", handleKeydownEscape, true);
      document.removeEventListener("selectstart", handleSelect);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, [enabled, maxTabSwitches, onSuspiciousActivity, onFullscreenExit, addLog, isUploadingWritten, isWrittenExam]);

  return {
    tabSwitchCount: tabSwitchCount.current,
    securityLogs,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
  };
}

// Get device fingerprint info
export function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchPoints: navigator.maxTouchPoints,
  };
}
