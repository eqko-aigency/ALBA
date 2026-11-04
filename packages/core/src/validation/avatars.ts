export const AVATAR_KEYS = [
  "padre",
  "madre",
  "abuelos",
  "madrastra",
  "padrastro",
  "hermano",
  "hermana",
  "hijo",
  "hija",
  "bebe_hombre",
  "bebe_mujer",
] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];
