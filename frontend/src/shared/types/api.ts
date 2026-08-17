// Файл сгенерирован командой `bench --site <site> habibi-ui generate-types`.
// Править руками бессмысленно — изменения затрёт следующая генерация.

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

export interface WorkspaceRef {
  name: string;
  label: string;
  icon: string;
  parent: string;
}

export interface DesktopItem {
  key: string;
  label: string;
  icon: string;
  logo: string;
  color: string;
  sidebar: string;
  count: number;
}

export interface DesktopSection {
  key: string;
  label: string;
  icon: string;
  logo: string;
  color: string;
  sidebar: string;
  count: number;
  items: DesktopItem[];
}

export interface SidebarLink {
  label: string;
  link_to: string;
  link_type: string;
  icon: string;
}

export interface SidebarGroup {
  key: string;
  label: string;
  links: SidebarLink[];
}

export interface Shortcut {
  label: string;
  link_to: string;
  link_type: string;
  icon: string;
  color: string;
}

export interface CardLink {
  label: string;
  link_to: string;
  link_type: string;
}

export interface Card {
  title: string;
  links: CardLink[];
}

export interface WorkspacePage {
  name: string;
  label: string;
  shortcuts: Shortcut[];
  cards: Card[];
}
