import {
  Banknote,
  BookText,
  Blocks,
  Box,
  Building2,
  Contact,
  ChartPie,
  Database,
  DollarSign,
  Factory,
  FolderKanban,
  Globe,
  Hammer,
  Handshake,
  House,
  LayoutGrid,
  LifeBuoy,
  FileText,
  Mail,
  MonitorCheck,
  Package,
  Percent,
  Plug,
  Printer,
  ReceiptText,
  Receipt,
  Repeat2,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Table2,
  Tag,
  Users,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Внешний вид плитки: иконка и цвет.
 *
 * Ключ — имя иконки, пришедшее из самой системы (поле `icon` у Desktop Icon).
 * Так интерфейс следует за тем, что настроил администратор, а не за нашим
 * списком. Цвет задаётся именем переменной темы, а не значением: бренд клиента
 * переопределяет переменные, компоненты об этом не знают.
 */

export interface DesktopVisual {
  icon: LucideIcon;
  hueVar: string;
}

const BY_ICON: Record<string, DesktopVisual> = {
  home: { icon: House, hueVar: "--module-core" },
  accounting: { icon: Receipt, hueVar: "--module-accounts" },
  table: { icon: Table2, hueVar: "--module-accounts" },
  table_2: { icon: Table2, hueVar: "--module-core" },
  sell: { icon: Tag, hueVar: "--module-selling" },
  buying: { icon: ShoppingCart, hueVar: "--module-buying" },
  stock: { icon: Package, hueVar: "--module-stock" },
  organization: { icon: Building2, hueVar: "--module-manufacturing" },
  project: { icon: FolderKanban, hueVar: "--module-projects" },
  crm: { icon: Contact, hueVar: "--module-crm" },
  assets: { icon: Box, hueVar: "--module-assets" },
  quality: { icon: ShieldCheck, hueVar: "--module-quality" },
  support: { icon: LifeBuoy, hueVar: "--module-support" },
  website: { icon: Globe, hueVar: "--module-website" },
  integration: { icon: Plug, hueVar: "--module-integrations" },
  users: { icon: Users, hueVar: "--module-core" },
  hammer: { icon: Hammer, hueVar: "--module-core" },
  setting: { icon: Settings, hueVar: "--module-setup" },
  mail: { icon: Mail, hueVar: "--module-core" },
  printer: { icon: Printer, hueVar: "--module-core" },
  "monitor-check": { icon: MonitorCheck, hueVar: "--module-core" },
  "repeat-2": { icon: Repeat2, hueVar: "--module-core" },
  "getting-started": { icon: Handshake, hueVar: "--module-subcontracting" },
  data: { icon: Database, hueVar: "--module-core" },
  file: { icon: FileText, hueVar: "--module-accounts" },
  "receipt-text": { icon: ReceiptText, hueVar: "--module-accounts" },
  "dollar-sign": { icon: DollarSign, hueVar: "--module-accounts" },
  "book-text": { icon: BookText, hueVar: "--module-accounts" },
  expenses: { icon: TrendingUp, hueVar: "--module-accounts" },
};

/** Запасной вариант по имени плитки, когда иконка не задана или незнакома. */
const BY_KEY: Record<string, DesktopVisual> = {
  Payments: { icon: Wallet, hueVar: "--module-accounts" },
  Taxes: { icon: Percent, hueVar: "--module-accounts" },
  Banking: { icon: Banknote, hueVar: "--module-accounts" },
  Budget: { icon: TrendingUp, hueVar: "--module-accounts" },
  "Accounts Setup": { icon: Settings, hueVar: "--module-accounts" },
  "Share Management": { icon: ChartPie, hueVar: "--module-accounts" },
  Manufacturing: { icon: Factory, hueVar: "--module-manufacturing" },
  Organization: { icon: Building2, hueVar: "--module-core" },
  Framework: { icon: Blocks, hueVar: "--module-core" },
};

const FALLBACK: DesktopVisual = { icon: LayoutGrid, hueVar: "--module-default" };

export function desktopVisual(icon: string, key: string): DesktopVisual {
  return BY_ICON[icon] ?? BY_KEY[key] ?? FALLBACK;
}
