import { Navbar } from "./_components/navbar";
import { AppSidebar } from "./_components/app-sidebar";

import { SidebarProvider } from "@/components/ui/sidebar";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider className="min-h-screen flex bg-[#f7f8f9]">
      <AppSidebar variant="floating" />
      <div className="w-full sm:flex-1 flex flex-col gap-3 p-2.5 sm:p-0 sm:m-2.5">
        <Navbar />
        {children}
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
