"""Кабинет владельца: разделы из Cabinet Settings и их данные.

Методы работают с правами пользователя — поверх них здесь режутся поля:
ни одно поле вне конфигурации раздела не читается и не пишется. Граница
безопасности — набор DocType, на которые у ролей кабинета есть права; фильтр
полей держит экран простым и служебные поля нетронутыми.
"""

from dataclasses import asdict, dataclass

import frappe
from frappe import _
from frappe.model import default_fields

from habibi_ui.cabinet import registry
from habibi_ui.cabinet.fields import merge_filters, parse_fields, split_values

CABINET_ROLES = ("Habibi Owner", "Habibi Staff")
PAGE_LIMIT = 100

# Служебные поля Frappe (frappe.model.default_fields) не имеют DocField в мете
# доктайпа — meta.get_field() отдаёт по ним None. Кабинет всё равно должен их
# показывать: например docstatus нужен для orders-раздела и Home-фильтра, и
# без этих подписей весь раздел выпадал бы из config() как «битый».
_DEFAULT_FIELD_LABELS = {"name": _("Номер"), "docstatus": _("Проведён")}
_DEFAULT_FIELD_TYPES = {"docstatus": "Int", "idx": "Int", "creation": "Datetime", "modified": "Datetime"}


@dataclass
class CabinetField:
	fieldname: str
	label: str
	fieldtype: str
	options: str
	reqd: bool
	read_only: bool


@dataclass
class CabinetSection:
	key: str
	label: str
	icon: str
	kind: str
	screen: str
	doctype: str
	can_create: bool
	can_edit: bool
	can_delete: bool
	list_fields: list[CabinetField]
	form_fields: list[CabinetField]


def _visible(row, roles, features):
	if row.feature and row.feature not in features:
		return False
	wanted = {r.strip() for r in (row.roles or "").splitlines() if r.strip()}
	if wanted:
		return bool(wanted & roles) or "System Manager" in roles
	return bool(set(CABINET_ROLES) & roles) or "System Manager" in roles


def _describe(meta, specs):
	"""Мета полей; None — если хоть одного поля на сайте нет."""
	result = []
	for spec in specs:
		if spec.adapter:
			a = registry.adapter(spec.fieldname)
			if a is None or a.doctype != meta.name:
				return None
			result.append(
				CabinetField(spec.fieldname, spec.label or a.label, a.fieldtype, "", False, not a.editable())
			)
			continue
		df = meta.get_field(spec.fieldname)
		if df is None:
			if spec.fieldname not in default_fields:
				return None
			result.append(
				CabinetField(
					spec.fieldname,
					spec.label or _DEFAULT_FIELD_LABELS.get(spec.fieldname, spec.fieldname),
					_DEFAULT_FIELD_TYPES.get(spec.fieldname, "Data"),
					"",
					False,
					True,
				)
			)
			continue
		result.append(
			CabinetField(
				spec.fieldname,
				spec.label or _(df.label),
				df.fieldtype,
				df.options or "",
				bool(df.reqd),
				bool(df.read_only),
			)
		)
	return result


def _sections():
	roles = set(frappe.get_roles())
	features = registry.enabled_features()
	result = {}
	for row in frappe.get_single("Cabinet Settings").sections:
		if not _visible(row, roles, features):
			continue
		if row.kind == "custom":
			result[row.key] = (
				row,
				CabinetSection(
					row.key, row.label, row.icon or "", "custom", row.screen or "", "",
					False, False, False, [], [],
				),
			)
			continue
		if not row.ref_doctype or not frappe.db.exists("DocType", row.ref_doctype):
			frappe.logger("habibi_ui").warning(f"Раздел {row.key}: нет DocType {row.ref_doctype}")
			continue
		meta = frappe.get_meta(row.ref_doctype)
		list_fields = _describe(meta, parse_fields(row.list_fields))
		form_fields = _describe(meta, parse_fields(row.form_fields))
		if list_fields is None or form_fields is None:
			frappe.logger("habibi_ui").warning(f"Раздел {row.key}: поле из конфигурации отсутствует на сайте")
			continue
		result[row.key] = (
			row,
			CabinetSection(
				row.key, row.label, row.icon or "", "generic", "", row.ref_doctype,
				bool(row.can_create), bool(row.can_edit), bool(row.can_delete), list_fields, form_fields,
			),
		)
	return result


def _section(key):
	found = _sections().get(key)
	if not found or found[1].kind != "generic":
		frappe.throw(_("Раздел не найден"), frappe.DoesNotExistError)
	return found


def _require_login():
	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)


def _with_adapters(rows, specs):
	for spec in specs:
		if spec.adapter:
			values = registry.adapter(spec.fieldname).read([r["name"] for r in rows])
			for r in rows:
				r[spec.fieldname] = values.get(r["name"])
	return rows


@frappe.whitelist()
def config():
	_require_login()
	return [asdict(s) for _row, s in _sections().values()]


@frappe.whitelist()
def list(section, filters=None, start=0, page_length=20):
	_require_login()
	row, s = _section(section)
	specs = parse_fields(row.list_fields)
	plain = [f.fieldname for f in specs if not f.adapter]
	page_length = min(int(page_length), PAGE_LIMIT)
	rows = frappe.get_list(
		s.doctype,
		fields=sorted({"name", *plain}),
		filters=merge_filters(row.base_filters, frappe.parse_json(filters) if filters else None, set(plain)),
		order_by="modified desc",
		start=int(start),
		page_length=page_length + 1,
	)
	has_more = len(rows) > page_length
	rows = _with_adapters(rows[:page_length], specs)
	return {"rows": rows, "has_more": has_more}


def _doc_in_section(row, s, name):
	filters = merge_filters(row.base_filters, None, set()) + [["name", "=", name]]
	if not frappe.get_list(s.doctype, filters=filters, pluck="name", limit=1):
		frappe.throw(_("Документ не найден"), frappe.DoesNotExistError)
	return frappe.get_doc(s.doctype, name)


@frappe.whitelist()
def get(section, name):
	_require_login()
	row, s = _section(section)
	doc = _doc_in_section(row, s, name)
	# frappe.get_doc не проверяет права сам — ни на чтение документа (пропускает
	# контроллерный has_permission), ни по permlevel полей (Customize Form →
	# Permission Rules). list() безопасен готовым fields=[...] в get_list, а здесь
	# читаем doc.get(...) напрямую, и без явного вызова уровень поля утекал бы мимо
	# настроенных на сайте правил.
	doc.check_permission("read")
	doc.apply_fieldlevel_read_permissions()
	specs = parse_fields(row.form_fields)
	result = {"name": doc.name}
	for spec in specs:
		if not spec.adapter:
			result[spec.fieldname] = doc.get(spec.fieldname)
	return _with_adapters([result], specs)[0]


@frappe.whitelist(methods=["POST"])
def save(section, values, name=None):
	_require_login()
	row, s = _section(section)
	specs = parse_fields(row.form_fields)
	plain, adapters = split_values(frappe.parse_json(values), specs)
	if name:
		if not s.can_edit:
			frappe.throw(_("Изменение в этом разделе запрещено"), frappe.PermissionError)
		doc = _doc_in_section(row, s, name)
		doc.update(plain)
		doc.save()
	else:
		if not s.can_create:
			frappe.throw(_("Создание в этом разделе запрещено"), frappe.PermissionError)
		doc = frappe.get_doc({"doctype": s.doctype, **plain})
		doc.insert()
	for fieldname, value in adapters.items():
		a = registry.adapter(fieldname)
		if a.editable():
			a.write(doc, value)
	return get(section, doc.name)


@frappe.whitelist(methods=["POST"])
def delete(section, name):
	_require_login()
	row, s = _section(section)
	if not s.can_delete:
		frappe.throw(_("Удаление в этом разделе запрещено"), frappe.PermissionError)
	_doc_in_section(row, s, name)
	frappe.delete_doc(s.doctype, name)
