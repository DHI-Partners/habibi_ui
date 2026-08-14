declare global {
  interface Window {
    habibi: {
      csrf_token: string;
      user: string;
    };
  }
}

export {};
