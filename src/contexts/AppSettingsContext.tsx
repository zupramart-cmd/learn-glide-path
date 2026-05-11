import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppSettings } from "@/types";

const defaultSettings: AppSettings = {
  appName: "Darpan Academy",
  appLogo: "",
  youtubeChannel: "",
  googleDrive: "",
  paymentMethods: [],
  socialLinks: [],
  usefulLinks: [],
};

const SETTINGS_CACHE_KEY = "fsc_settings_app";
const SETTINGS_TTL = 30 * 60 * 1000; // 30 min

const AppSettingsContext = createContext<AppSettings>(defaultSettings);

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Load from localStorage immediately for instant render
    try {
      const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < SETTINGS_TTL) {
          return { ...defaultSettings, ...parsed.data } as AppSettings;
        }
      }
    } catch {}
    return defaultSettings;
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "app"));
        if (snap.exists()) {
          const data = { ...defaultSettings, ...snap.data() } as AppSettings;
          setSettings(data);
          localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ data: snap.data(), timestamp: Date.now() }));
        }
      } catch {}
    };
    
    // Check if cache is stale
    try {
      const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < SETTINGS_TTL) return; // Still fresh, skip fetch
      }
    } catch {}
    
    fetchSettings();
  }, []);

  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  );
}
