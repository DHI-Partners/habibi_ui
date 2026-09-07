import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { ChatPage } from "./features/ai/ChatPage";
import { AppShell } from "./shared/ui/AppShell";
import { GroupPage, Launcher, SectionPage } from "./shared/ui/Launcher";
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
      <Route path="/g/:name" element={<GroupPage />} />
      <Route path="/s/:key" element={<SectionPage />} />
      <Route
        path="/ai"
        element={
          <AppShell>
            <ChatPage />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
