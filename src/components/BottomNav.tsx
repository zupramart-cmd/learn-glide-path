import { Link, useLocation } from "react-router-dom";
import { FolderOpen, Timer, User, LayoutGrid, Video, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const userTabs = [
  { to: "/courses", icon: GraduationCap, label: "Courses" },
  { to: "/content", icon: FolderOpen, label: "Content" },
  { to: "/exams", icon: Timer, label: "Exam" },
  { to: "/profile", icon: User, label: "Profile" },
];

const adminTabs = [
  { to: "/admin", icon: LayoutGrid, label: "Dashboard" },
  { to: "/admin/videos/add", icon: Video, label: "Video" },
  { to: "/admin/courses", icon: GraduationCap, label: "Course", addParam: true },
  { to: "/admin/exams/add", icon: Timer, label: "Exam" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { userDoc } = useAuth();
  const isAdmin = userDoc?.role === "admin";
  const tabs = isAdmin ? adminTabs : userTabs;

  const isTabActive = (to: string) => {
    const base = to.split("?")[0];
    if (base === "/courses") return pathname === "/courses" || pathname === "/";
    if (base === "/admin") return pathname === "/admin";
    return pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isTabActive(tab.to);
          const linkTo = (tab as any).addParam ? `${tab.to}?add=true` : tab.to;
          return (
            <Link
              key={tab.to}
              to={linkTo}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] transition-colors"
            >
              <span
                className={`flex items-center justify-center h-8 w-12 rounded-full transition-all duration-300 ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <tab.icon
                  className={`h-5 w-5 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </span>
              <span
                className={`transition-colors ${
                  active ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
