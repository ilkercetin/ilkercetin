# 🥫 Açılış Takip — Ürün Açılış & Son Kullanma Tarihi Takibi

Bir ürünü **kameraya okutarak** (barkod) veya **fotoğrafını çekerek** ilk açılış tarihini cihaz hafızasına kaydeden, **son kullanma tarihini otomatik hesaplayan** mobil uyumlu PWA (Progressive Web App).

## Özellikler

- 📷 **Barkod okuma** — telefon kamerasıyla EAN/UPC/QR barkod taraması ([html5-qrcode](https://github.com/mebjas/html5-qrcode), cihazda yerel çalışır)
- 🔎 **Otomatik ürün tanıma** — okutulan barkod [Open Food Facts](https://world.openfoodfacts.org) veritabanında aranır; ürün adı ve kategorisi otomatik doldurulur
- ⏱️ **Otomatik son kullanma tarihi** — kategoriye göre "açıldıktan sonra tüketme süresi" (örn. süt 7 gün, ketçap 60 gün, maskara 90 gün) otomatik uygulanır: `SKT = açılış tarihi + süre`. Etiketteki SKT de girilirse iki tarihten erken olanı esas alınır.
- 🖼️ **Fotoğraflı kayıt** — barkodu olmayan ürünler için fotoğraf çekip kaydedin (fotoğraflar yer kaplamasın diye otomatik küçültülür)
- 💾 **Cihaz hafızasında saklama** — tüm kayıtlar IndexedDB'de tutulur; sunucu yok, hesap yok, internet olmadan da çalışır
- ⚠️ **Uyarılar** — süresi geçen ve 3 gün içinde dolacak ürünler liste başında rozetle ve özet çubuğuyla vurgulanır
- 📱 **Telefona kurulabilir** — PWA olduğu için "Ana ekrana ekle" ile uygulama gibi kullanılır, service worker ile çevrimdışı açılır

## Çalıştırma

Kamera erişimi için **HTTPS** (veya `localhost`) gerekir.

### Yerelde deneme

```bash
cd product-opening-tracker
npx serve .          # veya: python3 -m http.server 8080
```

Tarayıcıda `http://localhost:8080` adresini açın. Telefonda denemek için HTTPS veren bir tünel (örn. `npx localtunnel`) veya aşağıdaki gibi bir yayına alma yöntemi kullanın.

### Yayına alma (önerilen)

Statik dosyalardan ibaret olduğu için Netlify, Vercel veya GitHub Pages'e sürükle-bırak yayınlanabilir:

- **Netlify:** bu klasörü site olarak yayınlayın (build komutu yok, publish dizini: `product-opening-tracker`)
- **GitHub Pages:** repo ayarlarından Pages'i açın; uygulama `https://<kullanıcı>.github.io/<repo>/product-opening-tracker/` altında çalışır

Telefonda siteyi açtıktan sonra tarayıcı menüsünden **"Ana ekrana ekle"** deyin — artık normal bir uygulama gibi ikonuyla açılır.

## Nasıl çalışır?

1. **＋ Ürün Ekle** → **Barkod Okut** deyin, ürünün barkodunu kameraya gösterin
2. Ürün adı ve kategorisi Open Food Facts'ten otomatik gelir; kategoriye göre tüketme süresi dolar
3. Açılış tarihi varsayılan olarak bugündür; kaydedin
4. Ana listede her ürünün **kaç günü kaldığı** görünür; süresi yaklaşanlar turuncu, geçenler kırmızı rozet alır

Barkodu okunamayan/olmayan ürünler için **Fotoğraf Çek** ile fotoğraflı kayıt açabilir veya barkodu elle yazabilirsiniz.

## Teknik notlar

- Saf HTML/CSS/JS — build adımı ve framework yok, `vendor/` altındaki tarayıcı kütüphanesi repoya dahil (çevrimdışı çalışsın diye)
- Veri modeli: `{ name, barcode, category, openedAt, shelfLifeDays, printedExpiry, expiresAt, photo(Blob), notes }`
- Fotoğraflar canvas ile en fazla 900px'e küçültülüp JPEG olarak IndexedDB'ye yazılır
- Kategori süreleri `js/app.js` içindeki `CATEGORIES` dizisinden kolayca değiştirilebilir
