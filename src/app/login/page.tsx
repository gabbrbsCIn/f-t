import { LoginForm } from "@/components/LoginForm";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Entrar · liu liu" };

export default function LoginPage() {
  return (
    <main className="login">
      <Wordmark />
      <p className="muted">Seu dinheiro, numa conversa.</p>
      <LoginForm />
    </main>
  );
}
