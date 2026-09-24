"""Сверяет User.default_app с ролями у тех, кто заведён до хука на User.

Правило то же, что в habibi_ui.cabinet.access.set_default_app: роли кабинета
без System Manager — кабинет по умолчанию, если поле пустое; кабинет у всех
остальных (повышены до System Manager, роль снята) — убираем. Прямая запись
поля, а не save(): сохранение пользователя тянет за собой валидации и письма,
а меняется одно поле. Повторный запуск ничего не меняет.
"""

import frappe

from habibi_ui.api.v1.cabinet import CABINET_ROLES
from habibi_ui.cabinet.access import APP, cabinet_only


def execute():
	with_role = frappe.get_all(
		"Has Role",
		filters={"parenttype": "User", "role": ["in", CABINET_ROLES]},
		pluck="parent",
		distinct=True,
	)
	with_app = frappe.get_all("User", filters={"default_app": APP}, pluck="name")
	for user in set(with_role) | set(with_app):
		current = frappe.db.get_value("User", user, "default_app")
		if cabinet_only(frappe.get_roles(user)):
			wanted = current or APP
		else:
			wanted = "" if current == APP else current
		if wanted != current:
			frappe.db.set_value("User", user, "default_app", wanted, update_modified=False)
