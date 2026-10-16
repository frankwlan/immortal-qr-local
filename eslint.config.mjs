import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// `next lint` was removed in Next.js 16, so linting runs through ESLint
// directly (`npm run lint`). Same base rule set as before: Next's
// core-web-vitals.
export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // New in eslint-plugin-react-hooks 7. It exists to prepare code for the
      // React Compiler, which this app doesn't use, and it flags ordinary
      // patterns we rely on on purpose (fetching on mount, filling a form from
      // the session, reading router.query once the router is ready). Turned
      // off rather than rewriting working auth/form code to satisfy it.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
