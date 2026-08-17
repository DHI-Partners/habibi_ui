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

	def test_guest_is_redirected_to_login(self):
		# Возврат пользователя через addCleanup, а не последней строкой тела:
		# при падении assert соседние тесты не должны достаться Guest-у.
		# Приём такой же, как в habibi_ui/tests/test_session.py.
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")

		# Вне HTTP-запроса frappe.request не привязан (RuntimeError: object is not
		# bound). get_context читает frappe.request.path, поэтому подставляем
		# минимальный request, как это делают тесты самого frappe (см.
		# frappe/tests/test_client.py, test_db_query.py: frappe.local.request = frappe._dict()).
		self.addCleanup(delattr, frappe.local, "request")
		frappe.local.request = frappe._dict(path="/ui")

		# frappe.redirect() не возвращает управление — поднимает Redirect,
		# сама ссылка складывается в frappe.flags.redirect_location.
		with self.assertRaises(frappe.exceptions.Redirect):
			get_context(frappe._dict())

		self.assertTrue(frappe.flags.redirect_location.startswith("/login?"))
		self.assertIn("redirect-to", frappe.flags.redirect_location)
