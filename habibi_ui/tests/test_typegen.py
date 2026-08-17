from frappe.tests import IntegrationTestCase

from habibi_ui.typegen import render_types


class TestTypegen(IntegrationTestCase):
	def test_renders_interfaces_for_exported_dataclasses(self):
		output = render_types()
		self.assertIn("export interface Module {", output)
		self.assertIn("key: string;", output)
		self.assertIn("export interface Me {", output)
		self.assertIn("roles: string[];", output)
		self.assertIn("modules: Module[];", output)

	def test_output_is_marked_as_generated(self):
		self.assertTrue(render_types().startswith("// Файл сгенерирован"))
