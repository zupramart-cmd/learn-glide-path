import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

interface ExamSecurityOptions {
  enabled: boolean;
  onSuspiciousActivity: () => void;
  onFullscreenExit: () => void;
  maxTabSwitches?: number;
}

export function useExamSecurity({ enabled, onSuspiciousActivity, onFullscreenExit, maxTabSwitches = 2 }: ExamSecurityOptions) {
  const tabSwitchCount = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount.current++;
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

    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs && enabled) {
        onFullscreenExit();
      }
    };

    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      toast.warning("⚠️ পরীক্ষা চলাকালীন কপি/পেস্ট নিষিদ্ধ!");
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        toast.warning("⚠️ পরীক্ষা চলাকালীন স্ক্রিনশট নেওয়া যাবে না!");
      }
      if (e.ctrlKey && ["c", "v", "a", "s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))) {
        e.preventDefault();
      }
    };

    const handleSelect = (e: Event) => {
      e.preventDefault();
    };

    const handleKeydownEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onFullscreenExit();
        return false;
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "পরীক্ষা চলছে! বের হতে চাইলে এক্সাম সাবমিট করুন।";
      return e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
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
  }, [enabled, maxTabSwitches, onSuspiciousActivity, onFullscreenExit]);

  return {
    tabSwitchCount: tabSwitchCount.current,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
  };
}

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
