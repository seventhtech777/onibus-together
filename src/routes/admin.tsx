import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { BusFront, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/reserva";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel administrativo — Together" },
      { name: "description", content: "Acompanhe vagas vendidas, arrecadação e confirme pagamentos." },
      { property: "og:title", content: "Painel administrativo — Together" },
      { property: "og:description", content: "Acompanhe vagas vendidas, arrecadação e confirme pagamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <BusFront className="h-5 w-5 text-primary" /> Painel — Together
          </div>
          {session && (
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          )}
        </div>
      </header>
      {session ? <Painel userId={session.user.id} /> : <Login />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-foreground">Entrar no painel</h1>
      <form
        className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
          setLoading(false);
          if (error) toast.error("E-mail ou senha incorretos");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

function Painel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const isAdmin = useQuery({
    queryKey: ["is-admin", userId],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  const reservas = useQuery({
    queryKey: ["admin-reservas"],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select("id,codigo_reserva,nome,igreja,celular,onibus,tipo_poltrona,valor_pagamento,status_pagamento,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isAdmin.isLoading) return null;
  if (!isAdmin.data)
    return <p className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">Sua conta não tem acesso de administrador.</p>;

  const lista = reservas.data ?? [];
  const leito = lista.filter((r) => r.onibus === "Floriano" && r.tipo_poltrona === "Leito").length;
  const comum = lista.filter((r) => r.onibus === "Floriano" && r.tipo_poltrona === "Comum").length;
  const guadalupe = lista.filter((r) => r.onibus === "Guadalupe").length;
  const arrecadado = lista.filter((r) => r.status_pagamento).reduce((s, r) => s + Number(r.valor_pagamento), 0);

  async function confirmar(id: string) {
    setConfirmando(id);
    const { error } = await supabase.from("reservas").update({ status_pagamento: true }).eq("id", id);
    setConfirmando(null);
    if (error) return toast.error("Não foi possível confirmar");
    toast.success("Pagamento confirmado");
    qc.invalidateQueries({ queryKey: ["admin-reservas"] });
  }

  const cards = [
    ["Vagas vendidas", String(lista.length)],
    ["Floriano Leito", `${leito} / 20`],
    ["Floriano Comum", `${comum} / 40`],
    ["Guadalupe", `${guadalupe} / 6`],
    ["Valor arrecadado", brl(arrecadado)],
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Painel administrativo</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([t, v], i) => (
          <div key={t} className={`rounded-xl border border-border bg-card p-4 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">O valor arrecadado soma apenas pagamentos confirmados.</p>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Igreja</th>
              <th className="px-4 py-3 font-medium">Celular</th>
              <th className="px-4 py-3 font-medium text-right">Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono font-semibold">{r.codigo_reserva}</td>
                <td className="px-4 py-3">{r.nome}</td>
                <td className="px-4 py-3">{r.igreja}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.celular}</td>
                <td className="px-4 py-3 text-right">
                  {r.status_pagamento ? (
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Confirmado</span>
                  ) : (
                    <Button size="sm" disabled={confirmando === r.id} onClick={() => confirmar(r.id)}>
                      {confirmando === r.id ? "..." : "Confirmar pagamento"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma reserva ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
