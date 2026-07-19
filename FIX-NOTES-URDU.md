# تشخیصی رپورٹ — Tariq Karyana Store POS

**ورژن:** v1.3.6 (اپ لوڈ شدہ سورس)
**تاریخ:** 18 جولائی 2026

---

## خلاصہ (سب سے پہلے یہ پڑھیں)

آپ کے سورس کوڈ کے اندر پہلے سے ایک `DEBUGGING-REPORT.md` فائل موجود ہے جس میں آپ کے پچھلے ایجنٹ نے دعویٰ کیا تھا کہ اس نے سارے 500 ایررز اور سیو کے مسائل v1.3.5 میں ٹھیک کر دیے تھے۔ میں نے پورا کوڈ پڑھ کر تصدیق کی ہے کہ **وہ ایپلیکیشن لیول کے فکسز واقعی موجود ہیں اور درست ہیں** — یعنی:

- ہر API route (`dashboard`, `daily-closing`, `reports`, `products`, `sales`, `expenses`, `users` وغیرہ) میں `ensureDbReady()` کال ہو رہی ہے، تو ڈیٹا بیس ٹیبلز خود بخود بن جاتے ہیں۔
- `Settings` کی ڈیفالٹ رو خود بخود بن جاتی ہے۔
- Expense میں `expenseTypeId` نہ ہونے پر خودکار "General" ٹائپ بن جاتی ہے۔
- Sale کے invoice number کی ریس کنڈیشن ٹھیک ہے (ٹرانزیکشن کے اندر پڑھا جاتا ہے)۔

**تو پھر مسئلہ ابھی تک کیوں موجود ہے؟**

اصل وجہ کوڈ کے منطق (logic) میں نہیں، بلکہ **بلڈ/پیکجنگ کے عمل میں ایک بہت بڑا خلا (gap)** ہے، جو ہر بار آپ کے ایجنٹ نے سورس کوڈ ٹھیک کیا مگر پھر بھی اصل .exe میں فرق نہیں پڑا۔ نیچے تفصیل ہے۔

---

## اصل جڑ کا مسئلہ (ROOT CAUSE) — Prisma Windows Engine غائب

### مسئلہ کہاں ہے
فائل: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}
```

اس میں `binaryTargets` بالکل سیٹ نہیں تھا۔

### اس کا کیا مطلب ہے
جب بھی `npm install` چلتا ہے، اس کے `postinstall` میں `prisma generate` خودکار چلتا ہے (`package.json` دیکھیں)۔ Prisma **صرف اسی آپریٹنگ سسٹم کا "query engine" (`.node` بائنری فائل) ڈاؤن لوڈ کرتا ہے جس پر یہ کمانڈ چل رہی ہو** — جب تک کہ `binaryTargets` میں واضح طور پر کوئی اور OS نہ لکھا ہو۔

- آپ کی ایپ **صرف Windows** کے لیے پیکج ہوتی ہے (`electron-builder --win`)۔
- لیکن اگر `npm install` / `prisma generate` Windows کے علاوہ کسی مشین پر چلا ہو (مثلاً ڈویلپر کا Mac/Linux، یا کوئی AI ایجنٹ جو Linux sandbox میں کام کرتا ہو — بالکل جیسے میں خود ابھی اس sandbox میں ہوں) — تو صرف **Linux/Mac کا engine** ڈاؤن لوڈ ہوتا ہے، **Windows کا نہیں**۔

پھر مزید بدتر: `scripts/build-standalone.js` کے اندر ایک فنکشن ہے `stripNonWindowsPrisma()` جو یہ کرتا ہے:

```js
if (lower.includes('linux') || lower.includes('darwin') || ...) {
  fs.unlinkSync(filePath); // ← ڈیلیٹ کر دیتا ہے
}
```

یعنی اگر `.prisma/client` فولڈر میں صرف Linux والا engine موجود تھا (کیونکہ اوپر بتائی گئی وجہ سے)، تو یہ سٹرپ فنکشن اسے بھی **ڈیلیٹ کر دیتا ہے** — نتیجہ: پیکج ہونے والی Windows ایپ میں **کوئی بھی query engine بائنری موجود نہیں ہوتی**۔ نہ Windows کا، نہ Linux کا — کچھ بھی نہیں۔

اور سب سے خطرناک بات: بلڈ سکرپٹ کے آخر میں جو "Final Verification" چلتا تھا، وہ صرف یہ چیک کرتا تھا کہ `.prisma/client` **فولڈر موجود ہے یا نہیں** — یہ چیک نہیں کرتا تھا کہ اس فولڈر کے اندر Windows کی اصل engine فائل موجود ہے بھی یا نہیں۔ اس لیے بلڈ "All checks passed ✅" پرنٹ کر دیتا تھا حالانکہ اندر سے engine غائب ہوتی تھی۔

### یہ آپ کی تمام رپورٹ کردہ علامات کی وضاحت کیوں کرتا ہے
جب Prisma کا query engine بالکل موجود نہ ہو، تو **ہر ایک** ڈیٹا بیس کال (چاہے وہ کتنی ہی اچھی طرح `try/catch` میں لپٹی ہو) ناکام ہو جاتی ہے، کیونکہ Prisma Client خود شروع (initialize) ہی نہیں ہو پاتا۔ یہی وجہ ہے کہ:

| آپ کی شکایت | وضاحت |
|---|---|
| ڈیش بورڈ کھلتے ہی Error 500 | Prisma client fail → ہر query fail |
| پروڈکٹ/کوئی بھی چیز سیو نہیں ہوتی | create/update calls سب fail |
| Daily Closing رپورٹ نظر نہیں آتی | Prisma fail |
| کوئی اور رپورٹ نظر نہیں آتی | Prisma fail |
| نیا یوزر ایڈ نہیں ہوتا | Prisma fail |

یعنی یہ ایک ہی جڑ کا مسئلہ ہے جو ہر جگہ ایک جیسی علامت دکھا رہا ہے — بالکل ویسے جیسے آپ نے بتایا کہ "ہر چیز میں مسئلہ ہے"۔ اور یہی وجہ ہے کہ آپ کے پچھلے ایجنٹ کی ساری source-code level فکسز کا اصل .exe پر کوئی اثر نہیں ہوا: **مسئلہ کوڈ کی منطق میں تھا ہی نہیں، بلڈ پائپ لائن میں تھا۔**

---

## کیے گئے فکسز (اس فائل کے ساتھ دی گئی زپ میں شامل)

### 1. `prisma/schema.prisma`
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "windows"]
}
```
اب چاہے `npm install` کسی بھی OS پر چلے، Windows کا query engine ہمیشہ ڈاؤن لوڈ ہوگا۔

### 2. `scripts/build-standalone.js`
"Final Verification" سیکشن میں ایک نیا سخت چیک شامل کیا گیا ہے جو فولڈر کے اندر جا کر واقعی Windows engine فائل (`*.node` جس کے نام میں "windows" ہو) تلاش کرتا ہے۔ اگر نہ ملے تو:
- بلڈ کو **fail** کر دے گا (silently pass نہیں ہوگا)۔
- واضح ہدایت دے گا کہ کیا کرنا ہے (نیچے دیکھیں)۔

---

## اب آپ کو (یا آپ کے ایجنٹ کو) کیا کرنا ہے

یہ بہت ضروری ہے — صرف کوڈ بدلنے سے کچھ نہیں ہوگا، کیونکہ آپ کی مشین پر پہلے سے ڈاؤن لوڈ شدہ (غلط) engine کیش میں موجود ہو سکتا ہے۔

```bash
# 1. پرانا سب کچھ صاف کریں
rd /s /q node_modules      (یا Mac/Linux پر: rm -rf node_modules)
rd /s /q .next
del /f pnpm-lock.yaml package-lock.json bun.lock   (اگر چاہیں تو، عام طور پر ضروری نہیں)

# 2. دوبارہ انسٹال کریں — یہ اب binaryTargets کی وجہ سے Windows engine بھی لائے گا
npm install

# 3. یقین کریں کہ Windows engine واقعی آ گیا
dir node_modules\.prisma\client
# آپ کو ایک فائل نظر آنی چاہیے جس کے نام میں "windows" ہو، مثلاً:
# query_engine-windows.dll.node

# 4. بلڈ چلائیں
npm run build:electron

# بلڈ کے آخر میں یہ لائن ضرور دیکھیں:
#   === Prisma Windows Engine Check ===
#   OK Windows query engine found: query_engine-windows.dll.node
# اگر یہاں "MISSING!" لکھا آئے تو رکیں — انسٹالر نہ بنائیں، پہلے یہ حل کریں۔

# 5. installer بنائیں
npm run electron:build
```

**اہم:** یہ سارا عمل (`npm install` سے لے کر `electron:build` تک) **Windows مشین پر ہی چلائیں**، کیونکہ فائنل installer صرف Windows کے لیے ہے اور serialport/printer جیسی چیزیں بھی Windows-specific ہیں۔

---

## دوسرے (چھوٹے) مسائل جو پہلے سے ٹھیک تھے — صرف تصدیق کے لیے

میں نے ہر route پڑھ کر تصدیق کی، یہ سب پہلے سے درست ہیں (v1.3.3–v1.3.6 میں فکس ہو چکے):

1. **DB schema lazily بننا** — اب ہر route کے شروع میں `ensureDbReady()` کال ہوتی ہے، صرف auto-login پر نہیں۔
2. **Settings row نہ ہونا** — اب `ensureSettings()` خودکار ایک ڈیفالٹ Settings بنا دیتا ہے۔
3. **Expense کا `expenseTypeId` خالی ہونا** — اب خودکار "General" ٹائپ بن جاتی ہے۔
4. **Sale invoice number کی ریس کنڈیشن** — اب transaction کے اندر پڑھا اور بڑھایا جاتا ہے۔
5. **ensureDatabase() ناکامی پر بھی "initialized" مارک ہونا** — اب صرف verification پاس ہونے پر مارک ہوتا ہے۔

ان میں سے کسی میں مزید تبدیلی کی ضرورت نہیں۔ اصل مسئلہ صرف Prisma Windows engine کا تھا، جو اوپر فکس کر دیا گیا ہے۔

---

## اگر رفع کرنے کے بعد بھی مسئلہ رہے

اگر مندرجہ بالا سٹیپس کے بعد بھی مسئلہ رہے تو ایپ کا لاگ فائل چیک کریں:
- ونڈوز پر: `%APPDATA%\tariq-karyana-store\app.log` (یا ایپ کے اندر سے "Open Log" بٹن/مینو، `electron/main.ts` میں `get-log-path`/`open-log` IPC موجود ہے)
- اس میں `[DB] Init error` یا `Prisma engine files found: NONE` جیسی لائنیں تلاش کریں اور مجھے بھیجیں — اس سے فوراً پتا چل جائے گا کہ اب کیا رکاوٹ ہے۔
