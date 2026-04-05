/**
 * The Quiet Editorial — Design Tokens
 * Matching the Stitch design system (DESIGN.md).
 * Used for inline styles where Tailwind isn't sufficient.
 */

export const C = {
  // Primary
  primary: '#006c52',
  primaryDim: '#005e48',
  primaryContainer: '#7ff8cf',
  onPrimary: '#dffff0',
  onPrimaryContainer: '#005d47',

  // Surface hierarchy
  surface: '#f9f9fa',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f4f5',
  surfaceContainer: '#ebeef0',
  surfaceContainerHigh: '#e4e9ec',
  surfaceContainerHighest: '#dde3e7',

  // Text
  text: '#2d3336',
  text2: '#596063',
  text3: '#757c7f',
  textFaint: '#acb3b6',

  // Semantic
  error: '#9f403d',
  errorContainer: '#fe8983',
  onError: '#fff7f6',

  // Accent (for charts, badges)
  secondary: '#5c5e6d',
  tertiary: '#556445',

  // Borders
  outline: '#757c7f',
  outlineVariant: '#acb3b6',
  ghostBorder: 'rgba(172, 179, 182, 0.2)',

  // Inverse
  inverseSurface: '#0c0e0f',
  inverseOnSurface: '#9c9d9e',

  // Shadows
  shadow: '0px 12px 32px rgba(45, 51, 54, 0.04)',
  shadowElevated: '0px 8px 24px rgba(45, 51, 54, 0.08)',
}

// Rating colors for spaced repetition
export const RATING = {
  1: { label: 'Again', color: C.error, bg: '#fef2f2' },
  2: { label: 'Hard', color: C.secondary, bg: '#f1f1f7' },
  3: { label: 'Good', color: C.primary, bg: '#ecfdf5' },
  4: { label: 'Easy', color: '#16a34a', bg: '#f0fdf4' },
}

// Source type icons
export const SOURCE_ICONS = {
  topic: 'edit_note',
  youtube: 'smart_display',
  pdf: 'picture_as_pdf',
  document: 'description',
  image: 'image',
  paste: 'content_paste',
}
