export const PROFILE_COLORS = ["orange", "sky", "salmon", "success", "dawn", "danger"] as const;
export type ProfileColor = (typeof PROFILE_COLORS)[number];
