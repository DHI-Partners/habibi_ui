"""Разделы главной страницы: список пространств и содержимое одного из них.

Права на пространства не переизобретаются: список отдаёт frappe.desk.desktop.
get_workspaces(), а содержимое конкретного пространства строится классом
Workspace оттуда же — включая его is_permitted(), который сверяет роли
пользователя с ролями, назначенными пространству (в т.ч. кастомные роли через
get_custom_allowed_roles). Мы только переупаковываем результат в плоские DTO.
"""

from dataclasses import asdict, dataclass

import frappe
from frappe import _
from frappe.boot import get_sidebar_items
from frappe.desk.desktop import Workspace, get_workspaces
from frappe.desk.doctype.desktop_icon.desktop_icon import get_desktop_icons


@dataclass
class WorkspaceRef:
	name: str
	label: str
	icon: str
	parent: str


@dataclass
class DesktopItem:
	key: str
	label: str
	icon: str
	logo: str
	color: str
	sidebar: str
	count: int


@dataclass
class DesktopSection:
	key: str
	label: str
	icon: str
	logo: str
	color: str
	sidebar: str
	count: int
	items: list[DesktopItem]


@dataclass
class Shortcut:
	label: str
	link_to: str
	link_type: str
	icon: str
	color: str


@dataclass
class CardLink:
	label: str
	link_to: str
	link_type: str


@dataclass
class Card:
	title: str
	links: list[CardLink]


@dataclass
class WorkspacePage:
	name: str
	label: str
	shortcuts: list[Shortcut]
	cards: list[Card]


def _require_login():
	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)


@frappe.whitelist()
def sidebar() -> list[dict]:
	_require_login()

	result = get_workspaces()
	return [
		asdict(
			WorkspaceRef(
				name=page["name"],
				label=_(page["label"]),
				icon=page["icon"] or "",
				parent=page["parent_page"] or "",
			)
		)
		for page in result["pages"]
	]


def _sidebar_key(icon: dict) -> str:
	"""Куда ведёт плитка: имя группы Workspace Sidebar.

	В Desktop Icon почти все записи имеют link_type = "Workspace Sidebar", а
	link_to — имя группы. Группа и есть содержимое раздела: список ссылок на
	документы и отчёты.
	"""
	if icon.get("link_type") == "Workspace Sidebar" and icon.get("link_to"):
		return icon["link_to"]
	return ""


def _item(icon: dict, groups: dict) -> DesktopItem:
	key = _sidebar_key(icon)
	group = groups.get(key.lower()) if key else None
	links = [link for link in (group.get("items") if group else []) or [] if link.get("type") == "Link"]
	return DesktopItem(
		key=icon["name"],
		label=_(icon["label"]),
		icon=icon.get("icon") or "",
		logo=icon.get("logo_url") or "",
		color=icon.get("bg_color") or "",
		sidebar=key,
		count=len(links),
	)


@frappe.whitelist()
def modules() -> list[dict]:
	"""Плитки главной: то же, что показывает Desk, и из того же источника.

	Источник — Desktop Icon и штатная get_desktop_icons(), которая сверяет роли
	пользователя с ролями иконки. Свою фильтрацию не пишем: на мультиарендной
	системе цена ошибки в правах слишком велика.

	Иерархию задаёт поле parent_icon: верхний уровень — иконки без родителя.
	"""
	_require_login()

	# get_desktop_icons без bootinfo возвращает ПУСТОЙ список: вся фильтрация по
	# правам у неё внутри условия `if bootinfo`. Поэтому собираем ту же часть
	# загрузочного пакета, что и сам Desk, теми же функциями фреймворка.
	allowed = [page["name"] for page in get_workspaces()["pages"]]
	groups = get_sidebar_items(allowed)
	bootinfo = frappe._dict(workspace_sidebar_item=groups)

	visible = [dict(icon) for icon in get_desktop_icons(bootinfo=bootinfo) if not icon.get("hidden")]
	visible_names = {icon["name"] for icon in visible}

	# Ребёнок скрытого родителя поднимается на верхний уровень. Так ведёт себя и
	# сам Desk: группа приложения помечена hidden, а её разделы видны плитками.
	def is_top_level(icon: dict) -> bool:
		parent = icon.get("parent_icon")
		return not parent or parent not in visible_names

	children: dict[str, list[DesktopItem]] = {}
	for icon in visible:
		if not is_top_level(icon):
			children.setdefault(icon["parent_icon"], []).append(_item(icon, groups))

	sections = []
	for icon in visible:
		if not is_top_level(icon):
			continue
		base = _item(icon, groups)
		sections.append(
			DesktopSection(
				key=base.key,
				label=base.label,
				icon=base.icon,
				logo=base.logo,
				color=base.color,
				sidebar=base.sidebar,
				count=base.count,
				items=children.get(icon["name"], []),
			)
		)

	return [asdict(section) for section in sections]


@dataclass
class SidebarLink:
	label: str
	link_to: str
	link_type: str
	icon: str


@dataclass
class SidebarGroup:
	key: str
	label: str
	links: list[SidebarLink]


@frappe.whitelist()
def sidebar_group(name: str) -> dict:
	"""Содержимое группы Workspace Sidebar — то, что открывается по плитке.

	Карту групп строит штатная get_sidebar_items(): она уже отфильтровала
	ссылки по правам пользователя, поэтому своих проверок не добавляем.
	"""
	_require_login()

	allowed = [page["name"] for page in get_workspaces()["pages"]]
	groups = get_sidebar_items(allowed)
	group = groups.get(name.lower())
	if not group:
		frappe.throw(_("Раздел не найден"), frappe.DoesNotExistError)

	links = [
		SidebarLink(
			label=_(link.get("label") or ""),
			link_to=link.get("link_to") or "",
			link_type=link.get("link_type") or "",
			icon=link.get("icon") or "",
		)
		for link in group.get("items") or []
		if link.get("type") == "Link"
	]

	return asdict(SidebarGroup(key=name, label=_(group.get("label") or name), links=links))


@frappe.whitelist()
def page(name: str) -> dict:
	_require_login()

	doc = frappe.get_cached_doc("Workspace", name)

	# Тот же порядок проверок, что и в get_workspaces(): Workspace Manager видит
	# всё (иначе не смог бы редактировать чужие пространства), остальным решает
	# is_permitted() — штатная сверка ролей.
	workspace = Workspace({"name": doc.name, "title": doc.title, "public": doc.public})
	has_access = "Workspace Manager" in frappe.get_roles()
	if not has_access and not workspace.is_permitted():
		frappe.throw(_("Нет доступа к разделу"), frappe.PermissionError)

	workspace.build_workspace()

	shortcuts = [
		Shortcut(
			label=_(item["label"]),
			link_to=item.get("link_to") or "",
			link_type=item.get("type") or "",
			icon=item.get("icon") or "",
			color=item.get("color") or "",
		)
		for item in workspace.shortcuts["items"]
	]

	cards = [
		Card(
			title=_(card["label"]),
			links=[
				CardLink(
					label=_(link["label"]),
					link_to=link.get("link_to") or "",
					link_type=link.get("link_type") or "",
				)
				for link in card.get("links", [])
				if not link.get("hidden")
			],
		)
		for card in workspace.cards["items"]
		if not card.get("hidden")
	]

	return asdict(WorkspacePage(name=doc.name, label=_(doc.title), shortcuts=shortcuts, cards=cards))
