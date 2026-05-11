import { Link, useLocation } from "react-router-dom";
import { GraduationCap, User, MessageCircle, Share2, Download, Sun, Moon, ExternalLink, FolderOpen, Timer, Calendar, Globe, Heart, Lock } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { where } from "firebase/firestore";
import { getCachedDoc, getCachedCollection } from "@/lib/firestoreCache";
import { db } from "@/lib/firebase";
import { Course } from "@/types";

export function DesktopUserSidebar() {
  const settings = useAppSettings();
  const { user, userDoc } = useAuth();
  const { dark, toggle } = useTheme();
  const { pathname } = useLocation();
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [isActiveApproved, setIsActiveApproved] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  /* beforeinstallprompt — Install App দেখানোর জন্য */
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (userDoc?.activeCourseId) {
      getCachedDoc<Course>(db, "courses", userDoc.activeCourseId).then((c) => {
        if (c) setActiveCourse(c);
      });
      if (user) {
        getCachedCollection<any>(
          db,
          "enrollRequests",
          [
            where("userId", "==", user.uid),
            where("courseId", "==", userDoc.activeCourseId),
            where("status", "==", "approved"),
          ],
          `approved_${user.uid}_${userDoc.activeCourseId}`
        ).then((requests) => {
          setIsActiveApproved(requests.length > 0);
        });
      }
    }
  }, [userDoc?.activeCourseId, user]);

  const isActive = (path: string) => pathname === path;

  const handleInstall = async () => {
    if (installPrompt) { installPrompt.prompt(); setInstallPrompt(null); }
  };

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 border-r border-border bg-card overflow-y-auto shrink-0 h-[calc(100vh-3.5rem)] sticky top-14">
      <nav className="p-2 flex flex-col gap-0.5">

        {/* Main Menu — Exams সবসময় দেখাবে */}
        <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Menu</p>
        <SidebarLink to="/home"      icon={GraduationCap} label="Courses"   active={isActive("/home") || isActive("/")} />
        <SidebarLink to="/content"   icon={FolderOpen}    label="Content"   active={isActive("/content")} />
        <SidebarLink to="/exams"     icon={Timer}         label="Exams"     active={isActive("/exams")} />
        <SidebarLink to="/profile"   icon={User}          label="Profile"   active={isActive("/profile")} />

        {/* Course Resources */}
        {activeCourse && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Course Resources</p>

            {isActiveApproved ? (
              <>
                {activeCourse.allMaterialsLink && (
                  <a href={activeCourse.allMaterialsLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    All Materials
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                  </a>
                )}

                {activeCourse.routinePDF && (
                  <a href={activeCourse.routinePDF} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors">
                    <Calendar className="h-4 w-4 text-primary" />
                    Routine
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                  </a>
                )}

                {activeCourse.discussionGroups?.filter(g => g.name && g.link).length > 0 && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Discussion Groups</p>
                    {activeCourse.discussionGroups.filter(g => g.name && g.link).map((g, i) => (
                      <a key={i} href={g.link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        {g.name}
                        <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                      </a>
                    ))}
                  </>
                )}
              </>
            ) : (
              /* Approved না হলে lock message */
              <div className="px-3 py-3 rounded-lg text-xs text-muted-foreground flex items-center gap-2 bg-accent/50">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Resources available after approval
              </div>
            )}
          </>
        )}

        {/* Useful Links */}
        {settings.usefulLinks?.length > 0 && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Useful Links</p>
            {settings.usefulLinks.map((link, i) => (
              <a key={i} href={link.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {link.name}
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </a>
            ))}
          </>
        )}

        {/* Social Links */}
        {settings.socialLinks?.length > 0 && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Follow Us</p>
            {settings.socialLinks.map((sl, i) => (
              <a key={i} href={sl.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors">
                <Heart className="h-4 w-4 text-muted-foreground" />
                {sl.name}
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </a>
            ))}
          </>
        )}

        {/* Settings */}
        <div className="my-2 border-t border-border" />

        <button onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors w-full">
          {dark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        <button onClick={() => navigator.share?.({ title: settings.appName, url: window.location.origin })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors w-full">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          Share App
        </button>

        {/* Install App — beforeinstallprompt থাকলেই দেখাবে */}
        {installPrompt && (
          <button onClick={handleInstall}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors w-full">
            <Download className="h-4 w-4 text-muted-foreground" />
            Install App
          </button>
        )}

      </nav>
    </aside>
  );
}

function SidebarLink({
  to, icon: Icon, label, active, highlight,
}: {
  to: string; icon: any; label: string; active: boolean; highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${active
          ? "bg-primary text-primary-foreground font-medium"
          : highlight
            ? "bg-primary/5 border border-primary/15 text-foreground hover:bg-accent/80"
            : "text-foreground hover:bg-accent/80"
        }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-primary-foreground" : highlight ? "text-primary" : "text-muted-foreground"}`} />
      {label}
    </Link>
  );
}
