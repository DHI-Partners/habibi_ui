"""Единственная точка входа оболочки фронта: кто вошёл и что ему доступно."""

from dataclasses import asdict, dataclass

import frappe
import frappe.sessions
from frappe import _

from habibi_ui.api.v1.cabinet import CABINET_ROLES

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
	home: str


def _modules() -> list[Module]:
	installed = frappe.get_installed_apps()
	return [Module(key=app, label=MODULE_LABELS[app]) for app in installed if app in MODULE_LABELS]


def _home(roles) -> str:
	"""Кабинет — для ролей кабинета без System Manager.

	Решает сервер: фронт только перенаправляет. Администратор с ролью
	владельца остаётся в лаунчере — ему нужна вся система, кабинет он
	откроет по /ui/c.
	"""
	if "System Manager" in roles:
		return "launcher"
	return "cabinet" if set(CABINET_ROLES) & set(roles) else "launcher"


@frappe.whitelist()
def me() -> dict:
	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)

	roles = frappe.get_roles()
	return asdict(
		Me(
			user=frappe.session.user,
			full_name=frappe.utils.get_fullname(frappe.session.user),
			roles=roles,
			modules=_modules(),
			home=_home(roles),
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

	Гейт на developer_mode: метод permanently whitelisted и в проде тоже,
	хотя нужен только для vite dev server. Сегодня same-origin делает его
	безопасным, но это CSRF-token oracle в день, когда кто-то включит
	allow_cors. В проде window.habibi и так уже в разметке www/ui.html —
	вызывать boot там незачем.
	"""
	if not frappe.conf.get("developer_mode"):
		frappe.throw(_("Недоступно"), frappe.PermissionError)

	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)

	return {
		"csrf_token": frappe.sessions.get_csrf_token(),
		"user": frappe.session.user,
		"desk_theme": frappe.db.get_value("User", frappe.session.user, "desk_theme") or "",
		# Тот же неймспейс socket.io, что и страница-обёртка — см. www/ui.py.
		"site_name": frappe.local.site,
	}
