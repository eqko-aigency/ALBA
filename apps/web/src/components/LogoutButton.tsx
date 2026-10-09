import { logoutAction } from "@/lib/authActions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-full border border-subtle px-3 py-2 text-xs font-medium text-ink-soft"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
