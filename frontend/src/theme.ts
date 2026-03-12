// FSM DataBridge Theme Configuration
// Based on Infor Brand Guidelines with Purple as Primary

export const theme = {
  primary: {
    main: '#4600AF',
    light: '#6B2DC7',
    dark: '#350080',
    gradient: 'linear-gradient(135deg, #4600AF 0%, #6B2DC7 100%)',
  },
  secondary: {
    green: '#00BD58',
    yellow: '#4600AF',  // Using primary color for consistency
    red: '#ED0C2E',
  },
  background: {
    primary: '#F7F7FB',     // Page background
    secondary: '#FFFFFF',   // Cards
    tertiary: '#F1F1F6',    // Sections (keeping existing for compatibility)
    quaternary: '#E6E6EF',  // Borders (updated for better visibility)
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#4B4B5A',
    tertiary: '#6B6B7A',
    muted: '#9A9AAA',
  },
  accent: {
    purpleTintLight: '#F3EEFF',  // Row hover
    purpleTintMedium: '#E6DCFF',
    purpleTintStrong: '#D4C3FF',
  },
  status: {
    success: '#00BD58',
    warning: '#FFAC00',
    error: '#ED0C2E',
    info: '#4600AF',
  },
  interactive: {
    hover: '#F3EEFF',        // Row hover color
    active: '#350080',
    focus: '#4600AF',
    disabled: '#C4C4CC',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #4600AF 0%, #6B2DC7 100%)',
    success: 'linear-gradient(135deg, #00BD58 0%, #00D463 100%)',
    warning: 'linear-gradient(135deg, #FFAC00 0%, #FFB82E 100%)',
    error: 'linear-gradient(135deg, #ED0C2E 0%, #FF1A3D 100%)',
  },
};