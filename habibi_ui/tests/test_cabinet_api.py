"""Методы `cabinet.*`: разделы из Cabinet Settings режут поля документа.

Тестовый раздел строится на `ToDo` — он есть на любом сайте, в том числе без
`habibi_ai`, и не требует установки других приложений.
"""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1 import cabinet

SECTION = {
	"key": "todo",
	"label": "Дела",
	"kind": "generic",
	"ref_doctype": "ToDo",
	"list_fields": "description:Что сделать\nstatus",
	"form_fields": "description\npriority",
	"base_filters": '{"status": "Open"}',
	"can_create": 1,
	"can_edit": 1,
}


class TestCabinetApi(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		settings = frappe.get_single("Cabinet Settings")
		settings.sections = []
		settings.append("sections", SECTION)
		settings.save()

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_config_отдаёт_раздел_с_метой_полей(self):
		(section,) = [s for s in cabinet.config() if s["key"] == "todo"]
		self.assertEqual([f["fieldname"] for f in section["list_fields"]], ["description", "status"])
		self.assertEqual(section["list_fields"][0]["label"], "Что сделать")
		self.assertEqual(section["form_fields"][1]["fieldtype"], "Select")

	def test_раздел_с_несуществующим_полем_выпадает(self):
		settings = frappe.get_single("Cabinet Settings")
		settings.append("sections", {**SECTION, "key": "broken", "form_fields": "no_such_field"})
		settings.save()
		keys = [s["key"] for s in cabinet.config()]
		self.assertIn("todo", keys)
		self.assertNotIn("broken", keys)

	def test_раздел_с_несуществующим_доктайпом_выпадает(self):
		settings = frappe.get_single("Cabinet Settings")
		settings.append("sections", {**SECTION, "key": "ghost"})
		settings.save()
		# Link не даст сохранить несуществующий DocType — так и бывает на сайте,
		# где DocType удалили после настройки. Имитируем прямой записью.
		frappe.db.set_value("Cabinet Section", settings.sections[-1].name, "ref_doctype", "Delivery Zone Ghost")
		self.assertNotIn("ghost", [s["key"] for s in cabinet.config()])

	def test_list_только_поля_списка_и_базовый_фильтр(self):
		open_ = frappe.get_doc({"doctype": "ToDo", "description": "открытое"}).insert()
		frappe.get_doc({"doctype": "ToDo", "description": "закрытое", "status": "Closed"}).insert()
		rows = cabinet.list("todo", filters=[["status", "=", "Closed"]])["rows"]
		names = [r["name"] for r in rows]
		self.assertIn(open_.name, names)
		self.assertTrue(all(set(r) <= {"name", "description", "status"} for r in rows))
		self.assertFalse(any(r["status"] == "Closed" for r in rows))

	def test_save_пишет_только_поля_формы(self):
		result = cabinet.save("todo", {"description": "новое", "priority": "High", "allocated_to": "x@y.z"})
		doc = frappe.get_doc("ToDo", result["name"])
		self.assertEqual(doc.priority, "High")
		self.assertFalse(doc.allocated_to)

	def test_save_не_пишет_поле_только_для_чтения(self):
		"""read_only поля форма не отправляет, но прямой вызов API может —
		save() его отбрасывает. Property Setter, а не Custom Field: DDL
		закоммитил бы транзакцию, и откат в tearDown не сработал бы."""
		frappe.make_property_setter(
			{"doctype": "ToDo", "fieldname": "priority", "property": "read_only", "value": "1", "property_type": "Check"}
		)
		frappe.clear_cache(doctype="ToDo")
		self.addCleanup(frappe.clear_cache, doctype="ToDo")
		result = cabinet.save("todo", {"description": "новое", "priority": "High"})
		doc = frappe.get_doc("ToDo", result["name"])
		self.assertEqual(doc.description, "новое")
		self.assertNotEqual(doc.priority, "High")
		cabinet.save("todo", {"description": "правка", "priority": "High"}, name=doc.name)
		doc.reload()
		self.assertEqual(doc.description, "правка")
		self.assertNotEqual(doc.priority, "High")

	def test_save_не_пишет_нередактируемый_адаптер(self):
		"""Адаптер с editable() == False (статус, сумма заказа) не пишется —
		write у них вообще бросает PermissionError."""
		adapter = type("A", (), {})()
		adapter.doctype, adapter.label, adapter.fieldtype = "ToDo", "Метка", "Data"
		adapter.editable = lambda: False
		adapter.read = lambda names: {}
		adapter.write = lambda doc, value: self.fail("нередактируемый адаптер записан")
		settings = frappe.get_single("Cabinet Settings")
		settings.sections[0].form_fields = "description\n@fake_label"
		settings.save()
		with patch("habibi_ui.cabinet.registry.adapter", return_value=adapter):
			cabinet.save("todo", {"description": "с адаптером", "fake_label": "x"})

	def test_save_без_права_создавать_запрещён(self):
		settings = frappe.get_single("Cabinet Settings")
		settings.sections[0].can_create = 0
		settings.save()
		with self.assertRaises(frappe.PermissionError):
			cabinet.save("todo", {"description": "нельзя"})

	def test_delete_без_права_запрещён(self):
		todo = frappe.get_doc({"doctype": "ToDo", "description": "x"}).insert()
		with self.assertRaises(frappe.PermissionError):
			cabinet.delete("todo", todo.name)

	def test_get_чужого_раздела_по_базовому_фильтру_не_отдаётся(self):
		closed = frappe.get_doc({"doctype": "ToDo", "description": "закрытое", "status": "Closed"}).insert()
		with self.assertRaises(frappe.DoesNotExistError):
			cabinet.get("todo", closed.name)

	def test_раздел_скрыт_без_флага(self):
		settings = frappe.get_single("Cabinet Settings")
		settings.sections[0].feature = "delivery"
		settings.save()
		with patch("habibi_ui.cabinet.registry.enabled_features", return_value=set()):
			self.assertNotIn("todo", [s["key"] for s in cabinet.config()])
		with patch("habibi_ui.cabinet.registry.enabled_features", return_value={"delivery"}):
			self.assertIn("todo", [s["key"] for s in cabinet.config()])

	def test_раздел_скрыт_от_чужой_роли(self):
		settings = frappe.get_single("Cabinet Settings")
		settings.sections[0].roles = "Habibi Owner"
		settings.save()
		with patch("frappe.get_roles", return_value=["Habibi Staff"]):
			self.assertNotIn("todo", [s["key"] for s in cabinet.config()])

	def test_неизвестный_раздел(self):
		with self.assertRaises(frappe.DoesNotExistError):
			cabinet.list("nope")

	def test_раздел_со_docstatus_в_списке_остаётся(self):
		# docstatus — служебное поле Frappe без DocField в мете; _describe должен
		# считать его существующим (в default_fields), иначе раздел выпал бы из
		# config() целиком, а не только это поле.
		settings = frappe.get_single("Cabinet Settings")
		settings.append("sections", {**SECTION, "key": "todo_ds", "list_fields": "description\ndocstatus"})
		settings.save()

		(section,) = [s for s in cabinet.config() if s["key"] == "todo_ds"]
		self.assertEqual([f["fieldname"] for f in section["list_fields"]], ["description", "docstatus"])

		todo = frappe.get_doc({"doctype": "ToDo", "description": "с docstatus"}).insert()
		rows = cabinet.list("todo_ds")["rows"]
		(row,) = [r for r in rows if r["name"] == todo.name]
		self.assertEqual(row["docstatus"], 0)

	def test_get_прячет_поле_без_доступа_по_permlevel(self):
		# frappe.get_doc не проверяет права сам: без явного check_permission и
		# apply_fieldlevel_read_permissions() в get() поле уровня 1 (Customize
		# Form → Permission Rules) утекло бы любому пользователю с доступом
		# уровня 0 — именно то, что здесь проверяется. permlevel — через Property
		# Setter (существующее поле ToDo), не через Custom Field: добавление
		# Custom Field меняет схему таблицы (ALTER TABLE), а DDL в MySQL сам
		# коммитит текущую транзакцию — откат в tearDown тогда не срабатывает и
		# тестовые данные остаются на сайте навсегда.
		#
		# Роль — своя тестовая, а не Habibi Owner/Staff (их ещё нет на этом
		# сайте как Role) и не "All": ToDo прячет документы по владельцу для
		# любого пользователя без «настоящей» (не автоматической) роли с
		# доступом на чтение — frappe.desk.doctype.todo.todo.has_permission.
		role_name = "Cabinet Permlevel Test Role"
		if not frappe.db.exists("Role", role_name):
			frappe.get_doc({"doctype": "Role", "role_name": role_name, "desk_access": 0}).insert(
				ignore_permissions=True
			)

		frappe.make_property_setter(
			{"doctype": "ToDo", "fieldname": "priority", "property": "permlevel", "value": "1", "property_type": "Int"}
		)
		# Custom DocPerm полностью заменяет permissions доктайпа на сайте — поэтому
		# здесь перечислен весь набор ролей, которым нужен доступ, а не только
		# новая level-1 запись.
		frappe.get_doc(
			{
				"doctype": "Custom DocPerm",
				"parent": "ToDo",
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": role_name,
				"permlevel": 0,
				"read": 1,
				"write": 1,
				"create": 1,
			}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Custom DocPerm",
				"parent": "ToDo",
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": "System Manager",
				"permlevel": 1,
				"read": 1,
			}
		).insert()
		frappe.clear_cache(doctype="ToDo")
		self.addCleanup(frappe.clear_cache, doctype="ToDo")
		self.addCleanup(frappe.set_user, "Administrator")

		settings = frappe.get_single("Cabinet Settings")
		settings.sections[0].roles = role_name
		settings.save()

		todo = frappe.get_doc({"doctype": "ToDo", "description": "секретное", "priority": "High"}).insert()

		user_email = "cabinet-permlevel-test@example.com"
		if not frappe.db.exists("User", user_email):
			user = frappe.get_doc(
				{
					"doctype": "User",
					"email": user_email,
					"first_name": "Cabinet Permlevel Test",
					"send_welcome_email": 0,
				}
			)
			user.insert(ignore_permissions=True)
			user.add_roles(role_name)

		frappe.set_user(user_email)
		result = cabinet.get("todo", todo.name)
		self.assertIsNone(result.get("priority"))

		frappe.set_user("Administrator")
		admin_result = cabinet.get("todo", todo.name)
		self.assertEqual(admin_result["priority"], "High")
