// Colours and labels shared by the map and the charts.
// style.css carries the same base colours as custom properties.
window.THEME = {
  ink: '#1f2430',
  muted: '#7a7366',
  rule: '#ddd3c1',
  paper: '#f6f1e7',
  land: '#e4d9c6',
  accent: '#b4462f',
  slate: '#34567a',

  type: {
    'Policy Impact': '#2d6a69',
    'Systems/Practice Impact': '#c08a24'
  },

  // earthy print colours; the long tail shares quieter tones
  topic: {
    'Road Safety': '#b4462f',
    'CRVS': '#34567a',
    'Tobacco Control': '#6e3b5b',
    'Overdose Prevention': '#2d6a69',
    'Food Policy': '#c08a24',
    'Air Quality': '#6f8fa6',
    'Health Data Systems': '#586b2f',
    'NCDs': '#9a6239',
    'RMNCH': '#a55473',
    'Infectious Diseases': '#7d7a2b',
    'Environmental Health': '#3e7c62',
    'Cancer Registry': '#7b5c8f',
    'Gender-Based Violence': '#b8705a',
    'Mental Health': '#4f7f8f',
    'Alcohol Policy': '#8c4a3a',
    'Heat': '#d0a03c',
    'Other': '#8e877a'
  },

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
