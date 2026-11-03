import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

import { DEAD_AND_UNOWNED } from "../../packages/ui/lint-rules.js"

const paperPrototypePortResetDebounceAndDropdownMountExemptions = {
  name: "paper prototype port: reset, debounce and dropdown mount flags set state in effects",
  files: ["src/features/paper/**/*.{ts,tsx}"],
  rules: {
    "react-hooks/set-state-in-effect": "off",
    "react-refresh/only-export-components": "off",
  },
}

const HOVER_OVERLAY = [
  "JSXAttribute[name.name=/^(onMouseEnter|onMouseOver|onPointerEnter|onPointerOver)$/]",
].map((selector) => ({
  selector,
  message:
    "Hover must not open or close anything straight from onMouseEnter/onPointerEnter. Use the kit Popover or Tooltip (openOnHover, delay, closeDelay) or useHoverIntent from @/lib/use-hover-intent.ts, which add hover intent, a close grace and Escape.",
}))

const DYNAMIC_INERT = ["JSXAttribute[name.name='inert'][value]"].map(
  (selector) => ({
    selector,
    message:
      "A region that hides while it holds focus drops focus to the page body. Render it with FocusSafeRegion from @/components/focus-safe-region.tsx and pass focusFallback instead of inert={...}.",
  })
)

const GLOBAL_SHORTCUT = [
  "CallExpression[callee.property.name='addEventListener'][callee.object.name=/^(window|document|globalThis)$/][arguments.0.value=/^key(down|up|press)$/]",
  "CallExpression[callee.property.name='addEventListener'][callee.object.name=/^(window|document|globalThis)$/][arguments.0.type='TemplateLiteral'][arguments.0.quasis.0.value.raw=/^key(down|up|press)$/]",
].map((selector) => ({
  selector,
  message:
    "A key listener on window or document fires while the user types, composes text or drags. Use useShortcut from @/lib/use-shortcut.ts, which ignores fields, input method composition, held keys and an active pointer gesture.",
}))

const SCOPED_WRITES = [
  "CallExpression[callee.property.name='setProperty'][callee.object.property.name='style'][callee.object.object.property.name='documentElement']",
  "CallExpression[callee.property.name='setProperty'][callee.object.property.name='style'][arguments.0.type='Literal'][arguments.0.value=/^--/]",
  "CallExpression[callee.property.name='setProperty'][callee.object.property.name='style'][arguments.0.type='TemplateLiteral'][arguments.0.quasis.0.value.raw=/^--/]",
].map((selector) => ({
  selector,
  message:
    "Writing a CSS custom property from code makes the browser restyle every element that inherits it, and on document.documentElement that is the whole page. Set a plain property such as style.width or style.transform on the element that moves.",
}))

const TYPED_LIMITS = [
  "JSXAttribute[name.name='maxLength'][value.type='JSXExpressionContainer'][value.expression.type='Literal']",
  "JSXAttribute[name.name='maxLength'][value.type='Literal']",
  "BinaryExpression[operator=/^>=?$/][left.property.name='length'][right.type='Literal'][right.value>=10]",
].map((selector) => ({
  selector,
  message:
    "A form length limit typed as a number drifts from the contract. Import the limit from @workspace/domain and use it here and on the server.",
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
  paperPrototypePortResetDebounceAndDropdownMountExemptions,
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
    ignores: ["**/*.test.{ts,tsx}", "src/lib/use-shortcut.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...HOVER_OVERLAY,
        ...DYNAMIC_INERT,
        ...SCOPED_WRITES,
        ...GLOBAL_SHORTCUT,
        ...DEAD_AND_UNOWNED,
      ],
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...HOVER_OVERLAY,
        ...DYNAMIC_INERT,
        ...SCOPED_WRITES,
        ...GLOBAL_SHORTCUT,
        ...DEAD_AND_UNOWNED,
        ...TYPED_LIMITS,
      ],
    },
  },
  {
    files: [
      "src/features/paper/paper-slash-menu.tsx",
      "src/features/command-palette/command-palette.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...DYNAMIC_INERT,
        ...SCOPED_WRITES,
        ...GLOBAL_SHORTCUT,
        ...DEAD_AND_UNOWNED,
        ...TYPED_LIMITS,
      ],
    },
  },
  {
    files: ["src/features/app-shell/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...HOVER_OVERLAY,
        ...DYNAMIC_INERT,
        ...SCOPED_WRITES,
        ...GLOBAL_SHORTCUT,
        ...DEAD_AND_UNOWNED,
        ...TYPED_LIMITS,
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
