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


class TestCabinetListing(IntegrationTestCase):
	"""Список раздела: сортировка, поиск, счётчик, фильтры и быстрые фильтры адаптера."""

	def setUp(self):
		frappe.set_user("Administrator")
		settings = frappe.get_single("Cabinet Settings")
		settings.sections = []
		settings.append("sections", SECTION)
		settings.save()

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def _todo(self, text, creation=None, **kw):
		doc = frappe.get_doc({"doctype": "ToDo", "description": text, **kw}).insert()
		if creation:
			frappe.db.set_value("ToDo", doc.name, "creation", creation, update_modified=False)
		return doc.name

	def _texts(self, **kw):
		return [frappe.db.get_value("ToDo", r["name"], "description") for r in cabinet.list("todo", **kw)["rows"]]

	def test_по_умолчанию_новые_сверху_по_дате_создания_а_не_правки(self):
		old = self._todo("старое", creation="2026-01-01 10:00:00")
		self._todo("новое", creation="2026-06-01 10:00:00")
		# Правка старой записи не поднимает её наверх: «последний» — это созданный последним
		frappe.db.set_value("ToDo", old, "description", "старое", update_modified=True)
		self.assertEqual(self._texts()[:2], ["новое", "старое"])

	def test_order_by_только_поля_раздела(self):
		self._todo("б", creation="2026-01-01 10:00:00")
		self._todo("а", creation="2026-02-01 10:00:00")
		self.assertEqual(self._texts(order_by="description asc")[:2], ["а", "б"])
		self.assertEqual(self._texts(order_by="description desc")[:2], ["б", "а"])
		# Чужое поле и мусор не ломают запрос и не дают сортировку по скрытому: ведёт себя как по умолчанию
		for bad in ("allocated_to asc", "description; drop table tabToDo", "description sideways", ""):
			with self.subTest(bad):
				self.assertEqual(self._texts(order_by=bad)[:2], ["а", "б"])

	def test_total_не_зависит_от_страницы(self):
		for i in range(5):
			self._todo(f"дело {i}")
		result = cabinet.list("todo", page_length=2)
		self.assertEqual(len(result["rows"]), 2)
		self.assertTrue(result["has_more"])
		self.assertGreaterEqual(result["total"], 5)
		second = cabinet.list("todo", start=2, page_length=2)
		self.assertEqual(len({r["name"] for r in result["rows"]} & {r["name"] for r in second["rows"]}), 0)

	def test_total_считает_с_базовым_фильтром_и_поиском(self):
		self._todo("ёлка открытая")
		self._todo("ёлка закрытая", status="Closed")
		self.assertEqual(cabinet.list("todo", search="ёлка")["total"], 1)

	def test_поиск_по_текстовым_полям_и_номеру(self):
		hit = self._todo("зелёная ёлка")
		self._todo("красный шар")
		self.assertEqual(self._texts(search="ёлка"), ["зелёная ёлка"])
		self.assertEqual(self._texts(search=hit), ["зелёная ёлка"])  # по номеру (name)
		self.assertEqual(self._texts(search="  "), self._texts())  # пустой поиск — без поиска

	def test_поиск_не_выходит_за_поля_раздела(self):
		self._todo("обычное", allocated_to="Administrator")
		# allocated_to не в list_fields: искать по нему нельзя
		self.assertEqual(self._texts(search="Administrator"), [])

	def test_фильтр_по_дате_создания(self):
		self._todo("июль", creation="2026-07-10 10:00:00")
		self._todo("август", creation="2026-08-10 10:00:00")
		got = self._texts(filters=[["creation", ">=", "2026-08-01 00:00:00"], ["creation", "<=", "2026-08-31 23:59:59"]])
		self.assertEqual(got, ["август"])

	def _fake_status_adapter(self):
		adapter = type("A", (), {})()
		adapter.doctype, adapter.label, adapter.fieldtype = "ToDo", "Статус", "Data"
		adapter.editable = lambda: False
		adapter.read = lambda names: {}
		adapter.facets = lambda: [
			{"key": "high", "label": "Высокие", "filters": [["priority", "=", "High"]]},
			{"key": "low", "label": "Низкие", "filters": [["priority", "=", "Low"]]},
		]
		settings = frappe.get_single("Cabinet Settings")
		settings.sections[0].list_fields = "description:Что сделать\n@fake_status:Статус"
		settings.save()
		return patch("habibi_ui.cabinet.registry.adapter", return_value=adapter)

	def test_быстрый_фильтр_адаптера_в_списке(self):
		self._todo("важное", priority="High")
		self._todo("потом", priority="Low")
		with self._fake_status_adapter():
			self.assertEqual(self._texts(facet="high"), ["важное"])
			self.assertEqual(self._texts(facet="low"), ["потом"])
			with self.assertRaises(frappe.ValidationError):
				cabinet.list("todo", facet="no_such_facet")

	def test_facets_счётчики_с_базовым_фильтром(self):
		self._todo("важное", priority="High")
		self._todo("ещё важное", priority="High")
		self._todo("закрытое важное", priority="High", status="Closed")
		self._todo("потом", priority="Low")
		with self._fake_status_adapter():
			got = {f["key"]: f["count"] for f in cabinet.facets("todo")}
			labels = [f["label"] for f in cabinet.facets("todo")]
		self.assertEqual((got["high"], got["low"]), (2, 1))
		self.assertEqual(got[""], 3)  # «Все» — с базовым фильтром раздела
		self.assertEqual(labels[0], "Все")

	def test_facets_без_адаптера_пусты(self):
		self.assertEqual(cabinet.facets("todo"), [])
