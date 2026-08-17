import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppShell } from "./shared/ui/AppShell";
import { Launcher } from "./shared/ui/Launcher";
import { WorkspaceContent } from "./shared/ui/WorkspaceContent";

function NamedWorkspaceRoute() {
  const { name } = useParams<{ name: string }>();
  // react-router уже декодирует параметр пути, повторное decodeURIComponent не нужно.
  return <WorkspaceContent name={name ?? ""} />;
}

export function App() {
  return (
    <Routes>
      {/* Лаунчер модулей — без бокового меню, см. Launcher. */}
      <Route path="/" element={<Launcher />} />
      <Route
        path="/w/:name"
        element={
          <AppShell>
            <NamedWorkspaceRoute />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
