import { LoginForm } from "./LoginForm";

export default function IngresarPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 bg-sand">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
      <p className="mt-2 text-ink-soft">Entra a tu cuenta de ALBA.</p>
      <LoginForm />
    </div>
  );
}
