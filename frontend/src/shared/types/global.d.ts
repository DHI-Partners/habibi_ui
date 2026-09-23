declare global {
  interface Window {
    habibi: {
      csrf_token: string;
      user: string;
      /** User.desk_theme из Frappe: "Light" | "Dark" | "Automatic" | "" (не задано). */
      desk_theme: string;
      /** frappe.local.site — неймспейс socket.io кабинета, см. features/cabinet/useRealtime.ts. */
      site_name?: string;
    };
  }
}

export {};
