export type MenuThemeId = "classic-green" | "dark-bar" | "minimal-light";

export type MenuTheme = {
  id: MenuThemeId;
  name: string;
  tokens: {
    bg: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
    radius: string;
    card: "list" | "grid" | "photo";
  };
};

export const menuThemes: Record<MenuThemeId, MenuTheme> = {
  "classic-green": {
    id: "classic-green",
    name: "Classic Green & Beige",
    tokens: {
      bg: "#F6F2E9",
      surface: "#FFFFFF",
      ink: "#2A241C",
      muted: "#8A8578",
      accent: "#B8F15A",
      accentInk: "#0F1A14",
      radius: "16px",
      card: "list",
    },
  },
  "dark-bar": {
    id: "dark-bar",
    name: "Dark Bar",
    tokens: {
      bg: "#12110F",
      surface: "#1C1A17",
      ink: "#F6F2E9",
      muted: "#A39E93",
      accent: "#D4AF37",
      accentInk: "#12110F",
      radius: "12px",
      card: "photo",
    },
  },
  "minimal-light": {
    id: "minimal-light",
    name: "Minimal Light",
    tokens: {
      bg: "#FAFAF8",
      surface: "#FFFFFF",
      ink: "#111111",
      muted: "#6B6B6B",
      accent: "#111111",
      accentInk: "#FFFFFF",
      radius: "8px",
      card: "grid",
    },
  },
};
