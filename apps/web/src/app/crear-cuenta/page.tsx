import { AuthLayout } from "@/components/AuthLayout";
import { Wordmark } from "@/components/Wordmark";
import { SignupForm } from "./SignupForm";

export default function CrearCuentaPage() {
  return (
    <AuthLayout>
      <Wordmark className="text-6xl" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Crear cuenta</h1>
      <p className="mt-2 text-ink-soft">Regístrate para empezar a usar ALBA.</p>
      <SignupForm />
    </AuthLayout>
  );
}
