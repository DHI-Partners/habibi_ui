"""Генерация TypeScript-типов из датаклассов API.

OpenAPI во Frappe нет, у whitelisted-методов нет схемы ответа, поэтому источник
истины — датаклассы, а фронт получает типы из них. Вывод коммитится, расхождение
ловится в CI.
"""

from dataclasses import fields, is_dataclass
from typing import get_type_hints

from habibi_ui.api.v1.session import Me, Module

HEADER = "// Файл сгенерирован командой `bench --site <site> habibi-ui generate-types`.\n// Править руками бессмысленно — изменения затрёт следующая генерация.\n"

# Порядок значим: зависимые типы должны быть объявлены раньше тех, кто их использует.
EXPORTED = [Module, Me]

SCALARS = {str: "string", int: "number", float: "number", bool: "boolean"}


def _ts_type(annotation) -> str:
	if annotation in SCALARS:
		return SCALARS[annotation]

	origin = getattr(annotation, "__origin__", None)
	if origin is list:
		(inner,) = annotation.__args__
		return f"{_ts_type(inner)}[]"

	if is_dataclass(annotation):
		return annotation.__name__

	raise TypeError(f"Нет отображения в TypeScript для {annotation!r}")


def render_types() -> str:
	blocks = []
	for dataclass_type in EXPORTED:
		# get_type_hints, а не field.type: в Python 3.14 аннотации вычисляются отложенно
		# (PEP 649), и field.type может оказаться строкой.
		hints = get_type_hints(dataclass_type)
		lines = [f"export interface {dataclass_type.__name__} {{"]
		for field in fields(dataclass_type):
			lines.append(f"  {field.name}: {_ts_type(hints[field.name])};")
		lines.append("}")
		blocks.append("\n".join(lines))

	return HEADER + "\n" + "\n\n".join(blocks) + "\n"
