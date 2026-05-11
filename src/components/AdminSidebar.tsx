import { Link, useLocation } from "react-router-dom";
import {
  X, LayoutDashboard, Users, GraduationCap, Video,
  Settings, LogOut, Download, Timer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { to: "/admin",          icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/users",    icon: Users,           label: "Users" },
  { to: "/admin/courses",  icon: GraduationCap,   label: "Courses" },
  { to: "/admin/videos",   icon: Video,           label: "Videos" },
  { to: "/admin/exams",    icon: Timer,           label: "Exams" },
  { to: "/admin/settings", icon: Settings,        label: "Settings" },
  { to: "/admin/data",     icon: Download,        label: "Backup" },
];

function NavLink({ to, icon: Icon, label, onClick, pathname }: {
  to: string; icon: any; label: string; onClick?: () => void; pathname: string;
}) {
  const isActive = to === "/admin" ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
        ${isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
      {label}
    </Link>
  );
}

function SidebarContent({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const handleClose = isMobile ? onClose : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Nav Items — scrollable area */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} {...item} onClick={handleClose} pathname={pathname} />
        ))}

        {/* Logout — placed with nav items */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 w-full transition-colors">
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Logout</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to logout?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await logout(); onClose(); }}>
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </nav>
    </div>
  );
}

export function AdminSidebar({ open, onClose }: Props) {
  const isMobile = useIsMobile();

  // Desktop: sticky sidebar, independent scroll
  if (!isMobile) {
    return (
      <div className="w-56 border-r border-border bg-background shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
        </div>
        <SidebarContent onClose={onClose} isMobile={false} />
      </div>
    );
  }

  // Mobile: overlay sidebar
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/20 z-50" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-16 w-64 bg-background z-50 border-r border-border flex flex-col animate-fade-in rounded-br-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <SidebarContent onClose={onClose} isMobile={true} />
        </div>
      </div>
    </>
  );
}
