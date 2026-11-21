import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { criarRotasTeste } from "./rotas";
import { ProvedorSessao } from "./sessao";
import type { Empresa, Lead } from "./tipos";

const TOKEN = "t".repeat(43);

const empresa: Empresa = {
  id: "e1",
  slug: "padaria-demo",
  nome: "Padaria Pão de Ouro",
  nomeBot: "Lia",
  tom: "simpático",
  instrucoes: "",
  conhecimento: "# Horário\n- 6h às 20h",
  mensagemBoasVindas: "Oi! Eu sou a Lia.",
  corPrimaria: "#b45309",
  sugestoes: ["Horários"],
  criadoEm: "2026-11-17T00:00:00Z",
  atualizadoEm: "2026-11-17T00:00:00Z",
};
const usuario = { id: "u1", nome: "Equipe", email: "demo@x.com" };
const leads: Lead[] = [
  {
    id: "l1",
    conversaId: "c1",
    nome: "Mariana Costa",
    contato: "11977771234",
    tipoContato: "telefone",
    interesse: "Bolo para sábado",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  },
  {
    id: "l2",
    conversaId: "c2",
    nome: "Juliana Reis",
    contato: "juliana@x.com",
    tipoContato: "email",
    interesse: "Salgados",
    criadoEm: "2026-11-01T10:00:00Z",
    atualizadoEm: "2026-11-01T10:00:00Z",
  },
];

type Rota = (init: RequestInit) => [number, unknown?];

/** Finge a API: `{ 'POST /auth/entrar': (init) => [200, corpo] }`. Guarda as chamadas. */
function fingirApi(rotas: Record<string, Rota>) {
  const chamadas: { rota: string; init: RequestInit }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init = {}) => {
    const rota = `${init.method ?? "GET"} ${String(url).replace(/^.*\/api/, "")}`;
    chamadas.push({ rota, init });
    const fn = rotas[rota];
    if (!fn) throw new Error(`Rota não fingida: ${rota}`);
    const [status, corpo] = fn(init);
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return chamadas;
}

function abrir(inicio: string) {
  const rotas = criarRotasTeste(inicio);
  render(
    <ProvedorSessao>
      <RouterProvider router={rotas} />
    </ProvedorSessao>,
  );
  return rotas;
}

const logado = {
  "GET /auth/eu": () => [200, { usuario, empresa }] as [number, unknown],
};

describe("acesso", () => {
  it("sem login, manda para /entrar; ao entrar, volta para onde ia", async () => {
    const chamadas = fingirApi({
      "POST /auth/entrar": () => [
        200,
        { token: TOKEN, expiraEm: "", usuario, empresa },
      ],
      "GET /painel/leads": () => [200, leads],
    });
    const rotas = abrir("/leads");
    const u = userEvent.setup();

    await u.type(await screen.findByLabelText("E-mail"), "demo@x.com");
    await u.type(screen.getByLabelText("Senha"), "demo12345");
    await u.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: "Leads" }),
    ).toBeInTheDocument();
    expect(rotas.state.location.pathname).toBe("/leads");
    expect(localStorage.getItem("atende-ai.token")).toBe(TOKEN);
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({
      email: "demo@x.com",
      senha: "demo12345",
    });
  });

  it("entra na conta demo com um clique", async () => {
    const chamadas = fingirApi({
      "POST /auth/entrar": () => [
        200,
        { token: TOKEN, expiraEm: "", usuario, empresa },
      ],
      "GET /painel/leads": () => [200, leads],
    });
    abrir("/entrar");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /conta demo/ }));

    expect(
      await screen.findByRole("heading", { name: "Leads" }),
    ).toBeInTheDocument();
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({
      email: "demo@padaria-demo.local",
      senha: "demo12345",
    });
  });

  it("senha errada mostra a mensagem da API", async () => {
    fingirApi({
      "POST /auth/entrar": () => [
        401,
        { codigo: "NAO_AUTENTICADO", mensagem: "E-mail ou senha incorretos." },
      ],
    });
    abrir("/entrar");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("E-mail"), "a@b.com");
    await u.type(screen.getByLabelText("Senha"), "x");
    await u.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
  });

  it("cadastro sugere o endereço pelo nome da empresa e mostra erro por campo", async () => {
    const chamadas = fingirApi({
      "POST /auth/cadastro": () => [
        409,
        {
          codigo: "CONFLITO",
          mensagem: 'O endereço "padaria-pao-de-ouro" já está em uso.',
        },
      ],
    });
    abrir("/criar-conta");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("Seu nome"), "Ana");
    await u.type(screen.getByLabelText("E-mail"), "ana@x.com");
    await u.type(screen.getByLabelText("Senha"), "segredo-bom");
    await u.type(
      screen.getByLabelText("Nome da empresa"),
      "Padaria Pão de Ouro",
    );
    expect(screen.getByLabelText("Endereço do bot")).toHaveValue(
      "padaria-pao-de-ouro",
    );
    await u.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "já está em uso",
    );
    expect(JSON.parse(String(chamadas[0].init.body))).toMatchObject({
      empresa: { nome: "Padaria Pão de Ouro", slug: "padaria-pao-de-ouro" },
    });
  });

  it("token salvo que venceu leva de volta ao login", async () => {
    localStorage.setItem("atende-ai.token", TOKEN);
    fingirApi({
      "GET /auth/eu": () => [
        401,
        { codigo: "NAO_AUTENTICADO", mensagem: "Sua sessão expirou." },
      ],
    });
    abrir("/leads");
    expect(
      await screen.findByRole("heading", { name: "Entrar no painel" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("atende-ai.token")).toBeNull();
  });

  it("sair apaga o token e volta ao login", async () => {
    localStorage.setItem("atende-ai.token", TOKEN);
    fingirApi({
      ...logado,
      "GET /painel/leads": () => [200, []],
      "POST /auth/sair": () => [204],
    });
    abrir("/leads");
    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(
      await screen.findByRole("heading", { name: "Entrar no painel" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("atende-ai.token")).toBeNull();
  });
});

describe("leads", () => {
  beforeEach(() => localStorage.setItem("atende-ai.token", TOKEN));

  it("lista, conta e filtra", async () => {
    fingirApi({ ...logado, "GET /painel/leads": () => [200, leads] });
    abrir("/leads");
    const tabela = await screen.findByRole("table");
    expect(within(tabela).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("(11) 97777-1234")).toHaveAttribute(
      "href",
      "tel:+5511977771234",
    );
    expect(screen.getByText("Leads hoje").nextElementSibling).toHaveTextContent(
      "1",
    );

    await userEvent.click(screen.getByRole("button", { name: "E-mail" }));
    expect(within(tabela).getAllByRole("row")).toHaveLength(2);
    expect(within(tabela).getByText("Juliana Reis")).toBeInTheDocument();
  });

  it("sem leads, aponta para a instalação", async () => {
    fingirApi({ ...logado, "GET /painel/leads": () => [200, []] });
    abrir("/leads");
    const aviso = (await screen.findByText("Nenhum lead ainda")).parentElement!;
    expect(
      within(aviso).getByRole("link", { name: "Instalar no site" }),
    ).toHaveAttribute("href", "/instalar");
  });

  it("API fora: mostra o erro e tenta de novo", async () => {
    let falhar = true;
    fingirApi({
      ...logado,
      "GET /painel/leads": () =>
        falhar
          ? [503, { codigo: "FALHA_TRANSITORIA", mensagem: "Banco fora." }]
          : [200, leads],
    });
    abrir("/leads");
    expect(await screen.findByRole("alert")).toHaveTextContent("Banco fora.");
    falhar = false;
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});

describe("bot e base", () => {
  beforeEach(() => localStorage.setItem("atende-ai.token", TOKEN));

  it("salva só o que mudou e atualiza a prévia e a lateral", async () => {
    const chamadas = fingirApi({
      ...logado,
      "PATCH /painel/empresa": (init) => [
        200,
        { ...empresa, ...JSON.parse(String(init.body)) },
      ],
    });
    abrir("/bot");
    const u = userEvent.setup();
    const salvar = await screen.findByRole("button", {
      name: "Salvar alterações",
    });
    expect(salvar).toBeDisabled();

    const nome = screen.getByLabelText("Nome da assistente");
    await u.clear(nome);
    await u.type(nome, "Bia");
    await u.type(screen.getByLabelText("Sugestão 2"), "Encomendas");
    await u.click(screen.getByLabelText("Cor #7c3aed"));

    // A prévia acompanha antes de salvar.
    const previa = screen.getByRole("figure", { name: "Prévia do widget" });
    expect(within(previa).getByText("Bia")).toBeInTheDocument();
    expect(within(previa).getByText("Encomendas")).toBeInTheDocument();
    expect(screen.getByText("Há alterações não salvas.")).toBeInTheDocument();

    await u.click(salvar);
    expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
    const patch = chamadas.find((c) => c.rota === "PATCH /painel/empresa")!;
    expect(JSON.parse(String(patch.init.body))).toEqual({
      nomeBot: "Bia",
      corPrimaria: "#7c3aed",
      sugestoes: ["Horários", "Encomendas"],
    });
    expect(screen.getByText("assistente: Bia", { exact: false })).toBeVisible();
    expect(salvar).toBeDisabled();
  });

  it("mostra o erro de cada campo vindo da API", async () => {
    fingirApi({
      ...logado,
      "PATCH /painel/empresa": () => [
        422,
        {
          codigo: "DADOS_INVALIDOS",
          mensagem: "Confira os campos destacados.",
          campos: { mensagemBoasVindas: "Obrigatório." },
        },
      ],
    });
    abrir("/bot");
    const u = userEvent.setup();
    await u.clear(await screen.findByLabelText("Mensagem de boas-vindas"));
    await u.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Obrigatório.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem de boas-vindas")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Confira os campos destacados.",
    );
  });

  it("sessão vencida ao salvar volta ao login", async () => {
    fingirApi({
      ...logado,
      "PATCH /painel/empresa": () => [
        401,
        { codigo: "NAO_AUTENTICADO", mensagem: "Sua sessão expirou." },
      ],
    });
    abrir("/bot");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("Tom de voz"), " e direto");
    await u.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Entrar no painel" }),
      ).toBeInTheDocument(),
    );
  });
});

describe("instalar", () => {
  it("mostra a tag com o slug da empresa", async () => {
    localStorage.setItem("atende-ai.token", TOKEN);
    fingirApi(logado);
    abrir("/instalar");
    expect(await screen.findByLabelText("Tag do widget")).toHaveTextContent(
      'data-empresa="padaria-demo"',
    );
  });
});
