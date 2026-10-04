// Coordena qual fundo animado esta ativo atras da tela de login (Particulas/
// Feixe de luz/Web, escolhido em Aparencia > Fundo animado) - so um roda
// por vez, reaproveitando o mesmo <canvas>. Trocar de estilo destroi a
// instancia antiga (desliga o loop de animacao, libera o contexto
// WebGL/2D) e cria a nova do zero.
import { createParticlesBackground } from './particles.js';
import { createLightBeamBackground } from './lightbeam.js';
import { createWebBackground } from './web.js';

const FACTORIES = {
  particulas: createParticlesBackground,
  lightbeam: createLightBeamBackground,
  web: createWebBackground,
};
const DEFAULT_STYLE = 'particulas';

const initialCanvas = document.getElementById('login-background-canvas');
if (initialCanvas) {
  const loginScreen = document.getElementById('login-screen');
  const canvasRef = { el: initialCanvas };
  let currentInstance = null;
  let isVisible = false;

  function mount(style) {
    if (currentInstance) {
      currentInstance.dispose();
      currentInstance = null;
    }
    // Cada fundo cria seu proprio contexto WebGL no canvas - precisa de um
    // canvas "limpo" (sem contexto anterior) pra isso funcionar de novo,
    // entao trocamos o elemento ATUAL por um clone sem contexto associado.
    const fresh = canvasRef.el.cloneNode();
    canvasRef.el.replaceWith(fresh);
    canvasRef.el = fresh;

    const factory = FACTORIES[style] || FACTORIES[DEFAULT_STYLE];
    currentInstance = factory(fresh);
    if (isVisible) currentInstance.start();
  }

  function readStyle() {
    try {
      const saved = JSON.parse(localStorage.getItem('telinhafix-theme'));
      return (saved && saved.background) || DEFAULT_STYLE;
    } catch (err) {
      return DEFAULT_STYLE;
    }
  }

  mount(readStyle());

  if (loginScreen) {
    const observer = new MutationObserver(() => {
      const hidden = loginScreen.classList.contains('hidden');
      isVisible = !hidden;
      if (!currentInstance) return;
      if (hidden) currentInstance.stop();
      else currentInstance.start();
    });
    observer.observe(loginScreen, { attributes: true, attributeFilter: ['class'] });
    isVisible = !loginScreen.classList.contains('hidden');
    if (isVisible && currentInstance) currentInstance.start();
  } else {
    isVisible = true;
    if (currentInstance) currentInstance.start();
  }

  // Chamado pelo menu de configuracoes (Aparencia > Fundo animado) quando a
  // pessoa troca de estilo.
  window.__setBackgroundStyle = (style) => mount(style);
}
