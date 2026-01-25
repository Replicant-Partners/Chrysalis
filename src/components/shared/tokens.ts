export type ThemeMode = 'dark' | 'light';

type ModeMap<T> = Record<ThemeMode, T>;

type TokenScale = {
  color: {
    surface: {
      base: ModeMap<string>;
      primaryPane: ModeMap<string>;
      secondaryPane: ModeMap<string>;
    };
    border: {
      subtle: ModeMap<string>;
    };
    text: {
      primary: ModeMap<string>;
      secondary: ModeMap<string>;
    };
    trust: {
      external: ModeMap<string>;
      internal: ModeMap<string>;
      ada: ModeMap<string>;
    };
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
  };
  radius: {
    sm: number;
    md: number;
  };
  typography: {
    label: number;
    body: number;
    title: number;
    weight: {
      normal: number;
      bold: number;
    };
  };
  motion: {
    snap: string;
    easeSnap: string;
  };
};

export const tokens: TokenScale = {
  color: {
    surface: {
      base: { dark: '#0f1116', light: '#ffffff' },
      primaryPane: { dark: '#121722', light: '#f5f7fb' },
      secondaryPane: { dark: '#0d1018', light: '#ffffff' },
    },
    border: {
      subtle: { dark: '#1f2737', light: '#d9e0ee' },
    },
    text: {
      primary: { dark: '#e6e9f0', light: '#1a1d24' },
      secondary: { dark: '#9aa4b5', light: '#5b6472' },
    },
    trust: {
      external: { dark: '#6aa9ff', light: '#2563eb' },
      internal: { dark: '#34d399', light: '#059669' },
      ada: { dark: '#fbbf24', light: '#d97706' },
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  },
  radius: {
    sm: 6,
    md: 10,
  },
  typography: {
    label: 12,
    body: 13,
    title: 14,
    weight: {
      normal: 400,
      bold: 600,
    },
  },
  motion: {
    snap: '120ms',
    easeSnap: 'ease-out',
  },
};
