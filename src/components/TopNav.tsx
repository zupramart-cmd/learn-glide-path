import { Menu, Download } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  onMenuClick: () => void;
  hideMenu?: boolean;
}

export function TopNav({ onMenuClick, hideMenu }: Props) {
  const { dark, toggle } = useTheme();
  const isMobile = useIsMobile();
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) { installPrompt.prompt(); setInstallPrompt(null); }
  };

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {!hideMenu && (
            <button onClick={onMenuClick} className="text-foreground">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <img
            src={dark ? "/dark.png" : "/light.png"}
            alt="Darpan Academy"
            className="h-14 object-contain"
          />
        </div>
        <div className="flex items-center gap-1">
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Install
            </button>
          )}
          <button onClick={toggle} className="p-2 text-foreground rounded-md hover:bg-accent">
            {dark
              ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" /></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            }
          </button>
        </div>
      </div>
    </header>
  );
}
