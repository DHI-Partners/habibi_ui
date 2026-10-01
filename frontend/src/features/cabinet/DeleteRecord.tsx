import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { CabinetSection } from "../../shared/types/api";
import { Button } from "../../shared/ui/button";
import { useDeleteSectionDoc } from "./api";
import { ResponsiveModal } from "./ui";

/**
 * Подтверждение удаления записи раздела (позиция меню и т.п.): из формы и из строки списка.
 * Сервер откажет, если запись используется в заказах, и объяснит что делать — показываем его слова.
 */
export function DeleteRecordDialog({
  section,
  name,
  title,
  open,
  onOpenChange,
  onDeleted,
}: {
  section: CabinetSection;
  name: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const del = useDeleteSectionDoc(section.key);
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Удалить «${title}»?`}
      description="Запись исчезнет из раздела, это нельзя отменить."
    >
      <div className="flex gap-2">
        <Button variant="outline" className="h-10 flex-1" onClick={() => onOpenChange(false)}>
          Отмена
        </Button>
        <Button
          variant="destructive"
          className="h-10 flex-1 font-medium"
          disabled={del.isPending}
          onClick={() =>
            del.mutate(name, {
              onSuccess: () => {
                onOpenChange(false);
                toast.success("Удалено");
                onDeleted?.();
              },
              onError: (e) => {
                onOpenChange(false);
                toast.error(e.message);
              },
            })
          }
        >
          {del.isPending && <Loader2 className="animate-spin" />}
          Удалить
        </Button>
      </div>
    </ResponsiveModal>
  );
}
