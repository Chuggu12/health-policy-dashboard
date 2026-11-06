// World map: one circle per country, sized by its number of records.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURATION = reduceMotion ? 0 : 250;
  const geo = window.GEO || { aliases: {}, points: {}, unmapped: [] };

  let root = null;
  let svg = null;
  let land = null;
  let dots = null;
  let legend = null;
  let tip = null;
  let note = null;
  let world = null;
  let records = null;
  let state = { isActive: () => false };
  let onToggle = () => {};
  let width = 0;
  let maxAll = 1;

  const atlasName = (name) => geo.aliases[name] || name;
  const plural = (n, word) => `${n.toLocaleString('en')} ${word}${n === 1 ? '' : 's'}`;

  function message(text) {
    root.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'map-message';
    p.textContent = text;
    root.appendChild(p);
    svg = null;
  }

  // the largest polygon's centre, so overseas territories don't pull a country's circle into the sea
  function mainCentroid(path, feature) {
    if (feature.geometry.type !== 'MultiPolygon') return path.centroid(feature);
    let best = null;
    let bestArea = -1;
    for (const coords of feature.geometry.coordinates) {
      const part = { type: 'Polygon', coordinates: coords };
      const area = path.area(part);
      if (area > bestArea) {
        bestArea = area;
        best = part;
      }
    }
    return path.centroid(best);
  }

  function init(container, opts) {
    root = container;
    onToggle = (opts && opts.onToggle) || onToggle;
    if (!window.d3 || !window.topojson) {
      message('The map could not load. The charts and records below still work.');
      return;
    }
    // sizes come from all records so circles stay comparable while filtering
    maxAll = d3.max(d3.rollup(window.RECORDS || [], (v) => v.length, (d) => d.country).values()) || 1;

    svg = d3.select(root).append('svg')
      .attr('class', 'map-svg')
      .attr('role', 'group')
      .attr('aria-label', 'World map: circles show the number of records per country');
    land = svg.append('g').attr('class', 'map-land').attr('aria-hidden', 'true');
    dots = svg.append('g').attr('class', 'map-dots');
    legend = svg.append('g').attr('class', 'map-legend').attr('aria-hidden', 'true');
    tip = d3.select(root).append('div').attr('class', 'map-tip').attr('role', 'tooltip').attr('hidden', '');
    note = d3.select(root).append('p').attr('class', 'map-note');

    d3.json(geo.atlas)
      .then((topo) => {
        world = topojson.feature(topo, topo.objects.countries).features
          .filter((f) => f.properties.name !== 'Antarctica');
        draw();
      })
      .catch(() => message('The world map could not be loaded (no internet connection?). The charts and records still work.'));

    new ResizeObserver(() => {
      const w = Math.round(root.clientWidth);
      if (w && w !== width) {
        width = w;
        draw();
      }
    }).observe(root);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideTip();
    });
  }

  function update(next, nextState) {
    records = next;
    if (nextState) state = nextState;
    draw();
  }

  function draw() {
    if (!svg || !world || !records) return;
    width = Math.round(root.clientWidth) || width || 600;
    const height = Math.max(220, Math.round(width * 0.52));
    const projection = d3.geoEqualEarth().fitSize([width, height], { type: 'FeatureCollection', features: world });
    const path = d3.geoPath(projection);
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const byCountry = d3.group(records, (d) => d.country);
    const shaded = new Set([...byCountry.keys()].map(atlasName));
    land.selectAll('path')
      .data(world, (f) => f.properties.name)
      .join('path')
      .attr('d', path)
      .classed('map-has-records', (f) => shaded.has(f.properties.name));

    const features = new Map(world.map((f) => [f.properties.name, f]));
    const radius = d3.scaleSqrt().domain([0, maxAll]).range([0, (26 * width) / 900]);
    const points = [];
    let unplaced = 0;
    for (const [country, rows] of byCountry) {
      const feature = features.get(atlasName(country));
      let xy = null;
      if (feature) xy = mainCentroid(path, feature);
      else if (geo.points[country]) xy = projection(geo.points[country]);
      if (!xy || Number.isNaN(xy[0])) {
        unplaced += rows.length;
        continue;
      }
      points.push({ country, rows, x: xy[0], y: xy[1], r: Math.max(3, radius(rows.length)) });
    }
    points.sort((a, b) => b.r - a.r);

    dots.selectAll('circle')
      .data(points, (d) => d.country)
      .join((enter) => enter.append('circle')
        .attr('class', 'map-dot')
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('r', 0)
        .on('click', (event, d) => onToggle('country', d.country))
        .on('keydown', (event, d) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle('country', d.country);
          }
        })
        .on('mouseenter mousemove', (event, d) => showTip(d, event))
        .on('focus', (event, d) => showTip(d, null))
        .on('mouseleave blur', hideTip))
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('aria-label', (d) => `${d.country}: ${plural(d.rows.length, 'record')}`)
      .attr('aria-pressed', (d) => String(state.isActive('country', d.country)))
      .classed('map-dot-active', (d) => state.isActive('country', d.country))
      .order()
      .transition()
      .duration(DURATION)
      .attr('r', (d) => d.r);

    drawLegend(radius, height);
    note.text(unplaced ? `${plural(unplaced, 'record')} without a single country (such as global work) ${unplaced === 1 ? 'is' : 'are'} not on the map.` : '');
  }

  function drawLegend(radius, height) {
    legend.selectAll('*').remove();
    const values = [5, 20, 50].filter((v) => v <= maxAll);
    const baseline = height - 8;
    let x = 10;
    for (const v of values) {
      const r = Math.max(3, radius(v));
      legend.append('circle').attr('cx', x + r).attr('cy', baseline - r - 12).attr('r', r);
      legend.append('text').attr('x', x + r).attr('y', baseline).attr('text-anchor', 'middle').text(v);
      x += 2 * r + 12;
    }
    legend.append('text').attr('x', x).attr('y', baseline).text('records');
  }

  function showTip(d, event) {
    const policy = d.rows.filter((r) => r.type === 'Policy Impact').length;
    const topics = d3.rollups(d.rows, (v) => v.length, (r) => r.topic)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const box = tip.node();
    box.textContent = '';
    const title = document.createElement('strong');
    title.textContent = d.country;
    const count = document.createElement('span');
    count.textContent = `${plural(d.rows.length, 'record')}: ${policy.toLocaleString('en')} policy, ${(d.rows.length - policy).toLocaleString('en')} systems or practice`;
    const list = document.createElement('ul');
    for (const [topic, n] of topics) {
      const li = document.createElement('li');
      li.textContent = `${topic} (${n})`;
      list.appendChild(li);
    }
    box.append(title, count, list);
    box.hidden = false;

    // follow the pointer, or sit above the circle when reached by keyboard
    const area = root.getBoundingClientRect();
    const x = event ? event.clientX - area.left : d.x;
    const y = event ? event.clientY - area.top : d.y - d.r;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = Math.min(Math.max(4, x - w / 2), root.clientWidth - w - 4);
    const top = y - h - 12 >= 0 ? y - h - 12 : y + 16;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function hideTip() {
    if (tip) tip.attr('hidden', '');
  }

  window.MapView = { init, update };
})();
