import { SessionProvider } from "next-auth/react";
import "./globals.css"; // optional if you add styles

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}