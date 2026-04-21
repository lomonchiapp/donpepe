import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Fab } from "@/components/layout/fab";
import { PagoRapido } from "@/components/cmd/pago-rapido";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar />
      <div className="flex min-h-dvh w-full flex-col md:pl-64">
        <TopBar />
        <main className="flex-1 pb-24 md:pb-8">{children}</main>
        <BottomNav />
        <Fab />
        <PagoRapido />
      </div>
    </div>
  );
}
