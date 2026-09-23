import json

import frappe
from frappe import _
from frappe.model.document import Document


class CabinetSettings(Document):
	def validate(self):
		seen = set()
		for row in self.sections:
			if row.key in seen:
				frappe.throw(_("Раздел с ключом {0} уже есть").format(row.key))
			seen.add(row.key)
			if row.base_filters:
				try:
					json.loads(row.base_filters)
				except ValueError:
					frappe.throw(_("Раздел {0}: базовый фильтр — не JSON").format(row.key))
