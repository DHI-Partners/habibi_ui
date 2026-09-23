declare global {
  interface Window {
    habibi: {
      csrf_token: string;
      user: string;
      /** User.desk_theme из Frappe: "Light" | "Dark" | "Automatic" | "" (не задано). */
      desk_theme: string;
      /** frappe.local.site — неймспейс socket.io кабинета, см. features/cabinet/useRealtime.ts. */
      site_name?: string;
      /**
       * Порт socket.io под dev-сервером бенча (conf.socketio_port); null в проде,
       * где socket.io за nginx на том же origin. См. useRealtime.ts.
       */
      socketio_port?: number | null;
    };
  }
}

export {};
