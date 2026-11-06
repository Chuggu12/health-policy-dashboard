// Temporary harness: draws the map and charts with every record and logs
// clicks, so map.js and charts.js can be tried before the full app is in.
(function () {
  const records = window.RECORDS || [];
  const opts = { onToggle: (field, value) => console.log('toggle', field, value) };
  const state = { isActive: () => false };
  if (window.MapView) {
    MapView.init(document.getElementById('map'), opts);
    MapView.update(records, state);
  }
  if (window.Charts) {
    Charts.init({
      years: document.getElementById('chart-years'),
      topics: document.getElementById('chart-topics'),
      regions: document.getElementById('chart-regions'),
      levels: document.getElementById('chart-levels')
    }, opts);
    Charts.update(records, state);
  }
})();
