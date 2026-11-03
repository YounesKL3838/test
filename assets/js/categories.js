/* Vilar admin - categories.js */
(function () {
  var A = Admin, esc = A.esc;
  var $ = function (id) { return document.getElementById(id); };
  var MARK = '/storage/v1/object/public/site/';
  var cats = [], editing = null, imageUrl = '', slugTouched = false;
  var dlg = $('dlg');

  function storagePath(url) {
    var i = String(url || '').indexOf(MARK);
    return i === -1 ? null : decodeURIComponent(String(url).slice(i + MARK.length));
  }

  function render() {
    $('rows').innerHTML = cats.length ? cats.map(function (c) {
      return '<tr data-id="' + esc(c.id) + '"><td>' + (c.image_url ? '<img class="thumb" src="' + esc(c.image_url) + '" alt="">' : '<div class="thumb"></div>') + '</td>' +
        '<td><b>' + esc(c.name_ar) + '</b><div class="muted" dir="ltr" style="text-align:start">' + esc(c.name_fr) + '</div></td>' +
        '<td>' + c.sort_order + '</td><td>' + (c.is_active ? '✓' : '—') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn ghost sm" type="button" data-act="edit">تعديل</button> ' +
        '<button class="btn danger sm" type="button" data-act="del">حذف</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">لا توجد تصنيفات.</td></tr>';
  }
  function load() {
    return sb.from('categories').select('*').order('sort_order').then(function (r) {
      if (r.error) throw r.error; cats = r.data || []; render();
    });
  }

  function showImage() {
    $('c-img').hidden = !imageUrl; if (imageUrl) $('c-img').src = imageUrl;
    $('c-clear').hidden = !imageUrl;
  }
  function openForm(c) {
    editing = c || null; slugTouched = !!c; imageUrl = (c && c.image_url) || '';
    $('d-title').textContent = c ? 'تعديل التصنيف' : 'تصنيف جديد';
    $('name_ar').value = c ? c.name_ar : ''; $('name_fr').value = c ? c.name_fr : '';
    $('slug').value = c ? c.slug : ''; $('sort_order').value = c ? c.sort_order : cats.length + 1;
    $('is_active').checked = c ? c.is_active : true;
    $('msg').textContent = ''; $('c-msg').textContent = ''; showImage();
    dlg.showModal();
  }

  $('add').addEventListener('click', function () { openForm(null); });
  $('d-close').addEventListener('click', function () { dlg.close(); });
  $('name_fr').addEventListener('input', function () { if (!slugTouched) $('slug').value = A.slugify($('name_fr').value); });
  $('slug').addEventListener('input', function () { slugTouched = true; });

  $('rows').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var id = b.closest('tr').dataset.id, c = cats.find(function (x) { return x.id === id; });
    if (b.dataset.act === 'edit') return openForm(c);
    if (!confirm('حذف التصنيف «' + c.name_ar + '»؟ ستبقى المنتجات لكن بدون تصنيف.')) return;
    var p = storagePath(c.image_url);
    (p ? sb.storage.from('site').remove([p]) : Promise.resolve())
      .then(function () { return sb.from('categories').delete().eq('id', id); })
      .then(function (r) { if (r.error) throw r.error; return load(); })
      .then(function () { A.toast('تم الحذف.'); })
      .catch(function (err) { A.toast(A.errText(err), true); });
  });

  /* ----- image ----- */
  function resize(file) {
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
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
  $('c-pick').addEventListener('click', function () { $('c-file').click(); });
  $('c-clear').addEventListener('click', function () { imageUrl = ''; showImage(); });
  $('c-file').addEventListener('change', function () {
    var f = this.files[0], input = this; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 20 * 1024 * 1024) { A.toast('ملف غير صالح.', true); input.value = ''; return; }
    $('c-msg').textContent = 'جاري الرفع…';
    resize(f).then(function (blob) {
      var path = 'categories/' + A.uuid() + (blob.type === 'image/webp' ? '.webp' : '.jpg');
      return sb.storage.from('site').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' }).then(function (u) {
        if (u.error) throw u.error;
        imageUrl = sb.storage.from('site').getPublicUrl(path).data.publicUrl; showImage();
      });
    }).catch(function (e) { A.toast(A.errText(e), true); })
      .then(function () { $('c-msg').textContent = ''; input.value = ''; });
  });

  /* ----- save ----- */
  $('cform').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('msg'); msg.className = 'msg'; msg.textContent = '';
    var row = {
      name_ar: $('name_ar').value.trim(), name_fr: $('name_fr').value.trim(),
      slug: $('slug').value.trim().toLowerCase(), sort_order: parseInt($('sort_order').value, 10) || 0,
      is_active: $('is_active').checked, image_url: imageUrl || null
    };
    if (!row.name_ar || !row.name_fr) { msg.className = 'msg err'; msg.textContent = 'الاسمان مطلوبان.'; return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug)) { msg.className = 'msg err'; msg.textContent = 'الرابط: أحرف لاتينية صغيرة وأرقام وشرطات.'; return; }
    var btn = $('save'); btn.disabled = true;
    var req = editing ? sb.from('categories').update(row).eq('id', editing.id) : sb.from('categories').insert(row);
    req.then(function (r) {
      if (r.error) throw r.error;
      dlg.close(); return load();
    }).then(function () { A.toast('تم الحفظ.'); })
      .catch(function (err) { msg.className = 'msg err'; msg.textContent = A.errText(err); })
      .then(function () { btn.disabled = false; });
  });

  A.init('categories').then(function () { return load(); }).catch(function (e) { A.toast(A.errText(e), true); });
})();
