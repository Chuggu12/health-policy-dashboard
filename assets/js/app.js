// Dashboard state: filters, headline numbers and the record list, plus the
// wiring between the filter controls, the map (map.js) and the charts (charts.js).
(function () {
  const RECORDS = window.RECORDS || [];
  const T = window.THEME;
  const UNMAPPED = (window.GEO && window.GEO.unmapped) || [];
  const FIELDS = ['topic', 'region', 'type', 'level', 'year', 'country'];
  const FIELD_NAMES = { topic: 'Topic', region: 'Region', type: 'Type', level: 'Level', year: 'Year', country: 'Country' };
  const ALL_LABEL = { topic: 'All topics', region: 'All regions', type: 'Both types', level: 'All levels', year: 'All years' };
  const PAGE = 20;

  const filters = Object.fromEntries(FIELDS.map((f) => [f, new Set()]));
  let terms = [];
  let markRe = null;
  let shown = PAGE;
  let current = RECORDS;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('en');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const label = (field, value) => (T.labels[field] && T.labels[field][value]) || value;
  const isActive = (field, value) => Boolean(filters[field] && filters[field].has(value));
  const realCountry = (c) => c && !UNMAPPED.includes(c);
  const isYear = (y) => /^\d{4}$/.test(y);
  // 'Gender Based Violence' and 'Gender-Based Violence' count as the same name
  const simple = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

  // one lowercase string per record, so search doesn't rebuild it on every key press
  const haystack = RECORDS.map((r) => [
    r.country, r.place, r.topic, r.program, r.division, r.details, r.impact, r.role, r.partners, r.year,
    label('region', r.region), label('level', r.level), label('type', r.type)
  ].join(' ').toLowerCase());

  function matches(r, i) {
    for (const f of FIELDS) {
      if (filters[f].size && !filters[f].has(r[f])) return false;
    }
    return terms.every((w) => haystack[i].includes(w));
  }

  // newest first; records without a year go last
  function byDate(a, b) {
    const ya = isYear(a.year) ? +a.year : 0;
    const yb = isYear(b.year) ? +b.year : 0;
    return yb - ya || a.country.localeCompare(b.country) || a.place.localeCompare(b.place);
  }

  function highlight(text) {
    if (!markRe) return esc(text);
    return String(text).split(markRe).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
  }

  // ---------- filter controls ----------

  function fillSelects() {
    const counts = Object.fromEntries(FIELDS.map((f) => [f, new Map()]));
    for (const r of RECORDS) {
      for (const f of FIELDS) counts[f].set(r[f], (counts[f].get(r[f]) || 0) + 1);
    }
    const order = {
      topic: (a, b) => a.localeCompare(b),
      region: (a, b) => counts.region.get(b) - counts.region.get(a),
      type: (a, b) => a.localeCompare(b),
      level: (a, b) => T.levelOrder.indexOf(a) - T.levelOrder.indexOf(b),
      year: (a, b) => (isYear(b) ? +b : 0) - (isYear(a) ? +a : 0)
    };
    document.querySelectorAll('.filter-row select').forEach((select) => {
      const field = select.dataset.field;
      select.add(new Option(ALL_LABEL[field], ''));
      [...counts[field].keys()].sort(order[field]).forEach((value) => {
        select.add(new Option(`${label(field, value)} (${fmt(counts[field].get(value))})`, value));
      });
      select.addEventListener('change', () => {
        if (select.value === '__multi') return;
        filters[field].clear();
        if (select.value) filters[field].add(select.value);
        refresh();
      });
    });
  }

  // a select shows its single value, "All", or how many values the charts selected
  function syncSelects() {
    document.querySelectorAll('.filter-row select').forEach((select) => {
      const set = filters[select.dataset.field];
      let multi = select.querySelector('option[value="__multi"]');
      if (set.size > 1) {
        if (!multi) {
          multi = new Option('', '__multi');
          multi.disabled = true;
          select.add(multi, 1);
        }
        multi.textContent = `${set.size} selected`;
        select.value = '__multi';
      } else {
        if (multi) multi.remove();
        select.value = set.size ? [...set][0] : '';
      }
    });
  }

  function toggle(field, value) {
    if (!filters[field]) return;
    if (filters[field].has(value)) filters[field].delete(value);
    else filters[field].add(value);
    refresh();
  }

  function clearAll() {
    FIELDS.forEach((f) => filters[f].clear());
    $('search').value = '';
    setSearch('');
    refresh();
  }

  function setSearch(text) {
    terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    markRe = terms.length ? new RegExp(`(${terms.map(escRe).join('|')})`, 'gi') : null;
  }

  function renderChips() {
    const chips = [];
    for (const f of FIELDS) {
      for (const value of filters[f]) {
        chips.push(`<span class="chip"><span class="chip-field">${FIELD_NAMES[f]}:</span> ${esc(label(f, value))}` +
          `<button type="button" data-field="${f}" data-value="${esc(value)}" aria-label="Remove ${FIELD_NAMES[f].toLowerCase()} filter ${esc(label(f, value))}">&times;</button></span>`);
      }
    }
    if (terms.length) {
      chips.push(`<span class="chip"><span class="chip-field">Search:</span> &ldquo;${esc($('search').value.trim())}&rdquo;` +
        '<button type="button" data-field="search" aria-label="Clear the search">&times;</button></span>');
    }
    if (chips.length) chips.push('<button type="button" class="chip-clear" data-clear>Clear all</button>');
    $('chips').innerHTML = chips.join('');
  }

  // ---------- headline numbers and records ----------

  function renderKpis(rows) {
    const policy = rows.filter((r) => r.type === 'Policy Impact').length;
    const countries = new Set(rows.map((r) => r.country).filter(realCountry)).size;
    const years = rows.map((r) => r.year).filter(isYear).sort();
    const span = !years.length ? '&ndash;'
      : years[0] === years[years.length - 1] ? years[0] : `${years[0]}&ndash;${years[years.length - 1]}`;
    const swatch = (color) => `<span class="swatch" style="background:${color}" aria-hidden="true"></span>`;
    const kpi = (value, text) => `<div class="kpi"><span class="kpi-value">${value}</span><span class="kpi-label">${text}</span></div>`;
    $('kpis').innerHTML = [
      kpi(fmt(rows.length), rows.length === 1 ? 'Record' : 'Records'),
      kpi(swatch(T.type['Policy Impact']) + fmt(policy), 'Policy changes'),
      kpi(swatch(T.type['Systems/Practice Impact']) + fmt(rows.length - policy), 'Systems or practice changes'),
      kpi(fmt(countries), countries === 1 ? 'Country' : 'Countries'),
      kpi(span, 'Years covered')
    ].join('');
  }

  function recordHtml(r) {
    const where = r.place && r.place !== r.country ? `${r.place}, ${r.country}` : r.country;
    const extra = [
      ['Impact', r.impact],
      ["Vital Strategies' role", r.role],
      ['Partners', r.partners]
    ].filter(([, text]) => text);
    const more = extra.length
      ? `<details><summary>Impact, role and partners</summary><dl>${extra.map(([dt, dd]) => `<dt>${dt}</dt><dd>${highlight(dd)}</dd>`).join('')}</dl></details>`
      : '';
    return `<li class="record">
      <div class="record-meta">
        <span class="record-year">${isYear(r.year) ? r.year : 'Year not recorded'}</span>
        <span class="record-place">${highlight(where)}</span>
        <span>${esc(label('level', r.level))} &middot; ${esc(label('region', r.region))}</span>
      </div>
      <div class="record-body">
        <div class="record-tags">
          <span class="tag" style="--tag:${T.topic[r.topic] || T.muted}">${esc(r.topic)}</span>
          <span class="tag" style="--tag:${T.type[r.type] || T.muted}">${esc(label('type', r.type))}</span>
          ${r.program && simple(r.program) !== simple(r.topic) ? `<span>${esc(r.program)}</span>` : ''}
        </div>
        <p class="record-text">${highlight(r.details || 'No description recorded.')}</p>
        ${more}
      </div>
    </li>`;
  }

  function renderList(rows) {
    const visible = rows.slice(0, shown);
    $('records-count').textContent = rows.length ? `Showing ${fmt(visible.length)} of ${fmt(rows.length)}` : '';
    $('record-list').innerHTML = rows.length
      ? visible.map(recordHtml).join('')
      : '<li class="empty">No records match these filters. <button type="button" class="chip-clear" data-clear>Clear all filters</button></li>';
    $('more').hidden = visible.length >= rows.length;
    $('more').textContent = `Show ${fmt(Math.min(PAGE, rows.length - visible.length))} more`;
  }

  // ---------- refresh everything after a change ----------

  function safely(fn) {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }

  function refresh(keepPage) {
    if (!keepPage) shown = PAGE;
    current = RECORDS.filter(matches).sort(byDate);
    syncSelects();
    renderChips();
    renderKpis(current);
    renderList(current);
    const view = { isActive };
    if (window.MapView) safely(() => window.MapView.update(current, view));
    if (window.Charts) safely(() => window.Charts.update(current, view));
  }

  function init() {
    const countries = new Set(RECORDS.map((r) => r.country).filter(realCountry)).size;
    const years = RECORDS.map((r) => r.year).filter(isYear).sort();
    $('lede').textContent = `${fmt(RECORDS.length)} policy and systems changes in ${fmt(countries)} countries, ` +
      `recorded from ${years[0]} to ${years[years.length - 1]}. Filter by topic, place, year or level of government.`;

    fillSelects();
    let timer = 0;
    $('search').addEventListener('input', (event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setSearch(event.target.value);
        refresh();
      }, 150);
    });
    $('more').addEventListener('click', () => {
      shown += PAGE;
      renderList(current);
    });
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-clear], #chips button[data-field]');
      if (!target) return;
      if (target.hasAttribute('data-clear')) {
        clearAll();
      } else if (target.dataset.field === 'search') {
        $('search').value = '';
        setSearch('');
        refresh();
      } else {
        filters[target.dataset.field].delete(target.dataset.value);
        refresh();
      }
    });

    const opts = { onToggle: toggle };
    if (window.MapView) safely(() => window.MapView.init($('map'), opts));
    if (window.Charts) {
      safely(() => window.Charts.init({
        years: $('chart-years'),
        topics: $('chart-topics'),
        regions: $('chart-regions'),
        levels: $('chart-levels')
      }, opts));
    }
    refresh();
  }

  init();
})();
