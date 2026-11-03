/* Vilar - checkout.js : formulaire de commande (paiement à la livraison)
   Le serveur (create_order) revalide tout et recalcule les prix. */
(function () {
  var t = I18N.t, pick = I18N.pick, esc = UI.esc, money = I18N.money;
  var form = document.getElementById('order-form');
  var summaryEl = document.getElementById('summary');
  var zones = [], items = [], hasGone = false, busy = false;

  /* ---------- Utilitaires ---------- */
  function normalizePhone(p) {
    var s = String(p || '').replace(/[\s.\-()]/g, '');
    if (s.indexOf('+213') === 0) s = '0' + s.slice(4);
    else if (s.indexOf('00213') === 0) s = '0' + s.slice(5);
    else if (s.indexOf('213') === 0) s = '0' + s.slice(3);
    return s;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function idemKey() {
    // Une clé par tentative de commande : conservée tant que la commande n'a pas réussi,
    // ainsi un double clic ou un nouvel essai ne crée jamais deux commandes.
    try {
      var k = sessionStorage.getItem('vilar_idem');
      if (!k) { k = uuid(); sessionStorage.setItem('vilar_idem', k); }
      return k;
    } catch (e) { return uuid(); }
  }
  function currentZone() {
    var code = parseInt(form.wilaya.value, 10);
    return zones.find(function (z) { return z.wilaya_code === code; }) || null;
  }
  function dtype() { return form.dtype.value === 'desk' ? 'desk' : 'home'; }
  function fee() {
    var z = currentZone();
    return z ? Number(dtype() === 'desk' ? z.desk_fee : z.home_fee) : null;
  }

  /* ---------- Récapitulatif ---------- */
  function renderSummary() {
    var subtotal = 0;
    var lines = items.map(function (i) {
      subtotal += i.price * i.qty;
      return '<div class="row"><span>' + esc(pick(i, 'name')) + ' <span class="muted">(' + esc(i.size) + ', ' + esc(i.color) + ') × ' + i.qty + '</span></span>' +
        '<b>' + money(i.price * i.qty) + '</b></div>';
    }).join('');
    var f = fee(), feeTxt = f === null ? '—' : (f === 0 ? t('k_free') : money(f));
    var total = subtotal + (f || 0);
    summaryEl.innerHTML = '<h2 style="font-size:1.5rem;margin-bottom:14px">' + esc(t('k_summary')) + '</h2>' + lines +
      '<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">' +
      '<div class="row"><span>' + esc(t('c_sub')) + '</span><b>' + money(subtotal) + '</b></div>' +
      '<div class="row"><span>' + esc(t('k_delivery')) + '</span><b>' + feeTxt + '</b></div>' +
      '<div class="row total"><span>' + esc(t('c_total')) + '</span><span>' + (f === null ? money(subtotal) : money(total)) + '</span></div>' +
      '<p class="muted" style="margin:10px 0 0;font-size:.92rem">' + esc(t('k_cod')) + '</p>';
  }

  /* ---------- Données ---------- */
  function refreshCart() {
    var local = Cart.get();
    if (!local.length) return Promise.resolve([]);
    return sb.from('product_variants')
      .select('id,stock,is_active,products(price,sale_price,is_active)')
      .in('id', local.map(function (i) { return i.variant_id; }))
      .then(function (r) {
        if (r.error) throw r.error;
        var map = {};
        (r.data || []).forEach(function (row) { map[row.id] = row; });
        var ok = [];
        local.forEach(function (i) {
          var row = map[i.variant_id];
          if (!row || !row.is_active || !row.products || !row.products.is_active || row.stock <= 0) { hasGone = true; return; }
          i.price = row.products.sale_price != null ? Number(row.products.sale_price) : Number(row.products.price);
          if (i.qty > row.stock) { i.qty = row.stock; }
          ok.push(i);
        });
        return ok;
      });
  }
  function loadZones() {
    return sb.from('delivery_zones').select('wilaya_code,name_fr,name_ar,home_fee,desk_fee')
      .eq('is_active', true).order('wilaya_code')
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }

  function fillWilayas() {
    form.wilaya.innerHTML = '<option value="">' + esc(t('k_wilaya_ph')) + '</option>' +
      zones.map(function (z) {
        var name = I18N.lang === 'ar' && z.name_ar ? z.name_ar : z.name_fr;
        return '<option value="' + z.wilaya_code + '">' + String(z.wilaya_code).padStart(2, '0') + ' - ' + esc(name) + '</option>';
      }).join('');
  }

  /* ---------- Validation ---------- */
  function setErr(name, key) {
    var el = form.querySelector('.ferr[data-for="' + name + '"]');
    if (el) el.textContent = key ? t(key) : '';
  }
  function validate() {
    var ok = true, first = null;
    function bad(field, key) { setErr(field, key); if (!first) first = form[field]; ok = false; }
    ['fullname', 'phone', 'wilaya', 'commune', 'address'].forEach(function (f) { setErr(f, ''); });
    if (form.fullname.value.trim().length < 2) bad('fullname', 'e_name');
    if (!/^0[567][0-9]{8}$/.test(normalizePhone(form.phone.value))) bad('phone', 'e_phone');
    if (!currentZone()) bad('wilaya', 'e_wilaya');
    if (form.commune.value.trim().length < 2) bad('commune', 'e_commune');
    if (form.address.value.trim().length < 5) bad('address', 'e_address');
    if (first) first.focus();
    return ok;
  }

  function errorKey(err) {
    var m = String((err && (err.message || err.details)) || '');
    if (/INVALID_NAME/.test(m)) return 'e_name';
    if (/INVALID_PHONE/.test(m)) return 'e_phone';
    if (/INVALID_WILAYA/.test(m)) return 'e_wilaya';
    if (/INVALID_COMMUNE/.test(m)) return 'e_commune';
    if (/INVALID_ADDRESS/.test(m)) return 'e_address';
    if (/OUT_OF_STOCK|VARIANT_NOT_FOUND|INVALID_QTY|INVALID_ITEMS/.test(m)) return 'e_stock';
    if (/TOO_MANY_ORDERS/.test(m)) return 'e_many';
    return 'e_generic';
  }

  /* ---------- Envoi ---------- */
  function setBusy(b) {
    busy = b;
    var btn = document.getElementById('submit');
    btn.disabled = b;
    btn.textContent = b ? t('k_sending') : t('k_submit');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;                       // anti double-clic
    var msg = document.getElementById('form-msg');
    msg.textContent = '';
    if (hasGone) { msg.textContent = t('e_stock'); return; }
    if (!validate()) return;
    setBusy(true);

    var utm = null;
    try { utm = JSON.parse(sessionStorage.getItem('vilar_utm') || 'null'); } catch (x) {}

    var payload = {
      idempotency_key: idemKey(),
      name: form.fullname.value.trim(),
      phone: normalizePhone(form.phone.value),
      wilaya_code: currentZone().wilaya_code,
      commune: form.commune.value.trim(),
      address: form.address.value.trim(),
      notes: form.notes.value.trim(),
      delivery_type: dtype(),
      source: 'home',
      utm: utm,
      items: items.map(function (i) { return { variant_id: i.variant_id, qty: i.qty }; })
    };

    sb.rpc('create_order', { p: payload }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {};
      try { sessionStorage.removeItem('vilar_idem'); } catch (x) {}
      Cart.clear();
      location.href = 'thank-you.html?o=' + encodeURIComponent(d.order_number) +
        '&t=' + encodeURIComponent(d.total) + (d.duplicate ? '&d=1' : '');
    }).catch(function (err) {
      setBusy(false);
      var key = errorKey(err);
      msg.textContent = t(key);
      if (key === 'e_stock') {
        msg.innerHTML = esc(t(key)) + ' <a href="cart.html">' + esc(t('go_cart')) + '</a>';
      } else if (/^e_(name|phone|wilaya|commune|address)$/.test(key)) {
        setErr(key === 'e_name' ? 'fullname' : key.slice(2), key);
      }
    });
  });

  form.addEventListener('change', function (e) {
    if (e.target.name === 'wilaya' || e.target.name === 'dtype') renderSummary();
  });

  /* ---------- Démarrage ---------- */
  UI.init().then(function () {
    if (!window.VILAR_CONFIGURED) return;
    return Promise.all([refreshCart(), loadZones()]).then(function (res) {
      items = res[0]; zones = res[1];
      if (!items.length && !hasGone) { location.replace('cart.html'); return; }
      var box = document.getElementById('checkout');
      box.hidden = false;
      if (!zones.length) {
        form.hidden = true;
        summaryEl.innerHTML = '<p>' + esc(t('k_no_zones')) + '</p>';
        return;
      }
      fillWilayas(); renderSummary();
      if (hasGone) {
        document.getElementById('form-msg').innerHTML = esc(t('e_stock')) + ' <a href="cart.html">' + esc(t('go_cart')) + '</a>';
      }
    }).catch(function () { UI.notice('err_load'); });
  });
})();
