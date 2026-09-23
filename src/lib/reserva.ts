export const IGREJAS = [
  "Alto da Cruz",
  "Barão de Grajaú",
  "Cajueiro 2",
  "Catumbi",
  "Central",
  "Irapuá",
  "Oeiras",
  "Pastos Bons",
] as const;

export const FORMAS_PAGAMENTO = [
  "PIX - Completo",
  "PIX - Parcelado 2x",
  "CARTÃO",
] as const;

export const CAPACIDADE = {
  florianoLeito: 20,
  florianoComum: 40,
  guadalupe: 6,
};

export const LINKS_CARTAO = {
  "Floriano|Leito": "https://mpago.la/11bKP95",
  "Floriano|Comum": "https://mpago.la/2tX6TuZ",
  Guadalupe: "https://mpago.la/2Ten9yL",
} as const;

export const WHATSAPP = "5589994362450";

export function brl(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function mascaraCelular(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function linkCartao(onibus: string, tipoPoltrona: string | null) {
  if (onibus === "Guadalupe") return LINKS_CARTAO.Guadalupe;
  return tipoPoltrona === "Leito"
    ? LINKS_CARTAO["Floriano|Leito"]
    : LINKS_CARTAO["Floriano|Comum"];
}
