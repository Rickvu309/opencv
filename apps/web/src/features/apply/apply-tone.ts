/**
 * The pen's tertiary greys fail WCAG AA on every Apply surface. Text the pen
 * draws in them ships as the lightest grey that still meets 4.5:1 on its
 * surface, as verify-pen-layout requires.
 */
export const FAINT_TEXT = {
  card: "text-[color-mix(in_srgb,var(--muted-foreground)_84%,var(--card))]",
  background:
    "text-[color-mix(in_srgb,var(--muted-foreground)_86%,var(--background))]",
  secondary:
    "text-[color-mix(in_srgb,var(--muted-foreground)_88%,var(--secondary))]",
} as const
