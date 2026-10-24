# تشغيل المساعد الذكي (مرة وحدة بس)

المساعد بيحتاج مفتاح. المفتاح بينحط بـ Supabase، وما بيوصل أبدًا عالتلفون أو الكمبيوتر.

الطريقة المجانية: مفتاح Google Gemini. ما بدو بطاقة، بس عندو حد بالدقيقة وباليوم، وGoogle ممكن تستعمل الطلبات لتحسين نماذجها.

## 1. اعمل مفتاح Gemini (مجاني)
1. افتح aistudio.google.com
2. سجّل دخول بحساب Gmail.
3. اكبس Get API key.
4. اكبس Create API key.
5. انسخ المفتاح. ما تبعتو لحدا.

## 2. حط المفتاح بـ Supabase
1. افتح مشروعك بـ supabase.com
2. من القائمة الشمال اكبس Edge Functions.
3. اكبس Secrets.
4. بخانة Name اكتب: GEMINI_API_KEY
5. بخانة Value الصق المفتاح.
6. اكبس Save.

## 3. انشر دالة المساعد
1. بـ Edge Functions اكبس Deploy a new function.
2. اختار Via Editor.
3. سمّي الدالة: ai
4. امحي الكود يلي موجود.
5. الصق كل الكود من الملف supabase/functions/ai/index.ts
6. اكبس Deploy function.
7. خلّي خيار Verify JWT شغّال.

## 4. جرّب
1. افتح التطبيق وسجّل دخول.
2. روح على المساعد الذكي.
3. اكتب: ارسملي طاولة 3 متر ب 80 عرض فيها جرن 50 ب 40

## بعدين، إذا بدك مساعد أقوى (مدفوع)
1. اعمل مفتاح من console.anthropic.com (بدو بطاقة ورصيد).
2. حطّو بـ Supabase Secrets باسم ANTHROPIC_API_KEY
3. ما بدك تغيّر شي تاني. إذا المفتاحين موجودين، بيستعمل Anthropic.

## إذا Gemini قال إنو الحد خلص من أول مرة: زيد مفتاح Groq (مجاني كمان)
1. افتح console.groq.com
2. سجّل دخول بحساب Gmail.
3. اكبس API Keys.
4. اكبس Create API Key.
5. سمّيه MADI.
6. انسخ المفتاح (بيبلش بـ gsk_).
7. بـ Supabase اكبس Edge Functions.
8. اكبس Secrets.
9. بخانة Name اكتب: GROQ_API_KEY
10. بخانة Value الصق المفتاح.
11. اكبس Save.
المساعد بيجرّب Gemini أول، وإذا ما زبط بيروح على Groq لحالو.
