import { useSession } from "next-auth/react";
import Link from "next/link";
import QrGridArt from "../components/QrGridArt";

const FEATURES = [
  {
    title: "Redirect anytime",
    body: "Change where a code points whenever you need to. The code printed in the world never has to change.",
  },
  {
    title: "See who's scanning",
    body: "Every scan is timestamped, so you know a code is working before you find out the hard way.",
  },
  {
    title: "One dashboard, every code",
    body: "Create, edit, and retire QR codes from one place, instead of a shared spreadsheet nobody trusts.",
  },
];

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="page">
      <header className="site-header">
        <div className="container site-header-inner">
          <span className="wordmark">ImmortalQR</span>
          {session ? (
            <Link href="/dashboard" className="btn btn-outline">
              Go to dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn-text">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>Print once. Redirect forever.</h1>
            <p style={{ fontSize: "1.1rem" }}>
              ImmortalQR gives you a QR code whose destination you control.
              Change where it points anytime — without reprinting a single
              poster, label, or business card.
            </p>
            <div className="hero-actions">
              {session ? (
                <Link href="/dashboard" className="btn btn-primary">
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login?mode=register" className="btn btn-primary">
                    Get started
                  </Link>
                  <Link href="/login" className="btn btn-outline">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <QrGridArt size={300} />
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>Why ImmortalQR</h2>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <span>&copy; {new Date().getFullYear()} ImmortalQR</span>
          <div className="site-footer-links">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
