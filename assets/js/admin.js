/* Vilar admin - admin.js : garde d'authentification, menu, utilitaires */
(function () {
  var STATUS = {
    new: 'Nouvelle commande', pending_confirmation: 'Confirmation en attente', confirmed: 'Confirmée',
    preparing: 'En préparation', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', returned: 'Retour'
  };
  var NAV = [
    ['index', 'index.html', 'الإحصائيات'],
    ['orders', 'orders.html', 'الطلبات'],
    ['products', 'products.html', 'المنتجات'],
    ['landing', 'landing-pages.html', 'صفحات الهبوط'],
    ['categories', 'categories.html', 'التصنيفات'],
    ['delivery', 'delivery.html', 'التوصيل']
  ];
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return nf.format(Math.round(Number(n) || 0)).replace(/\u202f|\u00a0/g, ' ') + ' د.ج'; }
  function fmtDate(d) {
    return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
  function statusPill(s) {
    return '<span class="pill st-' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>';
  }
  function slugify(s) {
    var r = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return r || ('item-' + Math.random().toString(36).slice(2, 8));
  }
  function uuid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // Redimensionne et convertit en WebP (JPEG si WebP indisponible)
  function resizeImage(file, max) {
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, (max || 1400) / Math.max(bmp.width, bmp.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      return new Promise(function (res) {
        cv.toBlob(function (b) {
          if (b && b.type === 'image/webp') res(b); else cv.toBlob(function (j) { res(j); }, 'image/jpeg', 0.85);
        }, 'image/webp', 0.82);
      });
    });
  }

  var toastTimer;
  function toast(msg, isErr) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 3200);
  }

  function layout(active, email) {
    var side = document.getElementById('side'), top = document.getElementById('top');
    side.className = 'side';
    side.innerHTML = '<a class="brand" href="index.html">Vilar</a><nav>' +
      NAV.map(function (n) {
        return '<a href="' + n[1] + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + n[2] + '</a>';
      }).join('') + '<a href="../index.html" target="_blank" rel="noopener">عرض المتجر ↗</a></nav>';
    top.className = 'top';
    top.innerHTML = '<button class="btn ghost sm menu-btn" type="button" aria-label="القائمة">☰</button>' +
      '<span class="who" dir="ltr">' + esc(email || '') + '</span>' +
      '<button class="btn ghost sm" type="button" id="logout">تسجيل الخروج</button>';
    top.querySelector('.menu-btn').addEventListener('click', function () { side.classList.toggle('open'); });
    document.getElementById('logout').addEventListener('click', function () {
      sb.auth.signOut().then(function () { location.href = 'login.html'; });
    });
  }

  // Vérifie la session ET l'appartenance à la table admins. Redirige sinon.
  function init(active) {
    var app = document.getElementById('app');
    if (!window.VILAR_CONFIGURED) {
      if (app) app.innerHTML = '<div class="card">املأ ملف <code>assets/js/config.js</code> برابط Supabase والمفتاح العام.</div>';
      return new Promise(function () {});
    }
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { location.replace('login.html'); return new Promise(function () {}); }
      return sb.rpc('is_admin').then(function (a) {
        if (a.error || a.data !== true) {
          return sb.auth.signOut().then(function () { location.replace('login.html?e=1'); return new Promise(function () {}); });
        }
        if (active) layout(active, s.user.email);
        return s.user;
      });
    });
  }

  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (/duplicate key|23505/.test(m)) return 'القيمة مستعملة مسبقاً (تكرار).';
    if (/violates check|23514/.test(m)) return 'قيمة غير صالحة.';
    if (/row-level security|42501|FORBIDDEN/.test(m)) return 'لا تملك صلاحية هذه العملية.';
    return m || 'حدث خطأ.';
  }

  window.Admin = { STATUS: STATUS, esc: esc, money: money, fmtDate: fmtDate, statusPill: statusPill,
                   slugify: slugify, uuid: uuid, resizeImage: resizeImage, toast: toast, init: init, errText: errText };
})();
