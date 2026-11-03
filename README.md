# Vilar - المرحلة 1: قاعدة البيانات

## خطوات التشغيل

1. أنشئ مشروعاً جديداً في [Supabase](https://supabase.com).
2. افتح **SQL Editor** ونفّذ الملفات **بهذا الترتيب** (كل ملف على حدة):
   1. `supabase/01_schema.sql`
   2. `supabase/02_functions.sql`
   3. `supabase/03_policies.sql`
   4. `supabase/04_storage.sql`
   5. `supabase/05_seed.sql`
3. أنشئ حساب المدير: **Authentication → Users → Add user** (بريدك وكلمة مرور قوية).
4. اجعله مديراً (نفّذ في SQL Editor مع تغيير البريد):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'your-email@example.com';
```

5. **Authentication → Providers → Email**: عطّل التسجيل الذاتي (Disable sign ups) حتى لا يُنشئ أحد حساباً.
6. من **Project Settings → API** احتفظ بـ `Project URL` و `anon public key` فقط (سنضعهما في `assets/js/config.js` في المرحلة 2). لا تستعمل `service_role` في أي ملف أمامي.

## ما يجب ضبطه قبل استقبال الطلبات

- من جدول `delivery_zones`: ضع أسعار التوصيل (`home_fee`, `desk_fee`) وفعّل (`is_active = true`) الولايات التي تغطيها. حالياً كلها معطّلة. لوحة الإدارة ستتيح ذلك في المرحلة 4.

## ملاحظات

- الطلبات لا تُنشأ إلا عبر `create_order(jsonb)`: الأسعار تُحسب من قاعدة البيانات، والمخزون يُخصم ذرياً، والتكرار مرفوض (مفتاح `idempotency_key` + نفس الهاتف والمنتج خلال 10 دقائق، وحد 5 طلبات/ساعة/هاتف).
- أكواد الأخطاء التي تعيدها الدالة: `INVALID_NAME`, `INVALID_PHONE`, `INVALID_COMMUNE`, `INVALID_ADDRESS`, `INVALID_WILAYA`, `INVALID_ITEMS`, `INVALID_QTY`, `VARIANT_NOT_FOUND`, `OUT_OF_STOCK`, `TOO_MANY_ORDERS`.
- حالات الطلب في قاعدة البيانات: `new`, `pending_confirmation`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`, `returned` (تُعرض بالفرنسية في الواجهة).
- عند تحويل الطلب إلى `cancelled` أو `returned` يعود المخزون تلقائياً.

---

# المرحلة 2: واجهة المتجر

## الملفات الجديدة
- `supabase/06_newsletter.sql`: جدول النشرة البريدية (إدراج فقط للزوار) وإعداد `hero`. نفّذه بعد الملفات الخمسة الأولى.
- `index.html`, `shop.html`, `product.html`, `cart.html` و `assets/` (CSS وJS).

## التشغيل
1. نفّذ `06_newsletter.sql` في Supabase.
2. افتح `assets/js/config.js` وضع `SUPABASE_URL` و`SUPABASE_ANON_KEY` (من Project Settings → API، المفتاح العام فقط).
3. للتجربة محلياً من مجلد المشروع: `python3 -m http.server 8000` ثم افتح `http://localhost:8000`.
4. للنشر: ارفع المجلد إلى مستودع GitHub وفعّل GitHub Pages.

## ملاحظات
- المتجر يقرأ كل شيء من قاعدة البيانات. قبل إضافة المنتجات من لوحة الإدارة (المرحلة 4) تظهر الصفحات فارغة وهذا طبيعي. للاختبار المبكر يمكنك إدخال منتج من Table Editor في Supabase.
- الرابط «إتمام الطلب» يشير إلى `checkout.html` التي تُبنى في المرحلة 3.
- اللغة: الزر في الترويسة يبدّل بين العربية (RTL) والفرنسية، ويُحفظ الاختيار في المتصفح.
- روابط السياسات (التوصيل، الاستبدال، الخصوصية) تُضاف في المرحلة 6 بنصوصك أنت.

---

# المرحلة 3: إتمام الطلب

## الملفات الجديدة
- `checkout.html` و`assets/js/checkout.js`: نموذج الطلب (الاسم، الهاتف، الولاية، البلدية، العنوان، طريقة التوصيل، ملاحظات).
- `thank-you.html`: صفحة تأكيد مع رقم الطلب.
- تحديثات في `i18n.js` و`ui.js` و`styles.css`.

## قبل التجربة: فعّل الولايات
كل الولايات معطّلة افتراضياً. لتجربة الطلب نفّذ في SQL Editor (الأسعار مجرد أمثلة، عدّلها لاحقاً):

```sql
update public.delivery_zones set home_fee = 600, desk_fee = 400, is_active = true;
```

## كيف تتأكد أن الطلب وصل
من Supabase: **Table Editor → orders** و**order_items**. ستجد الطلب برقم `VL-1001` والمجموع والمصدر، ولاحظ أن مخزون المقاس نقص في `product_variants`.

---

# المرحلة 4: لوحة الإدارة

## الملفات الجديدة
- `supabase/07_admin.sql`: دالة إحصائيات اللوحة (للمدير فقط). **نفّذه في SQL Editor.**
- مجلد `admin/` كاملاً: `login.html` و`index.html` (الإحصائيات) و`orders.html` و`invoice.html` و`products.html` و`product-edit.html` و`categories.html` و`delivery.html` + `admin/css` و`admin/js`.

## الدخول
افتح `admin/login.html` بالبريد وكلمة المرور التي أنشأتها في Supabase (Authentication → Users) وأضفتها إلى جدول `admins`.

## الترتيب المقترح للبدء
1. **التوصيل**: ضع أسعار الولايات وفعّل ما تغطيه.
2. **التصنيفات**: عدّل الأسماء أو أضف صورة لكل تصنيف.
3. **المنتجات**: أضف منتجاً، احفظه، ثم ارفع صوره (تُضغط تلقائياً).
4. **الطلبات**: اضغط على أي طلب لرؤية تفاصيله وتغيير حالته وطباعة الفاتورة. «تصدير إلى Excel» يصدّر النتائج الحالية بعد الفلاتر.
