İzin Yönetim Sistemi 
Proje Hakkında
Bu proje, şirketlerin çalışan izin taleplerini yönetmek için geliştirilmiş backend API uygulamasıdır.
Kullanıcıların (admin, IK ve çalışan) izin taleplerini oluşturup, güncelleyip, onaylayabildiği veya reddedebildiği, token tabanlı kimlik doğrulama (JWT) ve yetkilendirme sistemine sahip RESTful bir servistir.

1. Kullanıcı Rolleri ve Yetkilendirme
Admin: Sistemdeki tüm verilere tam erişim sağlar. Kullanıcı yönetimi, izin türü yönetimi, izin taleplerini görüntüleme ve onaylama yetkisi vardır. Sisteme veritabanından doğrudan eklenir.
İK (İnsan Kaynakları): Şu anda tüm departmanların izin taleplerini tek bir IK kullanıcısı tarafından yönetilmektedir. Ancak sistem, ileride departman bazında ayrı IK kullanıcılarının atanmasına
uygun olarak tasarlanmıştır. Admin tarafından sisteme eklenir. İK ise yeni employee ekleyebilir.
Çalışan: Kendi izin taleplerini oluşturur, görüntüler ve güncelleyebilir. Admin ya da İK tarafından sisteme eklenir.

2. İzin Talepleri Süreci
Çalışan, izin talebi oluşturmak istediğinde ilgili API endpoint’ine (POST /leave) izin türü, başlangıç ve bitiş tarihleri gibi bilgileri gönderir.
Sistem, gelen talebi doğrular (validation) ve aynı kullanıcı için çakışan izin tarihlerini kontrol eder.
Yeni izin talebi “Beklemede” durumunda kaydedilir.
İK veya admin, izin taleplerini listeleyebilir ve durumunu değiştirebilir (onayla veya reddet).
İzin durumu güncellenince, ilgili kullanıcıya bildirim gönderilir ve işlem audit log’a kaydedilir.
Çalışan izin durumunu API üzerinden takip edebilir.

3. Token Tabanlı Kimlik Doğrulama (JWT) ve Güvenlik
Kullanıcı başarılı giriş yaptıktan sonra, erişim için kısa ömürlü bir access token ve uzun ömürlü refresh token alır.
Access token ile API çağrıları yapılır, süresi dolduğunda refresh token kullanılarak yeni access token alınır.
Refresh token güvenli şekilde hashlenip veritabanında saklanır.
Kullanıcı çıkış yaptığında refresh token iptal edilir.
Token yenileme ve iptal işlemleri audit log’a kaydedilir.
Şifreler bcrypt ile güvenli hashlenir.

4. Bildirim ve Audit Kayıtları
Sistem, önemli işlemler (izin talebi oluşturma, onaylama, reddetme, token işlemleri vb.) için audit log kaydı tutar.
Kullanıcılar, izin taleplerinin durumu değiştiğinde bildirim alır.
Bildirimler okunma durumuna göre yönetilir.

5. Veritabanı Yapısı ve Katmanlı Mimari
PostgreSQL veritabanı kullanılır.
Departman, kullanıcı, izin türü, izin talepleri, refresh token, bildirim ve audit log tabloları bulunur.
Katmanlı mimari ile:
-Model katmanı: Veritabanı işlemleri
-Controller katmanı: İş mantığı ve API yanıtları
-Middleware: Yetkilendirme, doğrulama ve hata yönetimi
-Routes: API uç noktaları

7. Diğer Teknik Detaylar
İstek doğrulamalarında express-validator kullanılır.
Geliştirme sırasında kod değişikliklerinde sunucu otomatik yeniden başlatılır (nodemon).
API endpointleri REST standartlarına uygun tasarlanmıştır.
Tarih çakışmaları, izin limitleri ve rol bazlı yetkiler katı kurallarla kontrol edilir.

Özellikler
-Kullanıcı yönetimi: Admin, IK ve çalışan rolleri
-İzin talebi oluşturma, listeleme, güncelleme, silme
-İzin türleri yönetimi
-İzin durumu takibi: Beklemede, Onaylandı, Reddedildi
-Token tabanlı kimlik doğrulama ve yetkilendirme (JWT)
-Refresh token ile güvenli token yenileme (token rotation)
-İzin taleplerinin departman bazında yönetimi
-Bildirim sistemi ve audit log kayıtları
-PostgreSQL veritabanı kullanımı
-Katı validation kuralları ve middleware ile güvenlik

Teknolojiler
-Node.js
-Express.js
-PostgreSQL
-JSON Web Token (JWT)
-bcrypt (şifreleme)
-dotenv (ortam değişkenleri yönetimi)

API Dokümantasyonu
-Auth
POST	/auth/login	Kullanıcı girişi
POST	/auth/refresh-token	Refresh token ile access token yenileme
POST	/auth/logout	Refresh token iptal etme

-Leave Requests (İzin Talepleri)
POST	/leave	Yeni izin talebi oluşturma
GET	/leave	Kendi izin taleplerini listeleme
GET	/leave/department	Departman izin taleplerini listeleme
PUT	/leave/:id	İzin talebini güncelleme
DELETE	/leave/:id	İzin talebini silme
PUT	/leave/:id/status	İzin durumunu (onay/reddet) güncelleme

Geliştirme Süreci
-Kodlama sırasında nodemon ile otomatik yeniden başlatma kullanıldı.
-JWT ve refresh token mekanizması ile güvenli oturum yönetimi sağlandı.
-express-validator ile istek doğrulamaları yapıldı.
-Katmanlı mimari (controller, routes, middleware, models) ile düzen sağlandı.
-Veritabanı modelleri ve migration SQL scripti hazırlandı.
-Testler Postman ile yapıldı.

express-validator (istek doğrulama)

nodemon (geliştirme sırasında otomatik yeniden başlatma)
