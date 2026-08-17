/**
 * Единая точка сборки адресов в Desk. Своих списков документов у нас пока
 * нет, поэтому ярлыки и ссылки карточек ведут туда — но адрес всегда
 * собирается здесь, а не разбросан по компонентам.
 */

/** Frappe приводит link_to к нижнему регистру с дефисами вместо пробелов в адресах. */
function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function buildDeskLink(linkTo: string, linkType: string): string {
  const slug = slugify(linkTo);

  switch (linkType) {
    case "DocType":
      return `/app/${slug}`;
    case "Report":
      return `/app/query-report/${slug}`;
    case "Dashboard":
      return `/app/dashboard-view/${slug}`;
    // Page и всё остальное
    default:
      return `/app/${slug}`;
  }
}
