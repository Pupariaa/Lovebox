export const colors = {
  rosePrimary: "#FF6B8A",
  roseSecondary: "#E85D75",
  roseDark: "#B84D62",
  wineAccent: "#8B3A4A",
  creamHighlight: "#FFF5F0",
  creamMuted: "#F5E6DC",
  plumBackground: "#1A0C12",
  surfaceDark: "#241018",
  surfaceCard: "#2E141C",
  textPrimary: "#FFF0F2",
  textMuted: "#C9A8B0",
  authGlow: "rgba(255, 107, 138, 0.16)",
  outline: "#5A3848",
  onPrimary: "#2A0A12",
  gradientTop: "#1A0812",
  gradientMid: "#1A0C12",
  gradientBottom: "#0D0208",
  success: "#5BD6A0",
  danger: "#FF7A7A",
  overlay: "rgba(10, 4, 8, 0.72)",
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  headlineLarge: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.5 },
  headlineMedium: { fontSize: 22, lineHeight: 28, fontWeight: "600" as const },
  titleMedium: { fontSize: 16, lineHeight: 22, fontWeight: "500" as const },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  labelLarge: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const, letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
} as const;

export type ThemeColors = typeof colors;
