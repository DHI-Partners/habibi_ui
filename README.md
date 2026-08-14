### Habibi UI

Собственный фронтенд поверх ERPNext: React-SPA внутри Frappe-приложения.
Отдаётся тем же сайтом по той же сессии, ходит только в свои методы `habibi_ui.api.v1.*`.

Дизайн: `docs/superpowers/specs/2026-08-14-habibi-ui-design.md`

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
