import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function Home() {
  const { data: session } = useSession();
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mode, setMode] = useState("login"); // 'login' | 'register'

  const onSubmit = async (e) => {
    e.preventDefault();
    if (mode === "login") {
      await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard", redirect: true });
    } else {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard" });
      } else {
        alert("Registration failed");
      }
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "3rem auto", fontFamily: "system-ui" }}>
      <h1>ImmortalQR</h1>
      {session ? (
        <>
          <p>Signed in as {session.user?.email}</p>
          <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          {mode === "register" && (
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ display: "block", width: "100%", marginBottom: 8 }}
            />
          )}
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10 }}>{mode === "login" ? "Sign in" : "Register"}</button>
          <div style={{ marginTop: 12 }}>
            <a onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ cursor: "pointer" }}>
              {mode === "login" ? "Create account" : "Have an account? Sign in"}
            </a>
          </div>
          <hr style={{ margin: "16px 0" }} />
          <button type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} style={{ width: "100%", padding: 10 }}>Sign in with Google</button>
          <button type="button" onClick={() => signIn("github", { callbackUrl: "/dashboard" })} style={{ width: "100%", padding: 10, marginTop: 8 }}>Sign in with GitHub</button>
        </form>
      )}
    </main>
  );
}