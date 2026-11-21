#!/usr/bin/env python3
"""
Етап 3.1 + Етап 1.2: інтеграція web.psgua.com -> academy.psgua.com

Запуск локально на копії папки web (НЕ на сервері напряму):
    python3 patch_web_psgua.py /шлях/до/web            # сухий прогін, лише звіт
    python3 patch_web_psgua.py /шлях/до/web --apply    # внести зміни (+ створює *.bak)

Що робить (ідемпотентно — повторний запуск нічого не дублює):
  1. <nav>: додає пункт «Академія» одразу після посилання «Кваліфікації»
     (або в кінець першого <nav>, якщо «Кваліфікації» не знайдено).
  2. index.html, секція id="directions": додає кнопку переходу в Академію.
  3. qualifications.html: додає CTA-блок перед <footer> (або перед </main>).
  4. Футер, блок «Швидкі розділи»: додає <li> з посиланням на Академію.
  5. Moodle: видаляє <a>/<li> з посиланнями на moodlecloud.com / uaguides-memory
     і показує всі інші згадки «moodle» для ручної перевірки.
Скрипт не вгадує: якщо якоря немає — пише «ПРОПУЩЕНО» і пояснює, що вставити вручну
(див. snippets.html).
"""
import re
import sys
from pathlib import Path

ACADEMY = "https://academy.psgua.com/"
MARK = "academy.psgua.com"

NAV_ITEM = f'<a href="{ACADEMY}" class="nav-academy" style="color:#d6a84b;font-weight:bold">Академія</a>'
DIRECTIONS_BTN = (
    f'\n<p class="academy-cta" style="margin-top:24px;text-align:center">'
    f'<a href="{ACADEMY}" class="btn" style="display:inline-block;background:#d6a84b;color:#0d2b49;'
    f'padding:13px 26px;border-radius:999px;font-weight:bold;text-decoration:none">'
    f'Перейти до Академії ПСТГУ →</a></p>\n'
)
QUAL_BLOCK = (
    f'\n<section class="academy-cta" style="max-width:1240px;margin:48px auto;padding:32px;border-radius:18px;'
    f'background:#123b63;color:#fff;box-shadow:0 12px 28px rgba(18,59,99,.12)">'
    f'<h2 style="color:#fff;margin-top:0">Підвищення кваліфікації в Академії ПСТГУ</h2>'
    f'<p style="color:#dbe7f3">Програми за Професійним стандартом «Туристичний гід (за видами туризму)»: '
    f'методика екскурсій, доступний туризм, безпека, цифрові навички.</p>'
    f'<a href="{ACADEMY}" style="display:inline-block;background:#d6a84b;color:#0d2b49;padding:13px 26px;'
    f'border-radius:999px;font-weight:bold;text-decoration:none">Обрати курс в Академії →</a></section>\n'
)
FOOTER_LI = f'<li><a href="{ACADEMY}">Академія ПСТГУ</a></li>'

BAD_LINK = re.compile(r'(moodlecloud\.com|uaguides-memory)', re.I)


def patch_nav(html):
    m = re.search(r'<nav\b[^>]*>(.*?)</nav>', html, re.S | re.I)
    if not m:
        return html, "nav: ПРОПУЩЕНО — <nav> не знайдено"
    body = m.group(1)
    if MARK in body:
        return html, "nav: вже містить Академію"
    q = re.search(r'<a\b[^>]*>\s*Кваліфікації\s*</a>', body, re.I)
    if q:
        # якщо пункт обгорнуто в <li>, додаємо новий <li>
        after = body[q.end():]
        li_close = re.match(r'\s*</li>', after)
        if li_close:
            ins_at = q.end() + li_close.end()
            new_body = body[:ins_at] + f'\n<li>{NAV_ITEM}</li>' + body[ins_at:]
        else:
            new_body = body[:q.end()] + '\n' + NAV_ITEM + body[q.end():]
        where = "після «Кваліфікації»"
    else:
        uses_li = re.search(r'<li\b', body, re.I)
        ul_end = body.rfind('</ul>')
        if uses_li and ul_end != -1:
            new_body = body[:ul_end] + f'<li>{NAV_ITEM}</li>\n' + body[ul_end:]
        else:
            new_body = body + NAV_ITEM + '\n'
        where = "у кінець меню («Кваліфікації» не знайдено — перевірте позицію)"
    return html[:m.start(1)] + new_body + html[m.end(1):], f"nav: додано {where}"


def patch_directions(html):
    m = re.search(r'<(section|div)\b[^>]*\bid=["\']directions["\'][^>]*>', html, re.I)
    if not m:
        return html, "#directions: ПРОПУЩЕНО — секцію не знайдено"
    tag = m.group(1).lower()
    # шукаємо закриття цієї секції з урахуванням вкладеності
    depth, pos = 1, m.end()
    pat = re.compile(rf'<(/?){tag}\b[^>]*>', re.I)
    for t in pat.finditer(html, pos):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            section = html[m.start():t.start()]
            if MARK in section:
                return html, "#directions: вже містить кнопку"
            return html[:t.start()] + DIRECTIONS_BTN + html[t.start():], "#directions: додано кнопку"
    return html, "#directions: ПРОПУЩЕНО — не знайдено закриваючий тег"


def patch_qualifications(html):
    if 'class="academy-cta"' in html:
        return html, "qualifications CTA: вже є"
    for anchor, label in ((r'<footer\b', '<footer>'), (r'</main>', '</main>')):
        m = re.search(anchor, html, re.I)
        if m:
            return html[:m.start()] + QUAL_BLOCK + html[m.start():], f"qualifications CTA: додано перед {label}"
    return html, "qualifications CTA: ПРОПУЩЕНО — немає <footer>/<main>"


def patch_footer(html):
    m = re.search(r'Швидкі\s+розділи', html, re.I)
    if not m:
        return html, "footer «Швидкі розділи»: ПРОПУЩЕНО — блок не знайдено"
    ul_end = html.find('</ul>', m.end())
    if ul_end == -1:
        return html, "footer «Швидкі розділи»: ПРОПУЩЕНО — список <ul> не знайдено"
    if MARK in html[m.end():ul_end]:
        return html, "footer «Швидкі розділи»: вже містить Академію"
    return html[:ul_end] + FOOTER_LI + '\n' + html[ul_end:], "footer «Швидкі розділи»: додано"


def clean_moodle(html):
    notes = []
    # <li> що містить тільки посилання на moodlecloud
    li_pat = re.compile(r'<li\b[^>]*>\s*<a\b[^>]*href=["\'][^"\']*(?:moodlecloud\.com|uaguides-memory)[^"\']*["\'][^>]*>.*?</a>\s*</li>\s*', re.I | re.S)
    html, n1 = li_pat.subn('', html)
    a_pat = re.compile(r'<a\b[^>]*href=["\'][^"\']*(?:moodlecloud\.com|uaguides-memory)[^"\']*["\'][^>]*>.*?</a>', re.I | re.S)
    html, n2 = a_pat.subn('', html)
    if n1 + n2:
        notes.append(f"moodle: видалено посилань — {n1 + n2}")
    for i, line in enumerate(html.splitlines(), 1):
        if re.search(r'moodle|uaguides-memory', line, re.I):
            notes.append(f"moodle: ПЕРЕВІРТЕ ВРУЧНУ рядок {i}: {line.strip()[:120]}")
    return html, notes


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    root = Path(sys.argv[1])
    apply = "--apply" in sys.argv
    files = sorted(root.rglob("*.html"))
    if not files:
        print(f"У {root} немає .html файлів")
        sys.exit(1)
    if not (root / "qualifications.html").exists():
        print("⚠ qualifications.html не знайдено — схоже, це не папка web.psgua.com.")
        if apply and "--force" not in sys.argv:
            print("  Зупинено, щоб не змінити чужий сайт. Якщо папка правильна — додайте --force.")
            sys.exit(2)
    changed = 0
    for f in files:
        html0 = html = f.read_text(encoding="utf-8", errors="surrogateescape")
        log = []
        html, r = patch_nav(html); log.append(r)
        html, r = patch_footer(html); log.append(r)
        if f.name == "index.html" and f.parent == root:
            html, r = patch_directions(html); log.append(r)
        if f.name == "qualifications.html":
            html, r = patch_qualifications(html); log.append(r)
        html, notes = clean_moodle(html); log.extend(notes)
        status = "ЗМІНЕНО" if html != html0 else "без змін"
        print(f"\n== {f.relative_to(root)} [{status}]")
        for line in log:
            print("   ", line)
        if html != html0:
            changed += 1
            if apply:
                f.with_suffix(f.suffix + ".bak").write_text(html0, encoding="utf-8", errors="surrogateescape")
                f.write_text(html, encoding="utf-8", errors="surrogateescape")
    print(f"\nФайлів зі змінами: {changed}. " + ("Зміни записано (*.bak створено)." if apply else "Сухий прогін — додайте --apply."))


if __name__ == "__main__":
    main()
