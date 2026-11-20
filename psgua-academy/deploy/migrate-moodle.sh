#!/usr/bin/env bash
# =========================================================
# Етап 1: безпечне перенесення Moodle в _legacy_moodle_backup/
# Запуск НА СЕРВЕРІ (SSH ADM.TOOLS) з кореня сайту academy.psgua.com:
#   bash migrate-moodle.sh            # сухий прогін: лише показує, що буде перенесено
#   bash migrate-moodle.sh --apply    # виконати перенесення
# Нічого не видаляє. Переносить УСЕ з кореня, крім самого архіву.
# =========================================================
set -euo pipefail
BACKUP="_legacy_moodle_backup"
APPLY=0; [[ "${1:-}" == "--apply" ]] && APPLY=1

if [[ ! -f config.php && ! -f version.php ]]; then
  echo "⚠ У поточній теці немає config.php/version.php Moodle. Перевірте, що ви в корені academy.psgua.com: $(pwd)"; exit 1
fi

shopt -s dotglob nullglob
items=()
for f in *; do [[ "$f" == "$BACKUP" ]] && continue; items+=("$f"); done
echo "Тека: $(pwd)"; echo "Буде перенесено в $BACKUP/: ${#items[@]} елементів"; printf '  %s\n' "${items[@]}"

if [[ $APPLY -eq 0 ]]; then echo; echo "Сухий прогін. Для виконання: bash $0 --apply"; exit 0; fi

mkdir -p "$BACKUP"
for f in "${items[@]}"; do mv -- "$f" "$BACKUP/"; done

# Закрити архів від вебу (config.php містить пароль БД!)
cat > "$BACKUP/.htaccess" <<'HT'
Require all denied
Options -Indexes
HT
chmod 700 "$BACKUP" || true
echo "✓ Готово. Корінь порожній — завантажте вміст теки academy/."
echo "Нагадування: дані Moodle (moodledata) і база MySQL цим скриптом НЕ зачіпаються — зробіть їх дамп окремо."
