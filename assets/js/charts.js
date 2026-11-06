// Charts: stacked year columns (SVG via d3) and three category bar lists
// (plain buttons, so they still work if d3 fails to load).
// app.js calls Charts.init once, then Charts.update after every filter change.
(function () {
  const THEME = window.THEME || {};
  const LABELS = THEME.labels || {};
  // stack order: first entry sits at the bottom of each column
  const TYPES = ['Policy Impact', 'Systems/Practice Impact'];
  const TYPE_SHORT = {
    'Policy Impact': 'policy',
    'Systems/Practice Impact': 'systems or practice'
  };
  const DURATION = 300;
  const LIST_FIELDS = ['topic', 'region', 'level'];

  const motionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const reducedMotion = () => Boolean(motionQuery && motionQuery.matches);

  const fmt = (n) => n.toLocaleString('en');
  const recordsText = (n) => `${fmt(n)} record${n === 1 ? '' : 's'}`;
  const noActive = () => false;

  const typeColor = (t) => (THEME.type && THEME.type[t]) || THEME.muted || '#7a7366';
  const typeLabel = (t) => (LABELS.type && LABELS.type[t]) || t;

  let onToggle = () => {};

  // Categories from ALL records, so filtered-out values stay visible at 0.
  const universe = {
    yearMin: null,
    yearMax: null,
    totals: { topic: new Map(), region: new Map(), level: new Map() }
  };

  let yearChart = null;
  const lists = {};

  function countBy(records, field) {
    const counts = new Map();
    for (const r of records) {
      const v = r[field];
      if (v == null || v === '') continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return counts;
  }

  function numericYear(v) {
    return /^\d{4}$/.test(String(v)) ? Number(v) : null;
  }

  // Adds categories the full data set did not have (in case app.js passes others).
  function extendUniverse(records) {
    for (const field of LIST_FIELDS) {
      const totals = universe.totals[field];
      for (const [value, n] of countBy(records, field)) {
        if (!totals.has(value)) totals.set(value, n);
      }
    }
    for (const r of records) {
      const y = numericYear(r.year);
      if (y == null) continue;
      if (universe.yearMin == null || y < universe.yearMin) universe.yearMin = y;
      if (universe.yearMax == null || y > universe.yearMax) universe.yearMax = y;
    }
  }

  function yearRange() {
    if (universe.yearMin == null) return [];
    const years = [];
    for (let y = universe.yearMin; y <= universe.yearMax; y += 1) years.push(String(y));
    return years;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- year chart ---------- */

  function createYearChart(container) {
    container.classList.add('chart', 'chart-years');
    container.textContent = '';

    const legend = el('div', 'chart-legend');
    legend.setAttribute('role', 'group');
    legend.setAttribute('aria-label', 'Type of change');
    const legendButtons = TYPES.map((type) => {
      const button = el('button', 'chart-legend-item');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      const swatch = el('span', 'chart-swatch');
      swatch.style.background = typeColor(type);
      swatch.setAttribute('aria-hidden', 'true');
      button.append(swatch, document.createTextNode(typeLabel(type)));
      button.addEventListener('click', () => onToggle('type', type));
      legend.append(button);
      return { type, button };
    });

    const plot = el('div', 'chart-plot');
    container.append(legend, plot);

    function updateLegend(isActive) {
      let any = false;
      for (const { type, button } of legendButtons) {
        const on = Boolean(isActive('type', type));
        any = any || on;
        button.setAttribute('aria-pressed', String(on));
      }
      legend.classList.toggle('has-active', any);
    }

    const d3 = window.d3;
    if (!d3) {
      plot.append(el('p', 'chart-empty', 'The year chart could not load. The other charts and the filters still work.'));
      return { update: (records, isActive) => updateLegend(isActive) };
    }

    const HEIGHT = 220;
    const M = { top: 10, right: 2, bottom: 24, left: 30 };

    const svg = d3.select(plot).append('svg')
      .attr('class', 'chart-svg')
      .attr('role', 'group')
      .attr('aria-label', 'Records by year, stacked by type of change');
    const gRoot = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
    const gGrid = gRoot.append('g').attr('class', 'chart-grid').attr('aria-hidden', 'true');
    const gCols = gRoot.append('g').attr('class', 'chart-cols');
    const gAxis = gRoot.append('g').attr('class', 'chart-axis').attr('aria-hidden', 'true');
    const emptyText = gRoot.append('text')
      .attr('class', 'chart-svg-empty')
      .attr('text-anchor', 'middle')
      .text('No dated records in this selection.');

    let last = { records: [], isActive: noActive };
    let drawnWidth = 0;
    let drawn = false;

    function rowsFor(records) {
      const byYear = new Map(yearRange().map((y) => [y, { year: y, total: 0, counts: {} }]));
      for (const r of records) {
        const row = byYear.get(String(r.year));
        if (!row) continue;
        row.counts[r.type] = (row.counts[r.type] || 0) + 1;
        row.total += 1;
      }
      return Array.from(byYear.values(), (row) => {
        let y0 = 0;
        // only the two known types are stacked; anything else still counts in the total
        row.segs = TYPES.map((type) => {
          const n = row.counts[type] || 0;
          const seg = { type, y0, y1: y0 + n };
          y0 += n;
          return seg;
        });
        return row;
      });
    }

    function ariaLabel(d) {
      const parts = TYPES.map((t) => `${fmt(d.counts[t] || 0)} ${TYPE_SHORT[t] || typeLabel(t)}`);
      return `${d.year}: ${recordsText(d.total)}, ${parts.join(', ')}`;
    }

    function toggleYear(event, d) {
      onToggle('year', d.year);
    }

    function onKey(event, d) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        onToggle('year', d.year);
      }
    }

    function draw(animate) {
      const width = Math.floor(plot.clientWidth);
      if (!width) return;
      drawnWidth = width;

      const innerW = Math.max(0, width - M.left - M.right);
      const innerH = HEIGHT - M.top - M.bottom;
      svg.attr('viewBox', `0 0 ${width} ${HEIGHT}`).attr('width', width).attr('height', HEIGHT);

      const { isActive } = last;
      const rows = rowsFor(last.records);
      const years = rows.map((d) => d.year);
      const maxTotal = d3.max(rows, (d) => d.total) || 0;
      const anyYear = years.some((y) => isActive('year', y));

      const x = d3.scaleBand().domain(years).range([0, innerW]).paddingInner(0.28).paddingOuter(0.12);
      const y = d3.scaleLinear().domain([0, Math.max(maxTotal, 1)]).nice().range([innerH, 0]);
      const bw = x.bandwidth();
      const step = x.step();
      const t = animate && drawn && !reducedMotion()
        ? d3.transition().duration(DURATION).ease(d3.easeCubicOut)
        : null;

      // gridlines: integer ticks only, counts on the left
      const ticks = y.ticks(4).filter(Number.isInteger);
      gGrid.selectAll('g.chart-tick')
        .data(ticks, (d) => d)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'chart-tick');
          g.append('line');
          g.append('text').attr('text-anchor', 'end').attr('dy', '0.32em');
          return g;
        })
        .classed('is-base', (d) => d === 0)
        .attr('transform', (d) => `translate(0,${Math.round(y(d)) + 0.5})`)
        .call((g) => g.select('line').attr('x1', 0).attr('x2', innerW))
        .call((g) => g.select('text').attr('x', -8).text((d) => fmt(d)));

      const cols = gCols.selectAll('g.chart-col')
        .data(rows, (d) => d.year)
        .join((enter) => {
          const g = enter.append('g')
            .attr('class', 'chart-col')
            .attr('tabindex', 0)
            .attr('role', 'button')
            .on('click', toggleYear)
            .on('keydown', onKey);
          g.append('rect').attr('class', 'chart-col-hit');
          return g;
        })
        .attr('transform', (d) => `translate(${x(d.year)},0)`)
        .attr('aria-label', ariaLabel)
        .attr('aria-pressed', (d) => String(Boolean(isActive('year', d.year))))
        .classed('is-dim', (d) => anyYear && !isActive('year', d.year));

      // the hit area covers the whole step so the gaps between columns are clickable too
      cols.select('rect.chart-col-hit')
        .attr('x', -(step - bw) / 2)
        .attr('y', 0)
        .attr('width', step)
        .attr('height', innerH);

      const segs = cols.selectAll('rect.chart-seg')
        .data((d) => d.segs, (s) => s.type)
        .join((enter) => enter.append('rect')
          .attr('class', 'chart-seg')
          .attr('y', innerH)
          .attr('height', 0))
        .attr('fill', (s) => typeColor(s.type))
        .attr('x', 0)
        .attr('width', bw);

      segs.interrupt();
      (t ? segs.transition(t) : segs)
        .attr('y', (s) => y(s.y1))
        .attr('height', (s) => Math.max(0, y(s.y0) - y(s.y1)));

      // every other year label when narrow, counted back from the latest year
      const sparse = width < 420;
      gAxis.selectAll('text')
        .data(years, (d) => d)
        .join('text')
        .attr('text-anchor', 'middle')
        .attr('x', (d) => x(d) + bw / 2)
        .attr('y', innerH + 16)
        .attr('display', (d, i) => (sparse && (years.length - 1 - i) % 2 ? 'none' : null))
        .classed('is-active', (d) => isActive('year', d))
        .text((d) => d);

      emptyText
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('display', maxTotal ? 'none' : null);

      drawn = true;
    }

    // redraw on width changes only; rAF avoids ResizeObserver loop warnings
    let frame = 0;
    function scheduleResize() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (Math.floor(plot.clientWidth) !== drawnWidth) draw(false);
      });
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(scheduleResize).observe(plot);
    } else {
      window.addEventListener('resize', scheduleResize);
    }

    return {
      update(records, isActive) {
        last = { records, isActive };
        updateLegend(isActive);
        draw(true);
      }
    };
  }

  /* ---------- category lists ---------- */

  function createList(container, field, opts) {
    container.classList.add('chart', 'chart-bars');
    container.textContent = '';
    const list = el('ul', `chart-list chart-list-${field}`);
    const empty = el('p', 'chart-empty', 'No records to show.');
    empty.hidden = true;
    container.append(list, empty);

    const rows = new Map();

    function rowFor(value) {
      if (rows.has(value)) return rows.get(value);
      const li = el('li', 'chart-row');
      const button = el('button', 'chart-item');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      const label = el('span', 'chart-item-label', opts.label(value));
      const count = el('span', 'chart-item-count', '0');
      const track = el('span', 'chart-item-track');
      track.setAttribute('aria-hidden', 'true');
      const bar = el('span', `chart-item-bar${opts.barClass ? ` ${opts.barClass}` : ''}`);
      bar.style.background = opts.color(value);
      track.append(bar);
      button.append(label, count, track);
      button.addEventListener('click', () => onToggle(field, value));
      li.append(button);
      const row = { li, button, count, bar };
      rows.set(value, row);
      return row;
    }

    function reorder(ordered) {
      const current = Array.from(list.children);
      if (current.length === ordered.length && current.every((li, i) => li === ordered[i])) return;
      // moving a focused button out of the DOM blurs it, so put focus back afterwards
      const focused = list.contains(document.activeElement) ? document.activeElement : null;
      for (const li of ordered) list.append(li);
      if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }

    return {
      update(records, isActive) {
        const counts = countBy(records, field);
        const values = opts.order(Array.from(universe.totals[field].keys()), counts);
        const max = values.reduce((m, v) => Math.max(m, counts.get(v) || 0), 0);

        const ordered = values.map((value) => {
          const row = rowFor(value);
          const n = counts.get(value) || 0;
          const name = opts.label(value);
          row.count.textContent = fmt(n);
          row.button.setAttribute('aria-label', `${name}: ${recordsText(n)}`);
          row.button.setAttribute('aria-pressed', String(Boolean(isActive(field, value))));
          row.li.classList.toggle('is-zero', n === 0);
          row.bar.style.transform = `scaleX(${max ? n / max : 0})`;
          return row.li;
        });

        reorder(ordered);
        empty.hidden = values.length > 0;
      }
    };
  }

  // largest first; ties keep the order of the full data set, then the label
  function byCount(field, label) {
    const totals = universe.totals[field];
    return (values, counts) => values.slice().sort((a, b) =>
      (counts.get(b) || 0) - (counts.get(a) || 0) ||
      (totals.get(b) || 0) - (totals.get(a) || 0) ||
      String(label(a)).localeCompare(String(label(b))));
  }

  function inLevelOrder(values) {
    const order = THEME.levelOrder || [];
    const rank = (v) => (order.indexOf(v) === -1 ? order.length : order.indexOf(v));
    return values.slice().sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
  }

  const topicLabel = (v) => v;
  const regionLabel = (v) => (LABELS.region && LABELS.region[v]) || v;
  const levelLabel = (v) => (LABELS.level && LABELS.level[v]) || v;

  const LIST_OPTS = {
    topic: {
      label: topicLabel,
      color: (v) => (THEME.topic && (THEME.topic[v] || THEME.topic.Other)) || THEME.muted || '#7a7366',
      order: byCount('topic', topicLabel)
    },
    region: {
      label: regionLabel,
      color: () => THEME.slate || '#34567a',
      order: byCount('region', regionLabel)
    },
    level: {
      label: levelLabel,
      color: () => THEME.ink || '#1f2430',
      barClass: 'chart-item-bar-soft',
      order: inLevelOrder
    }
  };

  /* ---------- public interface ---------- */

  window.Charts = {
    init(containers, options) {
      const c = containers || {};
      onToggle = (options && options.onToggle) || (() => {});
      extendUniverse(Array.isArray(window.RECORDS) ? window.RECORDS : []);

      if (c.years) yearChart = createYearChart(c.years);
      const targets = { topic: c.topics, region: c.regions, level: c.levels };
      for (const field of LIST_FIELDS) {
        if (targets[field]) lists[field] = createList(targets[field], field, LIST_OPTS[field]);
      }
    },

    update(records, state) {
      const recs = Array.isArray(records) ? records : [];
      const isActive = (state && state.isActive) || noActive;
      extendUniverse(recs);
      if (yearChart) yearChart.update(recs, isActive);
      for (const field of LIST_FIELDS) {
        if (lists[field]) lists[field].update(recs, isActive);
      }
    }
  };
})();
