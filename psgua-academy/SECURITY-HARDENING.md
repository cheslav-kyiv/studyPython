# academy.psgua.com (Moodle 4.5, ADM.TOOLS): посилення безпеки 20.11.2026

Підстава: звіт Moodle «Перевірки безпеки» (`/report/security/index.php`). Усі зміни внесено вручну на сервері та перевірено повторним запуском звіту.

| Перевірка Moodle | Було | Що зроблено | Стало |
|---|---|---|---|
| Публічні/приватні шляхи | 🔴 Помилка | правила `RedirectMatch 404` у `.htaccess`, а також `txt` прибрано з nginx «Статичні файли» | 28/29 OK. Залишок: `privacy/tests/fixtures/logo.png` (віддає nginx, бо `png` — статика; тестова картинка без даних) |
| Виведення PHP помилок | 🟡 | ADM.TOOLS → Налаштування PHP → `display_errors` вимкнено | ✅ OK |
| Шляхи виконання | 🟡 | у `config.php` перед `require_once(__DIR__ . '/lib/setup.php');` додано `$CFG->preventexecpath = true;` | ✅ OK |
| config.php може перезаписуватися | 🟡 | права `config.php` → `440` | ✅ OK |
| XSS довірені користувачі (1), Резервне копіювання даних користувачів (1 роль, 0 людей) | 🟡 | без змін: штатна поведінка з одним адміністратором | 🟡 (очікувано) |

## Вміст `.htaccess` у корені Moodle (`/home/uaguides/psgua.com/academy/.htaccess`)
```apache
DirectoryIndex index.html index.php

# --- Закрити службові файли Moodle від доступу з інтернету ---
RedirectMatch 404 /\.(?!well-known/)
RedirectMatch 404 composer\.(json|lock)$
RedirectMatch 404 \.lock$
RedirectMatch 404 /vendor/
RedirectMatch 404 /node_modules/
RedirectMatch 404 /behat/
RedirectMatch 404 /tests/
RedirectMatch 404 /fixtures/
RedirectMatch 404 (?i)/readme[^/]*\.(txt|md)$
RedirectMatch 404 /(upgrade\.txt|UPGRADING[^/]*\.md)$
RedirectMatch 404 /environment\.xml$
RedirectMatch 404 /install\.xml$
RedirectMatch 404 /phpunit\.xml
```

## Важливо знати адміністратору
- **nginx «Статичні файли»** (ADM.TOOLS → сайт → Налаштування сайту): для розширень зі списку `.htaccess` **не застосовується**. Якщо повернути туди `txt`, `readme.txt`/`upgrade.txt` знову стануть публічними.
- **`DirectoryIndex index.html index.php`**: якщо в корінь Moodle потрапить `index.html`, він замінить головну Moodle. Статичну заготовку з `psgua-academy/academy/` туди **не завантажувати**.
- **Оновлення Moodle**: `config.php` має права `440`, тож інсталятор не зможе його змінити (це нормально, він і не повинен). `.htaccess` після оновлення зберігається; `privacy/tests/fixtures/logo.png` повертається.
- `/.git` і `/moodle/` (тека з `landing.php` і `README_moodle.md` від 12.11.2026) повертають 403. Призначення `landing.php` не з'ясоване: якщо сторінка не використовується, її варто прибрати.
- Пробний MoodleCloud `uaguides-memory` («Маршрути пам'яті») містив лише демо-курс; після 25.11.2026 його можна не продовжувати.

## Пошта та фонові завдання (21.11.2026)
- **Cron**: на ADM.TOOLS → «Розклад завдань» уже налаштовано `* * * * * /usr/bin/php8.3 /home/uaguides/psgua.com/academy/admin/cli/cron.php`, статус OK. Змін не потрібно.
- **SMTP**: Moodle надсилає пошту через скриньку `academy@uaguides.com` (сервер `mail.adm.tools:465`, SSL, LOGIN; noreplyaddress = `academy@uaguides.com`; allowedemaildomains = `uaguides.com`). Ім'я відправника — «Академія ВАГ» (профіль адміністратора).
- **Перевірка**: тестовий лист Moodle (`admin/testoutgoingmailconf.php`) потрапив у **Вхідні** Yahoo, хоча до налаштування SMTP лист підтвердження реєстрації опинявся у «Спамі».
- Ліміт ADM.TOOLS: 500 листів на добу через SMTP. Пароль скриньки змінено 21.11.2026; у панелі він не відображається, тож зберігається у власника.
