import Link from "next/link";
import Image from "next/image";
import type { AvatarKey } from "@alba/core";
import { AVATAR_SRC } from "@/lib/avatars";

export function AppHeader({
  avatarKey,
  unseenNotifications,
  as,
}: {
  avatarKey: AvatarKey | null;
  unseenNotifications: number;
  as?: string;
}) {
  const asQuery = as === "b" ? "?as=b" : "";
  return (
    <div className="flex flex-shrink-0 items-center justify-between px-6 pb-4 pt-5">
      <Link href={`/perfil${asQuery}`} aria-label="Tu perfil" className="flex-shrink-0">
        {avatarKey ? (
          <Image
            src={AVATAR_SRC[avatarKey]}
            alt="Tu perfil"
            width={46}
            height={46}
            className="h-[46px] w-[46px] rounded-full border-2 border-white object-cover shadow-ambient"
            style={{ objectPosition: "center 15%" }}
          />
        ) : (
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-white bg-dawn text-sm font-semibold text-ink shadow-ambient">
            Tú
          </span>
        )}
      </Link>

      <span className="text-[28px] font-extrabold tracking-tight text-ink">
        alba<span className="text-orange">.</span>
      </span>

      <Link
        href={`/notificaciones${asQuery}`}
        aria-label="Notificaciones"
        className="relative flex-shrink-0 p-1"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-[26px] w-[26px] text-ink" aria-hidden="true">
          <path
            d="M6 10a6 6 0 0112 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unseenNotifications > 0 && (
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {unseenNotifications > 9 ? "9+" : unseenNotifications}
          </span>
        )}
      </Link>
    </div>
  );
}
