import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { UserSidebar, DesktopUserSidebar } from "@/components/UserSidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userDoc } = useAuth();
  const isAdmin = userDoc?.role === "admin";
  const isMobile = useIsMobile();
  const { pathname } = useLocation();

  // Hide all navigation when taking an exam
  const isExamActive = /^\/exams\/[^/]+$/.test(pathname);

  // Show bottom nav ONLY on mobile (any role) — never on desktop
  const showBottomNav = isMobile && !isExamActive;

  // Show desktop sidebar for user on non-video pages
  const isVideoPage = pathname.startsWith("/video/");
  const showDesktopSidebar = !isMobile && !isAdmin && !isVideoPage && !isExamActive;

  // Hide hamburger when desktop sidebar is visible
  const hasVisibleSidebar = showDesktopSidebar || (!isMobile && isAdmin && !isExamActive);

  if (isExamActive) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav onMenuClick={() => setSidebarOpen(true)} hideMenu={hasVisibleSidebar} />
      
      {isAdmin ? (
        <>
          {isMobile && <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
          <div className="flex flex-1">
            {!isMobile && <AdminSidebar open={true} onClose={() => {}} />}
            <main className={`flex-1 overflow-x-hidden ${isMobile ? "pb-16" : ""}`}>
              <Outlet />
            </main>
          </div>
        </>
      ) : (
        <>
          <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex flex-1">
            {showDesktopSidebar && <DesktopUserSidebar />}
            <main className={`flex-1 overflow-x-hidden ${showBottomNav ? "pb-16" : ""}`}>
              <Outlet />
            </main>
          </div>
        </>
      )}

      {showBottomNav && <BottomNav />}
    </div>
  );
}
