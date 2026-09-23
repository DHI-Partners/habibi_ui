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
