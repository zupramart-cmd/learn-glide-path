import { useEffect } from "react";

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || (navigator as any).vendor || "";
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|WhatsApp|Snapchat|Line|Twitter|TikTok|MicroMessenger|KAKAOTALK|NAVER/i.test(
    ua,
  );
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function ExternalRedirect() {
  useEffect(() => {
    if (!isInAppBrowser()) return;

    // Avoid infinite loops if redirect already attempted this session
    const KEY = "__ext_redirect_attempted";
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");

    const url = window.location.href;

    if (isAndroid()) {
      // Chrome intent — opens external Chrome on Android
      const intentUrl = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.replace(intentUrl);
      return;
    }

    if (isIOS()) {
      // iOS: x-safari scheme opens Safari directly
      window.location.replace(`x-safari-${url}`);
      return;
    }

    // Generic fallback
    window.open(url, "_system");
  }, []);

  return null;
}
