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
from frappe.desk.desktop import Workspace, get_workspaces


@dataclass
class WorkspaceRef:
	name: str
	label: str
	icon: str
	parent: str


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
				label=page["label"],
				icon=page["icon"] or "",
				parent=page["parent_page"] or "",
			)
		)
		for page in result["pages"]
	]


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
			label=item["label"],
			link_to=item.get("link_to") or "",
			link_type=item.get("type") or "",
			icon=item.get("icon") or "",
			color=item.get("color") or "",
		)
		for item in workspace.shortcuts["items"]
	]

	cards = [
		Card(
			title=card["label"],
			links=[
				CardLink(
					label=link["label"],
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

	return asdict(WorkspacePage(name=doc.name, label=doc.title, shortcuts=shortcuts, cards=cards))
