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
