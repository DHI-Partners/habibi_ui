import { Link } from "react-router-dom";

import { useSidebar } from "../api/queries";
import { cn } from "../lib/utils";
import type { WorkspaceRef } from "../types/api";
import { Icon } from "./Icon";
import { Skeleton } from "./skeleton";

interface TreeNode extends WorkspaceRef {
  children: TreeNode[];
}

function buildTree(items: WorkspaceRef[]): TreeNode[] {
  const byName = new Map<string, TreeNode>();
  for (const item of items) {
    byName.set(item.name, { ...item, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const item of items) {
    const node = byName.get(item.name);
    if (!node) continue;
    const parent = item.parent ? byName.get(item.parent) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface SidebarProps {
  collapsed: boolean;
  activeName: string;
  onNavigate?: () => void;
  className?: string;
}

function workspaceHref(name: string): string {
  return name === "Home" ? "/" : `/w/${encodeURIComponent(name)}`;
}

function SidebarNode({
  node,
  collapsed,
  activeName,
  onNavigate,
}: {
  node: TreeNode;
  collapsed: boolean;
  activeName: string;
  onNavigate?: () => void;
}) {
  const isActive = node.name === activeName;

  return (
    <li>
      <Link
        to={workspaceHref(node.name)}
        onClick={onNavigate}
        title={collapsed ? node.label : undefined}
        className={cn(
          "flex items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors",
          collapsed && "justify-center",
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon
          name={node.icon}
          className={cn("size-4 flex-none", isActive ? "text-primary" : "text-muted-foreground")}
        />
        {!collapsed && <span className="overflow-hidden text-ellipsis">{node.label}</span>}
      </Link>
      {!collapsed && node.children.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 pl-4">
          {node.children.map((child) => (
            <SidebarNode
              key={child.name}
              node={child}
              collapsed={collapsed}
              activeName={activeName}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ collapsed, activeName, onNavigate, className }: SidebarProps) {
  const { data, isPending, error } = useSidebar();

  return (
    <nav aria-label="Рабочие пространства" className={cn("overflow-y-auto p-2", className)}>
      {isPending && (
        <ul className="flex flex-col gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((key) => (
            <li key={key}>
              <Skeleton className="h-9 w-full rounded-md" />
            </li>
          ))}
        </ul>
      )}
      {error && !isPending && <p className="p-2 text-sm text-muted-foreground">Не удалось загрузить меню</p>}
      {data && (
        <ul className="flex flex-col gap-1">
          {buildTree(data).map((node) => (
            <SidebarNode
              key={node.name}
              node={node}
              collapsed={collapsed}
              activeName={activeName}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}
