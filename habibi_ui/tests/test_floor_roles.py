"""Роли кухни и курьера: вход в кабинет и видимость разделов."""

import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1.cabinet import CABINET_ROLES, FLOOR_ROLES, STAFF_ROLES, _visible
from habibi_ui.cabinet import access


class TestFloorRoles(IntegrationTestCase):
	def test_роли_кухни_и_курьера_входят_в_кабинет(self):
		self.assertEqual(FLOOR_ROLES, ("Habibi Kitchen", "Habibi Courier"))
		self.assertEqual(CABINET_ROLES, STAFF_ROLES + FLOOR_ROLES)

	def test_кухня_и_курьер_только_кабинет(self):
		for role in FLOOR_ROLES:
			with self.subTest(role):
				self.assertTrue(access.cabinet_only([role]))
		# System Manager решает сам, как и у владельца
		self.assertFalse(access.cabinet_only(["Habibi Courier", "System Manager"]))

	def test_пустые_roles_не_показывают_раздел_кухне_и_курьеру(self):
		row = frappe._dict(feature="", roles="")
		for role in FLOOR_ROLES:
			with self.subTest(role):
				self.assertFalse(_visible(row, {role}, set()))
		for role in STAFF_ROLES:
			with self.subTest(role):
				self.assertTrue(_visible(row, {role}, set()))
		self.assertTrue(_visible(row, {"System Manager"}, set()))

	def test_явная_роль_показывает_раздел_кухне(self):
		row = frappe._dict(feature="", roles="Habibi Kitchen")
		self.assertTrue(_visible(row, {"Habibi Kitchen"}, set()))
		self.assertFalse(_visible(row, {"Habibi Courier"}, set()))
		self.assertFalse(_visible(row, {"Habibi Staff"}, set()))

	def test_роли_приезжают_фикстурой_и_ведут_в_кабинет(self):
		hooks = frappe.get_hooks("role_home_page")
		self.assertEqual(hooks.get("Habibi Kitchen"), ["ui"])
		self.assertEqual(hooks.get("Habibi Courier"), ["ui"])
		fixture = next(f for f in frappe.get_hooks("fixtures") if f.get("dt") == "Role")
		names = fixture["filters"][0][2]
		self.assertIn("Habibi Kitchen", names)
		self.assertIn("Habibi Courier", names)
