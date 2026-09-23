"""Какие поля раздела кабинета видны и какие пишутся.

Без frappe: это граница данных кабинета, и её тесты не должны ждать сайт.
Права Frappe работают поверх — этот модуль их не заменяет, а сужает.
"""

import json
from dataclasses import dataclass

# Эти поля не пишутся никогда, даже если их по ошибке перечислили в разделе:
# ими управляет жизненный цикл документа, а не владелец бизнеса.
SYSTEM_FIELDS = frozenset(
	{"name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "doctype", "parent"}
)

# Операторы фильтра, которые кабинет пропускает. Остальное — не ошибка, а мусор
# с фронта, и он молча отбрасывается.
OPERATORS = frozenset({"=", "!=", "<", ">", "<=", ">=", "like", "not like", "in", "not in", "is"})


@dataclass(frozen=True)
class FieldSpec:
	fieldname: str
	label: str | None
	adapter: bool


def parse_fields(text):
	"""Строки раздела: `fieldname`, `fieldname:Подпись`, `@adapter:Подпись`."""
	specs, seen = [], set()
	for raw in (text or "").splitlines():
		line = raw.strip()
		if not line:
			continue
		name, _, label = line.partition(":")
		name = name.strip()
		adapter = name.startswith("@")
		name = name.lstrip("@")
		if not name or name in seen:
			continue
		seen.add(name)
		specs.append(FieldSpec(name, label.strip() or None, adapter))
	return specs


def split_values(values, specs):
	"""Разделить присланное на поля документа и адаптеры; остальное выбросить."""
	plain_names = {s.fieldname for s in specs if not s.adapter} - SYSTEM_FIELDS
	adapter_names = {s.fieldname for s in specs if s.adapter}
	plain = {k: v for k, v in (values or {}).items() if k in plain_names}
	adapters = {k: v for k, v in (values or {}).items() if k in adapter_names}
	return plain, adapters


def merge_filters(base, user, allowed):
	"""Базовый фильтр раздела AND пользовательский.

	Пользовательский фильтр по полю из базового отбрасывается целиком: иначе
	`disabled = 1` рядом с базовым `disabled = 0` дал бы пустой список, а
	`!=` — обход. Базовый фильтр задаёт супер-админ; битый JSON — ошибка
	настройки, и она должна быть видна, а не превращаться в «без фильтра».
	"""
	result = []
	if base:
		parsed = json.loads(base)
		if isinstance(parsed, dict):
			result = [[k, "=", v] for k, v in parsed.items()]
		else:
			result = [list(f) for f in parsed]
	locked = {f[0] for f in result}
	for f in user or []:
		if not isinstance(f, list | tuple) or len(f) != 3:
			continue
		field, op, value = f
		if field in allowed and field not in locked and str(op).lower() in OPERATORS:
			result.append([field, str(op).lower(), value])
	return result
