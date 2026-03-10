import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, User, FileText, MessageCircle, Link as LinkIcon, Share2, Sun, Moon, ExternalLink, FolderOpen, ClipboardList } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course } from "@/types";

export function DesktopUserSidebar() {
  const settings = useAppSettings();
  const { userDoc } = useAuth();
  const { dark, toggle } = useTheme();
  const { pathname } = useLocation();
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);

  useEffect(() => {
    if (userDoc?.activeCourseId) {
      getDoc(doc(db, "courses", userDoc.activeCourseId)).then((snap) => {
        if (snap.exists()) setActiveCourse({ id: snap.id, ...snap.data() } as Course);
      });
    }
  }, [userDoc?.activeCourseId]);

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 border-r border-border bg-card overflow-y-auto shrink-0 h-[calc(100vh-3.5rem)] sticky top-14">
      <nav className="p-2 flex flex-col gap-0.5">
        <SidebarLink to="/home" icon={Home} label="Home" active={isActive("/home") || isActive("/")} />
        <SidebarLink to="/my-courses" icon={BookOpen} label="My Courses" active={isActive("/my-courses")} />
        <SidebarLink to="/exams" icon={ClipboardList} label="Exams" active={isActive("/exams")} />
        <SidebarLink to="/profile" icon={User} label="Profile" active={isActive("/profile")} />

        {/* All Materials - shows course subjects + allMaterialsLink PDF */}
        {activeCourse && userDoc?.status === "approved" && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase">Course</p>


            {activeCourse.allMaterialsLink && (
              <a href={activeCourse.allMaterialsLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent">
                <FileText className="h-4 w-4 text-muted-foreground" />
                All Materials PDF
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </a>
            )}

            {activeCourse.routinePDF && (
              <a href={activeCourse.routinePDF} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Routine PDF
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </a>
            )}

            {activeCourse.discussionGroups?.filter(g => g.name && g.link).length > 0 && (
              <>
                <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase mt-2">Discussion Groups</p>
                {activeCourse.discussionGroups.filter(g => g.name && g.link).map((g, i) => (
                  <a key={i} href={g.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {g.name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                  </a>
                ))}
              </>
            )}
          </>
        )}

        {settings.usefulLinks?.length > 0 && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase">Useful Links</p>
            {settings.usefulLinks.map((link, i) => (
              <a key={i} href={link.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                {link.name}
              </a>
            ))}
          </>
        )}

        {settings.socialLinks?.length > 0 && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase">Follow Us</p>
            {settings.socialLinks.map((sl, i) => (
              <a key={i} href={sl.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                {sl.name}
              </a>
            ))}
          </>
        )}

        <div className="my-2 border-t border-border" />

        <button onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent w-full">
          {dark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        <button onClick={() => navigator.share?.({ title: settings.appName, url: window.location.origin })}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent w-full">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          Share App
        </button>
      </nav>
    </aside>
  );
}

function SidebarLink({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${active ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-accent"}`}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
