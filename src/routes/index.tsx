import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, BusFront, CalendarDays, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  CAPACIDADE,
  FORMAS_PAGAMENTO,
  IGREJAS,
  brl,
  mascaraCelular,
} from "@/lib/reserva";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reserva de Vaga — Excursão Floriano & Guadalupe" },
      {
        name: "description",
        content:
          "Reserve sua vaga nos ônibus da excursão: roteiro, valores e vagas disponíveis em tempo real.",
      },
      { property: "og:title", content: "Reserva de Vaga — Excursão" },
      {
        property: "og:description",
        content:
          "Garanta sua vaga nos ônibus Floriano e Guadalupe. Reserva rápida pelo celular.",
      },
    ],
  }),
  component: ReservaPage,
});

type Vagas = {
  floriano_leito: number;
  floriano_comum: number;
  guadalupe: number;
};

function useVagas() {
  return useQuery({
    queryKey: ["vagas"],
    queryFn: async (): Promise<Vagas> => {
      const { data, error } = await supabase.rpc("vagas_disponiveis");
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Vagas | undefined;
      return (
        row ?? { floriano_leito: 0, floriano_comum: 0, guadalupe: 0 }
      );
    },
  });
}

function VagaBarra({
  rotulo,
  restantes,
  total,
}: {
  rotulo: string;
  restantes: number;
  total: number;
}) {
  const disp = Math.max(0, restantes);
  const esgotado = disp <= 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{rotulo}</span>
        <span
          className={
            esgotado
              ? "shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
              : "shrink-0 text-muted-foreground"
          }
        >
          {esgotado ? "Esgotado" : `${disp}/${total} disponíveis`}
        </span>
      </div>
      <Progress value={(disp / total) * 100} className="h-2" />
    </div>
  );
}

function Linha({
  icone,
  rotulo,
  valor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 shrink-0 text-primary">{icone}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="font-medium">{valor}</p>
      </div>
    </div>
  );
}

function ReservaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vagas, isLoading } = useVagas();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [celular, setCelular] = useState("");
  const [igreja, setIgreja] = useState("");
  const [onibus, setOnibus] = useState<"Floriano" | "Guadalupe" | "">("");
  const [tipoPoltrona, setTipoPoltrona] = useState<"Leito" | "Comum" | "">("");
  const [preferencia, setPreferencia] = useState<"Janela" | "Corredor" | "">("");
  const [pagamento, setPagamento] = useState("");

  const leito = vagas?.floriano_leito ?? 0;
  const comum = vagas?.floriano_comum ?? 0;
  const glp = vagas?.guadalupe ?? 0;
  const florianoEsgotado = leito <= 0 && comum <= 0;
  const guadalupeEsgotado = glp <= 0;

  const valorTotal =
    onibus === "Guadalupe"
      ? 193
      : tipoPoltrona === "Leito"
        ? 420
        : tipoPoltrona === "Comum"
          ? 350
          : 0;
  const valorPagar =
    pagamento === "PIX - Parcelado 2x" ? valorTotal / 2 : valorTotal;

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("criar_reserva", {
        p_onibus: onibus,
        p_tipo_poltrona: onibus === "Floriano" ? tipoPoltrona : "",
        p_preferencia_poltrona: preferencia,
        p_nome: nome,
        p_cpf: cpf,
        p_celular: celular,
        p_igreja: igreja,
        p_forma_pagamento: pagamento,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (codigo) => {
      queryClient.invalidateQueries({ queryKey: ["vagas"] });
      toast.success(`Reserva ${codigo} confirmada!`);
      navigate({ to: "/pagamento/$codigo", params: { codigo } });
    },
    onError: (error: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["vagas"] });
      const msg = error?.message ?? "";
      toast.error(
        msg.includes("ESGOTADO")
          ? "As vagas para essa opção acabaram de esgotar. Escolha outra opção."
          : "Não foi possível confirmar a reserva. Tente novamente.",
      );
    },
  });

  function confirmar() {
    if (!nome.trim() || !cpf.trim() || !celular.trim() || !igreja) {
      toast.error("Preencha nome, CPF, celular e igreja.");
      return;
    }
    if (!onibus) {
      toast.error("Escolha o ônibus.");
      return;
    }
    if (onibus === "Floriano" && !tipoPoltrona) {
      toast.error("Escolha o tipo de poltrona.");
      return;
    }
    if (!preferencia) {
      toast.error("Escolha a preferência de poltrona.");
      return;
    }
    if (!pagamento) {
      toast.error("Escolha a forma de pagamento.");
      return;
    }
    criar.mutate();
  }

  return (
    <div className="surface-sand min-h-screen pb-28 md:pb-10">
      <nav className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
          <BusFront className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold tracking-tight md:text-base">
            Contratação de Ônibus — Together
          </span>
        </div>
      </nav>
      <header className="px-5 pt-8 pb-6 text-center md:pt-12">
        <h1 className="text-3xl font-semibold md:text-4xl">Reserva de Vaga</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground md:max-w-2xl md:text-base">
          Confira o roteiro, veja as vagas disponíveis e garanta a sua em poucos
          toques.
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 md:px-6">
        {/* Roteiros */}
        <div className="grid gap-5 md:grid-cols-2">

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BusFront className="size-5 shrink-0 text-primary" />
              <h2 className="truncate text-xl font-semibold">Ônibus Floriano</h2>
            </div>
            <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Leito / Comum
            </span>
          </div>
          <div className="mt-2 divide-y">
            <Linha
              icone={<CalendarDays className="size-4" />}
              rotulo="Saída"
              valor="16/11 às 19h — Segunda-feira"
            />
            <Linha
              icone={<MapPin className="size-4" />}
              rotulo="Passeio"
              valor="17/11 — Terça-feira"
            />
            <Linha
              icone={<Clock className="size-4" />}
              rotulo="Retorno"
              valor="22/11 às 10h — Domingo"
            />
          </div>
          <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
            Leito {brl(420)} · Comum {brl(350)}
          </p>
          <div className="mt-4 space-y-3">
            <VagaBarra
              rotulo="Floriano — Leito"
              restantes={leito}
              total={CAPACIDADE.florianoLeito}
            />
            <VagaBarra
              rotulo="Floriano — Comum"
              restantes={comum}
              total={CAPACIDADE.florianoComum}
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BusFront className="size-5 shrink-0 text-primary" />
              <h2 className="truncate text-xl font-semibold">
                Ônibus Guadalupe
              </h2>
            </div>
            <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Vaga única
            </span>
          </div>
          <div className="mt-2 divide-y">
            <Linha
              icone={<CalendarDays className="size-4" />}
              rotulo="Saída"
              valor="17/11 às 10h — Terça-feira"
            />
            <Linha
              icone={<MapPin className="size-4" />}
              rotulo="Passeio"
              valor="22/11 — Domingo"
            />
            <Linha
              icone={<Clock className="size-4" />}
              rotulo="Retorno"
              valor="22/11 às 14h — Domingo"
            />
          </div>
          <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
            Valor único {brl(193)}
          </p>
          <div className="mt-4">
            <VagaBarra
              rotulo="Guadalupe"
              restantes={glp}
              total={CAPACIDADE.guadalupe}
            />
          </div>
        </section>
        </div>

        {/* Formulário */}
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
          <h2 className="text-xl font-semibold">Seus dados</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                inputMode="numeric"
                placeholder="000.000.000-00"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="celular">Celular</Label>
              <Input
                id="celular"
                value={celular}
                onChange={(e) => setCelular(mascaraCelular(e.target.value))}
                inputMode="tel"
                placeholder="(89) 99999-9999"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Igreja</Label>
              <Select value={igreja} onValueChange={setIgreja}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue placeholder="Selecione sua igreja" />
                </SelectTrigger>
                <SelectContent>
                  {IGREJAS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ônibus</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                <Button
                  type="button"
                  variant={onibus === "Floriano" ? "default" : "outline"}
                  disabled={florianoEsgotado || isLoading}
                  className="h-12"
                  onClick={() => {
                    setOnibus("Floriano");
                    setTipoPoltrona("");
                  }}
                >
                  Floriano {florianoEsgotado ? "(Esgotado)" : ""}
                </Button>
                <Button
                  type="button"
                  variant={onibus === "Guadalupe" ? "default" : "outline"}
                  disabled={guadalupeEsgotado || isLoading}
                  className="h-12"
                  onClick={() => {
                    setOnibus("Guadalupe");
                    setTipoPoltrona("");
                  }}
                >
                  Guadalupe {guadalupeEsgotado ? "(Esgotado)" : ""}
                </Button>
              </div>
            </div>

            {onibus === "Floriano" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Tipo de poltrona</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                  <Button
                    type="button"
                    variant={tipoPoltrona === "Leito" ? "default" : "outline"}
                    disabled={leito <= 0}
                    className="h-12"
                    onClick={() => setTipoPoltrona("Leito")}
                  >
                    Leito · {brl(420)} {leito <= 0 ? "(Esgotado)" : ""}
                  </Button>
                  <Button
                    type="button"
                    variant={tipoPoltrona === "Comum" ? "default" : "outline"}
                    disabled={comum <= 0}
                    className="h-12"
                    onClick={() => setTipoPoltrona("Comum")}
                  >
                    Comum · {brl(350)} {comum <= 0 ? "(Esgotado)" : ""}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Preferência de poltrona</Label>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(["Janela", "Corredor"] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={preferencia === p ? "default" : "outline"}
                    className="h-12"
                    onClick={() => setPreferencia(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                É apenas uma preferência — as poltronas serão distribuídas
                posteriormente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={pagamento} onValueChange={setPagamento}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue placeholder="Como você vai pagar?" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {valorTotal > 0 && (
              <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
                <p className="text-sm text-muted-foreground">Valor da vaga</p>
                <p className="text-lg font-semibold">{brl(valorTotal)}</p>
                {pagamento === "PIX - Parcelado 2x" && (
                  <p className="text-sm text-muted-foreground">
                    1ª parcela agora: <strong>{brl(valorPagar)}</strong>
                  </p>
                )}
              </div>
            )}

            <div className="md:col-span-2 md:flex md:justify-end">
              <Button
                size="lg"
                className="hidden h-14 w-full text-base font-semibold md:flex md:w-72"
                disabled={criar.isPending}
                onClick={confirmar}
              >
                {criar.isPending && (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                )}
                {criar.isPending ? "Confirmando..." : "Confirmar reserva"}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 p-4 backdrop-blur md:hidden">
        <div className="mx-auto max-w-xl">
          <Button
            size="lg"
            className="h-14 w-full text-base font-semibold"
            disabled={criar.isPending}
            onClick={confirmar}
          >
            {criar.isPending && (
              <Loader2 className="mr-2 size-5 animate-spin" />
            )}
            {criar.isPending ? "Confirmando..." : "Confirmar reserva"}
          </Button>
        </div>
      </div>
    </div>
  );
}
