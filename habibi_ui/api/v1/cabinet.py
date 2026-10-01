"""Кабинет владельца: разделы из Cabinet Settings и их данные.

Методы работают с правами пользователя — поверх них здесь режутся поля:
ни одно поле вне конфигурации раздела не читается и не пишется. Граница
безопасности — набор DocType, на которые у ролей кабинета есть права; фильтр
полей держит экран простым и служебные поля нетронутыми.
"""

import re
from dataclasses import asdict, dataclass

import frappe
from frappe import _
from frappe.model import default_fields

from habibi_ui.cabinet import registry
from habibi_ui.cabinet.fields import merge_filters, parse_fields, split_values

STAFF_ROLES = ("Habibi Owner", "Habibi Staff")
FLOOR_ROLES = ("Habibi Kitchen", "Habibi Courier")
CABINET_ROLES = STAFF_ROLES + FLOOR_ROLES
PAGE_LIMIT = 100
# Типы полей, по которым ищет строка поиска, и поля, по которым можно сортировать
# и отбирать помимо перечисленных в разделе: системные, они есть у любого документа
# Read Only — телефон и почта клиента (Customer.mobile_no, email_id) подтягиваются
# из контакта и живут в поле этого типа; без него по ним нельзя было бы искать
SEARCH_TYPES = frozenset({"Data", "Link", "Small Text", "Text", "Long Text", "Text Editor", "Read Only", "Phone"})
# Короче этого цифр на телефон не похоже: «12» — это номер заказа, а не часть номера
MIN_PHONE_DIGITS = 5
SYSTEM_SORT = frozenset({"creation", "modified", "name"})
DEFAULT_ORDER = "creation desc"

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
	# Пустое roles — владелец и сотрудник, но не кухня и курьер: у тех
	# разделы заводятся явно, иначе они увидели бы заказы, чаты и клиентов.
	return bool(set(STAFF_ROLES) & roles) or "System Manager" in roles


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


def _order_by(order_by, allowed):
	"""«поле asc|desc» только по полям раздела и системным; всё остальное —
	молча по умолчанию (новые сверху): сортировка по скрытому полю выдала бы его
	порядок, а мусор в order_by не должен доходить до SQL."""
	field, _sep, direction = str(order_by or "").strip().partition(" ")
	direction = direction.strip().lower() or "asc"
	if field in allowed and direction in ("asc", "desc"):
		return f"{field} {direction}"
	return DEFAULT_ORDER


def _search_variants(text):
	"""Что искать: набранное как есть и, если это похоже на телефон, только цифры.

	Номер набирают как угодно — «+7 701 555-10-00», «(701) 555 10 00», «8 701…» —
	а хранится он одной строкой «+77015551000», и без этого не нашёлся бы."""
	variants = [text]
	if re.fullmatch(r"[\d\s+()\-]+", text):
		digits = re.sub(r"\D", "", text)
		if len(digits) >= MIN_PHONE_DIGITS:
			variants.append(digits)
			if len(digits) == 11 and digits.startswith("8"):
				variants.append("7" + digits[1:])
	return [*dict.fromkeys(variants)]


def _search_filters(search, s, plain):
	"""Поиск — по номеру и текстовым полям раздела, не по любым полям документа."""
	text = (search or "").strip()
	if not text:
		return None
	fields = [f.fieldname for f in s.list_fields if f.fieldname in plain and f.fieldtype in SEARCH_TYPES]
	return [
		[s.doctype, name, "like", f"%{variant}%"]
		for name in sorted({"name", *fields})
		for variant in _search_variants(text)
	]


def _facet_adapter(specs):
	"""Адаптер раздела с быстрыми фильтрами (статус заказа): знает, как по его
	значению отобрать документы. Нет такого — быстрых фильтров у раздела нет."""
	for spec in specs:
		if spec.adapter:
			a = registry.adapter(spec.fieldname)
			if a is not None and hasattr(a, "facets"):
				return a
	return None


def _facet_filters(specs, facet):
	if not facet:
		return []
	adapter = _facet_adapter(specs)
	for f in adapter.facets() if adapter else []:
		if f["key"] == facet:
			return [[*x] for x in f["filters"]]
	frappe.throw(_("Неизвестный фильтр"), frappe.ValidationError)


def _count(doctype, filters, or_filters=None):
	# v16 не принимает функции SQL строкой в fields — только словарём
	return frappe.get_list(doctype, fields=[{"COUNT": "name", "as": "total"}], filters=filters, or_filters=or_filters)[0][
		"total"
	]


@frappe.whitelist()
def list(section, filters=None, start=0, page_length=20, search=None, order_by=None, facet=None):
	_require_login()
	row, s = _section(section)
	specs = parse_fields(row.list_fields)
	plain = {f.fieldname for f in specs if not f.adapter}
	page_length = min(int(page_length), PAGE_LIMIT)
	user_filters = frappe.parse_json(filters) if filters else None
	# Дата создания — системное поле: по ней отбирают периодом, хотя в списке её может не быть
	flt = merge_filters(row.base_filters, user_filters, plain | {"creation"}) + _facet_filters(specs, facet)
	or_flt = _search_filters(search, s, plain)
	rows = frappe.get_list(
		s.doctype,
		fields=sorted({"name", *plain}),
		filters=flt,
		or_filters=or_flt,
		order_by=_order_by(order_by, plain | SYSTEM_SORT),
		start=int(start),
		page_length=page_length + 1,
	)
	has_more = len(rows) > page_length
	rows = _with_adapters(rows[:page_length], specs)
	return {"rows": rows, "has_more": has_more, "total": _count(s.doctype, flt, or_flt)}


@frappe.whitelist()
def facets(section):
	"""Быстрые фильтры раздела со счётчиками: «Все» и то, что даёт адаптер.

	Счётчик — с базовым фильтром раздела, но без поиска и прочих фильтров: это
	«сколько всего в такой группе», по нему владелец видит, где что висит."""
	_require_login()
	row, s = _section(section)
	adapter = _facet_adapter(parse_fields(row.list_fields))
	if adapter is None:
		return []
	base = merge_filters(row.base_filters, None, set())
	result = [{"key": "", "label": _("Все"), "count": _count(s.doctype, base), "closed": False}]
	for f in adapter.facets():
		result.append(
			{
				"key": f["key"],
				"label": f["label"],
				"count": _count(s.doctype, base + [[*x] for x in f["filters"]]),
				"closed": bool(f.get("closed")),
			}
		)
	return result


@frappe.whitelist()
def board(section, limit=30):
	"""Доска: открытые документы раздела по колонкам быстрых фильтров.

	Колонки — фильтры адаптера, кроме «закрытых» (выдан, отменён): их место в
	списке. В колонке сверху то, что ждёт дольше всех. Нет быстрых фильтров —
	нет и доски."""
	_require_login()
	row, _s = _section(section)
	adapter = _facet_adapter(parse_fields(row.list_fields))
	if adapter is None:
		frappe.throw(_("У этого раздела нет доски"), frappe.ValidationError)
	columns = []
	for f in adapter.facets():
		if f.get("closed"):
			continue
		page = list(section, facet=f["key"], page_length=limit, order_by="creation asc")
		columns.append({"key": f["key"], "label": f["label"], "total": page["total"], "rows": page["rows"], "has_more": page["has_more"]})
	return columns


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
	# Поле только для чтения форма показывает, но не отправляет — а прямой
	# вызов API прислать может. Пишет его сам DocType (fetch_from, расчёт),
	# не пользователь. Адаптеры режет a.editable() ниже.
	read_only = {f.fieldname for f in s.form_fields if f.read_only}
	plain = {k: v for k, v in plain.items() if k not in read_only}
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
