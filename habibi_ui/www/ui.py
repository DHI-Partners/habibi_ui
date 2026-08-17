"""Страница-обёртка SPA. Повторяет поведение Desk: сессия, CSRF, отдача бандла."""

import json
import os
from urllib.parse import urlencode

import frappe
# Явный импорт обязателен: frappe.sessions не подтягивается пакетом frappe.
# Так же делает frappe/www/desk.py.
import frappe.sessions
from frappe import _

no_cache = 1

ASSET_PREFIX = "/assets/habibi_ui/frontend/"


def assets_from_manifest() -> dict:
	"""Имена файлов сборки хешируются, поэтому берём их из манифеста Vite."""
	# Путь считается внутри функции: на импорте модуля frappe ещё может быть не поднят.
	path = os.path.join(frappe.get_app_path("habibi_ui"), "public", "frontend", ".vite", "manifest.json")
	with open(path) as f:
		manifest = json.load(f)

	entry = manifest["index.html"]
	return {
		"js": ASSET_PREFIX + entry["file"],
		"css": [ASSET_PREFIX + name for name in entry.get("css", [])],
	}


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.response["status_code"] = 403
		frappe.msgprint(_("Войдите, чтобы открыть страницу."))
		frappe.redirect(f"/login?{urlencode({'redirect-to': frappe.request.path})}")

	assets = assets_from_manifest()
	csrf_token = frappe.sessions.get_csrf_token()
	# Тема по умолчанию — та, что пользователь уже выбрал в самом Frappe
	# (User.desk_theme), а не тема ОС: иначе при системной тёмной теме наш
	# интерфейс становится чёрным, а Desk рядом остаётся белым. Явный выбор в
	# нашем переключателе всё равно главнее — см. frontend/src/shared/lib/theme.ts.
	desk_theme = frappe.db.get_value("User", frappe.session.user, "desk_theme") or ""
	context.update(
		{
			"no_cache": 1,
			"lang": frappe.local.lang,
			"user": frappe.session.user,
			"csrf_token": csrf_token,
			# Jinja у Frappe рендерит без автоэкранирования, поэтому пользовательские
			# значения нельзя подставлять в JS сырой интерполяцией строк — собираем
			# готовый JSON в Python и выводим его в шаблоне как есть.
			"habibi_boot": json.dumps(
				{
					"csrf_token": csrf_token,
					"user": frappe.session.user,
					"desk_theme": desk_theme,
				}
			),
			"script": assets["js"],
			"styles": assets["css"],
		}
	)
	return context
