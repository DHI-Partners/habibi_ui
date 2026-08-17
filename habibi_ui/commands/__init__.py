"""Команды bench: `bench --site <site> habibi-ui <команда>`.

Frappe ищет переменную `commands` в модуле <app>.commands.
"""

import os

import click
import frappe
from frappe.commands import get_site, pass_context

from habibi_ui.typegen import render_types

TARGET = os.path.join("frontend", "src", "shared", "types", "api.ts")


@click.group("habibi-ui")
def habibi_ui():
	"""Habibi UI"""
	pass


@click.command("generate-types")
@pass_context
def generate_types(context):
	"""Сгенерировать TypeScript-типы из датаклассов API"""
	site = get_site(context)
	frappe.init(site=site)

	path = os.path.join(frappe.get_app_path("habibi_ui"), "..", TARGET)
	path = os.path.normpath(path)
	with open(path, "w") as f:
		f.write(render_types())
	click.echo(f"Записано: {path}")

	frappe.destroy()


habibi_ui.add_command(generate_types)

commands = [habibi_ui]
