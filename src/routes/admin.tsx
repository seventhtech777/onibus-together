import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { BusFront, LogOut, Search } from "lucide-react";
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
      {
        name: "description",
        content: "Acompanhe vagas vendidas, arrecadação e confirme pagamentos.",
      },
      { property: "og:title", content: "Painel administrativo — Together" },
      {
        property: "og:description",
        content: "Acompanhe vagas vendidas, arrecadação e confirme pagamentos.",
      },
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
      <header className="sticky top-0 z-20 border-b border-border bg-primary backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="justify-center mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
            <BusFront className="size-10 *:shrink-0 text-white" />
            <span className="truncate text-sm text-white font-semibold tracking-tight md:text-2xl">
              Contratação de Ônibus — Together
            </span>
          </div>
          {session && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="text-red-100 bg-red-400"
            >
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
      <h1 className="text-2xl text-center font-bold text-foreground">
        Entrar no Painel Administrativo
      </h1>
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
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
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
  const [busca, setBusca] = useState("");

  const isAdmin = useQuery({
    queryKey: ["is-admin", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  const reservas = useQuery({
    queryKey: ["admin-reservas"],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select(
          "id,codigo_reserva,nome,igreja,celular,onibus,tipo_poltrona,valor_pagamento,status_pagamento,created_at",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const lista = reservas.data ?? [];

  // Ordenada por nome, usada como base para a tabela e para o filtro de busca
  const listaOrdenada = useMemo(
    () => [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [lista],
  );

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return listaOrdenada;
    return listaOrdenada.filter(
      (r) =>
        r.nome.toLowerCase().includes(termo) ||
        r.igreja?.toLowerCase().includes(termo) ||
        r.codigo_reserva?.toLowerCase().includes(termo),
    );
  }, [listaOrdenada, busca]);

  if (isAdmin.isLoading) return null;
  if (!isAdmin.data)
    return (
      <p className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">
        Sua conta não tem acesso de administrador.
      </p>
    );

  const leito = lista.filter((r) => r.onibus === "Floriano" && r.tipo_poltrona === "Leito").length;
  const comum = lista.filter((r) => r.onibus === "Floriano" && r.tipo_poltrona === "Comum").length;
  const guadalupe = lista.filter((r) => r.onibus === "Guadalupe").length;
  const arrecadado = lista
    .filter((r) => r.status_pagamento)
    .reduce((s, r) => s + Number(r.valor_pagamento), 0);

  async function confirmar(id: string) {
    setConfirmando(id);
    const { error } = await supabase
      .from("reservas")
      .update({ status_pagamento: true })
      .eq("id", id);
    setConfirmando(null);
    if (error) {
      toast.error("Não foi possível confirmar");
      return;
    }
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
          <div
            key={t}
            className={`rounded-2xl border border-border/60 bg-primary p-5 transition-colors ${
              i === 4 ? "col-span-2 md:col-span-1" : ""
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-blue-200">{t}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        O valor arrecadado soma apenas pagamentos confirmados.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">Reservas</h2>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, igreja ou código..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Código</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Igreja</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Celular</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Valor</th>
              <th className="px-4 py-3 font-medium text-right">Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="hidden px-4 py-3 font-mono font-semibold md:table-cell">
                  {r.codigo_reserva}
                </td>
                <td className="px-4 py-3">{r.nome}</td>
                <td className="hidden px-4 py-3 md:table-cell">{r.igreja}</td>
                <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">{r.celular}</td>
                <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                  R$ {r.valor_pagamento}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status_pagamento ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      Confirmado
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={confirmando === r.id}
                      onClick={() => confirmar(r.id)}
                    >
                      {confirmando === r.id ? "..." : "Confirmar pagamento"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {listaFiltrada.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {lista.length === 0 ? "Nenhuma reserva ainda." : "Nenhuma reserva encontrada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
