import { logoutAction } from "@/lib/authActions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="w-full rounded-full border-2 border-danger/30 bg-card px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
