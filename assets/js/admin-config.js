/**
 * =============================================================
 *  ADMIN CONFIG — hostinger-store-assets
 *  Edit this file to change per-page defaults and behaviour.
 *  You should NEVER need to touch store-logic.js for these.
 * =============================================================
 *
 *  Each key under window.ADMIN_CONFIG must match the pageKey
 *  declared in the embed's window.APP_CONFIG.
 *
 *  ┌─────────────────┬─────────────────────────────────────────────────┐
 *  │  Setting        │  Valid values                                   │
 *  ├─────────────────┼─────────────────────────────────────────────────┤
 *  │  pageSize       │  Any positive integer or "all"                  │
 *  │  pageSizeOptions│  Array defining the dropdown, e.g.              │
 *  │                 │  [4, 8, 12, 24, "all"]  (optional — overrides   │
 *  │                 │  the hardcoded HTML options)                    │
 *  │  sheetId        │  Google Sheets document ID (the long string     │
 *  │                 │  in the spreadsheet URL)                        │
 *  │  sheetName      │  Exact tab name inside that spreadsheet         │
 *  │  itemLabel      │  Plural noun used in UI ("products", "games")   │
 *  └─────────────────┴─────────────────────────────────────────────────┘
 */

window.ADMIN_CONFIG = {

  // ── Products embed ──────────────────────────────────────────
  products: {
    pageSize: "all",     // Show every product without pagination
    pageSizeOptions: ["all", 4, 8, 12, 24],
    sheetId: "1UIpV8mZ21NTqJUWMbw5NK1V4cWFjuTbRUxpxlvOWljk",
    sheetName: "Products",
    itemLabel: "products"
  },

  // ── Lab (Games) embed ────────────────────────────────────────
  lab: {
    pageSize: "8",       // Show 8 games per page
    pageSizeOptions: ["all", 4, 8, 12, 24],
    sheetId: "1UIpV8mZ21NTqJUWMbw5NK1V4cWFjuTbRUxpxlvOWljk",
    sheetName: "Games",
    itemLabel: "games"
  },

  // ── Blog embed ───────────────────────────────────────────────
  blog: {
    pageSize: "8",       // Show 8 posts per page
    pageSizeOptions: ["all", 4, 8, 12, 24],
    sheetId: "1UIpV8mZ21NTqJUWMbw5NK1V4cWFjuTbRUxpxlvOWljk",
    sheetName: "Blogs",
    itemLabel: "blogs",
    // Read-time buckets: posts with readMinutes <= shortMax are "Short",
    // <= mediumMax are "Medium", anything above is "Long".
    readTimeBuckets: { shortMax: 5, mediumMax: 10 }
  }

};

/**
 * Shared URL utilities — available to all embeds via window.SWOOP_UTILS
 */
window.SWOOP_UTILS = {

  // Returns true if the URL is an internal Hostinger page
  isInternal: function (href) {
    if (!href || href === "#") return true;
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      return host === "hostinger.com" || host.endsWith(".hostinger.com");
    } catch (_) { return false; }
  },

  // Returns a display name for the platform, e.g. "Amazon", "Gumroad", "Medium"
  getPlatformName: function (href) {
    if (!href || href === "#") return null;
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      const map = {
        "amazon.com": "Amazon",   "amazon.in": "Amazon",
        "gumroad.com": "Gumroad", "etsy.com": "Etsy",
        "medium.com": "Medium",   "patreon.com": "Patreon",
        "substack.com": "Substack", "linkedin.com": "LinkedIn",
        "dev.to": "Dev.to",       "hashnode.com": "Hashnode",
        "mirror.xyz": "Mirror",   "itch.io": "Itch.io",
        "steampowered.com": "Steam", "github.com": "GitHub",
        "notion.so": "Notion"
      };
      if (map[host]) return map[host];
      const seg = host.split(".")[0];
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    } catch (_) { return null; }
  }

};