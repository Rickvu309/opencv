import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

const HOVER_OVERLAY = [
  "JSXAttribute[name.name=/^(onMouseEnter|onMouseOver|onPointerEnter|onPointerOver)$/]",
].map((selector) => ({
  selector,
  message:
    "Hover must not open or close anything straight from onMouseEnter/onPointerEnter. Use the kit Popover or Tooltip (openOnHover, delay, closeDelay) or useHoverIntent from @/lib/use-hover-intent.ts, which add hover intent, a close grace and Escape.",
}))

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/features/paper/**/*.{ts,tsx}"],
    rules: {
      // Prototype-port reset, debounce, and dropdown mount flags.
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      "src/features/paper/**/*.{ts,tsx}",
      "src/features/apply/**/*.{ts,tsx}",
      "src/features/pitch/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/router", "**/router.*"],
              message: "A surface feature must not import the router.",
            },
            {
              group: ["**/app-shell/*", "!**/app-shell/profile-display.ts"],
              message: "A surface feature must not import shell chrome.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...HOVER_OVERLAY],
    },
  },
  {
    files: [
      "src/features/paper/paper-slash-menu.tsx",
      "src/features/command-palette/command-palette.tsx",
      "src/components/layer-stack.tsx",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["src/features/app-shell/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...HOVER_OVERLAY,
        ...[
          "Literal[value=/(?:^|[\\s:])(?:hover:bg-transparent|focus-visible:ring-0|focus-visible:outline-none|focus-visible:shadow-none|focus:ring-0)(?:\\s|$)/]",
          "TemplateElement[value.raw=/(?:^|[\\s:])(?:hover:bg-transparent|focus-visible:ring-0|focus-visible:outline-none|focus-visible:shadow-none|focus:ring-0)(?:\\s|$)/]",
        ].map((selector) => ({
          selector,
          message:
            "A nav control must keep its hover and focus-visible style. Remove hover:bg-transparent and focus-visible:ring-0 here, or use FOCUS_RING from @workspace/ui/lib/focus-ring and hover:bg-sidebar-accent.",
        })),
      ],
    },
  },
])
