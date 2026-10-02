# liu liu

Assistente financeiro pessoal: lê suas contas e cartões pelo Open Finance (Pluggy), organiza os gastos em categorias e responde perguntas numa conversa (Ollama).

O design aprovado está em `design/` (`prototipo.html` e `direcoes.html`).

## Como funciona

- **Next.js 15** (App Router) com páginas renderizadas no servidor: Visão geral, Transações, Parcelamentos, Categorias e Cartões.
- **Banco de dados:** Postgres quando `DATABASE_URL` existe; sem ela, um Postgres embutido (PGlite) em `.data/`, bom para desenvolvimento.
- **Pluggy:** o botão “+ conectar banco” abre o widget da Pluggy. Escolha **MeuPluggy** para trazer os bancos que você já conectou lá. Depois disso o app importa 12 meses e atualiza:
  - pelo webhook da Pluggy (quando há transações novas);
  - por um cron diário da Vercel (`vercel.json`);
  - pelo botão “atualizado há…” no topo.
- **Categorias:** regras em `src/lib/categorize.ts` usam a categoria da Pluggy e a descrição. Quando você corrige uma categoria (na tela de transações ou pedindo ao liu liu), vira uma regra para as próximas. Pagamento de fatura, transferência entre suas contas e aplicações ficam fora dos gastos.
- **Chat:** `src/lib/ai/chat.ts` conversa com um modelo do Ollama (padrão `gpt-oss:120b`) com ferramentas para consultar o mês, buscar transações, registrar gastos em dinheiro, recategorizar, criar metas e definir orçamento e meta de poupança. Cada dia começa uma conversa nova.
- **Acesso:** uma senha só (`APP_PASSWORD`), já que o app é pessoal.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha o que tiver
LIU_TODAY=2026-09-28 npm run seed:demo   # opcional: dados de exemplo no banco local
npm run dev
```

`npm test` roda os testes de categorização e dos cálculos (parcelas, “pode gastar hoje”, contas recorrentes).

## Deploy na Vercel

1. Crie um Postgres (Neon, Supabase ou Vercel Postgres) e copie a URL de conexão.
2. Importe este repositório na Vercel.
3. Em *Environment Variables*, defina as variáveis do `.env.example`: `APP_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `WEBHOOK_SECRET`, `APP_URL` (a URL do deploy), `OLLAMA_API_KEY`, `CRON_SECRET` e, se quiser, `OLLAMA_MODEL` e `USER_NAME`.
4. Faça o deploy, entre com a senha e clique em **Conectar banco** → **MeuPluggy**.

As tabelas são criadas sozinhas na primeira requisição.
