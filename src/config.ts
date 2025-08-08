export const SITE = {
  website: "https://bytemash.net", // GitHub Pages URL
  author: "Jye Cusch",
  profile: "https://github.com/jyecusch",
  desc: "Thoughts on software engineering, and building better web applications.",
  title: "Bytemash",
  ogImage: "bytemash-og.png",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/jyecusch/blog/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Australia/Sydney", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
