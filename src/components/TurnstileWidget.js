import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Renders a Cloudflare Turnstile challenge and reports its token upward.
// Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, matching
// the server, which skips verification when its secret isn't set.
//
// Uses explicit rendering (not the auto-scan) because this widget mounts
// and unmounts as the user toggles between sign in and register — an
// auto-scan only sees elements present when the script first loads.
export default function TurnstileWidget({ onToken, resetSignal }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !scriptReady || !containerRef.current || !window.turnstile) return;

    const id = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current(""),
    });
    widgetIdRef.current = id;

    return () => {
      if (window.turnstile) window.turnstile.remove(id);
      widgetIdRef.current = null;
    };
  }, [scriptReady]);

  // Tokens are single-use, so the parent bumps resetSignal after every
  // submit attempt to get a fresh challenge.
  useEffect(() => {
    if (!resetSignal || widgetIdRef.current === null || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    onTokenRef.current("");
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} style={{ margin: "4px 0 12px" }} />
    </>
  );
}
