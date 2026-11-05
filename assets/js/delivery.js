/* Vilar admin - delivery.js */
(function () {
  var A = Admin, esc = A.esc;
  var zones = [], dirty = {};
  var rowsEl = document.getElementById('rows');

  function render() {
    rowsEl.innerHTML = zones.map(function (z) {
      return '<tr data-code="' + z.wilaya_code + '"><td>' + String(z.wilaya_code).padStart(2, '0') + '</td><td>' + esc(z.name_fr) + '</td>' +
        '<td><input class="field sm" type="number" min="0" step="1" data-f="home_fee" value="' + z.home_fee + '" dir="ltr" aria-label="سعر المنزل"></td>' +
        '<td><input class="field sm" type="number" min="0" step="1" data-f="desk_fee" value="' + z.desk_fee + '" dir="ltr" aria-label="سعر المكتب"></td>' +
        '<td><input type="checkbox" data-f="is_active"' + (z.is_active ? ' checked' : '') + ' aria-label="مفعّلة" style="width:18px;height:18px"></td></tr>';
    }).join('');
  }
  function mark(z) { dirty[z.wilaya_code] = true; }

  rowsEl.addEventListener('input', function (e) {
    var f = e.target.dataset.f; if (!f) return;
    var z = zones.find(function (x) { return x.wilaya_code === +e.target.closest('tr').dataset.code; });
    z[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    mark(z);
  });

  function setAll(fn) { zones.forEach(function (z) { fn(z); mark(z); }); render(); }
  function num(id) { var v = parseFloat(document.getElementById(id).value); return isFinite(v) && v >= 0 ? v : null; }

  document.getElementById('apply-all').addEventListener('click', function () {
    var h = num('all-home'), d = num('all-desk');
    if (h === null && d === null) { A.toast('أدخل سعراً واحداً على الأقل.', true); return; }
    setAll(function (z) { if (h !== null) z.home_fee = h; if (d !== null) z.desk_fee = d; });
  });
  document.getElementById('on-all').addEventListener('click', function () { setAll(function (z) { z.is_active = true; }); });
  document.getElementById('off-all').addEventListener('click', function () { setAll(function (z) { z.is_active = false; }); });

  document.getElementById('save').addEventListener('click', function () {
    var btn = this, rows = zones.filter(function (z) { return dirty[z.wilaya_code]; });
    if (!rows.length) { A.toast('لا توجد تغييرات.'); return; }
    var bad = rows.some(function (z) {
      return !(Number(z.home_fee) >= 0) || !(Number(z.desk_fee) >= 0) || z.home_fee === '' || z.desk_fee === '';
    });
    if (bad) { A.toast('الأسعار يجب أن تكون أرقاماً ≥ 0.', true); return; }
    btn.disabled = true;
    sb.from('delivery_zones').upsert(rows.map(function (z) {
      return { wilaya_code: z.wilaya_code, name_fr: z.name_fr, home_fee: Number(z.home_fee), desk_fee: Number(z.desk_fee), is_active: !!z.is_active };
    })).then(function (r) {
      btn.disabled = false;
      if (r.error) { A.toast(A.errText(r.error), true); return; }
      dirty = {}; A.toast('تم الحفظ.');
    });
  });

  A.init('delivery').then(function () {
    sb.from('delivery_zones').select('*').order('wilaya_code').then(function (r) {
      if (r.error) { A.toast(A.errText(r.error), true); return; }
      zones = r.data || []; render();
    });
  });
})();
