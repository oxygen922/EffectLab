export const FREE_TIER = {
  label: "Free",
  starterCredits: 8,
  dailyCredits: 3,
  note: "standard models · standard queue · personal use",
} as const;

export const PACKS = {
  starter: { id: "starter", label: "Starter", price: 5, listPrice: 7, credits: 60 },
  creator: { id: "creator", label: "Creator", price: 15, listPrice: 19, credits: 220, recommended: true },
  studio: { id: "studio", label: "Studio", price: 39, listPrice: 49, credits: 640 },
} as const;

export type PackId = keyof typeof PACKS;
