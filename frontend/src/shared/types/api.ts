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
