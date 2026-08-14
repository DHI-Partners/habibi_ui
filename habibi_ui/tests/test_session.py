import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1.session import me


class TestSessionMe(IntegrationTestCase):
	def test_returns_current_user(self):
		frappe.set_user("Administrator")
		result = me()
		self.assertEqual(result["user"], "Administrator")
		self.assertTrue(result["full_name"])

	def test_returns_roles_of_current_user(self):
		frappe.set_user("Administrator")
		result = me()
		self.assertIn("System Manager", result["roles"])

	def test_modules_reflect_installed_apps(self):
		# erpnext стоит всегда: habibi_ui объявляет его в required_apps.
		result = me()
		keys = [m["key"] for m in result["modules"]]
		self.assertIn("erpnext", keys)

	def test_guest_is_rejected(self):
		# Возврат пользователя через addCleanup, а не последней строкой тела:
		# при падении assert соседние тесты не должны достаться Guest-у.
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			me()
