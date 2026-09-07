### Habibi UI

Собственный фронтенд поверх ERPNext: React-SPA внутри Frappe-приложения.
Отдаётся тем же сайтом по той же сессии, ходит только в свои методы `habibi_ui.api.v1.*`.

Дизайн: `docs/superpowers/specs/2026-08-14-habibi-ui-design.md`

### Раздел ИИ

Живёт в `frontend/src/features/ai`, ходит в методы `habibi_ai.api.*`.
Появляется в лаунчере, только если на сайте установлен `habibi_ai`.

Панель трассировки показывается обладателям роли **Habibi AI Debug**: она
содержит собранный system prompt, и тенанту он не предназначен.

### Установка

Приложение попадает в образ через `habibi/apps.json` в
[habibi_docker](https://github.com/DHI-Partners/habibi_docker). На сайте:

```bash
bench --site <site> install-app habibi_ui
```

### Ветка

`main`.

### License

mit
