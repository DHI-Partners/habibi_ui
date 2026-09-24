"""Вход ведёт роли кабинета в кабинет, а Desk отправляет их обратно.

Проверяются все три звена: default_app у пользователя (по нему Frappe выбирает,
куда вести после входа), приложение на экране приложений и редирект из Desk.
"""

import frappe
from frappe.apps import get_default_path
from frappe.tests import IntegrationTestCase

from habibi_ui.cabinet import access
from habibi_ui.patches import set_cabinet_default_app

OWNER = "access-owner@example.com"
STAFF = "access-staff@example.com"
ADMIN = "access-admin@example.com"
OTHER = "access-other@example.com"


def _user(email, *roles, default_app=""):
	"""Пользователь с ровно этими ролями; существующий пересобирается заново."""
	if frappe.db.exists("User", email):
		user = frappe.get_doc("User", email)
		user.roles = []
	else:
		user = frappe.get_doc(
			{"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}
		)
	user.default_app = default_app
	for role in roles:
		user.append("roles", {"role": role})
	user.save(ignore_permissions=True)
	return user


class TestCabinetAccess(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_владелец_получает_кабинет_приложением_по_умолчанию(self):
		self.assertEqual(_user(OWNER, "Habibi Owner").default_app, "habibi_ui")

	def test_сотрудник_получает_кабинет_приложением_по_умолчанию(self):
		self.assertEqual(_user(STAFF, "Habibi Staff").default_app, "habibi_ui")

	def test_посторонняя_роль_не_мешает_кабинету(self):
		# На проде у владельца есть и Desk-роль заказов — она не делает его
		# пользователем Desk.
		user = _user(OWNER, "Habibi Owner", "Sales User")
		self.assertEqual(user.default_app, "habibi_ui")

	def test_system_manager_не_трогается(self):
		self.assertFalse(_user(ADMIN, "Habibi Owner", "System Manager").default_app)

	def test_заданное_приложение_не_перезаписывается(self):
		self.assertEqual(_user(OWNER, "Habibi Owner", default_app="erpnext").default_app, "erpnext")

	def test_снятие_роли_кабинета_убирает_кабинет_по_умолчанию(self):
		_user(OWNER, "Habibi Owner")
		self.assertFalse(_user(OWNER, "Sales User", default_app="habibi_ui").default_app)

	def test_повышение_до_system_manager_убирает_кабинет_по_умолчанию(self):
		# Владелец стал администратором: ему нужен Desk, а не кабинет.
		self.assertEqual(_user(OWNER, "Habibi Owner").default_app, "habibi_ui")
		user = frappe.get_doc("User", OWNER)
		user.append("roles", {"role": "System Manager"})
		user.save(ignore_permissions=True)
		self.assertFalse(user.default_app)

	def test_патч_убирает_кабинет_у_system_manager(self):
		_user(ADMIN, "Habibi Owner", "System Manager")
		_user(OTHER, "Sales User")
		# Повышенные до хука: кабинет остался в базе.
		frappe.db.set_value("User", ADMIN, "default_app", "habibi_ui")
		frappe.db.set_value("User", OTHER, "default_app", "habibi_ui")

		set_cabinet_default_app.execute()
		set_cabinet_default_app.execute()

		self.assertFalse(frappe.db.get_value("User", ADMIN, "default_app"))
		self.assertFalse(frappe.db.get_value("User", OTHER, "default_app"))

	def test_без_ролей_кабинета_ничего_не_ставится(self):
		self.assertFalse(_user(OTHER, "Sales User").default_app)

	def test_патч_проставляет_существующим_и_идемпотентен(self):
		_user(OWNER, "Habibi Owner")
		_user(ADMIN, "Habibi Owner", "System Manager")
		_user(STAFF, "Habibi Staff", default_app="erpnext")
		# Пользователи, заведённые до хука: поле пустое в базе.
		frappe.db.set_value("User", OWNER, "default_app", "")

		set_cabinet_default_app.execute()
		set_cabinet_default_app.execute()

		self.assertEqual(frappe.db.get_value("User", OWNER, "default_app"), "habibi_ui")
		self.assertFalse(frappe.db.get_value("User", ADMIN, "default_app"))
		self.assertEqual(frappe.db.get_value("User", STAFF, "default_app"), "erpnext")

	def test_путь_по_умолчанию_владельца_кабинет(self):
		# По нему /login уже вошедшего пользователя и ведёт — frappe/www/login.py.
		_user(OWNER, "Habibi Owner")
		frappe.set_user(OWNER)
		frappe.local.request_cache.clear()
		self.assertEqual(get_default_path(), "/ui/c")

	def test_кабинет_на_экране_приложений(self):
		cases = {
			OWNER: ("Habibi Owner",),
			STAFF: ("Habibi Staff",),
			ADMIN: ("System Manager",),
			OTHER: ("Sales User",),
		}
		for email, roles in cases.items():
			_user(email, *roles)
		seen = {}
		for email in cases:
			frappe.set_user(email)
			seen[email] = access.has_app_permission()
		self.assertEqual(seen, {OWNER: True, STAFF: True, ADMIN: True, OTHER: False})

	def test_desk_уводит_владельца_в_кабинет(self):
		_user(OWNER, "Habibi Owner", "Sales User")
		frappe.set_user(OWNER)
		with self.assertRaises(frappe.Redirect) as caught:
			access.send_desk_to_cabinet(frappe._dict(path="desk"))
		self.assertEqual(frappe.flags.redirect_location, "/ui/c")
		# Не 301: постоянный редирект браузер запомнит, и после снятия роли
		# Desk не откроется.
		self.assertEqual(caught.exception.http_status_code, 302)

	def test_desk_открыт_администратору_и_прочим(self):
		_user(ADMIN, "Habibi Owner", "System Manager")
		_user(OTHER, "Sales User")
		for user in ("Administrator", ADMIN, OTHER):
			frappe.set_user(user)
			access.send_desk_to_cabinet(frappe._dict(path="desk"))

	def test_прочие_страницы_владельцу_открыты(self):
		_user(OWNER, "Habibi Owner")
		frappe.set_user(OWNER)
		for path in ("ui", "update-password", "me"):
			access.send_desk_to_cabinet(frappe._dict(path=path))
