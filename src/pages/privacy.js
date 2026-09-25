import Link from "next/link";

export default function Privacy() {
  return (
    <main style={{ maxWidth: 700, margin: "3rem auto", fontFamily: "system-ui", lineHeight: 1.6 }}>
      <p><Link href="/">&larr; Back</Link></p>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: {new Date().toISOString().slice(0, 10)}</em></p>

      <p>
        This is a general starting template for ImmortalQR while it&apos;s an
        early, small-scale project. It&apos;s not a substitute for legal advice
        — review it with an attorney before relying on it for a larger user
        base, and update it if data handling changes (e.g. adding
        analytics or a new email provider).
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>Account info: name, email address, and a hashed password (we never store your password itself)</li>
        <li>QR link data: the destination URLs you create and their generated slugs</li>
        <li>Basic server logs (e.g. IP address) used for rate-limiting and abuse prevention</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        To operate your account, let you create and manage QR links, and
        send you account-related email (like password resets). We don&apos;t
        sell your data or share it with advertisers.
      </p>

      <h2>3. Third-party services</h2>
      <p>
        We use a database host to store account and link data, and an
        email provider (Resend) to send password reset emails. These
        providers process data on our behalf and have their own privacy
        practices.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We retain account and link data for as long as your account is
        active. You can ask us to delete your account and associated data
        at any time.
      </p>

      <h2>5. Changes</h2>
      <p>We may update this policy as the service evolves.</p>

      <h2>6. Contact</h2>
      <p>Questions about this policy? Reach out to the site owner directly.</p>
    </main>
  );
}
