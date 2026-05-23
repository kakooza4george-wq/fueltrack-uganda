import Sidebar from "@/components/layout/Sidebar";
import SessionGuard from "@/components/providers/SessionGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-60 overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SessionGuard>
  );
}