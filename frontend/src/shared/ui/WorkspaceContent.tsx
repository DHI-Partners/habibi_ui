import { useWorkspacePage } from "../api/queries";
import { buildDeskLink } from "../lib/deskLink";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Icon } from "./Icon";
import { Skeleton } from "./skeleton";

function ShortcutsSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--tile-min),1fr))] gap-4" aria-hidden="true">
      {[1, 2, 3, 4].map((key) => (
        <Skeleton key={key} className="h-26 rounded-xl" />
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--card-min),1fr))] gap-4" aria-hidden="true">
      {[1, 2, 3].map((key) => (
        <Skeleton key={key} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

export function WorkspaceContent({ name }: { name: string }) {
  const { data, isPending, error, refetch, isFetching } = useWorkspacePage(name);

  if (isPending) {
    return (
      <div className="flex flex-col gap-8">
        <ShortcutsSkeleton />
        <CardsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border p-8">
        <p className="text-lg font-semibold">Не удалось загрузить раздел</p>
        <p className="text-muted-foreground">{error.message}</p>
        <Button variant="outline" className="mt-2" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Повторяем…" : "Повторить"}
        </Button>
      </div>
    );
  }

  const isEmpty = data.shortcuts.length === 0 && data.cards.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border p-8">
        <p className="text-lg font-semibold">В этом разделе пока пусто</p>
        <p className="text-muted-foreground">Здесь появятся ярлыки и карточки, когда их добавят в пространство.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {data.shortcuts.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--tile-min),1fr))] gap-4">
          {data.shortcuts.map((shortcut) => (
            <a
              key={shortcut.label}
              href={buildDeskLink(shortcut.link_to, shortcut.link_type)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center text-foreground no-underline transition-colors hover:border-primary/50 hover:shadow-sm"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name={shortcut.icon} label={shortcut.label} className="size-5" />
              </span>
              <span className="text-sm font-medium">{shortcut.label}</span>
            </a>
          ))}
        </div>
      )}

      {data.cards.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--card-min),1fr))] items-start gap-4">
          {data.cards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {card.links.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {card.links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={buildDeskLink(link.link_to, link.link_type)}
                          className="-mx-2 block rounded-md px-2 py-1.5 text-sm text-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет ссылок</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
