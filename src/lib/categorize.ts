import type { GroupKey, TxGroup } from "./categories";

export type Rule = { pattern: string; group_key: string; sub_label: string };
export type Categorized = { group: TxGroup; sub: string; excluded: boolean };

export type CategorizeInput = {
  description: string;
  pluggyCategory?: string | null;
  merchantCategory?: string | null;
  direction: "in" | "out";
  accountType?: "BANK" | "CREDIT" | "MANUAL";
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip installment markers and card noise so "AMAZON PARC 05/12" and "AMAZON PARC 06/12" match. */
export function baseDescription(s: string): string {
  return normalize(s)
    .replace(/\b(parc(ela)?|parcelado)\s*\d{1,2}\s*(\/|de)\s*\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/[*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Movements between your own money: card bill payments, transfers between your accounts, investing.
const EXCLUDE =
  /credit card payment|pagamento de cartao|pagamento (de )?fatura|pgto fatura|pag fatura|same (person|ownership)|mesma titularidade|transfer(ence|encia)? entre contas|investment|investimento|aplicacao|resgate|proceeds|poupanca automatica/;

const SPEND: [RegExp, GroupKey, string][] = [
  [/aluguel|\brent\b/, "moradia", "Aluguel"],
  [/condominio|\bcondo\b/, "moradia", "Condomínio"],
  [/energia|electricity|\bluz\b|enel|cemig|copel|light s/, "moradia", "Energia elétrica"],
  [/\bagua\b|water|saneamento|sabesp|cedae/, "moradia", "Água"],
  [/internet|telecom|telefon|celular|mobile|vivo|claro|\btim\b|oi fibra/, "moradia", "Internet e telefone"],
  [/housing|moradia|imobiliaria/, "moradia", "Moradia"],
  [/ifood|rappi|food delivery|delivery|ze delivery|aiqfome/, "alim", "Delivery"],
  [/supermerc|mercado(?! livre|livre|pago)|groceries|grocery|atacad|hortifruti|assai|carrefour|pao de acucar|extra hiper/, "alim", "Supermercado"],
  [/padaria|bakery|panificadora/, "alim", "Padaria"],
  [/restaurant|eating out|\bbar\b|lanchonete|\bcafe\b|cafeteria|food and drinks|alimentacao|burger|pizza|outback|mcdonald|starbucks/, "alim", "Restaurantes e bares"],
  [/uber|\b99\b|99app|99 pop|taxi|ride-hailing|cabify/, "transp", "Apps de transporte"],
  [/posto|combustiv|gas station|fuel|shell|ipiranga|petrobras|\bbr mania/, "transp", "Combustível"],
  [/estaciona|parking|estapar/, "transp", "Estacionamento"],
  [/pedagio|\btoll|sem parar|conectcar|veloe/, "transp", "Pedágio"],
  [/metro|onibus|public transport|bilhete unico|transit|\bcptm\b/, "transp", "Transporte público"],
  [/transporte|transportation|automotive|oficina|auto pecas/, "transp", "Transporte"],
  [/farmac|drogaria|drogasil|raia|pague menos|pharmacy/, "saude", "Farmácia"],
  [/academia|\bgym|fitness|smart ?fit|wellhub|gympass|totalpass/, "saude", "Academia"],
  [/hospital|clinic|laborat|medic|dentist|health|saude|plano de saude|unimed|amil|psicolog/, "saude", "Saúde"],
  [/escola|curso|faculdade|universidade|education|educacao|udemy|alura|ingles|livraria|books/, "saude", "Educação"],
  [/netflix|spotify|disney|hbo|\bmax\b|prime video|youtube|deezer|globoplay|paramount|streaming|apple music|crunchyroll/, "lazer", "Streaming e música"],
  [/apple\.com|icloud|google one|google storage|microsoft|adobe|notion|software|digital services|app store|google play|openai|anthropic|claude\.ai|chatgpt/, "lazer", "Apps e software"],
  [/gambling|aposta|\bbet|betano|bet365|blaze|loteria|lottery/, "lazer", "Apostas"],
  [/cinema|cinemark|\bshow|ingresso|sympla|eventim|entertainment|lazer|leisure|\bgame|steam|playstation|xbox/, "lazer", "Cinema e shows"],
  [/viage|travel|hotel|airbnb|booking|latam|voegol|gol linhas|azul linhas|voeazul|airline|airport|accommodation|decolar|\btrip/, "lazer", "Viagens e passeios"],
  [/amazon|mercado ?livre|shopee|aliexpress|magalu|magazine luiza|online shopping|e-commerce|shein|americanas/, "compras", "Compras online"],
  [/roupa|vestu|clothing|renner|riachuelo|zara|c&a|\bcea\b|shoes|calcad|nike|adidas|centauro|netshoes/, "compras", "Roupas e calçados"],
  [/eletron|electronics|fast shop|kabum|apple store/, "compras", "Eletrônicos"],
  [/shopping|compras|department|houseware|casa e decor|leroy|tok ?& ?stok|ikea/, "compras", "Casa e compras"],
  [/\biof\b|tarifa|bank fee|\bfees?\b|juros|interest charged|anuidade|encargo|multa/, "outros", "Tarifas e juros"],
  [/imposto|\btax|darf|ipva|iptu|receita federal/, "outros", "Impostos"],
  [/presente|gift|donation|doacao|vakinha/, "outros", "Presentes e doações"],
  [/\bpix\b|transfer|\bted\b|\bdoc\b/, "outros", "Pix e transferências"],
];

export function categorize(input: CategorizeInput, rules: Rule[] = []): Categorized {
  const desc = normalize(input.description ?? "");
  const hay = normalize(`${input.pluggyCategory ?? ""} ${input.merchantCategory ?? ""} ${input.description ?? ""}`);

  // Your own corrections win over everything else.
  for (const r of rules) {
    if (r.pattern && desc.includes(normalize(r.pattern))) {
      return { group: r.group_key as TxGroup, sub: r.sub_label, excluded: r.group_key === "transfer" };
    }
  }

  if (EXCLUDE.test(hay)) return { group: "transfer", sub: "Entre suas contas", excluded: true };

  if (input.direction === "in") {
    // Money coming into a card is a refund or a bill payment, not income.
    if (input.accountType === "CREDIT") return { group: "transfer", sub: "Estorno ou pagamento", excluded: true };
    if (/salar|payroll|folha|vencimento/.test(hay)) return { group: "entrada", sub: "Salário", excluded: false };
    if (/rendimento|interest|yield|dividend|juros sobre/.test(hay)) return { group: "entrada", sub: "Rendimentos", excluded: false };
    if (/\bpix\b|transfer|\bted\b/.test(hay)) return { group: "entrada", sub: "Pix recebido", excluded: false };
    return { group: "entrada", sub: "Recebido", excluded: false };
  }

  for (const [re, g, sub] of SPEND) {
    if (re.test(hay)) return { group: g, sub, excluded: false };
  }
  return { group: "outros", sub: "Sem categoria", excluded: false };
}
