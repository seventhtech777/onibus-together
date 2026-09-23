import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Copy, MessageCircle, BusFront } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl, linkCartao, WHATSAPP } from "@/lib/reserva";

export const Route = createFileRoute("/pagamento/$codigo")({
  head: () => ({
    meta: [
      { title: "Pagamento da Reserva — Excursão" },
      {
        name: "description",
        content: "Finalize o pagamento da sua vaga por PIX ou cartão e envie o comprovante.",
      },
      { property: "og:title", content: "Pagamento da Reserva — Excursão" },
      {
        property: "og:description",
        content: "Pague por PIX ou cartão e envie o comprovante pelo WhatsApp.",
      },
    ],
  }),
  component: PagamentoPage,
});

type Reserva = {
  codigo_reserva: string;
  onibus: string;
  tipo_poltrona: string | null;
  preferencia_poltrona: string;
  nome: string;
  forma_pagamento: string;
  valor_total: number;
  valor_pagamento: number;
  status_pagamento: string;
};

const CHAVE_PIX = "vpcostaiasd@gmail.com";

function PagamentoPage() {
  const { codigo } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["reserva", codigo],
    queryFn: async (): Promise<Reserva | null> => {
      const { data, error } = await supabase.rpc("reserva_por_codigo", {
        p_codigo: codigo,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Reserva | undefined;
      return row ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="surface-sand flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando reserva...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="surface-sand flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Reserva não encontrada</h1>
        <p className="text-sm text-muted-foreground">Não localizamos a reserva {codigo}.</p>
        <Button asChild>
          <Link to="/">Voltar para a reserva</Link>
        </Button>
      </div>
    );
  }

  const ehFloriano = data.onibus === "Floriano";
  const mensagem = [
    "Olá, Verlan! Fiz uma reserva do ônibus.",
    "",
    `Reserva: ${data.codigo_reserva}`,
    `Nome: ${data.nome}`,
    `Ônibus: ${data.onibus}`,
    ...(ehFloriano && data.tipo_poltrona ? [`Poltrona: ${data.tipo_poltrona}`] : []),
    `Pagamento: ${data.forma_pagamento}`,
    `Valor: ${brl(Number(data.valor_pagamento))}`,
    "",
    "Estou enviando o comprovante do pagamento.",
  ].join("\n");

  const whatsUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;

  return (
    <div className="surface-sand min-h-screen pb-10">
      <nav className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="justify-center mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
          <BusFront className="size-10 *:shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold tracking-tight md:text-2xl">
            Contratação de Ônibus — Together
          </span>
        </div>
      </nav>
      <header className="text-center px-5 pt-8 pb-4">
        <h1 className="mt-3 text-3xl font-semibold">Pagamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua vaga já está reservada. Agora é só realizar o pagamento.
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 md:px-6">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
          {/* Sua reserva — card dominante em largura */}
          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate text-xl font-semibold">Sua reserva</h2>
              <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
                {data.codigo_reserva}
              </span>
            </div>
            <dl className="mt-4 divide-y text-sm">
              {[
                ["Nome", data.nome],
                ["Ônibus", data.onibus],
                ...(ehFloriano && data.tipo_poltrona
                  ? [["Tipo de poltrona", data.tipo_poltrona]]
                  : []),
                ["Preferência", data.preferencia_poltrona],
                ["Forma de pagamento", data.forma_pagamento],
                ["Status", data.status_pagamento],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
              <p className="text-sm text-muted-foreground">Valor a pagar agora</p>
              <p className="text-3xl font-semibold">{brl(Number(data.valor_pagamento))}</p>
              {data.forma_pagamento === "PIX - Parcelado 2x" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Referente à 1ª de 2 parcelas (total {brl(Number(data.valor_total))}).
                </p>
              )}
            </div>
          </section>

          {/* Div com mesma altura da reserva: PIX + cartão empilhados, dividindo o espaço */}
          <div className="flex flex-col gap-5">
            <section className="flex flex-1 flex-col justify-center rounded-2xl border bg-card p-5 text-center shadow-[var(--shadow-soft)]">
              <h2 className="text-xl font-semibold">Pague com PIX</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escaneie o QR Code abaixo no app do seu banco.
              </p>
              <img
                src="public/pix.png"
                alt="QR Code PIX para pagamento"
                className="mx-auto mt-4 w-full max-w-[220px] rounded-xl border bg-background p-2"
              />
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  <strong>Verlan Pereira da Costa</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Chave PIX:</span>{" "}
                  <strong>{CHAVE_PIX}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Banco:</span>{" "}
                  <strong>Mercado Pago</strong>
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-4 h-12 w-full"
                onClick={() => {
                  navigator.clipboard.writeText(CHAVE_PIX);
                  toast.success("Chave PIX copiada!");
                }}
              >
                <Copy className="mr-2 size-4" /> Copiar chave PIX
              </Button>
            </section>

            <section className="flex flex-1 flex-col justify-center rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-xl font-semibold">Prefere cartão?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você será direcionado ao Mercado Pago com o valor da sua vaga.
              </p>
              <Button asChild className="mt-4 h-14 w-full text-base font-semibold">
                <a
                  href={linkCartao(data.onibus, data.tipo_poltrona)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CreditCard className="mr-2 size-5" /> Pagar com Cartão
                </a>
              </Button>
            </section>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <Button
            asChild
            size="lg"
            className="h-14 min-h-14 w-full max-w-md text-base font-semibold bg-success text-success-foreground hover:bg-success/90"
          >
            <a href={whatsUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-5" /> Enviar Comprovante
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
