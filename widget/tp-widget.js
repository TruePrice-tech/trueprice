(function() {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var city = script.getAttribute('data-city') || '';
  var state = script.getAttribute('data-state') || '';
  var service = script.getAttribute('data-service') || 'roofing';
  var theme = script.getAttribute('data-theme') || 'light';
  var autoDetect = script.getAttribute('data-auto') === 'true';

  var isDark = theme === 'dark';
  var bg = isDark ? '#1e293b' : '#ffffff';
  var border = isDark ? '#334155' : '#e2e8f0';
  var textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  var textSecondary = isDark ? '#94a3b8' : '#64748b';
  var brand = isDark ? '#3b82f6' : '#1d4ed8';
  var rowBorder = isDark ? '#334155' : '#f1f5f9';
  var trackBg = isDark ? '#334155' : '#e2e8f0';
  var skeletonBg = isDark ? '#334155' : '#e2e8f0';
  var btnBg = isDark ? '#334155' : '#f1f5f9';
  var btnHover = isDark ? '#475569' : '#e2e8f0';

  function fmt(n) {
    if (typeof n === 'string') return n;
    return '$' + Number(n).toLocaleString('en-US');
  }

  var container = document.createElement('div');
  container.className = 'tp-widget-container';
  script.parentNode.insertBefore(container, script.nextSibling);

  var shadow = container.attachShadow({ mode: 'closed' });

  var styles = document.createElement('style');
  styles.textContent = [
    '@keyframes tp-pulse { 0%,100%{ opacity:.6 } 50%{ opacity:.3 } }',
    ':host { display:block; max-width:380px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; }',
    '.tp-card { background:' + bg + '; border:1px solid ' + border + '; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1); padding:20px; box-sizing:border-box; }',
    '.tp-header { display:flex; align-items:flex-start; gap:10px; margin-bottom:16px; }',
    '.tp-logo { font-weight:800; font-size:16px; color:' + brand + '; flex-shrink:0; line-height:1.3; }',
    '.tp-title { font-size:17px; font-weight:700; color:' + textPrimary + '; line-height:1.3; margin:0; }',
    '.tp-subtitle { font-size:14px; color:' + textSecondary + '; margin:2px 0 0; }',
    '.tp-highlight { text-align:center; margin:16px 0; padding:16px; background:' + (isDark ? '#1a2744' : '#f0f7ff') + '; border-radius:10px; }',
    '.tp-highlight-label { font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:' + textSecondary + '; margin-bottom:4px; }',
    '.tp-highlight-price { font-size:28px; font-weight:800; color:' + textPrimary + '; }',
    '.tp-highlight-range { font-size:13px; color:' + textSecondary + '; margin-top:4px; }',
    '.tp-highlight-note { font-size:12px; color:' + textSecondary + '; margin-top:6px; }',
    '.tp-materials { margin:16px 0; }',
    '.tp-material { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid ' + rowBorder + '; font-size:14px; }',
    '.tp-material:last-child { border-bottom:none; }',
    '.tp-material-name { color:' + textPrimary + '; }',
    '.tp-material-price { color:' + textSecondary + '; font-weight:600; font-variant-numeric:tabular-nums; }',
    '.tp-show-more { display:block; width:100%; padding:8px; border:1px solid ' + border + '; border-radius:8px; background:' + btnBg + '; color:' + textSecondary + '; font-size:13px; font-weight:600; cursor:pointer; text-align:center; font-family:inherit; transition:background 0.15s; }',
    '.tp-show-more:hover { background:' + btnHover + '; }',
    '.tp-hidden { display:none; }',
    '.tp-footer { display:flex; flex-direction:column; gap:8px; margin-top:16px; }',
    '.tp-cta-primary { display:block; text-align:center; padding:10px 16px; background:' + brand + '; color:#fff; border-radius:8px; font-size:14px; font-weight:700; text-decoration:none; transition:opacity 0.15s; }',
    '.tp-cta-primary:hover { opacity:0.9; text-decoration:none; }',
    '.tp-footer-row { display:flex; justify-content:space-between; align-items:center; }',
    '.tp-cta { font-size:13px; font-weight:600; color:' + brand + '; text-decoration:none; }',
    '.tp-cta:hover { text-decoration:underline; }',
    '.tp-powered { font-size:11px; color:#94a3b8; text-decoration:none; display:inline-flex; align-items:center; gap:4px; }',
    '.tp-powered:hover { text-decoration:underline; }',
    '.tp-error { text-align:center; padding:12px 0; }',
    '.tp-error-text { font-size:14px; color:' + textSecondary + '; margin-bottom:8px; }',
    '.tp-skel { border-radius:4px; background:' + skeletonBg + '; animation:tp-pulse 1.5s ease-in-out infinite; }',
    '.tp-skel-title { width:70%; height:18px; margin-bottom:6px; }',
    '.tp-skel-sub { width:40%; height:14px; margin-bottom:20px; }',
    '.tp-skel-bar { width:100%; height:6px; margin-bottom:6px; }',
    '.tp-skel-range { display:flex; justify-content:space-between; margin-bottom:20px; }',
    '.tp-skel-price { width:30%; height:20px; }',
    '.tp-skel-row { width:100%; height:14px; margin-bottom:12px; }',
    '.tp-skel-link { width:50%; height:14px; margin-top:8px; }'
  ].join('\n');
  shadow.appendChild(styles);

  var card = document.createElement('div');
  card.className = 'tp-card';
  shadow.appendChild(card);

  // Loading skeleton
  card.innerHTML = [
    '<div class="tp-header"><div class="tp-logo">TP</div><div><div class="tp-skel tp-skel-title"></div><div class="tp-skel tp-skel-sub"></div></div></div>',
    '<div class="tp-skel-range"><div class="tp-skel tp-skel-price"></div><div class="tp-skel tp-skel-price"></div></div>',
    '<div class="tp-skel tp-skel-bar"></div>',
    '<div style="margin-top:16px">',
    '<div class="tp-skel tp-skel-row"></div>',
    '<div class="tp-skel tp-skel-row"></div>',
    '<div class="tp-skel tp-skel-row"></div>',
    '</div>',
    '<div class="tp-skel tp-skel-link" style="margin-top:16px"></div>'
  ].join('');

  function loadWidget(resolvedCity, resolvedState) {
    var url = 'https://truepricehq.com/api/widget-data?city=' +
      encodeURIComponent(resolvedCity) + '&state=' + encodeURIComponent(resolvedState) +
      '&service=' + encodeURIComponent(service);

    fetch(url).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(data) {
      if (data.error) throw new Error(data.error);
      render(data);
    }).catch(function() {
      renderError();
    });
  }

  // Geo auto-detect or use provided city/state
  if (autoDetect && !city) {
    fetch('https://ipapi.co/json/').then(function(r) { return r.json(); }).then(function(geo) {
      city = geo.city || city || 'Dallas';
      state = geo.region_code || state || 'TX';
      loadWidget(city, state);
    }).catch(function() {
      city = city || 'Dallas';
      state = state || 'TX';
      loadWidget(city, state);
    });
  } else {
    loadWidget(city || 'Dallas', state || 'TX');
  }

  function render(data) {
    var label = data.serviceLabel || service;
    var displayCity = data.city || city;
    var displayState = data.state || state;
    var materials = data.materials || [];
    var cityUrl = data.cityPageUrl || 'https://truepricehq.com';
    var analyzerUrl = data.analyzerUrl || 'https://truepricehq.com/analyze-quote.html';
    var isHourly = data.isHourly || false;
    var note = data.referenceSize ? 'for a typical ' + data.referenceSize : '';

    // Compute "most common" price (median material mid-point)
    var mids = materials.map(function(m) {
      var low = typeof m.low === 'number' ? m.low : 0;
      var high = typeof m.high === 'number' ? m.high : (typeof m.high === 'string' ? parseInt(m.high) : 0);
      return (low + high) / 2;
    }).filter(function(v) { return v > 0; }).sort(function(a, b) { return a - b; });
    var mostCommon = mids.length > 2 ? mids[Math.floor(mids.length / 2)] : (mids.length ? mids[0] : 0);
    // Round to nearest 100
    mostCommon = Math.round(mostCommon / 100) * 100;

    var MAX_VISIBLE = 4;
    var hasMore = materials.length > MAX_VISIBLE;

    var html = [];
    html.push('<div class="tp-header">');
    html.push('<img src="https://truepricehq.com/images/trudy-peeking.png" alt="Trudy" width="32" height="32" style="flex-shrink:0;" onerror="this.style.display=\'none\'" />');
    html.push('<div>');
    html.push('<div class="tp-logo">TruePrice</div>');
    html.push('<div class="tp-title">' + esc(label) + ' Cost</div>');
    html.push('<div class="tp-subtitle">in ' + esc(displayCity) + ', ' + esc(displayState) + '</div>');
    html.push('</div></div>');

    // Most common price highlight
    if (mostCommon > 0 && !isHourly) {
      html.push('<div class="tp-highlight">');
      html.push('<div class="tp-highlight-label">Most common price</div>');
      html.push('<div class="tp-highlight-price">' + fmt(mostCommon) + '</div>');
      html.push('<div class="tp-highlight-range">Range: ' + fmt(data.overallLow) + ' &ndash; ' + fmt(data.overallHigh) + '</div>');
      if (note) html.push('<div class="tp-highlight-note">' + esc(note) + '</div>');
      html.push('</div>');
    } else if (isHourly) {
      html.push('<div class="tp-highlight">');
      html.push('<div class="tp-highlight-label">Typical hourly rate</div>');
      html.push('<div class="tp-highlight-price">' + fmt(data.overallLow) + ' &ndash; ' + fmt(data.overallHigh) + '/hr</div>');
      html.push('<div class="tp-highlight-note">Varies by practice area, firm size, and region</div>');
      html.push('</div>');
    }

    // Materials list (show top MAX_VISIBLE, hide rest)
    if (materials.length) {
      html.push('<div class="tp-materials">');
      for (var i = 0; i < materials.length; i++) {
        var m = materials[i];
        var hiddenClass = i >= MAX_VISIBLE ? ' tp-hidden tp-extra-row' : '';
        html.push('<div class="tp-material' + hiddenClass + '">');
        html.push('<span class="tp-material-name">' + esc(m.label) + '</span>');
        var priceStr = typeof m.high === 'string' ? fmt(m.low) + ' &ndash; ' + esc(String(m.high))
          : fmt(m.low) + ' &ndash; ' + fmt(m.high);
        html.push('<span class="tp-material-price">' + priceStr + '</span>');
        html.push('</div>');
      }
      html.push('</div>');
      if (hasMore) {
        html.push('<button class="tp-show-more" data-state="collapsed">Show all ' + materials.length + ' options</button>');
      }
    }

    // Footer with CTAs
    html.push('<div class="tp-footer">');
    html.push('<a class="tp-cta-primary" href="' + esc(analyzerUrl) + '" target="_blank" rel="noopener">Check your quote free &rarr;</a>');
    html.push('<div class="tp-footer-row">');
    html.push('<a class="tp-cta" href="' + esc(cityUrl) + '" target="_blank" rel="noopener">Full pricing details &rarr;</a>');
    html.push('<a class="tp-powered" href="https://truepricehq.com/widget.html" target="_blank" rel="noopener"><img src="https://truepricehq.com/images/trudy-peeking.png" alt="" width="14" height="14" onerror="this.style.display=\'none\'" /> by TruePrice</a>');
    html.push('</div>');
    html.push('</div>');

    card.innerHTML = html.join('');

    // Show more toggle
    var btn = card.querySelector('.tp-show-more');
    if (btn) {
      btn.addEventListener('click', function() {
        var rows = card.querySelectorAll('.tp-extra-row');
        var collapsed = btn.getAttribute('data-state') === 'collapsed';
        for (var j = 0; j < rows.length; j++) {
          rows[j].classList.toggle('tp-hidden', !collapsed);
        }
        btn.textContent = collapsed ? 'Show less' : 'Show all ' + materials.length + ' options';
        btn.setAttribute('data-state', collapsed ? 'expanded' : 'collapsed');
      });
    }
  }

  function renderError() {
    card.innerHTML = [
      '<div class="tp-error">',
      '<div class="tp-error-text">Pricing data unavailable</div>',
      '<a class="tp-cta-primary" href="https://truepricehq.com" target="_blank" rel="noopener">Visit TruePrice &rarr;</a>',
      '</div>'
    ].join('');
  }

  function esc(s) {
    var el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
  }
})();
