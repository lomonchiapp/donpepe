import type { Metadata } from "next";

import { LockscreenLogin } from "./lockscreen-login";
import { listarUsuariosLockscreen } from "./actions";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const users = await listarUsuariosLockscreen();
  return <LockscreenLogin users={users} next={next} />;
}
