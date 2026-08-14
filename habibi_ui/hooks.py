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

# Кому выдана роль — тот при входе попадает в новый интерфейс, остальные в Desk.
# Включение и откат делаются выдачей и снятием роли, без выкатки.
role_home_page = {
	"Habibi UI": "ui",
}
