declare global {
  interface Window {
    habibi: {
      csrf_token: string;
      user: string;
      /** User.desk_theme из Frappe: "Light" | "Dark" | "Automatic" | "" (не задано). */
      desk_theme: string;
    };
  }
}

export {};
