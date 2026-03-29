(function() {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var city = script.getAttribute('data-city') || '';
  var state = script.getAttribute('data-state') || '';
  var service = script.getAttribute('data-service') || 'roofing';
  var theme = script.getAttribute('data-theme') || 'light';

  var isDark = theme === 'dark';
  var bg = isDark ? '#1e293b' : '#ffffff';
  var border = isDark ? '#334155' : '#e2e8f0';
  var textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  var textSecondary = isDark ? '#94a3b8' : '#64748b';
  var brand = isDark ? '#3b82f6' : '#1d4ed8';
  var rowBorder = isDark ? '#334155' : '#f1f5f9';
  var skeletonBg = isDark ? '#334155' : '#e2e8f0';
  var skeletonShine = isDark ? '#475569' : '#f1f5f9';
  var trackBg = isDark ? '#334155' : '#e2e8f0';

  var serviceLabels = {
    roofing: 'Roof Replacement',
    hvac: 'HVAC Replacement',
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    windows: 'Window Replacement',
    siding: 'Siding Installation',
    painting: 'House Painting',
    solar: 'Solar Installation',
    'garage-doors': 'Garage Door',
    fencing: 'Fence Installation',
    concrete: 'Concrete Work',
    landscaping: 'Landscaping',
    foundation: 'Foundation Repair',
    kitchen: 'Kitchen Remodel',
    insulation: 'Insulation'
  };

  function fmt(n) {
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
    '.tp-range { margin:16px 0 4px; position:relative; }',
    '.tp-range-labels { display:flex; justify-content:space-between; font-size:20px; font-weight:700; color:' + textPrimary + '; margin-bottom:8px; }',
    '.tp-range-track { height:6px; border-radius:3px; background:' + trackBg + '; position:relative; overflow:hidden; }',
    '.tp-range-fill { position:absolute; top:0; left:0; right:0; bottom:0; border-radius:3px; background:linear-gradient(90deg,#16a34a,#eab308,#dc2626); }',
    '.tp-range-note { font-size:12px; color:' + textSecondary + '; margin-top:6px; }',
    '.tp-materials { margin:16px 0; }',
    '.tp-material { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid ' + rowBorder + '; font-size:14px; }',
    '.tp-material:last-child { border-bottom:none; }',
    '.tp-material-name { color:' + textPrimary + '; }',
    '.tp-material-price { color:' + textSecondary + '; font-weight:600; font-variant-numeric:tabular-nums; }',
    '.tp-footer { display:flex; justify-content:space-between; align-items:center; margin-top:16px; flex-wrap:wrap; gap:8px; }',
    '.tp-cta { font-size:14px; font-weight:600; color:' + brand + '; text-decoration:none; }',
    '.tp-cta:hover { text-decoration:underline; }',
    '.tp-powered { font-size:11px; color:#94a3b8; text-decoration:none; }',
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
    '<div class="tp-skel tp-skel-row"></div>',
    '</div>',
    '<div class="tp-skel tp-skel-link" style="margin-top:16px"></div>'
  ].join('');

  var url = 'https://truepricehq.com/api/widget-data?city=' +
    encodeURIComponent(city) + '&state=' + encodeURIComponent(state) +
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

  function render(data) {
    var label = data.serviceLabel || serviceLabels[service] || service;
    var displayCity = data.city || city;
    var displayState = data.state || state;
    var low = data.overallLow;
    var high = data.overallHigh;
    var note = data.referenceSize ? 'for a typical ' + data.referenceSize : '';
    var materials = data.materials || [];
    var cityUrl = data.cityPageUrl || 'https://truepricehq.com';

    var html = [];
    html.push('<div class="tp-header">');
    html.push('<div class="tp-logo">TP</div>');
    html.push('<div>');
    html.push('<div class="tp-title">' + esc(label) + ' Cost</div>');
    html.push('<div class="tp-subtitle">in ' + esc(displayCity) + ', ' + esc(displayState) + '</div>');
    html.push('</div></div>');

    html.push('<div class="tp-range">');
    html.push('<div class="tp-range-labels"><span>' + fmt(low) + '</span><span>' + fmt(high) + '</span></div>');
    html.push('<div class="tp-range-track"><div class="tp-range-fill"></div></div>');
    if (note) html.push('<div class="tp-range-note">' + esc(note) + '</div>');
    html.push('</div>');

    if (materials.length) {
      html.push('<div class="tp-materials">');
      for (var i = 0; i < materials.length; i++) {
        var m = materials[i];
        html.push('<div class="tp-material">');
        html.push('<span class="tp-material-name">' + esc(m.label) + '</span>');
        html.push('<span class="tp-material-price">' + fmt(m.low) + ' - ' + fmt(m.high) + '</span>');
        html.push('</div>');
      }
      html.push('</div>');
    }

    html.push('<div class="tp-footer">');
    html.push('<a class="tp-cta" href="' + esc(cityUrl) + '" target="_blank" rel="noopener">View full pricing in ' + esc(displayCity) + ' &rarr;</a>');
    html.push('<a class="tp-powered" href="https://truepricehq.com" target="_blank" rel="noopener">powered by TruePrice</a>');
    html.push('</div>');

    card.innerHTML = html.join('');
  }

  function renderError() {
    card.innerHTML = [
      '<div class="tp-error">',
      '<div class="tp-error-text">Pricing data unavailable</div>',
      '<a class="tp-cta" href="https://truepricehq.com" target="_blank" rel="noopener">Visit TruePrice &rarr;</a>',
      '</div>'
    ].join('');
  }

  function esc(s) {
    var el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
  }
})();
