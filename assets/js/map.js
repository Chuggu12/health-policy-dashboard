// World map (Apache ECharts): one bubble per country, sized by its number of records.
// Click the map to turn on zooming, so the page scroll isn't captured by accident.
(function () {
  const T = window.THEME;
  const geo = window.GEO || { aliases: {}, points: {}, unmapped: [] };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY_VALUES = [5, 20, 50];

  let root = null;
  let canvas = null;
  let key = null;
  let note = null;
  let chart = null;
  let featureNames = [];
  const centres = new Map(); // record country name -> [lon, lat]
  const recordName = new Map(); // atlas name -> record country name
  let ready = false;
  let roaming = false;
  let records = null;
  let state = { isActive: () => false };
  let onToggle = () => {};
  let maxAll = 1;

  const atlasName = (name) => geo.aliases[name] || name;
  const fmt = (n) => n.toLocaleString('en');
  const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function message(text) {
    root.textContent = '';
    const p = document.createElement('p');
    p.className = 'map-message';
    p.textContent = text;
    root.appendChild(p);
    chart = null;
  }

  // the largest polygon's centre, so overseas territories don't pull a bubble into the sea
  function mainCentre(feature) {
    if (feature.geometry.type !== 'MultiPolygon') return d3.geoCentroid(feature);
    let best = null;
    let bestArea = -1;
    for (const coords of feature.geometry.coordinates) {
      const part = { type: 'Polygon', coordinates: coords };
      const area = d3.geoArea(part);
      if (area > bestArea) {
        bestArea = area;
        best = part;
      }
    }
    return d3.geoCentroid(best);
  }

  // bubble diameter grows with the map's width
  function sizer() {
    const biggest = Math.max(18, Math.min(46, canvas.clientWidth / 20));
    const scale = d3.scaleSqrt().domain([0, maxAll]).range([0, biggest]);
    return (n) => Math.max(6, scale(n));
  }

  function tooltip(p) {
    const d = p.data;
    if (!d || !d.rows) return '';
    const policy = d.rows.filter((r) => r.type === 'Policy Impact').length;
    const topics = d3.rollups(d.rows, (v) => v.length, (r) => r.topic)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return `<div class="map-tip"><strong>${esc(d.name)}</strong>` +
      `<span class="map-tip-count">${plural(d.rows.length, 'record')}</span>` +
      `<span class="map-tip-split"><i style="background:${T.type['Policy Impact']}"></i>${fmt(policy)} policy` +
      `<i style="background:${T.type['Systems/Practice Impact']}"></i>${fmt(d.rows.length - policy)} systems or practice</span>` +
      `<ul>${topics.map(([t, n]) => `<li><span>${esc(t)}</span><b>${n}</b></li>`).join('')}</ul></div>`;
  }

  function setRoam(on) {
    if (!chart || roaming === on) return;
    roaming = on;
    chart.setOption({ geo: { roam: on } });
    root.classList.toggle('map-roaming', on);
  }

  function init(container, opts) {
    root = container;
    onToggle = (opts && opts.onToggle) || onToggle;
    if (!window.echarts || !window.d3 || !window.topojson) {
      message('The map could not load. The charts and records below still work.');
      return;
    }
    maxAll = d3.max(d3.rollup(window.RECORDS || [], (v) => v.length, (d) => d.country).values()) || 1;

    canvas = document.createElement('div');
    canvas.className = 'map-canvas';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'map-reset';
    reset.textContent = 'Reset view';
    reset.addEventListener('click', () => {
      if (chart) chart.setOption({ geo: { zoom: 1, center: null } });
    });
    const foot = document.createElement('div');
    foot.className = 'map-foot';
    key = document.createElement('div');
    key.className = 'map-key';
    key.setAttribute('aria-hidden', 'true');
    note = document.createElement('p');
    note.className = 'map-note';
    foot.append(key, note);
    root.append(canvas, reset, foot);

    chart = echarts.init(canvas);
    chart.on('click', (p) => {
      if (p.componentType === 'series' && p.data) onToggle('country', p.data.name);
      else if (p.componentType === 'geo' && recordName.has(p.name)) onToggle('country', recordName.get(p.name));
    });
    chart.getZr().on('click', () => setRoam(true));
    canvas.addEventListener('mouseleave', () => setRoam(false));
    document.addEventListener('pointerdown', (event) => {
      if (!canvas.contains(event.target)) setRoam(false);
    });

    let lastWidth = 0;
    new ResizeObserver(() => {
      if (!chart || canvas.clientWidth === lastWidth) return;
      lastWidth = canvas.clientWidth;
      chart.resize();
      draw();
    }).observe(canvas);

    d3.json(geo.atlas)
      .then((topo) => {
        const world = topojson.feature(topo, topo.objects.countries);
        world.features = world.features.filter((f) => f.properties.name !== 'Antarctica');
        echarts.registerMap('world', world);
        featureNames = world.features.map((f) => f.properties.name);
        const byName = new Map(world.features.map((f) => [f.properties.name, f]));
        for (const name of new Set((window.RECORDS || []).map((r) => r.country))) {
          const feature = byName.get(atlasName(name));
          if (feature) {
            centres.set(name, mainCentre(feature));
            recordName.set(feature.properties.name, name);
          } else if (geo.points[name]) {
            centres.set(name, geo.points[name]);
          }
        }
        setBase();
        ready = true;
        draw();
      })
      .catch(() => message('The world map could not be loaded (no internet connection?). The charts and records still work.'));
  }

  function setBase() {
    const projection = d3.geoEqualEarth();
    chart.setOption({
      backgroundColor: 'transparent',
      animation: !reduceMotion,
      animationDurationUpdate: 400,
      aria: {
        enabled: true,
        label: { description: 'World map with one circle per country, sized by its number of policy and systems change records.' }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: T.tooltip,
        borderColor: T.rule,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: T.ink, fontFamily: T.font, fontSize: 13 },
        extraCssText: 'border-radius:6px;box-shadow:0 8px 24px rgba(0,20,40,.35);',
        formatter: tooltip
      },
      geo: {
        map: 'world',
        roam: false,
        scaleLimit: { min: 1, max: 12 },
        projection: {
          project: (point) => projection(point),
          unproject: (point) => projection.invert(point)
        },
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
        label: { show: false },
        itemStyle: { areaColor: T.land, borderColor: T.bg, borderWidth: 0.6 },
        emphasis: { label: { show: false }, itemStyle: { areaColor: '#3d8fc9' } },
        select: { disabled: true }
      },
      series: [
        {
          id: 'dots',
          type: 'scatter',
          coordinateSystem: 'geo',
          z: 3,
          cursor: 'pointer',
          itemStyle: { color: T.accent, borderColor: '#ffffff', borderWidth: 1 },
          label: {
            show: true,
            formatter: (p) => (p.value[2] >= 20 ? p.value[2] : ''),
            color: '#ffffff',
            fontFamily: T.font,
            fontSize: 11,
            fontWeight: 600
          },
          emphasis: {
            scale: 1.25,
            itemStyle: { opacity: 1, borderWidth: 2, shadowBlur: 14, shadowColor: 'rgba(255, 90, 0, 0.7)' }
          },
          data: []
        },
        {
          id: 'pulse',
          type: reduceMotion ? 'scatter' : 'effectScatter',
          coordinateSystem: 'geo',
          z: 4,
          cursor: 'pointer',
          rippleEffect: { brushType: 'stroke', scale: 2.6, period: 3 },
          itemStyle: { color: T.accent, borderColor: '#ffffff', borderWidth: 2.5 },
          data: []
        }
      ]
    });
  }

  function update(next, nextState) {
    records = next;
    if (nextState) state = nextState;
    draw();
  }

  function draw() {
    if (!ready || !chart || !records) return;
    const size = sizer();
    const byCountry = d3.group(records, (d) => d.country);
    const anySelected = [...byCountry.keys()].some((c) => state.isActive('country', c));
    const dots = [];
    const pulse = [];
    let unplaced = 0;
    for (const [country, rows] of byCountry) {
      const centre = centres.get(country);
      if (!centre) {
        unplaced += rows.length;
        continue;
      }
      const active = state.isActive('country', country);
      const item = {
        name: country,
        value: [centre[0], centre[1], rows.length],
        rows,
        symbolSize: size(rows.length),
        itemStyle: { opacity: anySelected && !active ? 0.4 : 0.88 }
      };
      dots.push(item);
      if (active) pulse.push({ ...item, itemStyle: { opacity: 1 } });
    }
    // big bubbles first so the small ones drawn later stay clickable
    dots.sort((a, b) => b.value[2] - a.value[2]);

    const shaded = new Set([...byCountry.keys()].map(atlasName));
    chart.setOption({
      geo: {
        regions: featureNames.map((name) => ({
          name,
          itemStyle: { areaColor: shaded.has(name) ? T.landActive : T.land }
        }))
      },
      series: [{ id: 'dots', data: dots }, { id: 'pulse', data: pulse }]
    });

    key.innerHTML = KEY_VALUES.filter((v) => v <= maxAll)
      .map((v) => `<span><i style="width:${size(v)}px;height:${size(v)}px"></i>${v}</span>`)
      .join('') + '<span class="map-key-label">records</span>';
    note.textContent = unplaced
      ? `${plural(unplaced, 'record')} without a single country (such as global work) ${unplaced === 1 ? 'is' : 'are'} not on the map.`
      : '';
  }

  window.MapView = { init, update };
})();
