import type { ComponentType } from "react";

import type { CabinetSection } from "../../shared/types/api";

// Рукописные экраны по имени из Cabinet Section.screen. Имя неизвестно —
// SectionRoute показывает «Экран не найден», а не падает: пресет может
// оказаться новее фронта.
export const SCREENS: Record<string, ComponentType<{ section: CabinetSection }>> = {};
