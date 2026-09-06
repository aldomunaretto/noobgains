import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="page flex flex-col items-center justify-center gap-lg text-center" style={{ flex: 1 }}>
      <div style={{ fontSize: "4rem" }}>🏋️</div>
      <div>
        <h1 style={{ marginBottom: "var(--space-xs)" }}>NoobGains</h1>
        <p className="text-muted">Tu entrenador personal de gimnasio</p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
        style={{ width: "100%", maxWidth: 300 }}
      >
        <button type="submit" className="btn btn-primary btn-large">
          Entrar con Google
        </button>
      </form>
    </div>
  );
}
