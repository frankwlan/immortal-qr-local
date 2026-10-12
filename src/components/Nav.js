import Link from "next/link";
import { signOut } from "next-auth/react";

export default function Nav({ userLabel }) {
  return (
    <header style={{ borderBottom: "1px solid var(--line)" }}>
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 24px",
        }}
      >
        <Link
          href="/dashboard"
          className="wordmark"
          style={{ fontSize: "1.25rem" }}
        >
          Immortal<span className="text-gradient">QR</span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {userLabel && <span style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>{userLabel}</span>}
          <Link href="/settings">Settings</Link>
          <button type="button" className="btn-text" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
