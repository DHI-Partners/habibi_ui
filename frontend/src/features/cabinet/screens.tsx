import type { ComponentType } from "react";

import type { CabinetSection } from "../../shared/types/api";
import { ChatsScreen } from "./chats/ChatsScreen";
import { HomeScreen } from "./home/HomeScreen";
import { HoursScreen } from "./settings/HoursScreen";
import { ProfileScreen } from "./settings/ProfileScreen";
import { TelegramScreen } from "./settings/TelegramScreen";

// Рукописные экраны по имени из Cabinet Section.screen. Имя неизвестно —
// SectionRoute показывает «Экран не найден», а не падает: пресет может
// оказаться новее фронта.
export const SCREENS: Record<string, ComponentType<{ section: CabinetSection }>> = {
  home: HomeScreen,
  chats: ChatsScreen,
  hours: HoursScreen,
  profile: ProfileScreen,
  telegram: TelegramScreen,
};
