// Colours and labels shared by the map and the charts.
// Brand blue and orange are taken from Vital Strategies' CANARY Technical Appendix (2026);
// style.css carries the same base colours as custom properties.
window.THEME = {
  bg: '#004272',
  card: '#0b4b7c',
  tooltip: '#00243f',
  ink: '#ffffff',
  ink2: '#d6e4f0',
  muted: '#a9c4d8',
  rule: 'rgba(255, 255, 255, 0.16)',
  grid: 'rgba(255, 255, 255, 0.12)',
  land: '#1a5c8f',
  landActive: '#2f78ad',
  accent: '#ff5a00',
  sky: '#5cc8f0',
  font: "'Public Sans', 'Segoe UI', system-ui, sans-serif",

  type: {
    'Policy Impact': '#ff7a29',
    'Systems/Practice Impact': '#5cc8f0'
  },

  // light, saturated tones that stay readable on the blue background
  topic: {
    'Road Safety': '#ff7a29',
    'CRVS': '#5cc8f0',
    'Tobacco Control': '#ffc145',
    'Overdose Prevention': '#4fd1a5',
    'Food Policy': '#ff6f7d',
    'Air Quality': '#9fd3ff',
    'Health Data Systems': '#b39ddb',
    'NCDs': '#f7a072',
    'RMNCH': '#f48fb1',
    'Infectious Diseases': '#c5e86c',
    'Environmental Health': '#2fd0c9',
    'Cancer Registry': '#d4a5ff',
    'Gender-Based Violence': '#ff9eb5',
    'Mental Health': '#7fe0ff',
    'Alcohol Policy': '#e8b04a',
    'Heat': '#ffe066',
    'Other': '#a9c4d8'
  },

  region: {
    AMRO: '#5cc8f0',
    AFRO: '#ffc145',
    SEARO: '#ff7a29',
    WPRO: '#4fd1a5',
    EURO: '#b39ddb',
    EMRO: '#ff6f7d',
    Global: '#a9c4d8'
  },

  level: '#9fd3ff',

  labels: {
    region: {
      AMRO: 'Americas',
      AFRO: 'Africa',
      SEARO: 'South-East Asia',
      WPRO: 'Western Pacific',
      EURO: 'Europe',
      EMRO: 'Eastern Mediterranean',
      Global: 'Global'
    },
    type: {
      'Policy Impact': 'Policy change',
      'Systems/Practice Impact': 'Systems or practice change'
    },
    level: {
      'Federal/National': 'National',
      'State/Province': 'State or province',
      'City': 'City',
      'Global': 'Global',
      'Unspecified': 'Not specified'
    }
  },

  // display order for the level chart and filter
  levelOrder: ['Federal/National', 'State/Province', 'City', 'Global', 'Unspecified']
};
