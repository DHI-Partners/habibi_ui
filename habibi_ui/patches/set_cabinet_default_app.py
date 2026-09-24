"""Кабинет по умолчанию для тех, кто получил роль кабинета до хука на User.

Прямая запись поля, а не save(): сохранение пользователя тянет за собой
валидации и письма, а меняется одно поле. Повторный запуск ничего не меняет —
пустое поле заполняется один раз.
"""

import frappe

from habibi_ui.api.v1.cabinet import CABINET_ROLES
from habibi_ui.cabinet.access import APP, cabinet_only


def execute():
	users = frappe.get_all(
		"Has Role",
		filters={"parenttype": "User", "role": ["in", CABINET_ROLES]},
		pluck="parent",
		distinct=True,
	)
	for user in users:
		if frappe.db.get_value("User", user, "default_app"):
			continue
		if cabinet_only(frappe.get_roles(user)):
			frappe.db.set_value("User", user, "default_app", APP, update_modified=False)
