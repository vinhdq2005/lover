import type { ReactNode } from "react";
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-12"
    >
      {children}
    </main>
  );
}
