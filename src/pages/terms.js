import Link from "next/link";

export default function Terms() {
  return (
    <main style={{ maxWidth: 700, margin: "3rem auto", fontFamily: "system-ui", lineHeight: 1.6 }}>
      <p><Link href="/">&larr; Back</Link></p>
      <h1>Terms of Service</h1>
      <p><em>Last updated: {new Date().toISOString().slice(0, 10)}</em></p>

      <p>
        These terms are a general starting point for ImmortalQR while it&apos;s
        an early, small-scale project. They are not a substitute for legal
        advice — review them with an attorney before relying on them for a
        larger user base.
      </p>

      <h2>1. What this service does</h2>
      <p>
        ImmortalQR lets you create QR codes that redirect to a destination
        URL you specify, and manage those links from a dashboard.
      </p>

      <h2>2. Your account</h2>
      <p>
        You&apos;re responsible for keeping your password secure and for
        activity that happens under your account. Let us know if you
        believe your account has been compromised.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use ImmortalQR to create QR codes that redirect to:</p>
      <ul>
        <li>Illegal content, or content that facilitates illegal activity</li>
        <li>Phishing, malware, or scam destinations</li>
        <li>Content that harasses, defames, or infringes on others&apos; rights</li>
      </ul>
      <p>We may disable links or accounts that violate this.</p>

      <h2>4. Availability</h2>
      <p>
        This is a small, early-stage service. We don&apos;t currently guarantee
        uptime, and links or data could in principle be lost. Don&apos;t rely on
        it for anything critical yet.
      </p>

      <h2>5. Changes</h2>
      <p>We may update these terms as the service evolves.</p>

      <h2>6. Contact</h2>
      <p>Questions about these terms? Reach out to the site owner directly.</p>
    </main>
  );
}
