/**
 * Единый источник бренда Stolio.
 * Не хардкодьте название/цвета в компонентах — импортируйте отсюда.
 */
export const brand = {
  name: "Stolio",
  /** Читается одинаково на RU/KK/EN: Сто́лио */
  nameLocal: {
    ru: "Stolio",
    kk: "Stolio",
    en: "Stolio",
  },
  /**
   * Выбранный слоган: акцент на главном действии гостя (скан → меню).
   * Альтернатива («на каждом столе…») слабее по CTA на лендинге.
   */
  tagline: {
    ru: "Меню, которое открывается одним сканом",
    kk: "Бір сканермен ашылатын мәзір",
    en: "A menu that opens with one scan",
  },
  /** TODO: владелец должен подтвердить свободу домена до рекламы */
  domain: process.env.NEXT_PUBLIC_APP_DOMAIN ?? "TODO.stolio.kz",
  colors: {
    ink: "#0F1A14",
    cream: "#F6F2E9",
    lime: "#B8F15A",
    leaf: "#2F6B3C",
    coral: "#FF6B4A",
    stone: "#8A8578",
  },
  /** TODO: заполнить реальные контакты студии */
  contacts: {
    phone: process.env.NEXT_PUBLIC_STUDIO_PHONE ?? "TODO",
    whatsapp: process.env.NEXT_PUBLIC_STUDIO_WHATSAPP ?? "TODO",
    telegram: process.env.NEXT_PUBLIC_STUDIO_TELEGRAM ?? "TODO",
    email: process.env.NEXT_PUBLIC_STUDIO_EMAIL ?? "TODO",
  },
  fonts: {
    /** Onest: кириллица + казахские ӘҒҚҢӨҰҮҺІ (проверить в UI) */
    display: "Onest",
    body: "Manrope",
  },
  madeWith: {
    ru: "Сделано в Stolio",
    kk: "Stolio-да жасалған",
    en: "Made with Stolio",
  },
} as const;

export type Brand = typeof brand;
export type Locale = "ru" | "kk" | "en";
