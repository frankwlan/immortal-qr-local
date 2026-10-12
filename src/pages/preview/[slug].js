import Head from "next/head";
import Link from "next/link";
import { getPreview } from "../../lib/preview";
import { getClientIp } from "../../lib/rateLimit";

export async function getServerSideProps({ params, req, res }) {
  res.setHeader("Cache-Control", "no-store");
  const result = await getPreview(params.slug, getClientIp(req));
  if (result.status === "not_found") return { notFound: true };
  if (result.status === "limited") {
    res.statusCode = 429;
    return { props: { limited: true, link: null } };
  }
  return { props: { limited: false, link: result.link } };
}

export default function Preview({ link, limited }) {
  return (
    <main className="page" style={{ justifyContent: "center" }}>
      <Head>
        <title>Link preview — ImmortalQR</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="container" style={{ maxWidth: 560 }}>
        {limited ? (
          <p>Too many requests. Please try again in a minute.</p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Where does this code go?</h1>
            <p>
              This ImmortalQR code points to <strong>{link.host}</strong>. Check that you
              recognise it before continuing.
            </p>
            <p
              style={{ wordBreak: "break-all", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
            >
              <code>{link.destination}</code>
            </p>

            {link.disabled ? (
              <p style={{ color: "var(--danger)" }}>
                This link has been disabled for violating our Terms of Service.
              </p>
            ) : (
              <p>
                <a className="btn btn-primary" href={`/r/${link.slug}`}>Continue to {link.host}</a>
              </p>
            )}

            <p style={{ marginTop: 24, fontSize: "0.9rem" }}>
              Looks suspicious? <Link href={`/report?code=${link.slug}`}>Report this link</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
