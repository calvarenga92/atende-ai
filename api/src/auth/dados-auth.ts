import { dadosInvalidos, ErroAplicacao } from '../comum/erro-aplicacao.js';
import {
  type DadosEmpresa,
  validarDadosEmpresa,
} from '../empresas/dados-empresa.js';

export const MIN_SENHA = 8;
// scrypt aceita qualquer tamanho; o teto só evita gastar CPU com senha de 1 MB.
export const MAX_SENHA = 128;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
  empresa: DadosEmpresa;
}

export interface DadosEntrada {
  email: string;
  senha: string;
}

/**
 * Cadastro = conta + empresa nova. Da empresa só pede nome e slug; o resto do bot
 * sai com um padrão neutro, que a pessoa troca depois no painel.
 */
export function validarCadastro(corpo: unknown): DadosCadastro {
  const entrada = objeto(corpo);
  const erros: Record<string, string> = {};

  const nome = texto(entrada.nome);
  if (!nome) erros.nome = 'Obrigatório.';
  else if (nome.length > 120) erros.nome = 'Máximo de 120 caracteres.';

  const email = validarEmail(entrada.email, erros);
  const senha = validarSenha(entrada.senha, erros, true);

  const bruto = objeto(entrada.empresa ?? {}, 'empresa');
  const nomeEmpresa = texto(bruto.nome);
  let empresa: DadosEmpresa | undefined;
  try {
    empresa = validarDadosEmpresa(
      {
        nomeBot: 'Assistente',
        tom: 'simpático, claro e direto',
        mensagemBoasVindas: nomeEmpresa
          ? `Olá! Aqui é o atendimento da ${nomeEmpresa}. Como posso ajudar?`
          : undefined,
        ...bruto,
      },
      false,
    ) as DadosEmpresa;
  } catch (e) {
    if (!(e instanceof ErroAplicacao) || !e.campos) throw e;
    for (const [campo, msg] of Object.entries(e.campos)) {
      // Boas-vindas sai do nome da empresa: o erro que importa é o do nome.
      if (campo === 'mensagemBoasVindas' && !nomeEmpresa) continue;
      erros[`empresa.${campo}`] = msg;
    }
  }

  if (Object.keys(erros).length || !empresa) throw dadosInvalidos(erros);
  return { nome, email, senha, empresa };
}

export function validarEntrada(corpo: unknown): DadosEntrada {
  const entrada = objeto(corpo);
  const erros: Record<string, string> = {};
  const email = validarEmail(entrada.email, erros);
  const senha = validarSenha(entrada.senha, erros, false);
  if (Object.keys(erros).length) throw dadosInvalidos(erros);
  return { email, senha };
}

function objeto(corpo: unknown, campo = 'corpo'): Record<string, unknown> {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw dadosInvalidos({ [campo]: 'Envie um objeto JSON.' });
  }
  return corpo as Record<string, unknown>;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarEmail(valor: unknown, erros: Record<string, string>): string {
  const email = texto(valor).toLowerCase();
  if (!email) erros.email = 'Obrigatório.';
  else if (email.length > 254 || !EMAIL.test(email))
    erros.email = 'E-mail inválido.';
  return email;
}

/** No login não se cobra tamanho mínimo: a regra pode mudar e quem já tem conta não pode ficar trancado. */
function validarSenha(
  valor: unknown,
  erros: Record<string, string>,
  nova: boolean,
): string {
  // Senha não é aparada: espaço pode ser de propósito.
  const senha = typeof valor === 'string' ? valor : '';
  if (!senha) erros.senha = 'Obrigatória.';
  else if (senha.length > MAX_SENHA)
    erros.senha = `Máximo de ${MAX_SENHA} caracteres.`;
  else if (nova && senha.length < MIN_SENHA)
    erros.senha = `Use pelo menos ${MIN_SENHA} caracteres.`;
  return senha;
}
