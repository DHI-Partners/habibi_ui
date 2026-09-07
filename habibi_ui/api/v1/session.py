"""Единственная точка входа оболочки фронта: кто вошёл и что ему доступно."""

from dataclasses import asdict, dataclass

import frappe
import frappe.sessions
from frappe import _

# Заголовки модулей задаются здесь, а не берутся из app_title: в интерфейсе
# они видны пользователю и переводятся отдельно от технических имён приложений.
MODULE_LABELS = {
	"erpnext": "Учёт",
	"habibi_ai": "ИИ",
	"habibi_telegram": "Телеграм",
	"habibi_whatsapp": "WhatsApp",
}


@dataclass
class Module:
	key: str
	label: str


@dataclass
class Me:
	user: str
	full_name: str
	roles: list[str]
	modules: list[Module]


def _modules() -> list[Module]:
	installed = frappe.get_installed_apps()
	return [Module(key=app, label=MODULE_LABELS[app]) for app in installed if app in MODULE_LABELS]


@frappe.whitelist()
def me() -> dict:
	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)

	return asdict(
		Me(
			user=frappe.session.user,
			full_name=frappe.utils.get_fullname(frappe.session.user),
			roles=frappe.get_roles(),
			modules=_modules(),
		)
	)


@frappe.whitelist(methods=["GET"])
def boot() -> dict:
	"""То же, что страница-обёртка кладёт в window.habibi.

	Нужен только vite dev server: под ним index.html отдаёт сам vite, а не
	www/ui.html, и подставить boot в разметку некому. Метод доступен по GET
	намеренно — CSRF-токен нельзя получить запросом, который сам его требует.
	Ничего сверх того, что обёртка и так отдаёт этому же пользователю, здесь
	не появляется.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)

	return {
		"csrf_token": frappe.sessions.get_csrf_token(),
		"user": frappe.session.user,
		"desk_theme": frappe.db.get_value("User", frappe.session.user, "desk_theme") or "",
	}
