import type { Locale } from "@/config/brand";

const ru = {
  "nav.cta": "Оставить заявку",
  "nav.demo": "Посмотреть пример",
  "nav.login": "Кабинет",
  "hero.title": "Электронное меню для вашего заведения",
  "hero.sub":
    "QR на столе — меню в телефоне. Стоп-лист и цены обновляются за секунды. Без программистов.",
  "hero.note":
    "TODO: согласовать с владельцем формулировку сроков запуска (например «за 1 день»).",
  "how.title": "Как это работает",
  "how.1": "Оставляете заявку",
  "how.2": "Мы собираем меню",
  "how.3": "QR на столах — гости сканируют",
  "features.title": "Что входит",
  "pricing.title": "Тарифы",
  "pricing.body": "Цена по запросу — подберём под формат заведения.",
  "faq.title": "Вопросы и ответы",
  "contacts.title": "Контакты",
  "lead.title": "Заявка",
  "lead.name": "Имя",
  "lead.phone": "Телефон",
  "lead.method": "Способ связи",
  "lead.consent": "Согласен на обработку персональных данных",
  "lead.submit": "Отправить",
  "lead.success": "Заявка принята",
  "lead.successBody": "Мы свяжемся с вами в ближайшее время.",
  "menu.bill": "Счёт",
  "menu.search": "Поиск",
  "menu.unavailable": "Нет в наличии",
  "menu.paused": "Меню временно недоступно",
  "menu.notFound": "Заведение не найдено",
  "app.leads": "Заявки",
  "app.projects": "Проекты",
  "app.menu": "Меню",
  "app.qr": "QR",
  "app.more": "Ещё",
} as const;

const kk: Record<keyof typeof ru, string> = {
  ...ru,
  "nav.cta": "Өтінім қалдыру",
  "nav.demo": "Мысалды көру",
  "nav.login": "Кабинет",
  "hero.title": "Мекемеңізге арналған электронды мәзір",
  "hero.sub":
    "Үстелдегі QR — телефондағы мәзір. Стоп-лист пен бағалар секундтарда жаңарады.",
  "how.title": "Қалай жұмыс істейді",
  "features.title": "Не кіреді",
  "pricing.title": "Тарифтер",
  "pricing.body": "Баға сұраныс бойынша.",
  "faq.title": "Сұрақ-жауап",
  "contacts.title": "Байланыс",
  "lead.title": "Өтінім",
  "lead.name": "Аты",
  "lead.phone": "Телефон",
  "lead.method": "Байланыс тәсілі",
  "lead.submit": "Жіберу",
  "lead.success": "Өтінім қабылданды",
  "menu.bill": "Шот",
  "menu.search": "Іздеу",
  "menu.unavailable": "Қолжетімсіз",
  "app.leads": "Өтінімдер",
  "app.projects": "Жобалар",
  "app.menu": "Мәзір",
  "app.qr": "QR",
  "app.more": "Тағы",
};

const en: Record<keyof typeof ru, string> = {
  ...ru,
  "nav.cta": "Request a demo",
  "nav.demo": "See an example",
  "nav.login": "Studio",
  "hero.title": "Digital menus for hospitality",
  "hero.sub":
    "QR on the table — menu on the phone. Stop-list and prices update in seconds.",
  "how.title": "How it works",
  "features.title": "What's included",
  "pricing.title": "Pricing",
  "pricing.body": "Pricing on request — tailored to your venue.",
  "faq.title": "FAQ",
  "contacts.title": "Contacts",
  "lead.title": "Request",
  "lead.name": "Name",
  "lead.phone": "Phone",
  "lead.method": "Preferred contact",
  "lead.submit": "Send",
  "lead.success": "Request received",
  "menu.bill": "Bill",
  "menu.search": "Search",
  "menu.unavailable": "Unavailable",
  "app.leads": "Leads",
  "app.projects": "Projects",
  "app.menu": "Menu",
  "app.qr": "QR",
  "app.more": "More",
};

export const dictionaries = { ru, kk, en } as const;

export type MessageKey = keyof typeof ru;

export function t(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key] ?? dictionaries.ru[key];
}
