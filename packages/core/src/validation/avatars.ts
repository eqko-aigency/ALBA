// Los archivos en apps/web/public/avatars/ usan "-" (bebe-hombre.png), no
// "_" — quien mapee AvatarKey a una ruta debe convertir key.replace("_", "-").
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
