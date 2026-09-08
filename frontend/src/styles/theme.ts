export const theme = {
  colors: {
    primary: {
      50: '#e0f7ff',
      100: '#b3ecff',
      200: '#80e0ff',
      300: '#4dd4ff',
      400: '#26caff',
      500: '#00d4ff',
      600: '#00b8e6',
      700: '#0099cc',
      800: '#007a99',
      900: '#005c73',
    },
    secondary: {
      50: '#e6f0ff',
      100: '#b3d4ff',
      200: '#80b8ff',
      300: '#4d9cff',
      400: '#2680ff',
      500: '#0088ff',
      600: '#0066cc',
      700: '#004d99',
      800: '#003366',
      900: '#001a33',
    },
    accent: {
      blue: '#00d4ff',
      cyan: '#00f0ff',
      indigo: '#4f46e5',
      purple: '#7c3aed',
      green: '#10b981',
      orange: '#f59e0b',
      red: '#ef4444',
    },
    surface: {
      dark: '#0a0e1a',
      darker: '#060810',
      base: '#111827',
      light: '#1f2937',
      lighter: '#374151',
      border: 'rgba(0, 212, 255, 0.15)',
      hover: 'rgba(0, 212, 255, 0.08)',
    },
    text: {
      primary: '#f3f4f6',
      secondary: '#9ca3af',
      muted: '#6b7280',
      accent: '#00d4ff',
      inverse: '#0a0e1a',
    },
    glass: {
      background: 'rgba(17, 24, 39, 0.6)',
      border: 'rgba(0, 212, 255, 0.15)',
      highlight: 'rgba(255, 255, 255, 0.05)',
      shadow: 'rgba(0, 0, 0, 0.3)',
    },
    status: {
      online: '#10b981',
      away: '#f59e0b',
      busy: '#ef4444',
      offline: '#6b7280',
      processing: '#00d4ff',
    },
  } as const,

  typography: {
    fontFamily: {
      sans: "'Inter', system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
      display: "'Inter', system-ui, -apple-system, sans-serif",
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      tight: '1.2',
      normal: '1.5',
      relaxed: '1.75',
    },
  } as const,

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
  } as const,

  breakpoints: {
    xs: '475px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
    '3xl': '1920px',
  } as const,

  shadows: {
    glass: '0 8px 32px 0 rgba(0, 212, 255, 0.08)',
    glassLg: '0 16px 48px 0 rgba(0, 212, 255, 0.12)',
    glow: '0 0 20px rgba(0, 212, 255, 0.25)',
    glowMd: '0 0 30px rgba(0, 212, 255, 0.35)',
    glowLg: '0 0 60px rgba(0, 212, 255, 0.45)',
    innerGlow: 'inset 0 0 20px rgba(0, 212, 255, 0.1)',
    neon: '0 0 10px rgba(0, 212, 255, 0.5), 0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.1)',
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
    elevated: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
  } as const,

  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
      slower: '1000ms',
    },
    easing: {
      easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
      easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  } as const,

  effects: {
    glassBlur: 'blur(20px) saturate(180%)',
    glassBlurLight: 'blur(12px) saturate(140%)',
    glassBlurHeavy: 'blur(32px) saturate(200%)',
    borderRadius: {
      sm: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      '2xl': '1.5rem',
      '4xl': '2rem',
      full: '9999px',
    },
  } as const,
} as const;

export type Theme = typeof theme;
export default theme;
