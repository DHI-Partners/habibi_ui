import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.www.ui import assets_from_manifest, get_context


class TestUiPage(IntegrationTestCase):
	def test_manifest_gives_entry_script(self):
		assets = assets_from_manifest()
		self.assertTrue(assets["js"].startswith("/assets/habibi_ui/frontend/"))
		self.assertTrue(assets["js"].endswith(".js"))

	def test_context_has_csrf_token_for_logged_in_user(self):
		frappe.set_user("Administrator")
		context = frappe._dict()
		get_context(context)
		self.assertTrue(context["csrf_token"])
		self.assertEqual(context["user"], "Administrator")
