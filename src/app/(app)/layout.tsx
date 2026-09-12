import { AppShell } from "@/components/AppShell";

/** Route group layout: software screens live inside the app shell. */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
