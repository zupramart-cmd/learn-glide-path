import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "@/lib/firebase";
import { getCachedDoc } from "@/lib/firestoreCache";
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

// Must match firestoreCache key format: fsc_doc_<collection>_<docId>
const SETTINGS_LS_KEY = "fsc_doc_settings_app";

const AppSettingsContext = createContext<AppSettings>(defaultSettings);

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Instant render from firestoreCache localStorage entry
    try {
      const raw = localStorage.getItem(SETTINGS_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) return { ...defaultSettings, ...parsed.data } as AppSettings;
      }
    } catch {}
    return defaultSettings;
  });

  useEffect(() => {
    let cancelled = false;
    getCachedDoc<AppSettings & { id: string }>(db, "settings", "app")
      .then((data) => {
        if (!cancelled && data) {
          setSettings({ ...defaultSettings, ...data });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  );
}
