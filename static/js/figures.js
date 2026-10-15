// Interactive results figures for the SADGE page.
// Data: static/data/sadge.json, exported from the paper repository's tables
// (benchmark_variants.csv, calibration.json, scalars_heldout*.json) with the
// same definitions as the paper's figure script. Plain SVG, no libraries.
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var KIND_COLOR = { sadge: '#2e8b57', structure: '#d62728', appearance: '#3a6ea5' };
  var KIND_NAME = { sadge: 'SADGE (fitted)', structure: 'structure-oriented', appearance: 'appearance-oriented' };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, text, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmt(v, d) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 3 : d); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(ms, step) {
    if (reduceMotion || !(ms > 0)) { step(1); return; }
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / ms);
      step(ease(t));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function chips(parent, label, items, initial, onPick) {
    var row = html('div', 'chip-row', null, parent);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    html('span', 'chip-label', label, row);
    var buttons = items.map(function (it) {
      var b = html('button', 'chip', it.label, row);
      b.type = 'button';
      b.setAttribute('aria-pressed', it.id === initial ? 'true' : 'false');
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(it.id);
      });
      return b;
    });
  }

  function tooltip(card) {
    var t = html('div', 'viz-tooltip', null, card);
    t.setAttribute('role', 'status');
    return {
      show: function (content, evt) {
        t.innerHTML = content;
        t.classList.add('is-on');
        var box = card.getBoundingClientRect();
        var x = evt.clientX - box.left + 14, y = evt.clientY - box.top + 14;
        var w = t.offsetWidth, h = t.offsetHeight;
        if (x + w > box.width - 8) x = evt.clientX - box.left - w - 14;
        if (y + h > box.height - 8) y = evt.clientY - box.top - h - 14;
        t.style.left = Math.max(8, x) + 'px';
        t.style.top = Math.max(8, y) + 'px';
      },
      hide: function () { t.classList.remove('is-on'); }
    };
  }

  function legend(parent, keys) {
    var lg = html('div', 'viz-legend', null, parent);
    keys.forEach(function (k) {
      var key = html('span', 'key', null, lg);
      var sw = html('span', 'swatch' + (k.shape ? ' ' + k.shape : ''), null, key);
      if (k.shape === 'line' || k.shape === 'dash') sw.style.borderColor = k.color;
      else sw.style.background = k.color;
      html('span', null, k.label, key);
    });
    return lg;
  }

  // ---------------------------------------------------------------- ranking
  function ranking(card, data, W) {
    var metrics = Object.keys(data.panels[0].scores);
    var narrow = W < 560;
    var labelW = narrow ? 132 : 170, right = 50, top = 26, rowH = 30, barH = 20;
    var state = card._state || (card._state = { panel: 'all' });
    var H = top + metrics.length * rowH + 6;
    var lo = -0.3, hi = 1.0;
    function X(v) { return labelW + (v - lo) / (hi - lo) * (W - labelW - right); }

    chips(card, 'Benchmark', data.panels.map(function (p) {
      return { id: p.id, label: p.id === 'all' ? 'All 21 (Pearson r)' : p.id === 'all-rank' ? 'All 21 (Spearman ρ)' : p.label };
    }), state.panel, function (id) { state.panel = id; update(id); });

    var svg = el('svg', { class: 'viz-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' }, card);
    var title = el('title', {}, svg);
    (narrow ? [0, 0.5, 1.0] : [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0]).forEach(function (v) {
      el('line', { class: v === 0 ? 'zero-line' : 'grid-line', x1: X(v), x2: X(v), y1: top - 6, y2: H }, svg);
      el('text', { class: 'tick-label', x: X(v), y: top - 12, 'text-anchor': 'middle' }, svg).textContent = fmt(v, 1);
    });
    var tip = tooltip(card);
    var rows = {};
    metrics.forEach(function (m) {
      var g = el('g', { class: 'row' }, svg);
      var kind = data.kind[m];
      var label = el('text', { class: 'row-label' + (kind === 'sadge' ? ' is-ours' : ''), x: labelW - 10, y: rowH / 2 + 4, 'text-anchor': 'end' }, g);
      label.textContent = narrow && m === 'SuperPoint+LightGlue' ? 'SuperPoint+LG' : m;
      var bar = el('rect', { class: 'bar', y: (rowH - barH) / 2, height: barH, rx: 4, fill: KIND_COLOR[kind] }, g);
      var val = el('text', { class: 'value-label', y: rowH / 2 + 4 }, g);
      var hit = el('rect', { class: 'hit', x: 0, y: 0, width: W, height: rowH }, g);
      rows[m] = { g: g, bar: bar, val: val, v: 0, rank: 0 };
      hit.addEventListener('mousemove', function (e) {
        var r = rows[m];
        tip.show('<strong>' + m + '</strong> · ' + KIND_NAME[kind] + '<br>' + current.statName + ' = ' + fmt(r.v) +
          ' · rank ' + (r.rank + 1) + ' of ' + metrics.length, e);
        metrics.forEach(function (o) { rows[o].bar.style.opacity = o === m ? 1 : 0.45; });
      });
      hit.addEventListener('mouseleave', function () {
        tip.hide();
        metrics.forEach(function (o) { rows[o].bar.style.opacity = 1; });
      });
    });

    legend(card, [
      { color: KIND_COLOR.sadge, label: 'SADGE (fitted on all 21 variants)' },
      { color: KIND_COLOR.structure, label: 'Structure-oriented metric' },
      { color: KIND_COLOR.appearance, label: 'Appearance-oriented metric' }
    ]);
    var insight = html('div', 'viz-insight', null, card);
    insight.setAttribute('aria-live', 'polite');
    html('div', 'viz-note',
      'Standalone metrics are unfitted. SADGE uses the coefficients fitted on all 21 variants, so its bar is in-sample in every panel; the held-out results are below. LPIPS and FID are sign-flipped so that higher means more similar.', card);
    var details = html('details', 'viz-table-toggle', null, card);
    html('summary', null, 'Show as a table', details);
    var table = html('table', 'table is-narrow is-striped', null, details);

    var current = null, drawnOnce = false;
    function update(id) {
      var p = data.panels.filter(function (q) { return q.id === id; })[0];
      var statName = p.stat === 'rho' ? 'Spearman ρ' : 'Pearson r';
      current = { statName: statName };
      var order = metrics.slice().sort(function (a, b) { return p.scores[b] - p.scores[a]; });
      title.textContent = statName + ' with downstream performance, ' + p.label + ': ' +
        order.map(function (m) { return m + ' ' + fmt(p.scores[m]); }).join(', ');
      var from = {};
      metrics.forEach(function (m) { from[m] = rows[m].v; });
      order.forEach(function (m, i) {
        rows[m].rank = i;
        rows[m].g.style.transform = 'translateY(' + (top + i * rowH) + 'px)';
      });
      // the first draw is immediate; only switching panels animates
      tween(drawnOnce ? 450 : 0, function (t) {
        metrics.forEach(function (m) {
          var v = from[m] + (p.scores[m] - from[m]) * t;
          rows[m].v = v;
          var x0 = X(0), x1 = X(v);
          rows[m].bar.setAttribute('x', Math.min(x0, x1));
          rows[m].bar.setAttribute('width', Math.max(1, Math.abs(x1 - x0)));
          rows[m].val.setAttribute('x', v >= 0 ? x1 + 6 : x1 - 6);
          rows[m].val.setAttribute('text-anchor', v >= 0 ? 'start' : 'end');
          rows[m].val.textContent = fmt(v);
        });
      });
      drawnOnce = true;
      var best = order.filter(function (m) { return data.kind[m] !== 'sadge'; })[0];
      insight.innerHTML = 'Strongest standalone metric here: <strong>' + best + '</strong> (' + KIND_NAME[data.kind[best]] +
        ', ' + statName + ' = ' + fmt(p.scores[best]) + '). Switch panels to watch it change.';
      table.innerHTML = '<thead><tr><th>Metric</th><th>Kind</th><th>' + statName + '</th></tr></thead><tbody>' +
        order.map(function (m) { return '<tr><td>' + m + '</td><td>' + KIND_NAME[data.kind[m]] + '</td><td>' + fmt(p.scores[m]) + '</td></tr>'; }).join('') +
        '</tbody>';
    }
    update(state.panel);
  }

  // ---------------------------------------------------------------- scatter
  function scatter(card, data, W) {
    var narrow = W < 560;
    var H = narrow ? 330 : 400, L = 58, R = 18, T = 18, B = 46;
    var AXES = {
      sadge: { label: 'SADGE score', name: 'SADGE' },
      mast3r: { label: 'MASt3R log-inliers', name: 'MASt3R' },
      dinov3: { label: 'DINOv3 similarity', name: 'DINOv3' }
    };
    var families = [];
    data.points.forEach(function (p) { if (families.indexOf(p.family) < 0) families.push(p.family); });
    var state = card._state || (card._state = { x: 'sadge', fam: 'all' });

    chips(card, 'x-axis', Object.keys(AXES).map(function (k) { return { id: k, label: AXES[k].name }; }), state.x,
      function (id) { state.x = id; draw(true); });
    chips(card, 'Highlight', [{ id: 'all', label: 'None' }].concat(families.map(function (f) { return { id: f, label: f }; })), state.fam,
      function (id) { state.fam = id; style(); });

    var svg = el('svg', { class: 'viz-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' }, card);
    var title = el('title', {}, svg);
    var ylo = 25, yhi = 85;
    function Y(v) { return T + (yhi - v) / (yhi - ylo) * (H - T - B); }
    [30, 40, 50, 60, 70, 80].forEach(function (v) {
      el('line', { class: 'grid-line', x1: L, x2: W - R, y1: Y(v), y2: Y(v) }, svg);
      el('text', { class: 'tick-label', x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v;
    });
    var ylab = el('text', { x: 14, y: (T + H - B) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (T + H - B) / 2 + ')' }, svg);
    ylab.textContent = narrow ? 'Downstream score' : 'Downstream score (each benchmark’s own metric)';
    var xticks = el('g', {}, svg);
    var xlab = el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle' }, svg);
    var fit = el('line', { stroke: '#64748b', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, svg);
    var rlab = el('text', { x: L + 10, y: T + 14, class: 'value-label' }, svg);
    var tip = tooltip(card);
    var dots = data.points.map(function (p) {
      var c = el('circle', { r: 6.5, stroke: '#ffffff', 'stroke-width': 2 }, svg);
      var hit = el('circle', { r: 13, class: 'hit' }, svg);
      hit.addEventListener('mousemove', function (e) {
        tip.show('<strong>' + p.family + ' · ' + p.variant.replace(/_/g, ' ') + '</strong><br>' + p.task + ', ' + p.metric + ' ' + p.y +
          '<br>' + AXES[state.x].name + ' ' + fmt(p[state.x], 2), e);
        c.setAttribute('r', 8.5);
      });
      hit.addEventListener('mouseleave', function () { tip.hide(); c.setAttribute('r', state.fam === p.family ? 8 : 6.5); });
      return { p: p, c: c, hit: hit, x: null };
    });
    var insight = html('div', 'viz-insight', null, card);
    insight.setAttribute('aria-live', 'polite');
    html('div', 'viz-note',
      'Each point is one synthetic dataset variant. Downstream scores (AP, mIoU or pose recall) come from one published table per family and are pooled as reported, so the pooled r is a descriptive summary; the paper’s supplement gives family-centred readings.', card);

    function stats(xs, ys) {
      var n = xs.length, mx = 0, my = 0;
      for (var i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
      mx /= n; my /= n;
      var sxy = 0, sxx = 0, syy = 0;
      for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
      return { slope: sxy / sxx, icpt: my - sxy / sxx * mx, r: sxy / Math.sqrt(sxx * syy) };
    }
    function style() {
      dots.forEach(function (d) {
        var on = state.fam === 'all' || d.p.family === state.fam;
        d.c.setAttribute('fill', state.fam === 'all' ? '#475569' : on ? '#2563eb' : '#cbd5e1');
        d.c.setAttribute('r', state.fam !== 'all' && on ? 8 : 6.5);
        if (on) svg.appendChild(d.c), svg.appendChild(d.hit);
      });
      if (state.fam === 'all') insight.innerHTML = summary();
      else {
        var fp = data.points.filter(function (p) { return p.family === state.fam; });
        insight.innerHTML = summary() + ' <strong>' + state.fam + '</strong>: ' + fp.length + ' variant' + (fp.length > 1 ? 's' : '') +
          ', ' + fp[0].task + ' (' + fp[0].metric + ').';
      }
    }
    function summary() {
      var s = stats(data.points.map(function (p) { return p[state.x]; }), data.points.map(function (p) { return p.y; }));
      return AXES[state.x].name + ' against downstream performance: Pearson <strong>r = ' + fmt(s.r) + '</strong> over all 21 variants.';
    }
    function draw(animate) {
      var xs = data.points.map(function (p) { return p[state.x]; });
      var mn = Math.min.apply(null, xs), mxv = Math.max.apply(null, xs), pad = (mxv - mn) * 0.07;
      var xlo = mn - pad, xhi = mxv + pad;
      function X(v) { return L + (v - xlo) / (xhi - xlo) * (W - L - R); }
      while (xticks.firstChild) xticks.removeChild(xticks.firstChild);
      var step = niceStep((xhi - xlo) / (narrow ? 4 : 6));
      for (var v = Math.ceil(xlo / step) * step; v <= xhi + 1e-9; v += step) {
        el('line', { class: 'grid-line', x1: X(v), x2: X(v), y1: T, y2: H - B }, xticks);
        el('text', { class: 'tick-label', x: X(v), y: H - B + 18, 'text-anchor': 'middle' }, xticks).textContent = fmt(v, step < 0.1 ? 2 : step < 1 ? 1 : 0);
      }
      svg.insertBefore(xticks, svg.firstChild.nextSibling);
      xlab.textContent = AXES[state.x].label;
      var s = stats(xs, data.points.map(function (p) { return p.y; }));
      rlab.textContent = 'r = ' + fmt(s.r);
      title.textContent = AXES[state.x].name + ' against downstream score for 21 variants, Pearson r = ' + fmt(s.r);
      var targets = dots.map(function (d) { return { x: X(d.p[state.x]), y: Y(d.p.y) }; });
      var starts = dots.map(function (d, i) { return d.x === null || !animate ? targets[i] : { x: d.x, y: targets[i].y }; });
      var fx0 = X(xlo), fx1 = X(xhi);
      fit.setAttribute('x1', fx0); fit.setAttribute('x2', fx1);
      fit.setAttribute('y1', Y(s.icpt + s.slope * xlo)); fit.setAttribute('y2', Y(s.icpt + s.slope * xhi));
      tween(animate ? 500 : 0, function (t) {
        dots.forEach(function (d, i) {
          var x = starts[i].x + (targets[i].x - starts[i].x) * t;
          d.x = x;
          d.c.setAttribute('cx', x); d.c.setAttribute('cy', targets[i].y);
          d.hit.setAttribute('cx', x); d.hit.setAttribute('cy', targets[i].y);
        });
      });
      style();
    }
    function niceStep(raw) {
      var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
      return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
    }
    draw(false);
  }

  // ---------------------------------------------------------------- held-out
  function heldout(card, data, W) {
    var narrow = W < 560;
    var H = narrow ? 300 : 360, L = 56, R = narrow ? 96 : 120, T = 18, B = 46;
    var state = card._state || (card._state = { mode: 'variant' });
    var MODES = {
      variant: { rows: data.heldout_variant, key: 'm', label: 'Calibration variants m (of 21)', unit: 'calibration variants', lo: 0.3, hi: 0.9 },
      family: { rows: data.heldout_family, key: 'f', label: 'Calibration families f (of 7)', unit: 'calibration families', lo: -0.8, hi: 1.0 }
    };
    chips(card, 'Calibrate on', [{ id: 'variant', label: 'Random variants' }, { id: 'family', label: 'Whole families' }], state.mode,
      function (id) { state.mode = id; draw(id); });
    var svg = el('svg', { class: 'viz-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' }, card);
    var title = el('title', {}, svg);
    var layer = el('g', {}, svg);
    var tip = tooltip(card);
    legend(card, [
      { color: KIND_COLOR.sadge, label: 'SADGE, median over splits', shape: 'line' },
      { color: 'rgba(46,139,87,0.22)', label: 'SADGE, middle 50% of splits' },
      { color: '#64748b', label: 'SADGE, worst split', shape: 'dot' },
      { color: KIND_COLOR.appearance, label: 'LPIPS (unfitted)', shape: 'dash' },
      { color: KIND_COLOR.structure, label: 'log LoFTR (unfitted)', shape: 'dash' }
    ]);
    var insight = html('div', 'viz-insight', null, card);
    insight.setAttribute('aria-live', 'polite');
    html('div', 'viz-note',
      'Coefficients and normalization are refitted on the calibration set and scored on the held-out rest; the DINOv3 + MASt3R component pair stays fixed. Random variants: 2,000 draws per m. Whole families: every subset of f of the 7 families.', card);

    function draw(mode) {
      var M = MODES[mode], rows = M.rows, key = M.key;
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      var xs = rows.map(function (r) { return r[key]; });
      var x0 = xs[0], x1 = xs[xs.length - 1];
      function X(v) { return L + (v - x0) / (x1 - x0) * (W - L - R); }
      function Y(v) { return T + (M.hi - v) / (M.hi - M.lo) * (H - T - B); }
      var step = mode === 'family' ? 0.4 : 0.1;
      for (var v = Math.ceil(M.lo / step) * step; v <= M.hi + 1e-9; v += step) {
        var vv = Math.round(v * 10) / 10;
        el('line', { class: Math.abs(vv) < 1e-9 ? 'zero-line' : 'grid-line', x1: L, x2: W - R, y1: Y(vv), y2: Y(vv) }, layer);
        el('text', { class: 'tick-label', x: L - 8, y: Y(vv) + 4, 'text-anchor': 'end' }, layer).textContent = fmt(vv, 1);
      }
      xs.forEach(function (x) {
        el('text', { class: 'tick-label', x: X(x), y: H - B + 18, 'text-anchor': 'middle' }, layer).textContent = x;
      });
      el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle' }, layer).textContent = M.label;
      var yl = el('text', { x: 14, y: (T + H - B) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (T + H - B) / 2 + ')' }, layer);
      yl.textContent = 'Held-out Pearson r';
      // in-sample reference; end labels are nudged apart when they would collide
      var last = rows[rows.length - 1];
      var yIn = Y(data.in_sample_r) + 4, ySad = Y(last.median) + 4;
      if (Math.abs(yIn - ySad) < 15) {
        var mid = (yIn + ySad) / 2, up = yIn <= ySad;
        yIn = mid + (up ? -8 : 8); ySad = mid + (up ? 8 : -8);
      }
      el('line', { class: 'ref-line', x1: L, x2: W - R, y1: Y(data.in_sample_r), y2: Y(data.in_sample_r) }, layer);
      el('text', { class: 'ref-label', x: W - R + 8, y: yIn }, layer).textContent = 'in-sample ' + fmt(data.in_sample_r);
      // band
      var band = rows.map(function (r) { return X(r[key]) + ',' + Y(r.q75); }).concat(
        rows.slice().reverse().map(function (r) { return X(r[key]) + ',' + Y(r.q25); }));
      el('polygon', { points: band.join(' '), fill: 'rgba(46,139,87,0.16)' }, layer);
      function line(field, color, dash, width) {
        el('polyline', { points: rows.map(function (r) { return X(r[key]) + ',' + Y(r[field]); }).join(' '), fill: 'none',
          stroke: color, 'stroke-width': width || 2, 'stroke-dasharray': dash || 'none', 'stroke-linejoin': 'round' }, layer);
      }
      line('lpips', KIND_COLOR.appearance, '7 5');
      line('loftr', KIND_COLOR.structure, '7 5');
      line('median', KIND_COLOR.sadge, null, 3);
      rows.forEach(function (r) {
        el('circle', { cx: X(r[key]), cy: Y(r.median), r: 5, fill: KIND_COLOR.sadge, stroke: '#ffffff', 'stroke-width': 2 }, layer);
        if (r.min != null) el('circle', { cx: X(r[key]), cy: Y(r.min), r: 4.5, fill: '#64748b', stroke: '#ffffff', 'stroke-width': 2 }, layer);
      });
      el('text', { class: 'ref-label', x: W - R + 8, y: ySad, style: 'fill:' + KIND_COLOR.sadge + ';font-weight:600' }, layer).textContent = 'SADGE ' + fmt(last.median);
      // crosshair
      var cross = el('line', { x1: 0, x2: 0, y1: T, y2: H - B, stroke: '#94a3b8', 'stroke-width': 1, opacity: 0 }, layer);
      var hit = el('rect', { class: 'hit', x: L - 20, y: T, width: W - L - R + 40, height: H - T - B }, layer);
      hit.addEventListener('mousemove', function (e) {
        var box = svg.getBoundingClientRect();
        var sx = (e.clientX - box.left) / box.width * W;
        var r = rows.reduce(function (a, b) { return Math.abs(X(b[key]) - sx) < Math.abs(X(a[key]) - sx) ? b : a; });
        cross.setAttribute('x1', X(r[key])); cross.setAttribute('x2', X(r[key])); cross.setAttribute('opacity', 1);
        var s = '<strong>' + r[key] + ' ' + M.unit + '</strong><br>SADGE median ' + fmt(r.median) + ' (middle 50%: ' + fmt(r.q25) + ' to ' + fmt(r.q75) + ')';
        if (r.min != null) s += '<br>Worst split ' + fmt(r.min) + ' · ' + r.splits + ' splits';
        s += '<br>LPIPS ' + fmt(r.lpips) + ' · log LoFTR ' + fmt(r.loftr);
        tip.show(s, e);
      });
      hit.addEventListener('mouseleave', function () { tip.hide(); cross.setAttribute('opacity', 0); });

      var first = rows[0];
      title.textContent = 'Held-out SADGE correlation by number of ' + M.unit + ': median from ' + fmt(first.median) + ' to ' + fmt(last.median);
      if (mode === 'variant') {
        var from = null;
        for (var i = rows.length - 1; i >= 0; i--) {
          if (rows[i].median > Math.max(rows[i].lpips, rows[i].loftr)) from = rows[i].m; else break;
        }
        insight.innerHTML = 'Fitted on a few random variants and scored on the rest, SADGE’s median held-out r beats the strongest unfitted metric from <strong>' +
          from + ' calibration variants</strong> on, rising to ' + fmt(last.median) + ' at ' + last.m + '.';
      } else {
        var worst = Math.min.apply(null, rows.map(function (r) { return r.min; }));
        insight.innerHTML = 'Calibrating on whole families and testing on unseen ones, the median rises from ' + fmt(first.median) + ' (' + first.f +
          ' families) to <strong>' + fmt(last.median) + '</strong> (' + last.f + '), but some splits go negative (worst ' + fmt(worst) +
          '): which families you calibrate on matters.';
      }
    }
    draw(state.mode);
  }

  // Charts are drawn in CSS pixels at the card's width, so text keeps its size
  // on a phone; a resize redraws them with the same selection.
  function mount(card, chart, data) {
    var head = Array.prototype.slice.call(card.children, 0, 2), drawn = 0, timer = null;
    function render() {
      var cs = getComputedStyle(card);
      var w = Math.floor(card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
      if (Math.abs(w - drawn) < 2) return;
      drawn = w;
      Array.prototype.slice.call(card.children).forEach(function (n) { if (head.indexOf(n) < 0) card.removeChild(n); });
      chart(card, data, Math.max(280, w));
    }
    render();
    // Watch the card itself, not the window: a layout change without a window
    // resize (a viewport switch, a font load, a scrollbar) must redraw too.
    if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(timer); timer = setTimeout(render, 100); }).observe(card);
    else window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(render, 150); });
  }

  function init() {
    var a = document.getElementById('fig-ranking'), b = document.getElementById('fig-scatter'), c = document.getElementById('fig-heldout');
    if (!a && !b && !c) return;
    fetch('static/data/sadge.json').then(function (r) { return r.json(); }).then(function (data) {
      if (a) mount(a, ranking, data);
      if (b) mount(b, scatter, data);
      if (c) mount(c, heldout, data);
    }).catch(function () {
      [a, b, c].forEach(function (n) { if (n) html('p', 'viz-note', 'The interactive figure could not load its data.', n); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
