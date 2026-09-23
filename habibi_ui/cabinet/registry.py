"""Адаптеры полей и флаги возможностей — из хуков приложений.

habibi_ui не знает, какие приложения стоят на сайте: адаптер цены живёт в
habibi_ai, и прямой импорт отсюда создал бы цикл зависимостей.
"""

import frappe


def adapter(name):
	paths = frappe.get_hooks("habibi_cabinet_adapters") or {}
	# get_hooks для словаря отдаёт списки значений: последнее приложение побеждает
	path = paths.get(name)
	if not path:
		return None
	if isinstance(path, list):
		path = path[-1]
	return frappe.get_attr(path)


def enabled_features():
	result = set()
	for path in frappe.get_hooks("habibi_cabinet_features") or []:
		result |= set(frappe.get_attr(path)())
	return result
