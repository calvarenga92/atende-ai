# Atende AI

Chatbot com IA para empresas: cada empresa cadastra a persona do bot e a base de conhecimento
(FAQ, horários, preços), e cola um widget no site. O bot responde os visitantes com a Claude,
só com base no que a empresa informou.

## Rodar local

Requisitos: Node 24. Não precisa de Docker (o banco local é PGlite).

```bash
cd api
npm install
cp .env.example .env   # escolha a IA em IA_PROVEDOR
npm run dev
```

### Qual IA responde

| `IA_PROVEDOR` | O que é | Custo |
|---|---|---|
| `simulado` (padrão) | Resposta de mentira, para desenvolver e para demo pública | zero |
| `ollama` | IA local via [Ollama](https://ollama.com) (`ollama pull qwen3:8b`) | zero |
| `anthropic` | Claude, pela API da Anthropic (`ANTHROPIC_API_KEY`) | pago por uso |

Abra http://localhost:3100/teste.html para conversar com a empresa demo (`padaria-demo`).
Outra empresa: `teste.html?empresa=<slug>`.

## API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/saude` | Saúde da API e do banco |
| GET | `/api/chat/:slug/config` | Dados públicos do bot (nome, cor, boas-vindas) |
| POST | `/api/chat/:slug` | `{ mensagem, conversaId? }` → resposta em streaming (SSE) |
| GET/POST | `/api/empresas` | Lista / cria empresa |
| GET/PATCH | `/api/empresas/:slug` | Lê / edita empresa (persona, base de conhecimento) |
| GET | `/api/empresas/:slug/leads` | Contatos deixados pelos visitantes no chat |

Eventos do streaming: `inicio` (com `conversaId`), `texto` (pedaços da resposta), `fim`, `erro`.

## Captura de leads

Quando o visitante mostra interesse (encomenda, orçamento, falar com a equipe), o bot pede nome e
telefone ou e-mail. Com os dados em mãos, a IA chama a ferramenta `salvar_lead`, que:

- valida e normaliza o contato (telefone com DDD vira só dígitos, e-mail em minúsculas);
- devolve o problema para a IA quando falta algo (ex.: telefone sem DDD), e ela pede de novo;
- fica presa à conversa: a IA informa só os dados da pessoa, nunca a empresa ou a conversa;
- grava um lead por conversa (chamar de novo atualiza).

Funciona nos três modos de IA: no `simulado`, qualquer telefone ou e-mail na mensagem dispara a ferramenta.

## Roteiro

1. ~~Núcleo do chat: multi-empresa, persona, streaming~~
2. ~~Base de conhecimento no prompt (com cache)~~
3. ~~Captura de leads (ferramenta `salvar_lead`)~~
4. Widget embutível (`<script>` no site do cliente)
5. Painel admin em React com login
