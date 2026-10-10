import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";

export default function RequireAuth({ children }) {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") signIn();
  }, [status]);
  if (status !== "authenticated") return <p style={{ padding: 24 }}>Loading…</p>;
  return children;
}