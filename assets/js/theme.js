// Colours and labels shared by the map and the charts.
// Brand blue and orange are taken from Vital Strategies' CANARY Technical Appendix (2026);
// the charts sit on white panels, so these are mid-strength colours that read on white.
window.THEME = {
  bg: '#ffffff',
  card: '#ffffff',
  tooltip: '#00243f',
  ink: '#0b2540',
  ink2: '#3d5468',
  muted: '#5f7385',
  rule: '#dbe4ec',
  grid: '#e6edf3',
  land: '#dbe7f0',
  landActive: '#b3cde2',
  landHover: '#8fb9da',
  accent: '#ff5a00',
  brand: '#004272',
  sky: '#2b8cc4',
  font: "'Public Sans', 'Segoe UI', system-ui, sans-serif",

  type: {
    'Policy Impact': '#2b8cc4',
    'Systems/Practice Impact': '#ff7a29'
  },

  topic: {
    'Road Safety': '#ff5a00',
    'CRVS': '#004272',
    'Tobacco Control': '#c98a00',
    'Overdose Prevention': '#1a9e77',
    'Food Policy': '#e0475b',
    'Air Quality': '#2b8cc4',
    'Health Data Systems': '#6c5bb5',
    'NCDs': '#a0522d',
    'RMNCH': '#d0508a',
    'Infectious Diseases': '#6f9a1f',
    'Environmental Health': '#11847f',
    'Cancer Registry': '#8e44ad',
    'Gender-Based Violence': '#c2185b',
    'Mental Health': '#3f7fbf',
    'Alcohol Policy': '#8d6e63',
    'Heat': '#e6a100',
    'Other': '#90a4ae'
  },

  region: {
    AMRO: '#004272',
    AFRO: '#ff7a29',
    SEARO: '#2b8cc4',
    WPRO: '#1a9e77',
    EURO: '#6c5bb5',
    EMRO: '#e0475b',
    Global: '#90a4ae'
  },

  level: '#2b8cc4',

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
