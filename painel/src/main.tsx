import '@fontsource-variable/plus-jakarta-sans';
import './estilos.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { criarRotas } from './rotas';
import { ProvedorSessao } from './sessao';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProvedorSessao>
      <RouterProvider router={criarRotas()} />
    </ProvedorSessao>
  </StrictMode>,
);
