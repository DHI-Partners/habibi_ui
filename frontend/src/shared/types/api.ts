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
