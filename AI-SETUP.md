# تشغيل المساعد الذكي (مرة وحدة بس)

المساعد بيحتاج مفتاح من Anthropic. المفتاح بينحط بـ Supabase، وما بيوصل أبدًا عالتلفون أو الكمبيوتر.

## 1. اعمل مفتاح Anthropic
1. افتح console.anthropic.com وسجّل حساب.
2. روح على Billing وحط بطاقة واشحن رصيد صغير (مثلا 5$).
3. روح على API Keys.
4. اكبس Create Key.
5. سمّيه MADI.
6. انسخ المفتاح (بيبلش بـ sk-ant-). ما تبعتو لحدا.

## 2. حط المفتاح بـ Supabase
1. افتح مشروعك بـ supabase.com.
2. من القائمة الشمال اكبس Edge Functions.
3. اكبس Secrets.
4. بخانة Name اكتب: ANTHROPIC_API_KEY
5. بخانة Value الصق المفتاح.
6. اكبس Save.

## 3. انشر دالة المساعد
1. بـ Edge Functions اكبس Deploy a new function.
2. اختار Via Editor.
3. سمّي الدالة: ai
4. امحي الكود يلي موجود.
5. الصق كل الكود من الملف supabase/functions/ai/index.ts.
6. اكبس Deploy function.
7. خلّي خيار Verify JWT شغّال.

## 4. جرّب
1. افتح التطبيق وسجّل دخول.
2. روح على المساعد الذكي.
3. اكتب: ارسملي طاولة 3 متر ب 80 عرض فيها جرن 50 ب 40
