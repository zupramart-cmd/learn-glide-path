import { Link, useLocation } from "react-router-dom";
import { X, GraduationCap, User, Share2, Download, Sun, Moon, ExternalLink, Timer, Lock, Globe, Heart, FolderOpen, Calendar, MessageCircle } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { where } from "firebase/firestore";
import { getCachedDoc, getCachedCollection } from "@/lib/firestoreCache";
import { db } from "@/lib/firebase";
import { Course } from "@/types";

// ─── Shared data hook ──────────────────────────────────────────────────────
function useSidebarData() {
  const { user, userDoc } = useAuth();
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [isActiveApproved, setIsActiveApproved] = useState(false);
  const [isActiveCourseExpired, setIsActiveCourseExpired] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (userDoc?.activeCourseId) {
      getCachedDoc<Course>(db, "courses", userDoc.activeCourseId).then((c) => {
        if (c) {
          setActiveCourse(c);
          setIsActiveCourseExpired((c as any).isActive === false);
        }
      });
      if (user) {
        getCachedCollection<any>(
          db,
          "enrollRequests",
          [
            where("userId", "==", user.uid),
            where("courseId", "==", userDoc.activeCourseId),
          ],
          `enrollreq_${user.uid}_${userDoc.activeCourseId}`
        ).then((requests) => {
          const req = requests[0];
          setIsActiveApproved(req?.status === "approved");
        });
      }
    }
  }, [userDoc?.activeCourseId, user]);

  return { activeCourse, isActiveApproved, isActiveCourseExpired, installPrompt, setInstallPrompt };
}

// ─── Sidebar Content (shared between mobile drawer and desktop sidebar) ───
function SidebarContent({ onItemClick, compact = false }: { onItemClick?: () => void; compact?: boolean }) {
  const settings = useAppSettings();
  const { dark, toggle } = useTheme();
  const { pathname } = useLocation();
  const { activeCourse, isActiveApproved, isActiveCourseExpired, installPrompt, setInstallPrompt } = useSidebarData();

  const isActive = (path: string) => pathname === path || (path === "/courses" && pathname === "/");

  const handleClick = () => onItemClick?.();

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: settings.appName, url: window.location.origin });
    }
    onItemClick?.();
  };

  const handleInstall = async () => {
    if (installPrompt) { installPrompt.prompt(); setInstallPrompt(null); }
    onItemClick?.();
  };

  const py = compact ? "py-2" : "py-2.5";

  return (
    <>
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Menu</p>
      <SidebarLink to="/courses"  icon={GraduationCap} label="Courses" onClick={handleClick} active={isActive("/courses")} py={py} />
      <SidebarLink to="/content"  icon={FolderOpen}    label="Content" onClick={handleClick} active={isActive("/content")} py={py} />
      <SidebarLink to="/exams"    icon={Timer}         label="Exams"   onClick={handleClick} active={isActive("/exams")} py={py} />
      <SidebarLink to="/profile"  icon={User}          label="Profile" onClick={handleClick} active={isActive("/profile")} py={py} />

      {activeCourse && (
        <>
          <div className="my-3 border-t border-border" />
          <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Course Resources</p>

          {isActiveCourseExpired ? (
            <div className="px-3 py-3 rounded-lg text-xs text-destructive/80 flex items-center gap-2 bg-destructive/5 border border-destructive/15 my-0.5">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Course expired
            </div>
          ) : isActiveApproved ? (
            <>
              {activeCourse.allMaterialsLink && (
                <a href={activeCourse.allMaterialsLink} target="_blank" rel="noopener noreferrer" onClick={handleClick}
                  className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors my-0.5`}>
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="flex-1">All Materials</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              )}

              {activeCourse.routinePDF && (
                <a href={activeCourse.routinePDF} target="_blank" rel="noopener noreferrer" onClick={handleClick}
                  className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors my-0.5`}>
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="flex-1">Routine</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              )}

              {activeCourse.discussionGroups?.filter(g => g.name && g.link).length > 0 && (
                <>
                  <div className="my-3 border-t border-border" />
                  <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Discussion Groups</p>
                  {activeCourse.discussionGroups.filter(g => g.name && g.link).map((g, i) => (
                    <a key={i} href={g.link} target="_blank" rel="noopener noreferrer" onClick={handleClick}
                      className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors my-0.5`}>
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <span className="flex-1">{g.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="px-3 py-3 rounded-lg text-xs text-muted-foreground flex items-center gap-2 bg-accent/50 my-0.5">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Resources available after approval
            </div>
          )}
        </>
      )}

      {settings.usefulLinks?.length > 0 && (
        <>
          <div className="my-3 border-t border-border" />
          <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Useful Links</p>
          {settings.usefulLinks.map((link, i) => (
            <a key={i} href={link.link} target="_blank" rel="noopener noreferrer" onClick={handleClick}
              className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors my-0.5`}>
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{link.name}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          ))}
        </>
      )}

      {settings.socialLinks?.length > 0 && (
        <>
          <div className="my-3 border-t border-border" />
          <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Follow Us</p>
          {settings.socialLinks.map((sl, i) => (
            <a key={i} href={sl.link} target="_blank" rel="noopener noreferrer" onClick={handleClick}
              className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors my-0.5`}>
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{sl.name}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          ))}
        </>
      )}

      <div className="my-3 border-t border-border" />
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Settings</p>

      <button onClick={toggle}
        className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors w-full my-0.5`}>
        {dark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
        {dark ? "Light Mode" : "Dark Mode"}
      </button>

      <button onClick={handleShare}
        className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors w-full my-0.5`}>
        <Share2 className="h-4 w-4 text-muted-foreground" />
        Share App
      </button>

      {installPrompt && (
        <button onClick={handleInstall}
          className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors w-full my-0.5`}>
          <Download className="h-4 w-4 text-muted-foreground" />
          Install App
        </button>
      )}

      <div className="my-3 border-t border-border" />
      <a href="/developer.html" target="_blank" rel="noopener noreferrer" onClick={handleClick}
        className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm text-muted-foreground hover:bg-accent/80 transition-colors w-full my-0.5`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
        Md Ridoan Mahmud Zisan
      </a>
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Mobile Drawer ─────────────────────────────────────────────────────────
export function UserSidebar({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-foreground/20 z-50" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-0 w-72 bg-background z-50 border-r border-border flex flex-col animate-fade-in">
        <div className="flex items-center justify-end p-3 border-b border-border shrink-0">
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <nav className="p-2 flex-1 overflow-y-auto pb-20">
          <SidebarContent onItemClick={onClose} />
        </nav>
      </div>
    </>
  );
}

// ─── Desktop Sidebar ───────────────────────────────────────────────────────
export function DesktopUserSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 border-r border-border bg-card overflow-y-auto shrink-0 h-[calc(100vh-3.5rem)] sticky top-14">
      <nav className="p-2 flex flex-col gap-0.5">
        <SidebarContent compact />
      </nav>
    </aside>
  );
}

// ─── Shared link button ────────────────────────────────────────────────────
function SidebarLink({
  to, icon: Icon, label, onClick, active, py = "py-2.5",
}: {
  to: string; icon: any; label: string; onClick?: () => void; active?: boolean; py?: string;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 ${py} rounded-lg text-sm transition-colors my-0.5
        ${active
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground hover:bg-accent/80"
        }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
      {label}
    </Link>
  );
}
