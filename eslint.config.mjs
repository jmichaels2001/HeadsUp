import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier/flat"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // lib/game must stay pure: no React, Next, or SDK imports.
    files: ["lib/game/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "next",
            "next/*",
            "@supabase/*",
            "livekit-*",
            "@livekit/*",
            "@/components/*",
            "@/lib/mock/*",
            "@/lib/server",
            "@/lib/server/*",
          ],
        },
      ],
    },
  },
  {
    // Server-only code (secret keys, DB access) must never reach the browser.
    files: [
      "components/**/*.{ts,tsx}",
      "lib/room/**/*.{ts,tsx}",
      "lib/mock/**/*.{ts,tsx}",
      "lib/video/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/server", "@/lib/server/*"],
              message: "Server-only module.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
