"""Куда попадают роли кабинета: после входа — в кабинет, из Desk — обратно в него.

Кабинет — единственный интерфейс владельца и сотрудника. Frappe выбирает, куда
вести вошедшего, по User.default_app (frappe/apps.py:get_default_path) — его
здесь и держим в согласии с ролями. System Manager решает сам: ему нужна вся
система, а кабинет он откроет по /ui/c.
"""

import frappe

from habibi_ui.api.v1.cabinet import CABINET_ROLES

APP = "habibi_ui"
ROUTE = "/ui/c"


def cabinet_only(roles) -> bool:
	"""Роль кабинета без System Manager. Прочие роли (Desk-роль заказов у
	владельца на проде) исключения не дают — иначе владелец снова в Desk."""
	roles = set(roles)
	return bool(roles & set(CABINET_ROLES)) and "System Manager" not in roles


def has_app_permission() -> bool:
	"""Кабинет на экране приложений: роли кабинета и System Manager.

	Остальным его не показываем — открыть его им всё равно нечем.
	"""
	roles = set(frappe.get_roles())
	return bool(roles & set(CABINET_ROLES)) or "System Manager" in roles


def set_default_app(doc, method=None):
	"""User.validate: выдали роль кабинета — кабинет по умолчанию, сняли — убрали.

	Меняем поле до сохранения, а не db_set после: без второй записи и без
	рекурсии через on_update. Чужой выбор (default_app уже задан другим
	приложением) не трогаем.
	"""
	roles = {row.role for row in doc.get("roles") or []}
	if cabinet_only(roles):
		if not doc.default_app:
			doc.default_app = APP
	elif doc.default_app == APP:
		# Роль кабинета сняли или пользователя повысили до System Manager:
		# get_route() по-прежнему вёл бы его в кабинет, а ему теперь нужен Desk.
		# Цена: System Manager не может держать кабинет приложением по
		# умолчанию — кабинет он откроет по /ui/c или с экрана приложений.
		doc.default_app = ""


def send_desk_to_cabinet(context):
	"""update_website_context: Desk для ролей кабинета закрыт мягко — редиректом.

	Серверный хук вместо скрипта в Desk: страница Desk (TemplatePage "desk")
	проходит через update_website_context, а Redirect из рендера страницы
	frappe/website/serve.py превращает в ответ-редирект. Так Desk даже не
	начинает грузиться. /app/... Frappe сам уводит на /desk/..., поэтому
	хватает одной проверки. 302, а не 301 frappe.redirect(): постоянный
	редирект браузер запомнит, и после снятия роли Desk не откроется.
	"""
	if context.get("path") != "desk" or frappe.session.user == "Guest":
		return
	if cabinet_only(frappe.get_roles()):
		frappe.flags.redirect_location = ROUTE
		raise frappe.Redirect(302)
