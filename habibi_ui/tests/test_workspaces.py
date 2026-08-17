import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1.workspaces import page, sidebar


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
		# Домашнее пространство ERPNext заведомо содержит несколько карточек
		# ("Accounting", "Stock" и т.д.), каждая — со своими ссылками.
		self.assertGreater(len(result["cards"]), 1)
		titles = [card["title"] for card in result["cards"]]
		self.assertIn("Accounting", titles)
		accounting = next(card for card in result["cards"] if card["title"] == "Accounting")
		self.assertGreater(len(accounting["links"]), 1)
		link_labels = [link["label"] for link in accounting["links"]]
		self.assertIn("Customer", link_labels)
		# А не единая карточка со всеми ссылками разом.
		stock = next(card for card in result["cards"] if card["title"] == "Stock")
		self.assertNotIn("Item", link_labels)
		self.assertIn("Item", [link["label"] for link in stock["links"]])

	def test_guest_is_rejected(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			page("Home")
