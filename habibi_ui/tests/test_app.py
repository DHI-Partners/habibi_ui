import frappe
from frappe.tests import IntegrationTestCase


class TestApp(IntegrationTestCase):
	def test_app_installed(self):
		# Приложение должно быть установлено на сайт, а не просто лежать в apps/.
		self.assertIn("habibi_ui", frappe.get_installed_apps())
