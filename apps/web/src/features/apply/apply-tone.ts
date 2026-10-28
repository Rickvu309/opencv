/**
 * The pen's tertiary greys fail WCAG AA on every Apply surface. Text the pen
 * draws in them ships as the lightest grey that still meets 4.5:1 on its
 * surface, as verify-pen-layout requires.
 */
export const FAINT_TEXT = {
  card: "text-muted-foreground/84",
  background: "text-muted-foreground/86",
  secondary: "text-muted-foreground/88",
} as const
