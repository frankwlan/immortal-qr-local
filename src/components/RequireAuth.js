import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";

export default function RequireAuth({ children }) {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") signIn();
  }, [status]);
  if (status !== "authenticated") {
    return (
      <main className="page" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-faint)" }}>Loading…</p>
      </main>
    );
  }
  return children;
}
