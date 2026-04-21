import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl wine-gradient shadow-xl ring-1 ring-primary/20">
            <span className="text-5xl font-serif font-bold text-accent">P</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Don Pepe</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compraventa, empeños y oro
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
