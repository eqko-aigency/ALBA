import { LoginForm } from "./LoginForm";

const CONFIRM_LINK_ERRORS: Record<string, string> = {
  link_invalido: "El link de confirmación no es válido.",
  link_vencido: "El link de confirmación venció — pide uno nuevo registrándote de nuevo o contacta soporte.",
};

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError = error ? (CONFIRM_LINK_ERRORS[error] ?? null) : null;

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 bg-sand">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
      <p className="mt-2 text-ink-soft">Entra a tu cuenta de ALBA.</p>
      <LoginForm initialError={initialError} />
    </div>
  );
}
