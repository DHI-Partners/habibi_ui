"""Фильтр полей раздела кабинета — граница того, что владелец читает и пишет.

Без frappe: это главный тест безопасности кабинета, и он должен идти за
секунды, а не ждать сайт.
"""

import unittest

from habibi_ui.cabinet.fields import FieldSpec, merge_filters, parse_fields, split_values


class TestParseFields(unittest.TestCase):
	def test_имя_и_подпись(self):
		self.assertEqual(
			parse_fields("item_name:Название\nitem_group"),
			[FieldSpec("item_name", "Название", False), FieldSpec("item_group", None, False)],
		)

	def test_адаптер_помечается_и_теряет_собаку(self):
		self.assertEqual(parse_fields("@selling_price:Цена"), [FieldSpec("selling_price", "Цена", True)])

	def test_пустые_строки_пробелы_и_дубли_пропускаются(self):
		self.assertEqual(parse_fields("  a  \n\n a:Другая\n"), [FieldSpec("a", None, False)])

	def test_пустой_текст(self):
		self.assertEqual(parse_fields(None), [])
		self.assertEqual(parse_fields(""), [])


class TestSplitValues(unittest.TestCase):
	SPECS = parse_fields("item_name\n@selling_price")

	def test_лишнее_поле_не_пишется(self):
		plain, adapters = split_values({"item_name": "Бургер", "valuation_rate": 1, "owner": "x"}, self.SPECS)
		self.assertEqual(plain, {"item_name": "Бургер"})
		self.assertEqual(adapters, {})

	def test_адаптер_отдельно(self):
		plain, adapters = split_values({"selling_price": 2490}, self.SPECS)
		self.assertEqual(plain, {})
		self.assertEqual(adapters, {"selling_price": 2490})

	def test_адаптер_с_собакой_в_ключе_не_принимается(self):
		# Ключи приходят с фронта; "@selling_price" — не наш формат, и пропускать
		# его значило бы иметь два имени у одного поля.
		plain, adapters = split_values({"@selling_price": 1}, self.SPECS)
		self.assertEqual((plain, adapters), ({}, {}))

	def test_служебные_поля_не_пишутся_даже_если_перечислены(self):
		specs = parse_fields("name\nowner\ndocstatus\nitem_name")
		plain, _ = split_values({"name": "X", "owner": "y", "docstatus": 1, "item_name": "Б"}, specs)
		self.assertEqual(plain, {"item_name": "Б"})


class TestMergeFilters(unittest.TestCase):
	def test_базовый_фильтр_не_снимается(self):
		result = merge_filters('{"disabled": 0}', [["disabled", "=", 1]], {"item_name"})
		self.assertEqual(result, [["disabled", "=", 0]])

	def test_пользовательский_только_по_разрешённым(self):
		result = merge_filters(None, [["item_name", "like", "%бур%"], ["valuation_rate", ">", 0]], {"item_name"})
		self.assertEqual(result, [["item_name", "like", "%бур%"]])

	def test_базовый_списком_троек(self):
		self.assertEqual(merge_filters('[["docstatus", "<", 2]]', None, set()), [["docstatus", "<", 2]])

	def test_недопустимый_оператор_отбрасывается(self):
		self.assertEqual(merge_filters(None, [["item_name", "; drop", "x"]], {"item_name"}), [])

	def test_битый_json_базы_это_ошибка_настройки(self):
		with self.assertRaises(ValueError):
			merge_filters("{oops", None, set())


if __name__ == "__main__":
	unittest.main()
