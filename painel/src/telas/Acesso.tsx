import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { ErroApi } from '../api';
import { Campo } from '../componentes/Campo';
import { useSessao } from '../sessao';
import { gerarSlug } from '../util';

interface Props {
  modo: 'entrar' | 'cadastro';
}

const CONTA_DEMO = { email: 'demo@padaria-demo.local', senha: 'demo12345' };

export function Acesso({ modo }: Props) {
  const { entrar, cadastrar } = useSessao();
  const cadastro = modo === 'cadastro';

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [slug, setSlug] = useState('');
  const [slugMexido, setSlugMexido] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const slugFinal = slugMexido ? slug : gerarSlug(empresa);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErros({});
    setErroGeral('');
    setEnviando(true);
    try {
      if (cadastro) {
        await cadastrar({
          nome,
          email,
          senha,
          empresa: { nome: empresa, slug: slugFinal },
        });
      } else {
        await entrar(email, senha);
      }
      // A rota SoFora leva para dentro sozinha quando a sessão abre.
    } catch (err) {
      setEnviando(false);
      if (err instanceof ErroApi) {
        setErros(err.campos);
        setErroGeral(err.message);
      } else {
        setErroGeral('Algo deu errado. Tente de novo.');
      }
    }
  }

  /** Conta pública de demonstração: um clique e já está dentro (no ar, só leitura). */
  async function entrarNaDemo() {
    setEmail(CONTA_DEMO.email);
    setSenha(CONTA_DEMO.senha);
    setErros({});
    setErroGeral('');
    setEnviando(true);
    try {
      await entrar(CONTA_DEMO.email, CONTA_DEMO.senha);
    } catch (err) {
      setEnviando(false);
      setErroGeral(
        err instanceof ErroApi ? err.message : 'Algo deu errado. Tente de novo.',
      );
    }
  }

  return (
    <div className="acesso">
      <section className="acesso-marca" aria-hidden="true">
        <div className="marca">
          <i />
          Atende AI
        </div>
        <p className="acesso-frase">
          Uma assistente no seu site que responde com o que a sua empresa sabe e
          passa os interessados para a equipe.
        </p>
      </section>

      <section className="acesso-caixa">
        <h1>{cadastro ? 'Criar conta' : 'Entrar no painel'}</h1>
        <p className="sub">
          {cadastro
            ? 'Em um minuto a assistente já responde no seu site.'
            : 'Leads, base de conhecimento e instalação do widget.'}
        </p>

        <form onSubmit={(e) => void enviar(e)} noValidate>
          {cadastro && (
            <Campo
              rotulo="Seu nome"
              valor={nome}
              mudar={setNome}
              erro={erros.nome}
              autoComplete="name"
            />
          )}
          <Campo
            rotulo="E-mail"
            tipo="email"
            valor={email}
            mudar={setEmail}
            erro={erros.email}
            autoComplete="email"
          />
          <Campo
            rotulo="Senha"
            tipo="password"
            valor={senha}
            mudar={setSenha}
            erro={erros.senha}
            autoComplete={cadastro ? 'new-password' : 'current-password'}
            dica={cadastro ? 'Pelo menos 8 caracteres.' : undefined}
          />
          {cadastro && (
            <>
              <Campo
                rotulo="Nome da empresa"
                valor={empresa}
                mudar={setEmpresa}
                erro={erros['empresa.nome']}
                autoComplete="organization"
              />
              <Campo
                rotulo="Endereço do bot"
                valor={slugFinal}
                mudar={(v) => {
                  setSlugMexido(true);
                  setSlug(v.toLowerCase());
                }}
                erro={erros['empresa.slug']}
                dica="Vai na tag do widget. Letras minúsculas, números e hífen."
              />
            </>
          )}

          {erroGeral && (
            <p className="erro-geral" role="alert">
              {erroGeral}
            </p>
          )}

          <button className="btn-pri largo" type="submit" disabled={enviando}>
            {enviando
              ? cadastro
                ? 'Criando…'
                : 'Entrando…'
              : cadastro
                ? 'Criar conta'
                : 'Entrar'}
          </button>
        </form>

        <p className="troca">
          {cadastro ? (
            <>
              Já tem conta? <Link to="/entrar">Entrar</Link>
            </>
          ) : (
            <>
              Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link>
            </>
          )}
        </p>

        {!cadastro && (
          <button
            type="button"
            className="demo"
            disabled={enviando}
            onClick={() => void entrarNaDemo()}
          >
            Entrar na conta demo (Padaria Pão de Ouro)
          </button>
        )}
      </section>
    </div>
  );
}
