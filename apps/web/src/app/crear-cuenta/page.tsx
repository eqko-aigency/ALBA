import { SignupForm } from "./SignupForm";

export default function CrearCuentaPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 bg-sand">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Crear cuenta</h1>
      <p className="mt-2 text-ink-soft">Regístrate para empezar a usar ALBA.</p>
      <SignupForm />
    </div>
  );
}
