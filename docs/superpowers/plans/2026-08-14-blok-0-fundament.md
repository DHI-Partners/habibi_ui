# Блок 0. Фундамент habibi_ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пустой React-SPA внутри Frappe-приложения `habibi_ui` открывается на сайте по своей сессии, показывает данные текущего пользователя из собственного API и приезжает на прод существующим конвейером сборки образа.

**Architecture:** `habibi_ui` — обычное Frappe-приложение. Внутри `frontend/` лежит Vite+React проект, который собирается в `habibi_ui/public/frontend/`. Сборку запускает сам `bench build`: он выполняет `yarn build` в корне приложения, если в `package.json` есть такой скрипт (`apps/frappe/esbuild/esbuild.js:511-542`). Страница-обёртка `habibi_ui/www/ui.html` отдаёт бандл, проверяет сессию и передаёт в браузер CSRF-токен — ровно так, как это делает сам Desk (`apps/frappe/frappe/www/desk.py`). Фронт ходит только в свои whitelisted-методы через типизированный клиент.

**Tech Stack:** Python 3.14, Frappe 16.31, React 19, TypeScript 5, Vite 7, TanStack Query 5, yarn.

**Spec:** `docs/superpowers/specs/2026-08-14-habibi-ui-design.md`

## Global Constraints

- Ветка приложения — `main`, как у `habibi_core`.
- Python `>=3.14`, сборка через `flit_core >=3.4,<4`.
- Форматирование Python — ruff, `line-length = 110`, отступы табами, двойные кавычки; конфиг копируется из `habibi_core/pyproject.toml` целиком.
- Комментарии и сообщения коммитов — по-русски, как в `habibi_core` и `habibi_docker`.
- Тесты Python — `frappe.tests.IntegrationTestCase`, запуск `bench --site dev.localhost run-tests --app habibi_ui`.
- Все обращения к данным из фронта — только через методы `habibi_ui.api.v1.*`. Прямые запросы к `/api/resource` и `/api/v2/document` в Блоке 0 запрещены.
- Запись в базу — только через `frappe.get_doc(...).save()`; `frappe.db.sql` и `ignore_permissions=True` в этом блоке не используются вообще.
- `yarn.lock` обязан быть в git: `bench build` вызывает `yarn install --frozen-lockfile`, без файла сборка образа упадёт.
- Node и yarn есть только в builder-стадии образа (`frappe/build:version-16`); в рантайм-контейнере их нет. Поэтому `bench build` на проде не запускается никогда — фронт собирается при сборке образа.
- Маршрут SPA в этом блоке — `/ui`. Корень сайта не занимаем: по спеке это открытый вопрос, и сейчас на корне посторонний сайт. Перенос в корень — отдельная задача после решения вопроса.

---

### Task 1: Локальное dev-окружение с рабочей копией habibi_ui

Без бенча ни один следующий шаг не проверяем. Ставим по `habibi_docker/habibi/dev-setup.md`, добавляя монтирование рабочей копии `habibi_ui` внутрь `apps/`, чтобы правки на хосте сразу видел контейнер.

**Files:**
- Create: `habibi_docker/.devcontainer/devcontainer.json` (копия примера)
- Create: `habibi_docker/.devcontainer/docker-compose.yml` (копия примера + один том)
- Modify: `habibi_docker/.devcontainer/docker-compose.yml` — сервис `frappe`, секция `volumes`

`.devcontainer/` в `.gitignore` — эти файлы не коммитятся.

- [ ] **Step 1: Развернуть devcontainer из примера**

```bash
cd /Users/fsa/Projects/habibi/habibi_docker
cp -R devcontainer-example .devcontainer
cp -R development/vscode-example development/.vscode
docker compose -f .devcontainer/docker-compose.yml up -d
```

- [ ] **Step 2: Создать бенч и сайт внутри контейнера**

Монтирования `habibi_ui` пока НЕТ намеренно: `bench init` отказывается работать в непустом каталоге, а том создал бы `frappe-bench/apps/habibi_ui` заранее.

```bash
docker compose -f .devcontainer/docker-compose.yml exec frappe bash -lc '
cd /workspace/development &&
bench init --skip-redis-config-generation --frappe-branch version-16 frappe-bench &&
cd frappe-bench &&
bench set-config -g db_host mariadb &&
bench set-config -g redis_cache redis://redis-cache:6379 &&
bench set-config -g redis_queue redis://redis-queue:6379 &&
bench set-config -g redis_socketio redis://redis-queue:6379 &&
bench new-site dev.localhost --mariadb-user-host-login-scope=% --db-root-password 123 --admin-password admin &&
bench use dev.localhost &&
bench --site dev.localhost set-config developer_mode 1'
```

- [ ] **Step 3: Поставить erpnext (habibi_ui требует его через required_apps)**

```bash
docker compose -f .devcontainer/docker-compose.yml exec frappe bash -lc '
cd /workspace/development/frappe-bench &&
bench get-app https://github.com/frappe/erpnext --branch version-16 &&
bench --site dev.localhost install-app erpnext'
```

- [ ] **Step 4: Примонтировать рабочую копию habibi_ui**

В `.devcontainer/docker-compose.yml`, сервис `frappe`, в `volumes` добавить вторую строку:

```yaml
    volumes:
      - ..:/workspace:cached
      - ../../habibi_ui:/workspace/development/frappe-bench/apps/habibi_ui:cached
```

Путь `../../habibi_ui` считается от каталога `.devcontainer/`, то есть указывает на `/Users/fsa/Projects/habibi/habibi_ui`.

- [ ] **Step 5: Перезапустить контейнеры и проверить монтирование**

```bash
cd /Users/fsa/Projects/habibi/habibi_docker
docker compose -f .devcontainer/docker-compose.yml up -d --force-recreate frappe
docker compose -f .devcontainer/docker-compose.yml exec frappe \
  ls /workspace/development/frappe-bench/apps/habibi_ui/docs/superpowers/specs
```

Expected: в выводе `2026-08-14-habibi-ui-design.md`. Если каталог пуст — том не подхватился, дальше идти нельзя.

- [ ] **Step 6: Зафиксировать команду входа в бенч**

Дальше в плане эта строка используется как `<BENCH>`:

```bash
docker compose -f .devcontainer/docker-compose.yml exec frappe bash -lc 'cd /workspace/development/frappe-bench && <команда>'
```

Коммита в этой задаче нет: `.devcontainer/` в `.gitignore`, а `habibi_ui` ещё не изменялся.

---

### Task 2: Скелет Frappe-приложения и его установка на сайт

**Files:**
- Create: `pyproject.toml`
- Create: `habibi_ui/__init__.py`
- Create: `habibi_ui/hooks.py`
- Create: `habibi_ui/modules.txt`
- Create: `habibi_ui/patches.txt`
- Create: `habibi_ui/api/__init__.py`
- Create: `habibi_ui/api/v1/__init__.py`
- Create: `habibi_ui/tests/__init__.py`
- Create: `habibi_ui/tests/test_app.py`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Produces: пакет `habibi_ui` с модулем `Habibi UI`, устанавливаемый на сайт; пакет `habibi_ui.api.v1`, в который следующие задачи добавляют методы.

- [ ] **Step 1: Написать падающий тест**

`habibi_ui/tests/test_app.py`:

```python
import frappe
from frappe.tests import IntegrationTestCase


class TestApp(IntegrationTestCase):
	def test_app_installed(self):
		# Приложение должно быть установлено на сайт, а не просто лежать в apps/.
		self.assertIn("habibi_ui", frappe.get_installed_apps())
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui`
Expected: FAIL — приложения нет, bench сообщает `ModuleNotFoundError: No module named 'habibi_ui'`.

- [ ] **Step 3: Создать файлы приложения**

`pyproject.toml` — копия `habibi_core/pyproject.toml` с заменёнными `name` и `description`:

```toml
[project]
name = "habibi_ui"
authors = [
    { name = "Habeebe", email = "dosnet2200@gmail.com"}
]
description = "Собственный фронтенд поверх ERPNext"
requires-python = ">=3.14"
readme = "README.md"
dynamic = ["version"]
dependencies = []

[build-system]
requires = ["flit_core >=3.4,<4"]
build-backend = "flit_core.buildapi"

[tool.ruff]
line-length = 110
target-version = "py314"

[tool.ruff.lint]
select = ["F", "E", "W", "I", "UP", "B", "RUF"]
ignore = [
    "B017", "B018", "B023", "B904",
    "E101", "E402", "E501", "E741",
    "F401", "F403", "F405", "F722",
    "W191",
    "UP030", "UP031", "UP032", "UP037", "UP040",
]
typing-modules = ["frappe.types.DF"]

[tool.ruff.format]
quote-style = "double"
indent-style = "tab"
docstring-code-format = true
```

`habibi_ui/__init__.py`:

```python
__version__ = "0.0.1"
```

`habibi_ui/hooks.py`:

```python
app_name = "habibi_ui"
app_title = "Habibi UI"
app_publisher = "Habeebe"
app_description = "Собственный фронтенд поверх ERPNext"
app_email = "dosnet2200@gmail.com"
app_license = "mit"

# Весь фронт работает поверх данных ERPNext, ставить его на голый frappe бессмысленно.
required_apps = ["erpnext"]
```

`habibi_ui/modules.txt` (без завершающего перевода строки, как в `habibi_core`):

```
Habibi UI
```

`habibi_ui/patches.txt`:

```
[pre_model_sync]

[post_model_sync]
```

`habibi_ui/api/__init__.py`, `habibi_ui/api/v1/__init__.py`, `habibi_ui/tests/__init__.py` — пустые файлы.

`.gitignore`:

```
__pycache__/
*.py[cod]
.venv/
node_modules/
habibi_ui/public/frontend/
.DS_Store
```

Каталог сборки в `.gitignore` намеренно: собранный бандл — артефакт, его делает `bench build`.

`README.md`:

```markdown
### Habibi UI

Собственный фронтенд поверх ERPNext: React-SPA внутри Frappe-приложения.
Отдаётся тем же сайтом по той же сессии, ходит только в свои методы `habibi_ui.api.v1.*`.

Дизайн: `docs/superpowers/specs/2026-08-14-habibi-ui-design.md`

### Установка

Приложение попадает в образ через `habibi/apps.json` в
[habibi_docker](https://github.com/DHI-Partners/habibi_docker). На сайте:

```bash
bench --site <site> install-app habibi_ui
```

### Ветка

`main`.

### License

mit
```

- [ ] **Step 4: Зарегистрировать приложение в бенче и поставить на сайт**

```bash
<BENCH> ./env/bin/pip install -e apps/habibi_ui
<BENCH> bash -c 'grep -qx habibi_ui sites/apps.txt || echo habibi_ui >> sites/apps.txt'
<BENCH> bench --site dev.localhost install-app habibi_ui
```

- [ ] **Step 5: Запустить тест и убедиться, что он проходит**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui`
Expected: PASS, 1 тест.

- [ ] **Step 6: Коммит**

```bash
cd /Users/fsa/Projects/habibi/habibi_ui
git add .
git commit -m "feat: скелет Frappe-приложения habibi_ui"
```

---

### Task 3: Метод session.me()

Первая и единственная точка входа фронта в этом блоке. Возвращает то, что нужно оболочке: кто вошёл и какие модули ему доступны.

**Files:**
- Create: `habibi_ui/api/v1/session.py`
- Create: `habibi_ui/tests/test_session.py`

**Interfaces:**
- Produces: `habibi_ui.api.v1.session.me() -> dict` с ключами `user: str`, `full_name: str`, `roles: list[str]`, `modules: list[dict]`, где каждый модуль — `{"key": str, "label": str}`. Задача 6 рендерит из этого навигацию, задача 7 генерирует из этих же датаклассов TypeScript-типы.

Состав модулей в Блоке 0 выводится из установленных на сайте приложений. Фильтрация по плану и аддонам `saas_bridge` — следующий блок; сейчас это осознанно не делается, чтобы у задачи был законченный проверяемый результат.

- [ ] **Step 1: Написать падающие тесты**

`habibi_ui/tests/test_session.py`:

```python
import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.api.v1.session import me


class TestSessionMe(IntegrationTestCase):
	def test_returns_current_user(self):
		frappe.set_user("Administrator")
		result = me()
		self.assertEqual(result["user"], "Administrator")
		self.assertTrue(result["full_name"])

	def test_returns_roles_of_current_user(self):
		frappe.set_user("Administrator")
		result = me()
		self.assertIn("System Manager", result["roles"])

	def test_modules_reflect_installed_apps(self):
		# erpnext стоит всегда: habibi_ui объявляет его в required_apps.
		result = me()
		keys = [m["key"] for m in result["modules"]]
		self.assertIn("erpnext", keys)

	def test_guest_is_rejected(self):
		# Возврат пользователя через addCleanup, а не последней строкой тела:
		# при падении assert соседние тесты не должны достаться Guest-у.
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			me()
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui --module habibi_ui.tests.test_session`
Expected: FAIL с `ModuleNotFoundError: No module named 'habibi_ui.api.v1.session'`.

- [ ] **Step 3: Реализовать метод**

`habibi_ui/api/v1/session.py`:

```python
"""Единственная точка входа оболочки фронта: кто вошёл и что ему доступно."""

from dataclasses import asdict, dataclass

import frappe
from frappe import _

# Заголовки модулей задаются здесь, а не берутся из app_title: в интерфейсе
# они видны пользователю и переводятся отдельно от технических имён приложений.
MODULE_LABELS = {
	"erpnext": "Учёт",
	"habibi_telegram": "Телеграм",
	"habibi_whatsapp": "WhatsApp",
}


@dataclass
class Module:
	key: str
	label: str


@dataclass
class Me:
	user: str
	full_name: str
	roles: list[str]
	modules: list[Module]


def _modules() -> list[Module]:
	installed = frappe.get_installed_apps()
	return [Module(key=app, label=MODULE_LABELS[app]) for app in installed if app in MODULE_LABELS]


@frappe.whitelist()
def me() -> dict:
	if frappe.session.user == "Guest":
		frappe.throw(_("Требуется вход"), frappe.PermissionError)

	return asdict(
		Me(
			user=frappe.session.user,
			full_name=frappe.utils.get_fullname(frappe.session.user),
			roles=frappe.get_roles(),
			modules=_modules(),
		)
	)
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui --module habibi_ui.tests.test_session`
Expected: PASS, 4 теста.

- [ ] **Step 5: Проверить метод по HTTP**

```bash
<BENCH> bench --site dev.localhost execute habibi_ui.api.v1.session.me
```

Expected: словарь с `user`, `full_name`, `roles`, `modules`.

- [ ] **Step 6: Коммит**

```bash
git add habibi_ui/api/v1/session.py habibi_ui/tests/test_session.py
git commit -m "feat(api): метод session.me с пользователем, ролями и модулями"
```

---

### Task 4: Vite + React и сборка через bench build

**Files:**
- Create: `package.json` (корень репозитория)
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `yarn.lock` (генерируется)

**Interfaces:**
- Produces: сборка в `habibi_ui/public/frontend/` с манифестом `habibi_ui/public/frontend/.vite/manifest.json`; ключ входа в манифесте — `index.html`. Задача 5 читает этот манифест из Python.

Каталог `public/` приложения Frappe отдаёт по `/assets/habibi_ui/` — в бенче это симлинк `sites/assets/habibi_ui → apps/habibi_ui/habibi_ui/public`. Отсюда `base` у Vite.

- [ ] **Step 1: Создать package.json в корне приложения**

Скрипт обязан называться `build` и лежать в корневом `package.json`: именно там его ищет `run_build_command_for_apps` (`apps/frappe/esbuild/esbuild.js:520-527`).

```json
{
  "name": "habibi_ui",
  "private": true,
  "scripts": {
    "dev": "vite --config frontend/vite.config.ts",
    "build": "vite build --config frontend/vite.config.ts"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5",
    "typescript": "^5",
    "vite": "^7"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19"
  }
}
```

- [ ] **Step 2: Создать конфиги фронта**

`frontend/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // Frappe отдаёт public/ приложения по этому префиксу.
  base: "/assets/habibi_ui/frontend/",
  build: {
    outDir: "../habibi_ui/public/frontend",
    emptyOutDir: true,
    // Манифест нужен странице-обёртке: имена файлов хешируются.
    manifest: true,
  },
});
```

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Не найден корневой элемент #root");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`frontend/src/App.tsx`:

```tsx
export function App() {
  return <h1>Habibi UI</h1>;
}
```

- [ ] **Step 3: Установить зависимости и зафиксировать lock-файл**

```bash
<BENCH> bash -c 'cd apps/habibi_ui && yarn install'
```

Expected: появился `yarn.lock` в корне `habibi_ui`. Без него `bench build` упадёт на `yarn install --frozen-lockfile`.

- [ ] **Step 4: Собрать через bench и проверить артефакты**

```bash
<BENCH> bench build --app habibi_ui
<BENCH> ls apps/habibi_ui/habibi_ui/public/frontend/.vite/manifest.json
```

Expected: в логе строка `Running build command for habibi_ui`, файл манифеста существует.

- [ ] **Step 5: Проверить, что бандл отдаётся сайтом**

```bash
<BENCH> bench start &
curl -s -o /dev/null -w "%{http_code}\n" http://dev.localhost:8000/assets/habibi_ui/frontend/.vite/manifest.json
```

Expected: `200`.

- [ ] **Step 6: Коммит**

```bash
git add package.json yarn.lock frontend/
git commit -m "feat(frontend): каркас Vite + React, сборка через bench build"
```

---

### Task 5: Страница-обёртка, маршрут и вход по сессии

**Files:**
- Create: `habibi_ui/www/__init__.py`
- Create: `habibi_ui/www/ui.py`
- Create: `habibi_ui/www/ui.html`
- Modify: `habibi_ui/hooks.py` — добавить `website_route_rules` и `role_home_page`
- Create: `habibi_ui/tests/test_www.py`

**Interfaces:**
- Consumes: манифест `habibi_ui/public/frontend/.vite/manifest.json` из задачи 4.
- Produces: маршрут `/ui` и все вложенные пути `/ui/<что угодно>`; в браузере доступны `window.habibi = {csrf_token, user}` — задача 6 читает оттуда токен.

Поведение гостя копирует Desk (`apps/frappe/frappe/www/desk.py:20-27`): 403 и редирект на `/login?redirect-to=...`.

- [ ] **Step 1: Написать падающие тесты**

`habibi_ui/tests/test_www.py`:

```python
import frappe
from frappe.tests import IntegrationTestCase

from habibi_ui.www.ui import assets_from_manifest, get_context


class TestUiPage(IntegrationTestCase):
	def test_manifest_gives_entry_script(self):
		assets = assets_from_manifest()
		self.assertTrue(assets["js"].startswith("/assets/habibi_ui/frontend/"))
		self.assertTrue(assets["js"].endswith(".js"))

	def test_context_has_csrf_token_for_logged_in_user(self):
		frappe.set_user("Administrator")
		context = frappe._dict()
		get_context(context)
		self.assertTrue(context["csrf_token"])
		self.assertEqual(context["user"], "Administrator")
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui --module habibi_ui.tests.test_www`
Expected: FAIL с `ModuleNotFoundError: No module named 'habibi_ui.www'`.

- [ ] **Step 3: Реализовать страницу**

`habibi_ui/www/__init__.py` — пустой файл.

`habibi_ui/www/ui.py`:

```python
"""Страница-обёртка SPA. Повторяет поведение Desk: сессия, CSRF, отдача бандла."""

import json
import os
from urllib.parse import urlencode

import frappe
# Явный импорт обязателен: frappe.sessions не подтягивается пакетом frappe.
# Так же делает frappe/www/desk.py.
import frappe.sessions
from frappe import _

no_cache = 1

ASSET_PREFIX = "/assets/habibi_ui/frontend/"


def assets_from_manifest() -> dict:
	"""Имена файлов сборки хешируются, поэтому берём их из манифеста Vite."""
	# Путь считается внутри функции: на импорте модуля frappe ещё может быть не поднят.
	path = os.path.join(frappe.get_app_path("habibi_ui"), "public", "frontend", ".vite", "manifest.json")
	with open(path) as f:
		manifest = json.load(f)

	entry = manifest["index.html"]
	return {
		"js": ASSET_PREFIX + entry["file"],
		"css": [ASSET_PREFIX + name for name in entry.get("css", [])],
	}


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.response["status_code"] = 403
		frappe.msgprint(_("Войдите, чтобы открыть страницу."))
		frappe.redirect(f"/login?{urlencode({'redirect-to': frappe.request.path})}")

	assets = assets_from_manifest()
	context.update(
		{
			"no_cache": 1,
			"lang": frappe.local.lang,
			"user": frappe.session.user,
			"csrf_token": frappe.sessions.get_csrf_token(),
			"script": assets["js"],
			"styles": assets["css"],
		}
	)
	return context
```

`habibi_ui/www/ui.html`:

```html
<!DOCTYPE html>
<html lang="{{ lang }}">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Habibi</title>
		{% for style in styles %}
		<link rel="stylesheet" href="{{ style }}" />
		{% endfor %}
	</head>
	<body>
		<div id="root"></div>
		<script>
			window.habibi = {
				csrf_token: "{{ csrf_token }}",
				user: "{{ user }}",
			};
		</script>
		<script type="module" src="{{ script }}"></script>
	</body>
</html>
```

- [ ] **Step 4: Добавить маршруты в hooks**

В конец `habibi_ui/hooks.py`:

```python
# Клиентский роутинг: любой вложенный путь отдаёт ту же страницу, разбирается он в браузере.
website_route_rules = [
	{"from_route": "/ui/<path:app_path>", "to_route": "ui"},
]

# Кому выдана роль — тот при входе попадает в новый интерфейс, остальные в Desk.
# Включение и откат делаются выдачей и снятием роли, без выкатки.
role_home_page = {
	"Habibi UI": "ui",
}
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui --module habibi_ui.tests.test_www`
Expected: PASS, 2 теста.

- [ ] **Step 6: Проверить страницу в браузере и редирект гостя**

```bash
<BENCH> bench --site dev.localhost clear-cache
curl -s -o /dev/null -w "%{http_code}\n" http://dev.localhost:8000/ui
curl -s -o /dev/null -w "%{http_code}\n" http://dev.localhost:8000/ui/tasks/123
```

Expected: оба ответа `200` для залогиненного и `403` для анонимного curl. Открыть `http://dev.localhost:8000/ui` в браузере — виден заголовок «Habibi UI».

- [ ] **Step 7: Коммит**

```bash
git add habibi_ui/www habibi_ui/hooks.py habibi_ui/tests/test_www.py
git commit -m "feat(www): страница-обёртка SPA, маршрут /ui и вход по сессии"
```

---

### Task 6: Типизированный клиент, TanStack Query и экран с данными me()

**Files:**
- Create: `frontend/src/shared/api/client.ts`
- Create: `frontend/src/shared/api/queries.ts`
- Create: `frontend/src/shared/types/global.d.ts`
- Modify: `frontend/src/main.tsx` — обернуть в `QueryClientProvider`
- Modify: `frontend/src/App.tsx` — вывести пользователя и модули
- Modify: `package.json` — добавить `@tanstack/react-query`

**Interfaces:**
- Consumes: `window.habibi.csrf_token` из задачи 5; метод `habibi_ui.api.v1.session.me` из задачи 3.
- Produces: `call<T>(method: string, params?: Record<string, unknown>): Promise<T>` — единственный способ обращения к бэку; хук `useMe()`.

- [ ] **Step 1: Добавить зависимость**

```bash
<BENCH> bash -c 'cd apps/habibi_ui && yarn add @tanstack/react-query'
```

- [ ] **Step 2: Описать глобальные типы**

`frontend/src/shared/types/global.d.ts`:

```ts
declare global {
  interface Window {
    habibi: {
      csrf_token: string;
      user: string;
    };
  }
}

export {};
```

- [ ] **Step 3: Написать клиент**

Единственное место, где знают про транспорт: префикс, CSRF-заголовок и разбор ошибок Frappe.

`frontend/src/shared/api/client.ts`:

```ts
const BASE = "/api/method/";

/** Frappe кладёт человекочитаемые ошибки в _server_messages как JSON-массив JSON-строк. */
function parseFrappeError(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { _server_messages?: string })._server_messages;
  if (!messages) return null;
  try {
    const list = JSON.parse(messages) as string[];
    const first = JSON.parse(list[0]) as { message?: string };
    return first.message ?? null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch(BASE + method, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": window.habibi.csrf_token,
    },
    body: JSON.stringify(params ?? {}),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(parseFrappeError(body) ?? `Запрос не выполнен (${response.status})`, response.status);
  }

  return (body as { message: T }).message;
}
```

- [ ] **Step 4: Написать хук**

`frontend/src/shared/api/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { call } from "./client";

export interface Module {
  key: string;
  label: string;
}

export interface Me {
  user: string;
  full_name: string;
  roles: string[];
  modules: Module[];
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("habibi_ui.api.v1.session.me"),
  });
}
```

- [ ] **Step 5: Подключить провайдер и вывести данные**

`frontend/src/main.tsx` — заменить целиком:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Не найден корневой элемент #root");
}

const queryClient = new QueryClient();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

`frontend/src/App.tsx` — заменить целиком:

```tsx
import { useMe } from "./shared/api/queries";

export function App() {
  const { data, isPending, error } = useMe();

  if (isPending) return <p>Загрузка…</p>;
  if (error) return <p>Ошибка: {error.message}</p>;

  return (
    <main>
      <h1>{data.full_name}</h1>
      <nav>
        <ul>
          {data.modules.map((module) => (
            <li key={module.key}>{module.label}</li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
```

- [ ] **Step 6: Собрать и проверить в браузере**

```bash
<BENCH> bench build --app habibi_ui
<BENCH> bench --site dev.localhost clear-cache
```

Открыть `http://dev.localhost:8000/ui`.
Expected: заголовок — полное имя пользователя, ниже список модулей с «Учёт». В консоли браузера ошибок нет.

- [ ] **Step 7: Проверить типы**

Run: `<BENCH> bash -c 'cd apps/habibi_ui && npx tsc --noEmit -p frontend/tsconfig.json'`
Expected: без ошибок.

- [ ] **Step 8: Коммит**

```bash
git add frontend package.json yarn.lock
git commit -m "feat(frontend): типизированный клиент, TanStack Query и экран с данными me()"
```

---

### Task 7: Генерация TypeScript-типов из датаклассов

Ручная синхронизация `Me` в двух местах — источник расхождений. Тип генерируется из Python и коммитится, расхождение становится ошибкой сборки.

**Files:**
- Create: `habibi_ui/commands/__init__.py`
- Create: `habibi_ui/typegen.py`
- Create: `habibi_ui/tests/test_typegen.py`
- Create: `frontend/src/shared/types/api.ts` (генерируется, коммитится)
- Modify: `frontend/src/shared/api/queries.ts` — импортировать типы вместо объявления

**Interfaces:**
- Consumes: датаклассы `Me` и `Module` из `habibi_ui/api/v1/session.py`.
- Produces: `render_types() -> str` и команда `bench --site <site> habibi-ui generate-types`.

Конвенция bench-команд взята из `habibi_telegram/commands/__init__.py`: frappe ищет переменную `commands` в модуле `<app>.commands`.

- [ ] **Step 1: Написать падающий тест**

`habibi_ui/tests/test_typegen.py`:

```python
from frappe.tests import IntegrationTestCase

from habibi_ui.typegen import render_types


class TestTypegen(IntegrationTestCase):
	def test_renders_interfaces_for_exported_dataclasses(self):
		output = render_types()
		self.assertIn("export interface Module {", output)
		self.assertIn("key: string;", output)
		self.assertIn("export interface Me {", output)
		self.assertIn("roles: string[];", output)
		self.assertIn("modules: Module[];", output)

	def test_output_is_marked_as_generated(self):
		self.assertTrue(render_types().startswith("// Файл сгенерирован"))
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui --module habibi_ui.tests.test_typegen`
Expected: FAIL с `ModuleNotFoundError: No module named 'habibi_ui.typegen'`.

- [ ] **Step 3: Реализовать генератор**

`habibi_ui/typegen.py`:

```python
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
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `<BENCH> bench --site dev.localhost run-tests --app habibi_ui --module habibi_ui.tests.test_typegen`
Expected: PASS, 2 теста.

- [ ] **Step 5: Добавить bench-команду**

`habibi_ui/commands/__init__.py`:

```python
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
```

- [ ] **Step 6: Сгенерировать типы и переключить фронт на них**

```bash
<BENCH> bench --site dev.localhost habibi-ui generate-types
```

Expected: создан `frontend/src/shared/types/api.ts`.

В `frontend/src/shared/api/queries.ts` удалить объявления `Module` и `Me`, заменив их импортом:

```ts
import { useQuery } from "@tanstack/react-query";

import type { Me } from "../types/api";
import { call } from "./client";

export type { Me, Module } from "../types/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("habibi_ui.api.v1.session.me"),
  });
}
```

- [ ] **Step 7: Проверить, что типы и сборка сходятся**

```bash
<BENCH> bash -c 'cd apps/habibi_ui && npx tsc --noEmit -p frontend/tsconfig.json'
<BENCH> bench build --app habibi_ui
```

Expected: обе команды без ошибок, страница `/ui` по-прежнему показывает имя и модули.

- [ ] **Step 8: Проверить, что генерация идемпотентна**

```bash
<BENCH> bench --site dev.localhost habibi-ui generate-types
cd /Users/fsa/Projects/habibi/habibi_ui && git diff --exit-code frontend/src/shared/types/api.ts
```

Expected: `git diff` возвращает 0 — повторная генерация ничего не меняет. Именно это свойство позволит проверять расхождение в CI.

- [ ] **Step 9: Коммит**

```bash
git add habibi_ui/typegen.py habibi_ui/commands habibi_ui/tests/test_typegen.py frontend/src/shared
git commit -m "feat(typegen): генерация TS-типов из датаклассов API"
```

---

### Task 8: Подключение к образу и прогон на прод

Задача выполняется только после того, как репозиторий появился на GitHub — `apps.json` тянет приложения по URL.

**Files:**
- Modify: `habibi_docker/habibi/apps.json` — добавить запись `habibi_ui`

**Interfaces:**
- Consumes: всё, собранное в задачах 2-7.

- [ ] **Step 1: Проверить, что репозиторий доступен по URL**

```bash
git -C /Users/fsa/Projects/habibi/habibi_ui remote -v
git ls-remote https://github.com/DHI-Partners/habibi_ui.git HEAD
```

Expected: remote настроен, `ls-remote` отвечает хешем. Если нет — остановиться, репозиторий на GitHub ещё не создан.

- [ ] **Step 2: Добавить приложение в сборку образа**

В `habibi_docker/habibi/apps.json` добавить последним элементом:

```json
  {
    "url": "https://github.com/DHI-Partners/habibi_ui",
    "branch": "main"
  }
```

Порядок значим — приложения ставятся сверху вниз, `habibi_ui` требует `erpnext`, который идёт первым.

- [ ] **Step 3: Закоммитить и запустить сборку образа**

```bash
cd /Users/fsa/Projects/habibi/habibi_docker
git add habibi/apps.json
git commit -m "feat: добавить habibi_ui в сборку образа"
git push
```

- [ ] **Step 4: Дождаться сборки и проверить, что фронт собрался внутри образа**

Открыть воркфлоу «Habibi image» в GitHub Actions.
Expected: в логе шага сборки есть строка `Running build command for habibi_ui`, сборка зелёная, в выводе есть итоговые теги.

Если строки нет — `yarn.lock` или скрипт `build` не попали в репозиторий; дальше не идти.

- [ ] **Step 5: Выкатить версионный тег и установить приложение на сайт**

```bash
git tag v1.0.7 && git push --tags
```

После деплоя, на сервере:

```bash
ssh habibi 'docker exec habibi_docker-backend-1 bash -lc "
cd /home/frappe/frappe-bench &&
bench --site erp.ayntayba.com install-app habibi_ui &&
bench --site erp.ayntayba.com migrate"'
```

- [ ] **Step 6: Проверить на проде**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.ayntayba.com/ui
```

Expected: `301` для анонимного запроса — редирект на `/login`, ровно как отдаёт гостю сам Desk. Внутри `get_context` выставляется `status_code = 403`, но `frappe.redirect()` поднимает исключение со статусом 301 и затирает его; итоговый HTTP-статус именно 301. Затем открыть `https://erp.ayntayba.com/ui` в браузере под своим пользователем: видно полное имя и список модулей.

- [ ] **Step 7: Проверить включение по роли**

Создать роль `Habibi UI` в Desk, выдать её тестовому пользователю, зайти под ним.
Expected: пользователь после входа попадает на `/ui`, а не в Desk. После снятия роли — снова в Desk.

- [ ] **Step 8: Отметить фундамент готовым**

Блок 0 закрыт, когда выполняются все пункты сразу:

- `bench --site dev.localhost run-tests --app habibi_ui` — зелёный;
- `npx tsc --noEmit` — без ошибок;
- повторная генерация типов не даёт diff;
- образ собирается в CI со строкой `Running build command for habibi_ui`;
- `/ui` на проде показывает данные, полученные из `habibi_ui.api.v1.session.me`;
- переключение интерфейса делается выдачей роли, без выкатки.
