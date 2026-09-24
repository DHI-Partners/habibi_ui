app_name = "habibi_ui"
app_title = "Habibi UI"
app_publisher = "Habeebe"
app_description = "Собственный фронтенд поверх ERPNext"
app_email = "dosnet2200@gmail.com"
app_license = "mit"

# Весь фронт работает поверх данных ERPNext, ставить его на голый frappe бессмысленно.
required_apps = ["erpnext"]

# Клиентский роутинг: любой вложенный путь отдаёт ту же страницу, разбирается он в браузере.
website_route_rules = [
	{"from_route": "/ui/<path:app_path>", "to_route": "ui"},
]

# Роль-переключатель приезжает фикстурой: без неё role_home_page ниже ссылается
# на несуществующую роль, и включить интерфейс нечем. Habibi Owner и Habibi
# Staff — роли кабинета: их обладатель без System Manager попадает в кабинет,
# а не в лаунчер (см. _home() в api/v1/session.py).
fixtures = [
	{"dt": "Role", "filters": [["name", "in", ["Habibi UI", "Habibi Owner", "Habibi Staff"]]]},
]

# Кому выдана роль — тот при входе попадает в новый интерфейс, остальные в Desk.
# Включение и откат делаются выдачей и снятием роли, без выкатки.
role_home_page = {
	"Habibi UI": "ui",
	"Habibi Owner": "ui",
	"Habibi Staff": "ui",
}

# Кабинет — отдельное приложение на экране приложений Frappe. По нему же
# get_default_path() ведёт вошедшего с User.default_app = habibi_ui в /ui/c
# (frappe/apps.py:get_route), а default_app ролям кабинета ставит хук ниже.
add_to_apps_screen = [
	{
		"name": app_name,
		"logo": "/assets/habibi_ui/images/cabinet.svg",
		"title": "Кабинет",
		"route": "/ui/c",
		"has_permission": "habibi_ui.cabinet.access.has_app_permission",
	}
]

doc_events = {
	"User": {"validate": "habibi_ui.cabinet.access.set_default_app"},
}

# Desk для ролей кабинета закрыт: страница Desk уводит их в кабинет.
update_website_context = ["habibi_ui.cabinet.access.send_desk_to_cabinet"]
