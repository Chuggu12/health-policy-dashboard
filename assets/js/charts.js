// Charts drawn with Apache ECharts (SVG renderer): year columns, topic bars,
// region donut and level bars. app.js calls Charts.init once, then
// Charts.update after every filter change.
(function () {
  const THEME = window.THEME || {};
  const LABELS = THEME.labels || {};
  const FONT = THEME.font || 'system-ui, sans-serif';
  const INK = THEME.ink || '#ffffff';
  const INK2 = THEME.ink2 || '#d6e4f0';
  const MUTED = THEME.muted || '#a9c4d8';
  const GRID = THEME.grid || 'rgba(255, 255, 255, 0.12)';
  const RULE = THEME.rule || 'rgba(255, 255, 255, 0.16)';
  const CARD = THEME.card || '#0b4b7c';
  // stack order: first entry sits at the bottom of each column
  const TYPES = ['Policy Impact', 'Systems/Practice Impact'];
  const DIM = 0.35;
  const DURATION = 400;
  const YEAR_HEIGHT = 260;
  const TOPIC_ROW = 26;
  const TOPIC_PAD = 16;
  const REGION_HEIGHT = 300;
  const REGION_LEGEND = 72; // room under the donut for the legend
  const LEVEL_HEIGHT = 220;
  const EMPTY_TEXT = 'No records match';

  const motionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const reducedMotion = () => Boolean(motionQuery && motionQuery.matches);

  const fmt = (n) => n.toLocaleString('en');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (n, total) => (total ? `${Math.round((n / total) * 100)}%` : '0%');
  const noActive = () => false;

  const typeLabel = (v) => (LABELS.type && LABELS.type[v]) || v;
  const regionLabel = (v) => (LABELS.region && LABELS.region[v]) || v;
  const levelLabel = (v) => (LABELS.level && LABELS.level[v]) || v;
  const typeColor = (v) => (THEME.type && THEME.type[v]) || MUTED;
  const topicColor = (v) => (THEME.topic && (THEME.topic[v] || THEME.topic.Other)) || MUTED;
  const regionColor = (v) => (THEME.region && THEME.region[v]) || MUTED;

  let onToggle = () => {};

  // Categories from ALL records, so filtered-out values stay listed at 0.
  const universe = {
    yearMin: null,
    yearMax: null,
    totals: { topic: new Map(), region: new Map(), level: new Map() }
  };

  const charts = {};

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

  // adds categories the full data set did not have (in case app.js passes others)
  function extendUniverse(records) {
    for (const field of Object.keys(universe.totals)) {
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

  /* ---------- shared ECharts pieces ---------- */

  function baseOption(description) {
    const animate = !reducedMotion();
    return {
      backgroundColor: 'transparent',
      textStyle: { fontFamily: FONT, color: INK2 },
      aria: { enabled: true, label: { description } },
      animation: animate,
      animationDuration: 600,
      animationDurationUpdate: DURATION,
      animationEasing: 'cubicOut',
      animationEasingUpdate: 'cubicOut'
    };
  }

  function tooltipBase(extra) {
    return Object.assign({
      backgroundColor: THEME.tooltip || '#00243f',
      borderColor: RULE,
      borderWidth: 1,
      padding: [8, 10],
      confine: true,
      textStyle: { color: '#ffffff', fontFamily: FONT, fontSize: 12 },
      extraCssText: 'border-radius: 6px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);'
    }, extra);
  }

  function tipRow(color, name, value) {
    const dot = color ? `<span class="chart-tip-dot" style="background:${color}"></span>` : '';
    return `<div class="chart-tip-row">${dot}<span class="chart-tip-name">${esc(name)}</span>` +
      `<span class="chart-tip-value">${value}</span></div>`;
  }

  // the active value is drawn bold and white on the category axis
  const activeRich = { on: { color: INK, fontWeight: 700, fontSize: 12, fontFamily: FONT } };

  // a plot area with an explicit height, plus a centred empty-state message
  function createPlot(container, height) {
    const plot = el('div', 'chart-plot');
    const canvas = el('div', 'chart-canvas');
    canvas.style.height = `${height}px`;
    const empty = el('p', 'chart-empty', EMPTY_TEXT);
    empty.hidden = true;
    plot.append(canvas, empty);
    container.append(plot);
    return { plot, canvas, empty };
  }

  function setEmpty(parts, isEmpty) {
    parts.plot.classList.toggle('is-empty', isEmpty);
    parts.empty.hidden = !isEmpty;
  }

  function initChart(canvas) {
    return window.echarts.init(canvas, null, { renderer: 'svg' });
  }

  // resize on container size changes; rAF avoids ResizeObserver loop warnings
  function watchSize(container, chart) {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        chart.resize();
      });
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(schedule).observe(container);
    } else {
      window.addEventListener('resize', schedule);
    }
  }

  function noEcharts(container) {
    container.append(el('p', 'chart-empty chart-failed', 'This chart could not load. The filter menus still work.'));
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
    container.append(legend);

    function updateLegend(isActive) {
      let any = false;
      for (const { type, button } of legendButtons) {
        const on = Boolean(isActive('type', type));
        any = any || on;
        button.setAttribute('aria-pressed', String(on));
      }
      legend.classList.toggle('has-active', any);
    }

    if (!window.echarts) {
      noEcharts(container);
      return { update: (records, isActive) => updateLegend(isActive) };
    }

    const parts = createPlot(container, YEAR_HEIGHT);
    const chart = initChart(parts.canvas);
    watchSize(container, chart);

    let rows = [];

    // a click anywhere in a year's column area toggles that year
    function yearAt(point) {
      if (!rows.length || !chart.containPixel({ gridIndex: 0 }, point)) return null;
      let best = null;
      let bestDist = Infinity;
      for (const row of rows) {
        const x = chart.convertToPixel({ xAxisIndex: 0 }, row.year);
        const dist = Math.abs(x - point[0]);
        if (dist < bestDist) {
          bestDist = dist;
          best = row.year;
        }
      }
      return best;
    }

    const zr = chart.getZr();
    zr.on('click', (event) => {
      const year = yearAt([event.offsetX, event.offsetY]);
      if (year) onToggle('year', year);
    });
    zr.on('mousemove', (event) => {
      if (yearAt([event.offsetX, event.offsetY])) zr.setCursorStyle('pointer');
    });

    function rowsFor(records) {
      const byYear = new Map(yearRange().map((y) => [y, { year: y, total: 0, counts: {} }]));
      for (const r of records) {
        const row = byYear.get(String(r.year));
        if (!row) continue;
        row.counts[r.type] = (row.counts[r.type] || 0) + 1;
        row.total += 1;
      }
      return Array.from(byYear.values());
    }

    function tooltip(params) {
      const list = Array.isArray(params) ? params : [params];
      const row = list.length ? rows[list[0].dataIndex] : null;
      if (!row) return '';
      const lines = TYPES.map((t) => tipRow(typeColor(t), typeLabel(t), fmt(row.counts[t] || 0)));
      return `<div class="chart-tip-title">${esc(row.year)}</div>${lines.join('')}` +
        `<div class="chart-tip-total">${tipRow('', 'Total', fmt(row.total))}</div>`;
    }

    function describe() {
      if (!rows.length) return 'Records by year: no dated records.';
      const list = rows.map((r) => `${r.year}: ${fmt(r.total)}`).join(', ');
      return `Stacked bar chart of records per year from ${rows[0].year} to ${rows[rows.length - 1].year}, ` +
        `split into ${typeLabel(TYPES[0]).toLowerCase()} and ${typeLabel(TYPES[1]).toLowerCase()}, ` +
        `with a line for the yearly total. ${list}. Use the Year filter menu to filter by year.`;
    }

    return {
      update(records, isActive) {
        updateLegend(isActive);
        const isEmpty = records.length === 0;
        setEmpty(parts, isEmpty);
        if (isEmpty) return;

        rows = rowsFor(records);
        const years = rows.map((r) => r.year);
        const anyYear = years.some((y) => isActive('year', y));
        const opacity = (y) => (anyYear && !isActive('year', y) ? DIM : 1);
        const top = TYPES[TYPES.length - 1];

        const barSeries = TYPES.map((type) => ({
          name: typeLabel(type),
          type: 'bar',
          stack: 'total',
          barCategoryGap: '32%',
          cursor: 'pointer',
          emphasis: {
            focus: 'none',
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.35)' }
          },
          data: rows.map((row) => {
            const n = row.counts[type] || 0;
            // round the top of whichever segment ends the column
            const isTop = type === top || !(row.counts[top] || 0);
            return {
              value: n,
              itemStyle: {
                color: typeColor(type),
                opacity: opacity(row.year),
                borderRadius: isTop ? [4, 4, 0, 0] : 0
              }
            };
          })
        }));

        chart.setOption(Object.assign(baseOption(describe()), {
          grid: { top: 14, right: 8, bottom: 4, left: 4, containLabel: true },
          tooltip: tooltipBase({
            trigger: 'axis',
            axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
            formatter: tooltip
          }),
          xAxis: {
            type: 'category',
            data: years,
            axisTick: { show: false },
            axisLine: { lineStyle: { color: GRID } },
            axisLabel: {
              color: INK2,
              fontSize: 11,
              hideOverlap: true,
              formatter: (v) => (isActive('year', v) ? `{on|${v}}` : v),
              rich: activeRich
            }
          },
          yAxis: {
            type: 'value',
            minInterval: 1,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: MUTED, fontSize: 11 },
            splitLine: { lineStyle: { color: GRID } }
          },
          series: barSeries.concat([{
            name: 'Total',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            z: 5,
            lineStyle: { color: INK, width: 1.25, opacity: 0.85 },
            itemStyle: { color: INK },
            emphasis: { scale: 1.6 },
            data: rows.map((row) => row.total)
          }])
        }));
      }
    };
  }

  /* ---------- horizontal bar charts (topic, level) ---------- */

  function createBarChart(container, field, opts) {
    container.classList.add('chart', `chart-${opts.kind}`);
    container.textContent = '';
    if (!window.echarts) {
      noEcharts(container);
      return { update() {} };
    }

    let height = opts.height(universe.totals[field].size);
    const parts = createPlot(container, height);
    const chart = initChart(parts.canvas);
    watchSize(container, chart);

    let counts = new Map();
    let total = 0;

    chart.on('click', (params) => {
      if (params.componentType === 'series' && params.data) onToggle(field, params.data.raw);
      else if (params.componentType === 'yAxis' && params.value != null) onToggle(field, params.value);
    });

    function tooltip(params) {
      const raw = params.data && params.data.raw;
      if (raw == null) return '';
      const n = counts.get(raw) || 0;
      return `<div class="chart-tip-title">${esc(opts.label(raw))}</div>` +
        tipRow(opts.color(raw), 'Records', fmt(n)) +
        tipRow('', 'Share of selection', pct(n, total));
    }

    return {
      update(records, isActive) {
        const isEmpty = records.length === 0;
        setEmpty(parts, isEmpty);
        if (isEmpty) return;

        counts = countBy(records, field);
        total = records.length;
        const values = opts.order(Array.from(universe.totals[field].keys()), counts);
        const anyActive = values.some((v) => isActive(field, v));

        // a new category can arrive through update; grow the plot to fit it
        const wanted = opts.height(values.length);
        if (wanted !== height) {
          height = wanted;
          parts.canvas.style.height = `${height}px`;
          chart.resize();
        }

        const description = `${opts.title}, ${opts.orderText}: ` +
          values.map((v) => `${opts.label(v)} ${fmt(counts.get(v) || 0)}`).join(', ') +
          `. Use the ${opts.menu} filter menu to filter.`;

        chart.setOption(Object.assign(baseOption(description), {
          grid: { top: 4, right: 40, bottom: 4, left: 4, containLabel: true },
          tooltip: tooltipBase({ trigger: 'item', formatter: tooltip }),
          xAxis: { type: 'value', show: false, minInterval: 1 },
          yAxis: {
            type: 'category',
            inverse: true,
            data: values,
            triggerEvent: true,
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: {
              fontSize: 12,
              width: opts.labelWidth,
              overflow: 'truncate',
              color: (v) => (counts.get(v) ? INK2 : MUTED),
              formatter: (v) => (isActive(field, v) ? `{on|${opts.label(v)}}` : opts.label(v)),
              rich: activeRich
            }
          },
          series: [{
            type: 'bar',
            barCategoryGap: '38%',
            barMaxWidth: opts.barMaxWidth,
            cursor: 'pointer',
            showBackground: true,
            backgroundStyle: { color: 'rgba(255, 255, 255, 0.05)', borderRadius: 4 },
            label: {
              show: true,
              position: 'right',
              distance: 6,
              color: INK2,
              fontSize: 11,
              formatter: (p) => fmt(p.value || 0)
            },
            emphasis: {
              focus: 'self',
              itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 0, 0, 0.35)' }
            },
            blur: { itemStyle: { opacity: 0.45 }, label: { opacity: 0.6 } },
            data: values.map((v) => ({
              value: counts.get(v) || 0,
              raw: v,
              itemStyle: {
                color: opts.color(v),
                opacity: anyActive && !isActive(field, v) ? DIM : 1,
                borderRadius: [0, 4, 4, 0]
              }
            }))
          }]
        }));
      }
    };
  }

  // largest first; ties keep the order of the full data set, then the name
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

  const BAR_OPTS = {
    topic: {
      kind: 'topics',
      title: 'Bar chart of records by topic',
      orderText: 'largest first',
      menu: 'Topic',
      label: (v) => v,
      color: topicColor,
      order: byCount('topic', (v) => v),
      height: (n) => Math.max(1, n) * TOPIC_ROW + TOPIC_PAD,
      labelWidth: 140,
      barMaxWidth: 16
    },
    level: {
      kind: 'levels',
      title: 'Bar chart of records by level of government',
      orderText: 'from national to local',
      menu: 'Level',
      label: levelLabel,
      color: () => THEME.level || INK2,
      order: inLevelOrder,
      height: () => LEVEL_HEIGHT,
      labelWidth: 130,
      barMaxWidth: 20
    }
  };

  /* ---------- region donut ---------- */

  function createRegionChart(container) {
    container.classList.add('chart', 'chart-regions');
    container.textContent = '';
    if (!window.echarts) {
      noEcharts(container);
      return { update() {} };
    }

    const parts = createPlot(container, REGION_HEIGHT);
    const chart = initChart(parts.canvas);
    watchSize(container, chart);

    let counts = new Map();
    let total = 0;

    chart.on('click', (params) => {
      if (params.componentType === 'series' && params.data) onToggle('region', params.data.code);
    });

    function tooltip(params) {
      const code = params.data && params.data.code;
      if (code == null) return '';
      const n = counts.get(code) || 0;
      return `<div class="chart-tip-title">${esc(regionLabel(code))}</div>` +
        tipRow(regionColor(code), 'Records', fmt(n)) +
        tipRow('', 'Share of selection', pct(n, total));
    }

    return {
      update(records, isActive) {
        const isEmpty = records.length === 0;
        setEmpty(parts, isEmpty);
        if (isEmpty) return;

        counts = countBy(records, 'region');
        total = records.length;
        const totals = universe.totals.region;
        const codes = Array.from(totals.keys())
          .filter((c) => counts.get(c))
          .sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0) ||
            String(regionLabel(a)).localeCompare(String(regionLabel(b))));
        const anyActive = codes.some((c) => isActive('region', c));
        const centreY = (REGION_HEIGHT - REGION_LEGEND) / 2;

        const description = `Donut chart of ${fmt(total)} records by region: ` +
          codes.map((c) => `${regionLabel(c)} ${fmt(counts.get(c))}`).join(', ') +
          '. Use the Region filter menu to filter.';

        chart.setOption(Object.assign(baseOption(description), {
          tooltip: tooltipBase({ trigger: 'item', formatter: tooltip }),
          legend: {
            bottom: 0,
            left: 'center',
            selectedMode: false,
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 12,
            textStyle: { color: INK2, fontSize: 11, fontFamily: FONT }
          },
          graphic: [{
            id: 'chart-total',
            type: 'text',
            left: 'center',
            top: centreY - 23,
            silent: true,
            style: {
              text: `{n|${fmt(total)}}\n{l|${total === 1 ? 'record' : 'records'}}`,
              align: 'center',
              rich: {
                n: { fontSize: 26, fontWeight: 700, lineHeight: 30, fill: INK, fontFamily: FONT },
                l: { fontSize: 11, lineHeight: 15, fill: MUTED, fontFamily: FONT }
              }
            }
          }],
          series: [{
            type: 'pie',
            top: 0,
            bottom: REGION_LEGEND,
            radius: ['50%', '78%'],
            center: ['50%', '50%'],
            cursor: 'pointer',
            avoidLabelOverlap: false,
            label: { show: false },
            labelLine: { show: false },
            itemStyle: { borderColor: CARD, borderWidth: 2, borderRadius: 4 },
            emphasis: {
              scale: true,
              scaleSize: 7,
              label: { show: false },
              itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0, 0, 0, 0.35)' }
            },
            data: codes.map((c) => ({
              name: regionLabel(c),
              value: counts.get(c),
              code: c,
              itemStyle: {
                color: regionColor(c),
                opacity: anyActive && !isActive('region', c) ? DIM : 1
              }
            }))
          }]
        }));
      }
    };
  }

  /* ---------- public interface ---------- */

  window.Charts = {
    init(containers, options) {
      const c = containers || {};
      onToggle = (options && options.onToggle) || (() => {});
      extendUniverse(Array.isArray(window.RECORDS) ? window.RECORDS : []);

      if (c.years) charts.years = createYearChart(c.years);
      if (c.topics) charts.topics = createBarChart(c.topics, 'topic', BAR_OPTS.topic);
      if (c.regions) charts.regions = createRegionChart(c.regions);
      if (c.levels) charts.levels = createBarChart(c.levels, 'level', BAR_OPTS.level);
    },

    update(records, state) {
      const recs = Array.isArray(records) ? records : [];
      const isActive = (state && state.isActive) || noActive;
      extendUniverse(recs);
      for (const key of ['years', 'topics', 'regions', 'levels']) {
        if (charts[key]) charts[key].update(recs, isActive);
      }
    }
  };
})();
