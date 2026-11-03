/* Vilar - home.js */
(function () {
  var t = I18N.t, pick = I18N.pick, esc = UI.esc;

  function fill(sectionId, gridId, list) {
    var sec = document.getElementById(sectionId);
    if (!list.length) return;
    document.getElementById(gridId).innerHTML = list.slice(0, 8).map(UI.productCard).join('');
    sec.hidden = false;
  }

  function renderHero(h) {
    h = h || {};
    var title = h['title_' + I18N.lang], sub = h['subtitle_' + I18N.lang];
    if (title) document.getElementById('hero-title').textContent = title;
    if (sub) document.getElementById('hero-sub').textContent = sub;
    var img = UI.safeUrl(h.image_url);
    if (img) {
      document.getElementById('hero-art').innerHTML =
        '<img src="' + esc(img) + '" alt="Vilar" width="800" height="1000" fetchpriority="high">';
    }
  }

  function renderCategories(cats, products) {
    var withProducts = cats.filter(function (c) {
      return products.some(function (p) { return p.categories && p.categories.slug === c.slug; });
    });
    if (!withProducts.length) return;
    document.getElementById('cat-grid').innerHTML = withProducts.map(function (c) {
      var img = UI.safeUrl(c.image_url), name = pick(c, 'name');
      return '<a class="cat" href="shop.html?cat=' + encodeURIComponent(c.slug) + '">' +
        '<div class="cat-img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" width="300" height="400">'
                                      : '<span aria-hidden="true">' + esc(name.charAt(0)) + '</span>') + '</div>' +
        '<span class="cat-name">' + esc(name) + '</span></a>';
    }).join('');
    document.getElementById('sec-cats').hidden = false;
  }

  function renderReviews(list) {
    if (!list.length) return;
    document.getElementById('review-list').innerHTML = list.map(function (r) {
      var n = Math.max(1, Math.min(5, r.rating | 0));
      return '<figure class="review" style="margin:0"><div class="stars" role="img" aria-label="' + n + '/5">' +
        '★★★★★'.slice(0, n) + '<span style="color:var(--sand)">' + '★★★★★'.slice(n) + '</span></div>' +
        '<p>' + esc(r.body) + '</p><figcaption><b>' + esc(r.author) + '</b></figcaption></figure>';
    }).join('');
    document.getElementById('sec-reviews').hidden = false;
  }

  function initNewsletter() {
    var form = document.getElementById('nl-form'), msg = document.getElementById('nl-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim().toLowerCase();
      msg.className = 'nl-msg';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
        msg.textContent = t('nl_err'); msg.classList.add('err'); return;
      }
      if (!window.VILAR_CONFIGURED) { msg.textContent = t('nl_fail'); msg.classList.add('err'); return; }
      var btn = form.querySelector('button'); btn.disabled = true;
      sb.from('newsletter_subscribers').insert({ email: email }).then(function (r) {
        btn.disabled = false;
        // 23505 = déjà inscrit : on répond positivement sans révéler l'état
        if (!r.error || r.error.code === '23505') {
          msg.textContent = t('nl_ok'); msg.classList.add('ok'); form.reset();
        } else { msg.textContent = t('nl_fail'); msg.classList.add('err'); }
      });
    });
  }

  UI.init().then(function () {
    initNewsletter();
    if (!window.VILAR_CONFIGURED) return;
    ['grid-new', 'grid-best', 'grid-sale'].forEach(function (id) {
      document.getElementById(id).innerHTML = UI.skeletons(4);
    });
    return Promise.all([
      UI.settings(),
      sb.from('categories').select('*').eq('is_active', true).order('sort_order'),
      UI.fetchProducts(),
      sb.from('reviews').select('author,rating,body').eq('is_visible', true).order('created_at', { ascending: false }).limit(6)
    ]).then(function (res) {
      var s = res[0], cats = res[1].data || [], products = res[2], reviews = res[3].data || [];
      renderHero(s.hero);
      renderCategories(cats, products);
      fill('sec-new', 'grid-new', products.filter(function (p) { return p.is_new; }));
      fill('sec-best', 'grid-best', products.filter(function (p) { return p.is_bestseller; }));
      fill('sec-sale', 'grid-sale', products.filter(function (p) { return p.sale_price != null; }));
      renderReviews(reviews);
      if (!products.length) document.getElementById('empty-home').hidden = false;
    }).catch(function () { UI.notice('err_load'); })
      .then(function () {
        // Retire les squelettes des sections restées vides
        ['grid-new', 'grid-best', 'grid-sale'].forEach(function (id) {
          var g = document.getElementById(id);
          if (g.querySelector('.skeleton')) g.innerHTML = '';
        });
      });
  });
})();
