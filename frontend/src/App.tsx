import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppShell } from "./shared/ui/AppShell";
import { WorkspaceContent } from "./shared/ui/WorkspaceContent";

const HOME_WORKSPACE = "Home";

function NamedWorkspaceRoute() {
  const { name } = useParams<{ name: string }>();
  // react-router уже декодирует параметр пути, повторное decodeURIComponent не нужно.
  return <WorkspaceContent name={name ?? HOME_WORKSPACE} />;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<WorkspaceContent name={HOME_WORKSPACE} />} />
        <Route path="/w/:name" element={<NamedWorkspaceRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
