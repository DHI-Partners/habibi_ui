import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1.workspaces import modules, page, sidebar, sidebar_group


class TestWorkspacesSidebar(IntegrationTestCase):
	def test_returns_non_empty_list_for_administrator(self):
		frappe.set_user("Administrator")
		result = sidebar()
		self.assertTrue(result)
		self.assertIn("Home", [w["name"] for w in result])

	def test_items_are_flat_dto_with_expected_fields(self):
		frappe.set_user("Administrator")
		result = sidebar()
		home = next(w for w in result if w["name"] == "Home")
		self.assertEqual(set(home.keys()), {"name", "label", "icon", "parent"})

	def test_guest_is_rejected(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			sidebar()


class TestWorkspacesPage(IntegrationTestCase):
	def test_home_page_returns_shortcuts_and_cards(self):
		frappe.set_user("Administrator")
		result = page("Home")
		self.assertEqual(result["name"], "Home")
		self.assertTrue(result["shortcuts"])
		self.assertTrue(result["cards"])

	def test_cards_are_grouped_not_a_flat_list_of_links(self):
		frappe.set_user("Administrator")
		result = page("Home")
		# Подписи переводятся на язык сайта, поэтому проверяем структуру, а не слова.
		# Устойчивый признак — link_to: это имя DocType, оно не переводится никогда.
		self.assertGreater(len(result["cards"]), 1)

		targets = {card["title"]: [link["link_to"] for link in card["links"]] for card in result["cards"]}
		self.assertTrue(all(title for title in targets), "у карточки не должно быть пустого заголовка")

		with_account = [links for links in targets.values() if "Account" in links]
		with_item = [links for links in targets.values() if "Item" in links]
		self.assertEqual(len(with_account), 1, "Account ожидается ровно в одной карточке")
		self.assertEqual(len(with_item), 1, "Item ожидается ровно в одной карточке")

		# Ссылки разложены по разным карточкам, а не свалены в одну.
		self.assertNotIn("Item", with_account[0])
		self.assertNotIn("Account", with_item[0])

	def test_labels_are_translated_to_site_language(self):
		frappe.set_user("Administrator")
		self.assertEqual(frappe._("Buying"), page("Buying")["label"])

	def test_guest_is_rejected(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			page("Home")


class TestWorkspacesModules(IntegrationTestCase):
	"""Плитки главной строятся из Desktop Icon — того же источника, что у Desk."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		# Иконки кэшируются по пользователю, а тесты переключают пользователя
		# внутри одного процесса — сбрасываем кэш и сессию сами.
		from frappe.desk.doctype.desktop_icon.desktop_icon import clear_desktop_icons_cache

		clear_desktop_icons_cache()

	def _icons(self):
		

		from frappe.boot import get_sidebar_items
		from frappe.desk.desktop import get_workspaces
		from frappe.desk.doctype.desktop_icon.desktop_icon import get_desktop_icons

		allowed = [page["name"] for page in get_workspaces()["pages"]]
		bootinfo = frappe._dict(workspace_sidebar_item=get_sidebar_items(allowed))
		return [icon for icon in get_desktop_icons(bootinfo=bootinfo) if not icon.get("hidden")]

	def test_top_level_matches_visible_icons_without_visible_parent(self):
		frappe.set_user("Administrator")
		icons = self._icons()
		visible = {icon["name"] for icon in icons}
		# Ребёнок скрытого родителя поднимается наверх — так же ведёт себя Desk.
		expected = {i["name"] for i in icons if not i.get("parent_icon") or i["parent_icon"] not in visible}

		self.assertEqual(expected, {section["key"] for section in modules()})

	def test_children_are_attached_to_their_visible_parent(self):
		frappe.set_user("Administrator")
		icons = self._icons()
		visible = {icon["name"] for icon in icons}
		by_key = {section["key"]: section for section in modules()}

		for icon in icons:
			parent = icon.get("parent_icon")
			if parent and parent in visible:
				nested = [item["key"] for item in by_key[parent]["items"]]
				self.assertIn(icon["name"], nested)

	def test_section_carries_fields_the_launcher_needs(self):
		frappe.set_user("Administrator")
		section = modules()[0]
		self.assertEqual(
			{"key", "label", "icon", "logo", "color", "sidebar", "count", "items"},
			set(section),
		)
		self.assertTrue(section["label"], "у плитки не должно быть пустой подписи")

	def test_labels_are_translated(self):
		frappe.set_user("Administrator")
		labels = {section["key"]: section["label"] for section in modules()}
		if "Buying" in labels:
			self.assertEqual(frappe._("Buying"), labels["Buying"])

	def test_count_matches_links_in_group(self):
		"""Счётчик на плитке — это число ссылок в её разделе, а не выдумка."""
		frappe.set_user("Administrator")
		for section in modules():
			for entry in [section, *section["items"]]:
				if entry["sidebar"]:
					expected = len(sidebar_group(entry["sidebar"])["links"])
					self.assertEqual(expected, entry["count"], entry["key"])

	def test_every_tile_is_reachable(self):
		"""Мёртвых плиток быть не должно: либо вложенные, либо свой раздел."""
		frappe.set_user("Administrator")
		for section in modules():
			self.assertTrue(
				section["items"] or section["sidebar"],
				f"плитка {section['key']} никуда не ведёт",
			)
			for item in section["items"]:
				self.assertTrue(item["sidebar"], f"плитка {item['key']} никуда не ведёт")

	def test_sidebar_group_returns_links(self):
		frappe.set_user("Administrator")
		section = next(s for s in modules() if s["items"])
		group = sidebar_group(section["items"][0]["sidebar"])
		self.assertTrue(group["label"])
		for link in group["links"]:
			self.assertTrue(link["link_to"])
			self.assertTrue(link["link_type"])

	def test_guest_is_rejected(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			modules()
