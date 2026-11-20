# Atende AI

Chatbot com IA para empresas: cada empresa cadastra a persona do bot e a base de conhecimento
(FAQ, horários, preços), e cola um widget no site. O bot responde os visitantes com a Claude,
só com base no que a empresa informou.

## Rodar local

Requisitos: Node 24. Não precisa de Docker (o banco local é PGlite).

```bash
cd widget && npm install && npm run build && cd ..   # gera widget/dist/widget.js
cd api
npm install
cp .env.example .env   # escolha a IA em IA_PROVEDOR
npm run dev
```

Para mexer no widget com recarga automática: `cd widget && npm run dev` (em outro terminal).

O painel (em outro terminal, com a API rodando):

```bash
cd painel && npm install && npm run dev   # http://localhost:5173
```

Na tela de login, o botão "Usar a conta demo" preenche a conta da padaria.

### Qual IA responde

| `IA_PROVEDOR` | O que é | Custo |
|---|---|---|
| `simulado` (padrão) | Resposta de mentira, para desenvolver e para demo pública | zero |
| `ollama` | IA local via [Ollama](https://ollama.com) (`ollama pull qwen3:8b`) | zero |
| `anthropic` | Claude, pela API da Anthropic (`ANTHROPIC_API_KEY`) | pago por uso |

- http://localhost:3100/demo.html: site fictício da padaria com o widget de verdade.
- http://localhost:3100/teste.html: página crua do chat, para depurar a API. Outra empresa: `teste.html?empresa=<slug>`.
- Conta demo do painel (só em dev): `demo@padaria-demo.local` / `demo12345`.

Ponta a ponta do login e do painel (Postgres em memória, não mexe no banco local):
`cd api && npm run build && npm run e2e`.

## Widget

É o que a empresa cola no próprio site, uma linha antes do `</body>`:

```html
<script src="https://<endereço-da-api>/widget.js" data-empresa="padaria-demo" async></script>
```

- **Vem da API.** O endereço sai do `src` do próprio script; `data-api="https://..."` muda isso.
- **Não interfere no site.** Ele fica num Shadow DOM: o CSS do site não quebra o widget, e o do widget não vaza.
  São ~14 KB, sem dependência.
- **Veste a marca da empresa.** O topo, as bolhas e os botões saem de `corPrimaria`. O texto escolhe sozinho
  branco ou escuro, o que passar do contraste AA.
- **Segue as telas do Figma "Atende AI — Telas":**
  - bolha com dica (some depois de dispensada);
  - boas-vindas e sugestões (`sugestoes` da empresa, até 4);
  - "digitando" até o primeiro texto;
  - resposta em streaming;
  - aviso verde quando o contato é salvo (evento `lead`);
  - falha com "Tentar de novo".
- **Lembra a conversa** ao trocar de página no mesmo site, enquanto a aba estiver aberta (sessionStorage).
- **Acessível:** a janela é um `dialog` e as mensagens ficam num `log` com `aria-live`. Esc fecha, e o foco volta
  para a bolha.
- **No celular,** a janela ocupa a tela toda.
- **Se a empresa não existir ou a API estiver fora,** o widget simplesmente não aparece.
- **O texto da IA entra sempre como texto, nunca como HTML.**

## API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/saude` | Saúde da API e do banco |
| GET | `/api/chat/:slug/config` | Dados públicos do bot (nome, cor, boas-vindas) |
| POST | `/api/chat/:slug` | `{ mensagem, conversaId? }` → resposta em streaming (SSE) |
| POST | `/api/auth/cadastro` | `{ nome, email, senha, empresa: { nome, slug } }` → cria empresa + conta e já entra |
| POST | `/api/auth/entrar` | `{ email, senha }` → `{ token, expiraEm, usuario, empresa }` |
| POST | `/api/auth/sair` | Encerra a sessão do token |
| GET | `/api/auth/eu` | Conta e empresa do token |
| GET/PATCH | `/api/painel/empresa` | Lê / edita a própria empresa (persona, base de conhecimento, cor, sugestões) |
| GET | `/api/painel/leads` | Contatos deixados pelos visitantes no chat |

As rotas `/api/auth/eu`, `/api/auth/sair` e `/api/painel/*` pedem `Authorization: Bearer <token>`.

Eventos do streaming: `inicio` (com `conversaId`), `texto` (pedaços da resposta), `lead` (contato salvo agora), `fim`, `erro`.

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
4. ~~Widget embutível (`<script>` no site do cliente)~~
5. Painel admin em React com login

## Painel

React 19 + Vite + React Router, em `painel/`. Segue as telas 8 e 9 do Figma "Atende AI — Telas".

- **Entrar / Criar conta.** O cadastro sugere o endereço do bot a partir do nome da empresa.
- **Leads.** Números do dia e da semana, filtro por telefone ou e-mail, busca sem ligar para acento,
  contato clicável (`tel:` / `mailto:`) e exportação em CSV que abre direto no Excel em português.
  O CSV neutraliza fórmula vinda do chat (`=`, `+`, `-`, `@`).
- **Bot e base.** Nome, cor, tom, boas-vindas, sugestões, instruções e base de conhecimento, com
  **prévia ao vivo** do widget. A prévia usa a mesma função de cor do widget (`widget/src/cores.ts`).
  Salva só o que mudou, mostra o erro de cada campo e avisa antes de fechar com alteração pendente.
- **Instalar no site.** A tag pronta para copiar.
- Sessão vencida em qualquer tela leva de volta ao login. No celular, o menu vai para o topo e a tabela vira cartões.
- 19 testes (Vitest + Testing Library) com a API fingida: login, cadastro, sessão vencida, filtros, salvar, erros por campo.

## Login (API)

- **A empresa sai do login, nunca da URL.** As rotas do painel não recebem slug nem id: não tem como pedir
  os dados de outra empresa.
- **Senha com scrypt** (do próprio Node), com sal por senha. O formato guarda o custo, que pode subir sem invalidar as antigas.
- **Sessão com token opaco** (256 bits) no cabeçalho `Authorization`, válida por 7 dias. O banco guarda só o
  SHA-256 do token. Sair apaga a sessão na hora. Sem cookie, então não há CSRF para tratar.
- **Login não entrega quem tem conta:** a mensagem é a mesma para e-mail inexistente e senha errada, e o tempo também
  (confere contra um hash falso).
- **5 senhas erradas** no mesmo IP + e-mail travam por 15 minutos (429).
- **Cadastro é atômico:** empresa e conta são criadas juntas ou nenhuma das duas.
- **CORS em duas camadas:** `/api/chat` e `/api/saude` aceitam qualquer site (o widget roda no site do cliente);
  login e painel só respondem às origens de `CORS_ORIGENS`.
