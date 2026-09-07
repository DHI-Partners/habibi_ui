from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1.session import boot, me


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

	def test_ии_модуль_виден_когда_установлен(self):
		# habibi_ai стоит на dev-сайте; на сайтах без него ключа быть не должно,
		# и это единственное, чем управляется доступность раздела в интерфейсе.
		result = me()
		keys = [m["key"] for m in result["modules"]]
		self.assertEqual("habibi_ai" in keys, "habibi_ai" in frappe.get_installed_apps())

	def test_ии_модуль_скрыт_когда_не_установлен(self):
		# Обратное направление проверяется подменой списка приложений: на этом
		# сайте habibi_ai установлен, и без подмены случай недостижим. Без этого
		# теста регрессия, в которой _modules() перестаёт фильтровать вообще,
		# прошла бы незамеченной — обе стороны равенства выше уехали бы в True
		# одновременно. Скрытность раздела — то, на чём держится выборочная
		# выдача модуля тенантам, поэтому проверяется отдельно.
		with patch("frappe.get_installed_apps", return_value=["frappe", "erpnext"]):
			keys = [m["key"] for m in me()["modules"]]
		self.assertNotIn("habibi_ai", keys)

	def test_guest_is_rejected(self):
		# Возврат пользователя через addCleanup, а не последней строкой тела:
		# при падении assert соседние тесты не должны достаться Guest-у.
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			me()


class TestSessionBoot(IntegrationTestCase):
	def test_отдаёт_тот_же_состав_что_страница_обёртка(self):
		frappe.set_user("Administrator")
		result = boot()
		self.assertEqual(set(result), {"csrf_token", "user", "desk_theme"})
		self.assertEqual(result["user"], "Administrator")
		self.assertTrue(result["csrf_token"])

	def test_гость_отвергается(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			boot()

	def test_вне_developer_mode_отвергается(self):
		# На dev-сайте developer_mode включён, поэтому обратный случай
		# проверяется подменой конфигурации, а не сменой сайта: в проде это
		# permanently whitelisted GET, отдающий CSRF-токен, и его отключение
		# — единственное, что не даёт ему стать CSRF-token oracle в день,
		# когда где-то включат allow_cors.
		frappe.set_user("Administrator")
		with patch.dict(frappe.conf, {"developer_mode": 0}):
			with self.assertRaises(frappe.PermissionError):
				boot()
