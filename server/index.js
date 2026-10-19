const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
// Senha opcional para o servidor todo. Defina a variavel de ambiente
// APP_PASSWORD no Render para exigir que todo mundo digite essa senha
// antes de entrar em qualquer sala. Deixe em branco para nao exigir.
const APP_PASSWORD = process.env.APP_PASSWORD || '';
// Senha separada so pro client administrador (ve todas as salas ativas e
// pode entrar em qualquer uma). Define na variavel de ambiente
// ADMIN_PASSWORD no Render - precisa ser DIFERENTE da APP_PASSWORD e so
// deve ser conhecida pelo dono do app. Se nao for definida, o recurso de
// admin fica completamente desligado (nenhuma senha vira admin).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// --- TURN (plano B quando a conexao direta P2P nao fecha) -------------------
// Quando a rede dos dois lados nao deixa os PCs se ligarem direto (CGNAT,
// NAT simetrico, firewall), o video passa por um servidor TURN. As
// credenciais NUNCA ficam no codigo (o repositorio e publico) - vem das
// variaveis de ambiente do Render e sao mandadas pro app no join-room:
//   TURN_ICE_SERVERS  JSON com servidores fixos, ex. ExpressTURN:
//                     [{"urls":["turn:SERVIDOR:3478","turn:SERVIDOR:3478?transport=tcp"],"username":"...","credential":"..."}]
//   METERED_TURN_URL  URL de credenciais da Metered (Open Relay), ex.
//                     https://NOMEDOAPP.metered.live/api/v1/turn/credentials?apiKey=CHAVE
// Sem nenhuma das duas, o app continua so com STUN (como antes).
const STUN_SERVER = { urls: 'stun:stun.l.google.com:19302' };
const METERED_TURN_URL = process.env.METERED_TURN_URL || '';
const METERED_REFRESH_MS = 30 * 60 * 1000;

function sanitizeIceServers(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && (typeof s.urls === 'string' || Array.isArray(s.urls)))
    .map((s) => {
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => typeof u === 'string' && /^turns?:/.test(u));
      const out = { urls };
      if (typeof s.username === 'string') out.username = s.username;
      if (typeof s.credential === 'string') out.credential = s.credential;
      return out;
    })
    .filter((s) => s.urls.length > 0);
}

let staticTurnServers = [];
try {
  staticTurnServers = sanitizeIceServers(JSON.parse(process.env.TURN_ICE_SERVERS || '[]'));
} catch (err) {
  console.error('[turn] TURN_ICE_SERVERS nao e um JSON valido - ignorando:', err.message);
}
let meteredTurnServers = [];

async function refreshMeteredTurn() {
  if (!METERED_TURN_URL) return;
  try {
    const res = await fetch(METERED_TURN_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = sanitizeIceServers(await res.json());
    if (list.length) meteredTurnServers = list;
  } catch (err) {
    console.error('[turn] falha ao buscar credenciais da Metered:', err.message);
  }
}
refreshMeteredTurn();
if (METERED_TURN_URL) setInterval(refreshMeteredTurn, METERED_REFRESH_MS).unref();

function getIceServers() {
  return [STUN_SERVER, ...staticTurnServers, ...meteredTurnServers];
}
console.log(`[turn] ${staticTurnServers.length} servidor(es) TURN fixo(s), Metered ${METERED_TURN_URL ? 'ligada' : 'desligada'}`);

const httpServer = http.createServer((req, res) => {
  // Endpoint do teste de qualidade (opcional, roda no app): o cliente manda
  // um payload de tamanho conhecido e cronometra quanto tempo demora pra
  // subir, pra estimar o upload real disponivel. So precisa drenar o corpo
  // e responder - o conteudo em si nao importa.
  if (req.method === 'POST' && req.url === '/bandwidth-test') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    req.on('data', () => {});
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }
  if (req.method === 'OPTIONS' && req.url === '/bandwidth-test') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // "De uma sugestao ao dev" (tela de entrar do app): POST /sugestao com
  // { name, text, version } - repassa pro Google Forms do Bunny (ver
  // SUGGESTION_FORM_PREFILL_URL). 1 por minuto por IP.
  if (req.url === '/sugestao' && req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }
  if (req.url === '/sugestao' && req.method === 'POST') {
    handleSuggestion(req, res);
    return;
  }

  // Pagina de convite: https://.../convite/<sala>. Links telinhafix:// nao
  // ficam clicaveis no Discord/WhatsApp (so http/https), entao o botao
  // "Convidar" do app copia ESTE link - a pagina abre o TelinhaFix ja com a
  // sala (telinhafix://join?room=X) e mostra o codigo + o download pra quem
  // ainda nao tem o app.
  if (req.method === 'GET' && req.url.startsWith('/convite/')) {
    let raw = '';
    try { raw = decodeURIComponent(req.url.slice('/convite/'.length).split(/[?#]/)[0]); } catch { raw = ''; }
    const roomId = normalizeRoomId(raw);
    const valid = !!roomId && roomId.length <= MAX_ROOM_ID_LEN;
    res.writeHead(valid ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src https://raw.githubusercontent.com; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    });
    res.end(renderInvitePage(valid ? roomId : null));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TelinhaFix signaling server ok');
});

// --- Sugestoes -> Google Forms ----------------------------------------------
// SUGGESTION_FORM_PREFILL_URL (variavel no Render) = o "link pre-preenchido"
// do Google Forms, gerado com NOME no campo Nome e SUGESTAO no campo
// Sugestao (e, se quiser, VERSAO num terceiro campo opcional). Daqui sai o
// endereco de envio e o "entry.N" de cada campo - nada disso fica no codigo
// (o repositorio e publico). Sem a variavel, /sugestao responde que nao
// esta configurado. Toda sugestao tambem aparece no log do Render.
function parseSuggestionForm(url) {
  try {
    const u = new URL(url);
    const fields = {};
    for (const [key, value] of u.searchParams) {
      if (!key.startsWith('entry.')) continue;
      const v = value.trim().toUpperCase();
      if (v === 'NOME') fields.name = key;
      else if (v === 'SUGESTAO' || v === 'SUGESTÃO') fields.text = key;
      else if (v === 'VERSAO' || v === 'VERSÃO') fields.version = key;
    }
    if (!fields.name || !fields.text) return null;
    return { action: u.origin + u.pathname.replace(/\/viewform$/, '/formResponse'), ...fields };
  } catch {
    return null;
  }
}
const suggestionForm = parseSuggestionForm(process.env.SUGGESTION_FORM_PREFILL_URL || '');
console.log(`[sugestao] Google Forms ${suggestionForm ? 'configurado' : 'NAO configurado'}`);
const SUGGESTION_COOLDOWN_MS = 60 * 1000;
const lastSuggestionByIp = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, at] of lastSuggestionByIp) if (now - at > SUGGESTION_COOLDOWN_MS) lastSuggestionByIp.delete(ip);
}, 5 * 60 * 1000).unref();

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function handleSuggestion(req, res) {
  let raw = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 8192) { tooBig = true; req.destroy(); }
  });
  req.on('end', async () => {
    if (tooBig) return;
    let body;
    try { body = JSON.parse(raw); } catch { return sendJson(res, 400, { ok: false, error: 'Pedido inválido' }); }
    const name = (typeof body.name === 'string' ? body.name : '').trim().slice(0, MAX_NAME_LEN) || 'Anônimo';
    const text = (typeof body.text === 'string' ? body.text : '').trim().slice(0, 1000);
    const version = (typeof body.version === 'string' ? body.version : '').slice(0, 20);
    if (!text) return sendJson(res, 400, { ok: false, error: 'Escreve a sugestão antes de enviar.' });

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const last = lastSuggestionByIp.get(ip) || 0;
    const waitMs = last + SUGGESTION_COOLDOWN_MS - Date.now();
    if (waitMs > 0) return sendJson(res, 429, { ok: false, error: `Calma! Dá pra mandar outra em ${Math.ceil(waitMs / 1000)}s.` });

    console.log(`[sugestao] ${name} (v${version || '?'}): ${text.replace(/\s+/g, ' ')}`);
    if (!suggestionForm) return sendJson(res, 503, { ok: false, error: 'As sugestões ainda não foram configuradas pelo dev.' });

    lastSuggestionByIp.set(ip, Date.now());
    const params = new URLSearchParams();
    params.set(suggestionForm.name, name);
    params.set(suggestionForm.text, text);
    if (suggestionForm.version) params.set(suggestionForm.version, version);
    try {
      const r = await fetch(suggestionForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`Google Forms respondeu ${r.status}`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      lastSuggestionByIp.delete(ip); // falhou do nosso lado: deixa tentar de novo
      console.error('[sugestao] falha ao enviar pro Google Forms:', err.message);
      sendJson(res, 502, { ok: false, error: 'Não deu pra enviar agora. Tenta de novo daqui a pouco.' });
    }
  });
}

const INVITE_LOGO_URL ='https://raw.githubusercontent.com/RafaellMello/telinhafix/master/client/renderer/assets/logo.png';
const DOWNLOAD_URL = 'https://github.com/RafaellMello/telinhafix/releases/latest';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderInvitePage(roomId) {
  const title = roomId ? `Convite pra sala "${roomId}" no TelinhaFix` : 'Convite inválido - TelinhaFix';
  const deepLink = roomId ? `telinhafix://join?room=${encodeURIComponent(roomId)}` : '';
  const room = roomId ? escapeHtml(roomId) : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${roomId ? 'Clique pra entrar na sala com a galera no TelinhaFix.' : 'Esse link de convite não é válido.'}">
<meta property="og:image" content="${INVITE_LOGO_URL}">
<meta property="og:site_name" content="TelinhaFix">
<meta name="theme-color" content="#e0262f">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: #060607; color: #f2f2f2; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { width: 100%; max-width: 420px; text-align: center; background: #121214; border: 1px solid #26262a;
    border-radius: 16px; padding: 32px 24px; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
  img { width: 72px; height: 72px; border-radius: 16px; }
  h1 { font-size: 20px; margin: 16px 0 6px; }
  p { color: #a7a7ad; margin: 0 0 20px; line-height: 1.45; }
  .code { display: inline-block; font-size: 22px; font-weight: 800; letter-spacing: .5px; padding: 8px 16px;
    border-radius: 10px; background: #1d1d21; border: 1px dashed #e0262f; margin-bottom: 20px; word-break: break-all; }
  a.btn, button { display: block; width: 100%; padding: 13px; border-radius: 10px; font-size: 15px; font-weight: 700;
    text-decoration: none; border: 0; cursor: pointer; margin-top: 10px; font-family: inherit; }
  .primary { background: #e0262f; color: #fff; }
  .secondary { background: #1d1d21; color: #f2f2f2; border: 1px solid #2c2c31; }
  small { display: block; margin-top: 18px; color: #77777d; }
</style>
</head>
<body>
<main class="card">
  <img src="${INVITE_LOGO_URL}" alt="">
${roomId ? `  <h1>Você foi convidado pro TelinhaFix</h1>
  <p>Sala</p>
  <div class="code" id="code">${room}</div>
  <a class="btn primary" href="${escapeHtml(deepLink)}">Abrir no TelinhaFix</a>
  <button class="secondary" id="copy" type="button">Copiar código da sala</button>
  <a class="btn secondary" href="${DOWNLOAD_URL}">Não tenho o TelinhaFix - baixar</a>
  <small>Se o app não abrir sozinho, abra o TelinhaFix e digite o código da sala.</small>
<script>
  setTimeout(function () { window.location.href = ${JSON.stringify(deepLink).replace(/</g, '\\u003c')}; }, 400);
  document.getElementById('copy').addEventListener('click', function () {
    var btn = this;
    navigator.clipboard.writeText(document.getElementById('code').textContent).then(function () {
      btn.textContent = 'Código copiado!';
      setTimeout(function () { btn.textContent = 'Copiar código da sala'; }, 2000);
    });
  });
</script>` : `  <h1>Convite inválido</h1>
  <p>Esse link de convite não é válido. Peça um novo pra quem te convidou.</p>
  <a class="btn secondary" href="${DOWNLOAD_URL}">Baixar o TelinhaFix</a>`}
</main>
</body>
</html>`;
}

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// roomId -> Map<socketId, { name }>
const rooms = new Map();

// Banco de palavras do minijogo "Codigo Secreto" (Codenames) - precisa de
// pelo menos 25 pra montar um tabuleiro; bem mais que isso pra nao repetir
// toda hora entre partidas seguidas no mesmo grupo.
const CODENAMES_WORDS = [
  'CASTELO', 'LUA', 'MÉDICO', 'BANANA', 'AVIÃO', 'ROBÔ', 'PRAIA', 'PIRATA', 'GELO',
  'REI', 'ÁGUIA', 'BANCO', 'FOGO', 'MOUSE', 'MARTE', 'ESCOLA', 'CHAVE', 'CACHORRO',
  'RIO', 'COROA', 'TELEFONE', 'DRAGÃO', 'MÚSICA', 'PONTE', 'NEVE', 'GATO', 'LEÃO',
  'CARRO', 'SOL', 'ESPAÇO', 'SATURNO', 'SERPENTE', 'FLORESTA', 'MONTANHA', 'OCEANO', 'DESERTO',
  'VULCÃO', 'CHURRASCO', 'PROFESSOR', 'ENGENHEIRO', 'ADVOGADO', 'BOMBEIRO', 'POLICIAL', 'ASTRONAUTA', 'CIENTISTA',
  'PINTOR', 'MÚSICO', 'ATOR', 'JORNALISTA', 'COZINHEIRO', 'ELEFANTE', 'GIRAFA', 'MACACO', 'TIGRE',
  'URSO', 'LOBO', 'RAPOSA', 'COBRA', 'TARTARUGA', 'GOLFINHO', 'TUBARÃO', 'BALEIA', 'POLVO',
  'CAMALEÃO', 'PINGUIM', 'CANGURU', 'ZEBRA', 'RINOCERONTE', 'HIPOPÓTAMO', 'COMPUTADOR', 'CELULAR', 'TECLADO',
  'MONITOR', 'IMPRESSORA', 'FONE', 'CÂMERA', 'RELÓGIO', 'ÓCULOS', 'BICICLETA', 'MOTO', 'TREM',
  'NAVIO', 'FOGUETE', 'HELICÓPTERO', 'METRÔ', 'ÔNIBUS', 'CAMINHÃO', 'ESTRADA', 'TÚNEL', 'FAROL',
  'BÚSSOLA', 'MAPA', 'TESOURO', 'BAÚ', 'MOEDA', 'DIAMANTE', 'OURO', 'PRATA', 'ANEL',
  'ESPADA', 'ESCUDO', 'ARCO', 'FLECHA', 'ARMADURA', 'CAVALEIRO', 'PRINCESA', 'BRUXA', 'FANTASMA',
  'VAMPIRO', 'ZUMBI', 'MONSTRO', 'LABIRINTO', 'TORRE', 'MURALHA', 'PORTÃO', 'JARDIM', 'FONTE',
  'ESTÁTUA', 'IGREJA', 'TEMPLO', 'PIRÂMIDE', 'MÚMIA', 'FARAÓ', 'OÁSIS', 'CAMELO', 'CACTO',
  'TERREMOTO', 'FURACÃO', 'TEMPESTADE', 'RAIO', 'TROVÃO', 'ARCO-ÍRIS', 'NUVEM', 'CHUVA', 'GRANIZO',
  'GELEIRA', 'ILHA', 'CACHOEIRA', 'LAGO', 'PÂNTANO', 'CAVERNA', 'ROCHA', 'AREIA', 'CONCHA',
  'CORAL', 'RECIFE', 'PEIXE', 'CAVALO-MARINHO', 'CARANGUEJO', 'LAGOSTA', 'GAIVOTA', 'PELICANO', 'CORUJA',
  'MORCEGO', 'ARANHA', 'ESCORPIÃO', 'FORMIGA', 'ABELHA', 'BORBOLETA', 'GAFANHOTO', 'JOANINHA', 'VIOLÃO',
  'PIANO', 'BATERIA', 'GUITARRA', 'TROMPETE', 'FLAUTA', 'MICROFONE', 'PALCO', 'TEATRO', 'CINEMA',
  'LIVRO', 'CADERNO', 'LÁPIS', 'CANETA', 'TINTA', 'PINCEL', 'TELA', 'QUADRO', 'ESCULTURA',
  'MUSEU', 'BIBLIOTECA', 'HOSPITAL', 'FARMÁCIA', 'MERCADO', 'PADARIA', 'RESTAURANTE', 'HOTEL', 'AEROPORTO',
  'ESTAÇÃO', 'FÁBRICA', 'USINA', 'FAZENDA', 'CELEIRO', 'TRATOR', 'MOINHO', 'PLANTAÇÃO', 'COLHEITA',
  'SEMENTE', 'CABEÇA', 'OLHO', 'NARIZ', 'BOCA', 'ORELHA', 'DENTE', 'LÍNGUA', 'PESCOÇO',
  'OMBRO', 'BRAÇO', 'COTOVELO', 'PULSO', 'MÃO', 'DEDO', 'UNHA', 'PEITO', 'COSTAS',
  'BARRIGA', 'UMBIGO', 'QUADRIL', 'PERNA', 'JOELHO', 'TORNOZELO', 'PÉ', 'CALCANHAR', 'CABELO',
  'SOBRANCELHA', 'CÍLIO', 'QUEIXO', 'TESTA', 'BOCHECHA', 'CORAÇÃO', 'PULMÃO', 'FÍGADO', 'RIM',
  'ESTÔMAGO', 'CÉREBRO', 'OSSO', 'MÚSCULO', 'SANGUE', 'PELE', 'VEIA', 'CAMISA', 'CALÇA',
  'VESTIDO', 'SAIA', 'CASACO', 'JAQUETA', 'BONÉ', 'CHAPÉU', 'LUVA', 'CINTO', 'GRAVATA',
  'MEIA', 'SAPATO', 'TÊNIS', 'SANDÁLIA', 'BOTA', 'BOLSA', 'MOCHILA', 'CARTEIRA', 'PULSEIRA',
  'COLAR', 'BRINCO', 'CACHECOL', 'PIJAMA', 'UNIFORME', 'AVENTAL', 'TOUCA', 'CUECA', 'SUNGA',
  'BIQUÍNI', 'ARROZ', 'FEIJÃO', 'MACARRÃO', 'PIZZA', 'HAMBÚRGUER', 'SANDUÍCHE', 'SALADA', 'SOPA',
  'OMELETE', 'PÃO', 'QUEIJO', 'PRESUNTO', 'MANTEIGA', 'LEITE', 'IOGURTE', 'SORVETE', 'CHOCOLATE',
  'BOLO', 'TORTA', 'BISCOITO', 'PIPOCA', 'AMENDOIM', 'CASTANHA', 'MEL', 'AÇÚCAR', 'SAL',
  'PIMENTA', 'ALHO', 'CEBOLA', 'TOMATE', 'BATATA', 'CENOURA', 'ALFACE', 'REPOLHO', 'BRÓCOLIS',
  'MILHO', 'UVA', 'MAÇÃ', 'LARANJA', 'LIMÃO', 'MORANGO', 'MELANCIA', 'ABACAXI', 'MAMÃO',
  'MANGA', 'PERA', 'PÊSSEGO', 'COCO', 'ABACATE', 'GOIABA', 'CAFÉ', 'CHÁ', 'SUCO',
  'ÁGUA', 'CERVEJA', 'VINHO', 'REFRIGERANTE', 'FUTEBOL', 'BASQUETE', 'VÔLEI', 'NATAÇÃO', 'CORRIDA',
  'CICLISMO', 'BOXE', 'JUDÔ', 'KARATÊ', 'SURF', 'SKATE', 'XADREZ', 'DOMINÓ', 'BARALHO',
  'DADO', 'PIPA', 'BOLA', 'RAQUETE', 'CAPACETE', 'PATINS', 'PRANCHA', 'REDE', 'GOL',
  'QUADRA', 'PISCINA', 'GINÁSIO', 'MEDALHA', 'TROFÉU', 'CAMPEONATO', 'ÁRBITRO', 'TIME', 'DENTISTA',
  'VETERINÁRIO', 'PSICÓLOGO', 'ENFERMEIRO', 'FARMACÊUTICO', 'MOTORISTA', 'PILOTO', 'MARINHEIRO', 'SOLDADO', 'GENERAL',
  'JUIZ', 'PROMOTOR', 'CONTADOR', 'BANCÁRIO', 'VENDEDOR', 'GARÇOM', 'CABELEIREIRO', 'ELETRICISTA', 'ENCANADOR',
  'PEDREIRO', 'CARPINTEIRO', 'MECÂNICO', 'ALFAIATE', 'PADEIRO', 'AÇOUGUEIRO', 'AGRICULTOR', 'PESCADOR', 'CAÇADOR',
  'MINERADOR', 'COSTUREIRA', 'FOTÓGRAFO', 'ESCRITOR', 'POETA', 'PALHAÇO', 'MÁGICO', 'DOMADOR', 'ACROBATA',
  'CASA', 'APARTAMENTO', 'PRÉDIO', 'ARRANHA-CÉU', 'GARAGEM', 'PORÃO', 'SÓTÃO', 'VARANDA', 'TELHADO',
  'PAREDE', 'JANELA', 'PORTA', 'ESCADA', 'ELEVADOR', 'CORREDOR', 'QUARTO', 'SALA', 'COZINHA',
  'BANHEIRO', 'QUINTAL', 'CONDOMÍNIO', 'BAIRRO', 'CIDADE', 'VILA', 'ALDEIA', 'CAPITAL', 'PRAÇA',
  'PARQUE', 'ZOOLÓGICO', 'AQUÁRIO', 'PLANETÁRIO', 'ESTÁDIO', 'SHOPPING', 'FEIRA', 'CEMITÉRIO', 'PRISÃO',
  'QUARTEL', 'EMBAIXADA', 'PALÁCIO', 'FORTALEZA', 'MOSTEIRO', 'SINAGOGA', 'MESQUITA', 'INTERNET', 'SENHA',
  'ARQUIVO', 'PASTA', 'PROGRAMA', 'APLICATIVO', 'SITE', 'VIDEOGAME', 'CONTROLE', 'CARREGADOR', 'CABO',
  'ANTENA', 'SATÉLITE', 'DRONE', 'TABLET', 'NOTEBOOK', 'PENDRIVE', 'WEBCAM', 'PROJETOR', 'TELEVISÃO',
  'MICROONDAS', 'GELADEIRA', 'FOGÃO', 'LIQUIDIFICADOR', 'TORRADEIRA', 'ASPIRADOR', 'VENTILADOR', 'LÂMPADA', 'INTERRUPTOR',
  'TOMADA', 'DISJUNTOR', 'ÁRVORE', 'FOLHA', 'GALHO', 'RAIZ', 'TRONCO', 'FLOR', 'PÉTALA',
  'GRAMA', 'MATO', 'ARBUSTO', 'SAMAMBAIA', 'MUSGO', 'COGUMELO', 'BAMBU', 'PINHEIRO', 'CARVALHO',
  'PALMEIRA', 'IPÊ', 'ORQUÍDEA', 'ROSA', 'GIRASSOL', 'MARGARIDA', 'TULIPA', 'LÍRIO', 'CRAVO',
  'VIOLETA', 'JASMIM', 'GALÁXIA', 'COMETA', 'METEORO', 'ASTEROIDE', 'ECLIPSE', 'CONSTELAÇÃO', 'PLANETA',
  'ÓRBITA', 'GRAVIDADE', 'NEBULOSA', 'SUPERNOVA', 'TELESCÓPIO', 'OBSERVATÓRIO', 'VENTO', 'BRISA', 'NEBLINA',
  'ORVALHO', 'MARÉ', 'ONDA', 'PLANALTO', 'PLANÍCIE', 'VALE', 'COLINA', 'PENHASCO', 'FALÉSIA',
  'DUNA', 'SAVANA', 'TUNDRA', 'SELVA', 'MANGUE', 'DELTA', 'FOZ', 'NASCENTE', 'AFLUENTE',
  'CONTINENTE', 'HEMISFÉRIO', 'EQUADOR', 'UNICÓRNIO', 'FÊNIX', 'GRIFO', 'CENTAURO', 'SEREIA', 'MINOTAURO',
  'CÍCLOPE', 'TITÃ', 'ORÁCULO', 'FEITICEIRO', 'DUENDE', 'FADA', 'GNOMO', 'TROLL', 'OGRO',
  'ELFO', 'ANÃO', 'GIGANTE', 'LOBISOMEM', 'HIDRA', 'QUIMERA', 'PÉGASO', 'CARROÇA', 'CHARRETE',
  'BALSA', 'IATE', 'SUBMARINO', 'TELEFÉRICO', 'BONDE', 'PATINETE', 'TRICICLO', 'VAN', 'CARAVANA',
  'LIMUSINE', 'AMBULÂNCIA', 'VIATURA', 'GUINCHO', 'EMPILHADEIRA', 'GUINDASTE', 'SAXOFONE', 'CLARINETE', 'TROMBONE',
  'HARPA', 'VIOLINO', 'VIOLONCELO', 'CONTRABAIXO', 'PANDEIRO', 'TAMBOR', 'XILOFONE', 'SINO', 'GAITA',
  'ACORDEÃO', 'BANDOLIM', 'CAVAQUINHO', 'BERIMBAU', 'MARACÁ', 'CHOCALHO', 'PARTITURA', 'ORQUESTRA', 'BALÉ',
  'DANÇA', 'ÓPERA', 'GUARDA-CHUVA', 'LANTERNA', 'VELA', 'FÓSFORO', 'ISQUEIRO', 'CORDA', 'CORRENTE',
  'CADEADO', 'FECHADURA', 'PARAFUSO', 'PREGO', 'MARTELO', 'SERROTE', 'ALICATE', 'FITA-ADESIVA', 'COLA',
  'AGULHA', 'LINHA', 'BOTÃO', 'ZÍPER', 'ESPELHO', 'PENTE', 'ESCOVA', 'SABONETE', 'SHAMPOO',
  'TOALHA', 'TRAVESSEIRO', 'COBERTOR', 'LENÇOL', 'COLCHÃO', 'CORTINA', 'TAPETE', 'VASSOURA', 'RODO',
  'BALDE', 'ESPONJA', 'PANO', 'ESTOJO', 'BORRACHA', 'APONTADOR', 'RÉGUA', 'COMPASSO', 'CALCULADORA',
  'GLOBO', 'LOUSA', 'GIZ', 'DIPLOMA', 'BOLETIM', 'PROVA', 'REDAÇÃO', 'UNIVERSIDADE', 'FACULDADE',
  'LABORATÓRIO', 'LEOPARDO', 'PANTERA', 'GUEPARDO', 'HIENA', 'CHACAL', 'BISÃO', 'BÚFALO', 'ALCE',
  'VEADO', 'COELHO', 'ESQUILO', 'OURIÇO', 'TOUPEIRA', 'MORSA', 'FOCA', 'LONTRA', 'CASTOR',
  'GAMBÁ', 'TATU', 'PREGUIÇA', 'ONÇA', 'PUMA', 'LINCE', 'AVESTRUZ', 'FLAMINGO', 'CISNE',
  'PATO', 'GANSO', 'PERU', 'GALINHA', 'GALO', 'PINTO', 'POMBO', 'PAPAGAIO', 'ARARA',
  'TUCANO', 'BEIJA-FLOR', 'FALCÃO', 'GAVIÃO', 'URUBU', 'CORVO', 'PICA-PAU', 'SABIÁ', 'CANÁRIO',
  'PERIQUITO', 'IGUANA', 'LAGARTO', 'CROCODILO', 'JACARÉ', 'SALAMANDRA', 'SAPO', 'RÃ', 'LESMA',
  'MINHOCA', 'CENTOPEIA', 'LACRAIA', 'GRILO', 'BESOURO', 'VAGA-LUME', 'MOSCA', 'MOSQUITO', 'PULGA',
  'PIOLHO', 'LAGARTA', 'AMOR', 'ÓDIO', 'MEDO', 'CORAGEM', 'PAZ', 'GUERRA', 'LIBERDADE',
  'JUSTIÇA', 'VERDADE', 'MENTIRA', 'SONHO', 'PESADELO', 'MEMÓRIA', 'ESPERANÇA', 'SORTE', 'DESTINO',
  'TEMPO', 'SILÊNCIO', 'BARULHO', 'LUZ', 'SOMBRA', 'ESCURIDÃO', 'CALOR', 'FRIO', 'VELOCIDADE',
  'FORÇA', 'PODER', 'MAGIA', 'AZAR', 'SAMBA', 'CARNAVAL', 'FOLIA', 'FEIJOADA', 'CAIPIRINHA',
  'VIOLA', 'FORRÓ', 'FREVO', 'CAPOEIRA', 'CORDEL', 'RENDA', 'ARTESANATO', 'QUADRILHA', 'FOGUEIRA',
  'BALÃO', 'BANDEIRA', 'HINO', 'SELEÇÃO', 'TORCIDA', 'ANDAIME', 'CIMENTO', 'TIJOLO', 'CONCRETO',
  'VIGA', 'COLUNA', 'ALICERCE', 'TELHA', 'CANO', 'TORNEIRA', 'VÁLVULA', 'FIO-ELÉTRICO', 'JANEIRO',
  'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO',
  'NOVEMBRO', 'DEZEMBRO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO',
  'CÍRCULO', 'QUADRADO', 'TRIÂNGULO', 'RETÂNGULO', 'CUBO', 'ESFERA', 'ÂNGULO', 'SIMETRIA', 'METAL',
  'FERRO', 'AÇO', 'COBRE', 'BRONZE', 'ALUMÍNIO', 'CHUMBO', 'ESTANHO', 'PLÁSTICO', 'VIDRO',
  'MADEIRA', 'PAPEL', 'TECIDO', 'COURO', 'SEDA', 'ALGODÃO', 'LINHO', 'VERNIZ', 'CERÂMICA',
  'PORCELANA', 'ARGILA', 'PEDRA', 'MÁRMORE', 'GRANITO', 'CARVÃO', 'PETRÓLEO', 'GASOLINA', 'DIESEL',
  'ENERGIA', 'ELETRICIDADE', 'ASTRÔNOMO', 'BIÓLOGO', 'QUÍMICO',
  'FÍSICO', 'MATEMÁTICO', 'HISTORIADOR', 'GEÓGRAFO', 'FILÓSOFO', 'ARQUITETO', 'DESIGNER', 'PROGRAMADOR', 'TRADUTOR',
  'INTÉRPRETE', 'DIPLOMATA', 'EMBAIXADOR', 'SENADOR', 'DEPUTADO', 'PREFEITO', 'GOVERNADOR', 'PRESIDENTE', 'REPÓRTER',
  'APRESENTADOR', 'LOCUTOR', 'DIRETOR', 'PRODUTOR', 'ROTEIRISTA', 'DUBLADOR', 'MODELO', 'ESTILISTA', 'JOALHEIRO',
  'RELOJOEIRO', 'MARCENEIRO', 'VIDRACEIRO', 'SERRALHEIRO', 'JARDINEIRO', 'ZELADOR', 'PORTEIRO', 'SEGURANÇA', 'DETETIVE',
  'ESPIÃO', 'BIBLIOTECÁRIO', 'APICULTOR',
  'GARRAFA', 'COPO', 'XÍCARA', 'PRATO', 'TIGELA', 'PANELA', 'FRIGIDEIRA', 'TALHER', 'GARFO',
  'FACA', 'COLHER', 'BANDEJA', 'JARRA', 'SALEIRO', 'AÇUCAREIRO', 'CORTADOR', 'RALADOR', 'PENEIRA',
  'FUNIL', 'ABRIDOR', 'SACA-ROLHAS', 'PÁ', 'ENXADA', 'REGADOR', 'TESOURA', 'CESTA',
  'SACOLA', 'MALA', 'BAGAGEM', 'CANIVETE', 'BARRACA', 'SACO-DE-DORMIR', 'CANTIL', 'TERMOS',
  'PUDIM', 'BRIGADEIRO', 'BEIJINHO', 'PAÇOCA', 'CANJICA', 'PAMONHA', 'CURAU', 'RAPADURA', 'COCADA',
  'QUINDIM', 'ROSCA', 'PANETONE', 'COLOMBA', 'OVO-DE-PÁSCOA', 'BOMBOM', 'TRUFA', 'MARSHMALLOW', 'CHICLETE',
  'PIRULITO', 'BALA', 'GOMA', 'GELATINA', 'MOUSSE', 'MILK-SHAKE', 'AÇAÍ', 'TAPIOCA', 'CUSCUZ',
  'CANJA', 'VATAPÁ', 'ACARAJÉ', 'COXINHA', 'PASTEL', 'ESFIHA', 'KIBE', 'EMPADA', 'QUIBE',
  'ALEGRIA', 'TRISTEZA', 'RAIVA', 'INVEJA', 'CIÚME', 'ORGULHO', 'VERGONHA', 'CULPA', 'SAUDADE',
  'NOSTALGIA', 'ANSIEDADE', 'CALMA', 'PACIÊNCIA', 'GRATIDÃO', 'COMPAIXÃO', 'EMPATIA', 'SOLIDÃO', 'AMIZADE',
  'CONFIANÇA', 'DÚVIDA', 'CURIOSIDADE', 'SURPRESA', 'CHOQUE', 'ALÍVIO', 'EUFORIA', 'TÉDIO', 'FRUSTRAÇÃO',
  'SATISFAÇÃO', 'ARREPENDIMENTO', 'PERDÃO', 'LUA-CHEIA', 'ESTRELA-CADENTE', 'VIA-LÁCTEA', 'BURACO-NEGRO', 'UNIVERSO', 'SISTEMA-SOLAR',
  'MERCÚRIO', 'VÊNUS', 'JÚPITER', 'URANO', 'NETUNO', 'PLUTÃO', 'ESTAÇÃO-ESPACIAL', 'TRAJE-ESPACIAL',
  'ÁTOMO', 'MOLÉCULA', 'CÉLULA', 'DNA', 'GENE', 'VÍRUS', 'BACTÉRIA', 'VACINA', 'MICROSCÓPIO',
  'ÍMÃ', 'PILHA', 'CIRCUITO', 'ALAVANCA',
  'MOLA', 'PÊNDULO', 'PRISMA', 'LENTE', 'RAIO-LASER', 'GUARDA-SOL', 'CADEIRA-DE-PRAIA', 'CANGA',
  'BOIA', 'PRANCHA-DE-SURF', 'BARCO-A-VELA', 'JANGADA', 'FOGOS-DE-ARTIFÍCIO', 'CONFETE', 'SERPENTINA', 'FANTASIA', 'MÁSCARA',
  'CONVITE', 'PRESENTE', 'ENFEITE', 'GUIRLANDA', 'ÁRVORE-DE-NATAL', 'PAPAI-NOEL', 'COELHO-DA-PÁSCOA', 'AMIGO-OCULTO', 'RELÂMPAGO',
  'MARÉ-ALTA', 'MARÉ-BAIXA', 'TSUNAMI', 'AVALANCHE', 'DESMORONAMENTO', 'INCÊNDIO', 'EXPLOSÃO', 'FUMAÇA', 'CINZAS',
  'LAVA', 'MAGMA', 'CRATERA', 'TERMÔMETRO', 'PARA-RAIOS',
  'FILTRO-SOLAR', 'PROTETOR', 'CURATIVO', 'GESSO', 'MULETA', 'CADEIRA-DE-RODAS', 'BENGALA', 'ANDADOR', 'SERINGA',
  'RAIO-X', 'POLEGAR', 'ASA', 'GRÃO', 'MARFIM', 'SECRETÁRIA',
  'FRENTE', 'CASCA', 'BERMUDA', 'NOÉ', 'DOENÇA', 'BEBIDA', 'ELÉTRICO', 'SINAL', 'JORNADA',
  'MOLHO', 'PERUCA', 'ATLÂNTIDA', 'NAVE', 'CONTRATO', 'ERVA', 'DEPÓSITO', 'ESTÁBULO', 'CELA',
  'MILIONÁRIO', 'CAPITÃO', 'PARAQUEDAS', 'LATA', 'JULGAMENTO', 'GARRA', 'BACON',
];

// Categoria "Counter-Strike" (escolhida no lobby): armas, mapas, girias,
// patentes, jogadores e callouts da Mirage. A "Normal" e a CODENAMES_WORDS.
const CODENAMES_CS_WORDS = [
  'AK-47', 'M4A4', 'M4A1-S', 'AWP', 'DEAGLE', 'GLOCK', 'USP-S', 'P250', 'FIVE-SEVEN', 'TEC-9', 'CZ75',
  'BERETAS', 'P2000', 'FAMAS', 'GALIL', 'AUG', 'SG553', 'SSG08', 'TECO-TECO', 'MP9', 'MAC-10', 'MP7',
  'MP5-SD', 'UMP45', 'P90', 'PP-BIZON', 'NOVA', 'XM1014', 'MAG-7', 'SAWED-OFF', 'M249', 'NEGEV', 'ZEUS',
  'KEVLAR', 'CAPACETE', 'GRANADA', 'FLASHBANG', 'SMOKE', 'MOLOTOV', 'C4', 'DEFUSE', 'KIT', 'HEADSHOT',
  'VARADO', 'PREFIRE', 'SPRAY', 'FLICK', 'CLUTCH', 'ACE', 'ONE-TAP', 'NOSCOPE', 'RELOAD', 'PISTOL',
  'OVERPASS', 'MIRAGE', 'INFERNO', 'DUST2', 'NUKE', 'ANCIENT', 'ANUBIS', 'VERTIGO', 'TRAIN', 'CACHE',
  'COBBLESTONE', 'OFFICE', 'SHORTDUST', 'FACEIT', 'PREMIER', 'WINGMAN', 'DEATHMATCH', 'RETAKES',
  'CORRIDA-ARMADA', 'MM', 'ELO', 'RATING', 'RANK', 'GLOBAL', 'ÁGUIA', 'XERIFE', 'PRATA', 'OURO', 'SMURF',
  'PEZINHO', 'HACKER', 'BAN', 'REPORT', 'DEMO', 'PING', 'LAG', 'FPS', 'IGL', 'ENTRYFRAGGER', 'AWPER',
  'LURKER', 'SUPPORT', 'COACH', 'BAITER', 'TOPFRAG', 'BOTTOMFRAG', 'MVP', 'KDA', 'BOT', 'NOOB', 'TRYHARD',
  'AFK', 'DISCONNECT', 'KICK', 'FALLEN', 'COLDZERA', 'FER', 'KSCERATO', 'BOLTZ', 'TAPETE', 'VAN', 'FOREST',
  'NINJA', 'B', 'SOMBRA', 'COZINHA', 'MERCADO', 'TV', 'L', 'RATO', 'MOSCOW', 'ESQUINA', 'CARROÇA', 'JANELÃO',
  'BANCO', 'CADEIRA', 'BASE TR', 'LIGA', 'CABECINHA', 'SANDUÍCHE', 'TETRIS', 'CAVERNA', 'AREIA',
  'CAIXA FOGO', 'A', 'NEWBA', 'BASE CT',
];

const CODENAMES_CATEGORIES = { normal: CODENAMES_WORDS, cs: CODENAMES_CS_WORDS };
const DEFAULT_CODENAMES_CATEGORY = 'normal';

// roomId -> estado do minijogo "Codigo Secreto" (ver mais abaixo). So existe
// enquanto a sala em si existir - criado sob demanda, apagado junto com ela.
const codenamesGames = new Map();

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Modos de equipe do Codenames - "livre" e o padrao de sempre (sem limite
// de agentes, so 2 equipes). 2x2/3x3 sao a mesma coisa de 2 equipes so que
// com um teto de agentes por equipe. "ffa3" e o modo "Todos contra todos":
// 3 equipes em vez de 2, cada uma com no maximo 1 agente.
const GAME_MODES = {
  livre: { teams: ['red', 'blue'], maxAgents: Infinity },
  '2x2': { teams: ['red', 'blue'], maxAgents: 1 },
  '3x3': { teams: ['red', 'blue'], maxAgents: 2 },
  ffa3: { teams: ['red', 'blue', 'green'], maxAgents: 1 },
};
const DEFAULT_GAME_MODE = 'livre';
const TEAM_LABEL = { red: 'Vermelho', blue: 'Azul', green: 'Verde' };
const TEAM_LABEL_FEM = { red: 'Vermelha', blue: 'Azul', green: 'Verde' };

// Tempo que o time da vez tem pra escolher uma palavra depois que o
// Mestre-Espiao da a pista.
const ANSWER_TIME_MS = Number(process.env.CODENAMES_TIME_MS) || 90000; // env so pra testes automatizados

function emptyTeams(mode) {
  const teams = {};
  GAME_MODES[mode].teams.forEach((t) => { teams[t] = { spymaster: null, agents: [] }; });
  return teams;
}

function createCodenamesGame(roomId) {
  return {
    roomId,
    status: 'lobby', // lobby | playing | over
    round: 0,
    mode: DEFAULT_GAME_MODE,
    category: DEFAULT_CODENAMES_CATEGORY, // de onde vem as palavras (ver CODENAMES_CATEGORIES)
    board: [], // [{ word, team: 'red'|'blue'|'green'|'neutral'|'assassin', revealed }]
    currentTeam: null,
    eliminated: [], // times que caíram num assassino no modo ffa3 - fora da rodada, mas o jogo continua pros outros
    phase: null, // 'clue' | 'guess'
    clue: null, // { word, number, guessesMade, guessesAllowed }
    teams: emptyTeams(DEFAULT_GAME_MODE),
    winner: null,
    winReason: null, // 'words' | 'assassin' | 'last-standing'
    log: [],
    clueGivenAt: null,
    answerTimer: null,
    phaseStartedAt: null, // inicio do cronometro da fase atual (pista OU palpite)
    phaseToken: 0, // muda a cada fase nova - timeout velho que dispare atrasado se reconhece e nao faz nada
    timeoutSeq: 0, // conta quantas vezes o tempo esgotou - o cliente usa pra mostrar o aviso + som
    lastTimeout: null, // { team, phase } do ultimo tempo esgotado
    hostId: null,
    joinOrder: [], // ordem em que as pessoas entraram num time - define o proximo anfitriao
    vacated: [], // [{ name, team, role }] de quem caiu com a partida rolando - volta pro lugar se reconectar
    marks: {}, // socketId do agente -> indice da carta que ele esta apontando (o time todo ve)
    clueHistory: [], // [{ team, word, number, hits, targets }] - targets so aparece no fim da partida
    // "Time" Espectadores: so assiste, fica fora do "Sortear times".
    // socketId -> true (assiste COM o mapa secreto, como os mestres-espioes)
    // ou false (sem mapa, so as cartas reveladas, como um agente).
    spectators: {},
  };
}

// Um time so consegue jogar a vez se tiver mestre-espiao (pra dar a pista)
// E pelo menos um agente (pra palpitar) - e nao tiver sido eliminado.
function teamPlayable(game, team) {
  const t = game.teams[team];
  return !game.eliminated.includes(team) && !!t.spymaster && t.agents.length >= 1;
}

// Cronometro de 1min30 da fase atual - vale tanto pro mestre-espiao dar a
// pista quanto pros agentes palpitarem. Esgotou = perde a vez.
function startPhaseTimer(game) {
  clearAnswerTimer(game);
  game.phaseStartedAt = Date.now();
  const token = ++game.phaseToken;
  game.answerTimer = setTimeout(() => {
    if (codenamesGames.get(game.roomId) !== game) return; // sala acabou / jogo foi trocado
    if (game.status !== 'playing' || game.phaseToken !== token) return;
    const team = game.currentTeam;
    const who = game.phase === 'clue' ? 'o Mestre-Espião não deu a pista' : 'os agentes não escolheram';
    game.log.push(`Tempo esgotado (${who}) - Equipe ${TEAM_LABEL[team]} perdeu a vez`);
    game.timeoutSeq += 1;
    game.lastTimeout = { team, phase: game.phase };
    endGameTurn(game);
    broadcastGameState(game.roomId);
  }, ANSWER_TIME_MS);
}

// Proximo anfitriao quando o atual sai: o primeiro (na ordem em que
// entraram num time) que ainda esta na sala e num time.
function pickNextHost(game, roomId, leavingId) {
  const room = rooms.get(roomId);
  const next = game.joinOrder.find((id) => id !== leavingId && room && room.has(id) && playerGameRole(game, id));
  return next || null;
}

// Só quem abriu o lobby (o primeiro a escolher uma equipe num lobby vazio -
// ver "lobbyWasEmpty" em game-set-role) pode iniciar a partida. Se esse
// socket saiu da sala, o lobby fica "sem anfitrião" e qualquer um pode
// iniciar - senão a sala ficaria travada pra sempre se o anfitrião sumisse.
function isGameHost(game, roomId, socketId) {
  const room = rooms.get(roomId);
  const hostStillHere = game.hostId && room && room.has(game.hostId);
  return !hostStillHere || game.hostId === socketId;
}

// Limpa o cronometro de resposta pendente, se tiver - chamado sempre que o
// turno muda de qualquer jeito (passou a vez, acertou, errou, caiu num
// assassino) pra nao sobrar um setTimeout velho disparando depois da hora.
function clearAnswerTimer(game) {
  if (game.answerTimer) {
    clearTimeout(game.answerTimer);
    game.answerTimer = null;
  }
}

function getOrCreateGame(roomId) {
  if (!codenamesGames.has(roomId)) codenamesGames.set(roomId, createCodenamesGame(roomId));
  return codenamesGames.get(roomId);
}

function playerGameRole(game, socketId) {
  for (const team of GAME_MODES[game.mode].teams) {
    if (game.teams[team].spymaster === socketId) return { team, role: 'spymaster' };
    if (game.teams[team].agents.includes(socketId)) return { team, role: 'agent' };
  }
  return null;
}

function removeFromGameTeams(game, socketId) {
  for (const team of GAME_MODES[game.mode].teams) {
    if (game.teams[team].spymaster === socketId) game.teams[team].spymaster = null;
    game.teams[team].agents = game.teams[team].agents.filter((id) => id !== socketId);
  }
}

function generateBoard(mode, startingTeam, category) {
  let counts;
  if (mode === 'ffa3') {
    // 2x2x2 (pedido do Rafael): 9 do time que comeca, 8 de cada um dos
    // outros dois, 9 neutras e 3 assassinos = 37 cartas.
    counts = { neutral: 9, assassin: 3 };
    GAME_MODES.ffa3.teams.forEach((t) => { counts[t] = t === startingTeam ? 9 : 8; });
  } else {
    const otherTeam = GAME_MODES[mode].teams.find((t) => t !== startingTeam);
    counts = { [startingTeam]: 9, [otherTeam]: 8, neutral: 7, assassin: 1 };
  }
  const teamsArr = [];
  Object.entries(counts).forEach(([team, count]) => {
    for (let i = 0; i < count; i++) teamsArr.push(team);
  });
  const words = shuffle(CODENAMES_CATEGORIES[category] || CODENAMES_WORDS).slice(0, teamsArr.length);
  const shuffledTeams = shuffle(teamsArr);
  // Foto que aparece na carta quando ela e revelada - sorteada aqui pra
  // todo mundo ver a MESMA foto na mesma carta. Numeros 0-24 embaralhados
  // (o cliente faz % quantidade de fotos), entao quase nao repete.
  const photos = shuffle(Array.from({ length: words.length }, (_, i) => i));
  return words.map((word, i) => ({ word, team: shuffledTeams[i], revealed: false, photo: photos[i] }));
}

function countRemaining(game, team) {
  return game.board.filter((c) => c.team === team && !c.revealed).length;
}

function checkGameWinConditions(game) {
  if (game.status !== 'playing') return;
  for (const team of GAME_MODES[game.mode].teams) {
    if (game.eliminated.includes(team)) continue;
    if (countRemaining(game, team) === 0) {
      game.status = 'over'; game.winner = team; game.winReason = 'words'; game.phase = null;
      return;
    }
  }
}

// Passa a vez pro PROXIMO time ainda vivo na ordem do modo, a partir da
// posicao do time atual - funciona mesmo se o time atual acabou de ser
// eliminado (ver game-reveal-word), porque usa a ordem fixa do modo em vez
// de so alternar entre dois.
function endGameTurn(game) {
  clearAnswerTimer(game);
  game.clueGivenAt = null;
  const order = GAME_MODES[game.mode].teams;
  const idx = order.indexOf(game.currentTeam);
  // Pula times desfalcados (alguem saiu no meio: sem mestre-espiao ou sem
  // agente). Se NENHUM time vivo der pra jogar, fica no proximo vivo mesmo
  // - o cronometro continua girando a vez ate alguem voltar.
  let firstAlive = null;
  let chosen = null;
  const skipped = [];
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(idx + step) % order.length];
    if (game.eliminated.includes(candidate)) continue;
    if (!firstAlive) firstAlive = candidate;
    if (teamPlayable(game, candidate)) { chosen = candidate; break; }
    skipped.push(candidate);
  }
  game.currentTeam = chosen || firstAlive || game.currentTeam;
  if (chosen) skipped.forEach((t) => game.log.push(`Equipe ${TEAM_LABEL[t]} está desfalcada - vez pulada`));
  game.phase = 'clue';
  game.clue = null;
  game.marks = {};
  if (game.status === 'playing') startPhaseTimer(game);
}

function startNewGameRound(game) {
  clearAnswerTimer(game);
  const teams = GAME_MODES[game.mode].teams;
  const startingTeam = teams[Math.floor(Math.random() * teams.length)];
  game.board = generateBoard(game.mode, startingTeam, game.category);
  // Identifica ESTE tabuleiro. O "round" volta pra 1 quando a sala volta
  // pro lobby (jogo novo), entao nao serve pra saber se um mapa secreto
  // guardado no app e deste tabuleiro ou de uma partida anterior.
  game.boardId = require('crypto').randomBytes(8).toString('hex');
  game.round += 1;
  game.status = 'playing';
  game.currentTeam = startingTeam;
  game.eliminated = [];
  game.phase = 'clue';
  game.clue = null;
  game.clueGivenAt = null;
  game.winner = null;
  game.winReason = null;
  game.lastTimeout = null;
  game.marks = {};
  game.clueHistory = [];
  game.log = [`Nova partida! Equipe ${TEAM_LABEL_FEM[startingTeam]} comeca.`];
  startPhaseTimer(game);
}

function gameTeamsBothReady(game) {
  return GAME_MODES[game.mode].teams.every((team) => game.teams[team].spymaster && game.teams[team].agents.length >= 1);
}

function gameTeamView(game, roomId, team) {
  const room = rooms.get(roomId);
  const nameOf = (id) => (room && room.get(id) && room.get(id).name) || 'Jogador';
  const t = game.teams[team];
  return {
    spymaster: t.spymaster ? { id: t.spymaster, name: nameOf(t.spymaster) } : null,
    agents: t.agents.map((id) => ({ id, name: nameOf(id) })),
  };
}

function publicGameState(roomId) {
  const game = codenamesGames.get(roomId);
  if (!game) {
    return {
      status: 'lobby', round: 0, mode: DEFAULT_GAME_MODE, category: DEFAULT_CODENAMES_CATEGORY, board: [], currentTeam: null, eliminated: [], phase: null, clue: null,
      teams: emptyTeams(DEFAULT_GAME_MODE),
      winner: null, winReason: null, remaining: { red: 0, blue: 0 }, log: [],
      clueGivenAt: null, answerTimeMs: null, phaseEndsInMs: null, timeoutSeq: 0, lastTimeout: null, hostId: null, marks: {}, clueHistory: [],
      spectators: [],
    };
  }
  const teams = GAME_MODES[game.mode].teams;
  const remaining = {};
  teams.forEach((t) => { remaining[t] = countRemaining(game, t); });
  const teamsView = {};
  teams.forEach((t) => { teamsView[t] = gameTeamView(game, roomId, t); });
  return {
    status: game.status,
    round: game.round,
    boardId: game.boardId || null,
    mode: game.mode,
    category: game.category,
    // No fim da partida todo mundo ve a cor de todas as cartas.
    board: game.board.map((c) => {
      const visible = c.revealed || game.status === 'over';
      return { word: c.word, revealed: c.revealed, team: visible ? c.team : null, photo: visible ? c.photo : null };
    }),
    currentTeam: game.currentTeam,
    eliminated: game.eliminated,
    phase: game.phase,
    clue: game.clue ? {
      word: game.clue.word,
      number: game.clue.number,
      guessesMade: game.clue.guessesMade,
      guessesAllowed: game.clue.guessesAllowed === Infinity ? null : game.clue.guessesAllowed,
    } : null,
    teams: teamsView,
    winner: game.winner,
    winReason: game.winReason,
    remaining,
    log: game.log.slice(-30),
    clueGivenAt: game.clueGivenAt,
    answerTimeMs: ANSWER_TIME_MS,
    // Quanto falta do cronometro da fase AGORA (o cliente soma no proprio
    // relogio ao receber - nao depende do relogio do PC bater com o servidor).
    phaseEndsInMs: game.status === 'playing' && game.phaseStartedAt
      ? Math.max(0, ANSWER_TIME_MS - (Date.now() - game.phaseStartedAt)) : null,
    timeoutSeq: game.timeoutSeq,
    marks: (() => {
      const room = rooms.get(roomId);
      const out = {};
      for (const [id, idx] of Object.entries(game.marks)) {
        (out[idx] = out[idx] || []).push({ id, name: (room && room.get(id) && room.get(id).name) || 'Jogador' });
      }
      return out;
    })(),
    clueHistory: game.clueHistory.map((c) => ({
      team: c.team, word: c.word, number: c.number, hits: c.hits,
      targets: game.status === 'over' ? c.targets : null,
    })),
    lastTimeout: game.lastTimeout,
    hostId: game.hostId,
    spectators: (() => {
      const room = rooms.get(roomId);
      return Object.entries(game.spectators)
        .filter(([id]) => room && room.has(id))
        .map(([id, withMap]) => ({ id, name: room.get(id).name || 'Jogador', withMap }));
    })(),
  };
}

function broadcastGameState(roomId) {
  io.to(roomId).emit('game-state', publicGameState(roomId));
  broadcastRoomsToAdmins(); // painel de admin mostra os jogos ao vivo
}

// Resumo de um Codenames pro painel de admin - INCLUI o mapa secreto
// (cor de todas as cartas), so vai pra socket de admin.
function codenamesAdminView(roomId) {
  const game = codenamesGames.get(roomId);
  if (!game) return null;
  const pub = publicGameState(roomId);
  const room = rooms.get(roomId);
  return {
    status: pub.status,
    mode: pub.mode,
    round: pub.round,
    currentTeam: pub.currentTeam,
    phase: pub.phase,
    clue: pub.clue,
    remaining: pub.remaining,
    eliminated: pub.eliminated,
    winner: pub.winner,
    teams: pub.teams,
    spectators: pub.spectators,
    phaseEndsInMs: pub.phaseEndsInMs,
    hostName: (game.hostId && room && room.get(game.hostId) && room.get(game.hostId).name) || null,
    board: game.board.map((c) => ({ word: c.word, team: c.team, revealed: c.revealed })),
    log: game.log.slice(-8),
  };
}

// ============================================================================
// Minijogo "Stop / Adedonha" - sorteia uma letra, todo mundo (quem estiver na
// sala quando a rodada comecar) digita uma palavra por categoria comecando
// com ela, correndo contra um cronometro no servidor. Quem termina primeiro
// aperta "PARAR", o que encerra a rodada pra todo mundo na hora (regra
// classica do jogo). Sem equipes/papeis - todo mundo joga contra todo mundo.
// ============================================================================

const STOP_DEFAULT_CATEGORIES = ['Nome', 'Animal', 'Fruta', 'Cor', 'País', 'Objeto'];
// Letras raras como inicial em portugues (K, W, X, Y, Z) ficam de fora pra
// nao sortear uma rodada praticamente impossivel de preencher.
const STOP_LETTERS = 'ABCDEFGHIJLMNOPQRSTUV'.split('');
const STOP_ROUND_MS = 60000;
const STOP_CATEGORY_MAX_LEN = 24;
const STOP_MIN_CATEGORIES = 2;
const STOP_MAX_CATEGORIES = 10;

// roomId -> estado do Stop. So existe enquanto a sala existir.
const stopGames = new Map();

function createStopGame() {
  return {
    status: 'idle', // idle | lobby | playing | reveal
    round: 0,
    letter: null,
    // Categorias da ULTIMA rodada (ou o padrao, numa sala nova) - quem
    // aperta "comecar" pode mandar uma lista nova pra substituir essa (ver
    // sanitizeCategoryList/stop-start-round), e o que for usado fica salvo
    // aqui pra ser o ponto de partida mostrado pra todo mundo na proxima.
    categories: [...STOP_DEFAULT_CATEGORIES],
    startedAt: null,
    durationMs: STOP_ROUND_MS,
    // Quanto tempo (ms) precisa passar antes de alguem poder dar Stop
    // nessa rodada - calculado a partir do numero de categorias quando a
    // rodada comeca de verdade (ver computeStopMinStopMs/beginStopRound).
    minStopMs: 0,
    // Lobby: quem ja apertou "Pronto" pra essa rodada comecar (ver
    // tryStartStopRoundFromLobby) - zerado a cada nova entrada no lobby.
    readyPlayers: new Set(),
    players: new Map(), // socketId -> { name, values: { categoria: texto } }
    results: null,
    timer: null,
  };
}

// 3 categorias = 10s, 4 = 15s, +5s por categoria a mais (e o mesmo padrao
// pra menos: 2 categorias = 5s) - quanto mais categoria, mais tempo justo
// pra todo mundo pelo menos LER a letra e as categorias antes de alguem
// conseguir fechar a rodada na cara dos outros.
function computeStopMinStopMs(categoryCount) {
  return Math.max(0, (categoryCount - 1) * 5000);
}

function getOrCreateStopGame(roomId) {
  if (!stopGames.has(roomId)) stopGames.set(roomId, createStopGame());
  return stopGames.get(roomId);
}

// Valida/limpa a lista de categorias que quem vai comandar a rodada montou:
// remove vazias/duplicadas (sem diferenciar maiusculas) e limita tamanho de
// cada uma e quantidade total. Retorna null se sobrar categoria de menos
// pra valer a pena jogar.
function sanitizeCategoryList(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim().slice(0, STOP_CATEGORY_MAX_LEN);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= STOP_MAX_CATEGORIES) break;
  }
  return out.length >= STOP_MIN_CATEGORIES ? out : null;
}

function sanitizeStopValues(values, categories) {
  const out = {};
  for (const cat of categories) {
    const v = values && typeof values === 'object' ? values[cat] : '';
    out[cat] = typeof v === 'string' ? v.trim().slice(0, 40) : '';
  }
  return out;
}

function computeStopResults(game) {
  const letterLower = (game.letter || '').toLowerCase();
  const categories = game.categories;
  // Primeiro agrupa, por categoria, as respostas validas (nao vazias e que
  // comecam com a letra sorteada) por texto normalizado - pra saber quais
  // sao unicas (10 pontos) e quais se repetiram entre jogadores (5 pontos).
  const groupsByCategory = {};
  for (const cat of categories) {
    const groups = new Map();
    for (const [id, p] of game.players) {
      const raw = (p.values[cat] || '').trim();
      if (!raw || raw[0].toLowerCase() !== letterLower) continue;
      const norm = raw.toLowerCase();
      if (!groups.has(norm)) groups.set(norm, []);
      groups.get(norm).push(id);
    }
    groupsByCategory[cat] = groups;
  }

  const perPlayer = [];
  for (const [id, p] of game.players) {
    let total = 0;
    const catResults = {};
    for (const cat of categories) {
      const raw = (p.values[cat] || '').trim();
      const valid = raw.length > 0 && raw[0].toLowerCase() === letterLower;
      let points = 0;
      let status = 'vazio';
      if (valid) {
        const group = groupsByCategory[cat].get(raw.toLowerCase());
        if (group.length === 1) { points = 10; status = 'unica'; }
        else { points = 5; status = 'repetida'; }
      } else if (raw) {
        status = 'invalida';
      }
      total += points;
      catResults[cat] = { value: raw, points, status };
    }
    perPlayer.push({ id, name: p.name, total, categories: catResults });
  }
  perPlayer.sort((a, b) => b.total - a.total);
  return { letter: game.letter, categories, perPlayer };
}

function finalizeStopRound(roomId) {
  const game = stopGames.get(roomId);
  if (!game || game.status !== 'playing') return;
  if (game.timer) { clearTimeout(game.timer); game.timer = null; }
  game.status = 'reveal';
  game.results = computeStopResults(game);
  broadcastStopState(roomId);
}

// Comeca a rodada de verdade (sorteia letra, zera o cronometro) - chamada
// quando o lobby fecha, seja porque todo mundo apertou "Pronto" ou porque
// alguem forcou o inicio (stop-force-start).
function beginStopRound(roomId, game) {
  if (game.timer) { clearTimeout(game.timer); game.timer = null; }
  const room = rooms.get(roomId);
  game.players = new Map();
  if (room) room.forEach((info, id) => game.players.set(id, { name: info.name || 'Jogador', values: {} }));
  game.letter = STOP_LETTERS[Math.floor(Math.random() * STOP_LETTERS.length)];
  game.startedAt = Date.now();
  game.durationMs = STOP_ROUND_MS;
  game.minStopMs = computeStopMinStopMs(game.categories.length);
  game.status = 'playing';
  game.round += 1;
  game.results = null;
  game.readyPlayers = new Set();
  game.timer = setTimeout(() => finalizeStopRound(roomId), game.durationMs);
}

// Se todo mundo que esta na sala agora ja apertou "Pronto", fecha o lobby
// e comeca a rodada sozinho - e assim que o "todo mundo comeca junto"
// funciona na pratica, sem precisar de um botao extra na maioria das vezes.
function tryStartStopRoundFromLobby(roomId, game) {
  if (game.status !== 'lobby') return;
  const room = rooms.get(roomId);
  const roomSize = room ? room.size : 0;
  if (roomSize === 0 || game.readyPlayers.size < roomSize) return;
  beginStopRound(roomId, game);
}

function stopPublicState(roomId) {
  const game = stopGames.get(roomId);
  if (!game || game.status === 'idle') {
    return {
      status: 'idle', round: game ? game.round : 0, letter: null, categories: game ? game.categories : STOP_DEFAULT_CATEGORIES,
      startedAt: null, durationMs: STOP_ROUND_MS, minStopMs: 0, players: [], lobbyPlayers: [], results: null,
    };
  }
  if (game.status === 'lobby') {
    const room = rooms.get(roomId);
    const lobbyPlayers = room
      ? Array.from(room.entries()).map(([id, info]) => ({ id, name: info.name || 'Jogador', ready: game.readyPlayers.has(id) }))
      : [];
    return {
      status: 'lobby',
      round: game.round,
      letter: null,
      categories: game.categories,
      startedAt: null,
      durationMs: game.durationMs,
      minStopMs: computeStopMinStopMs(game.categories.length),
      players: [],
      lobbyPlayers,
      results: null,
    };
  }
  return {
    status: game.status,
    round: game.round,
    letter: game.letter,
    categories: game.categories,
    startedAt: game.startedAt,
    durationMs: game.durationMs,
    minStopMs: game.minStopMs || 0,
    players: Array.from(game.players.entries()).map(([id, p]) => ({ id, name: p.name })),
    lobbyPlayers: [],
    results: game.status === 'reveal' ? game.results : null,
  };
}

function broadcastStopState(roomId) {
  io.to(roomId).emit('stop-state', stopPublicState(roomId));
}

// ============================================================================
// Minijogo "Sketch do PC" - alguem cria uma pergunta "Voce prefere A ou B?",
// e quem estiver na sala vota ao vivo (contagem atualiza em tempo real pra
// todo mundo a cada voto, sem esperar ninguem "revelar" nada - diferente do
// Stop/Codigo Secreto, aqui nao tem nada escondido). A votacao se encerra
// sozinha quando todo mundo que esta na sala ja votou, ou qualquer um pode
// encerrar na mao a qualquer momento (ex: alguem ficou ausente).
// ============================================================================

const SKETCH_OPTION_MAX_LEN = 60;

// roomId -> estado do Sketch. So existe enquanto a sala existir.
const sketchGames = new Map();

function createSketchGame() {
  return {
    status: 'idle', // idle | voting | ended
    round: 0,
    optionA: null,
    optionB: null,
    authorName: null,
    votes: new Map(), // socketId -> 'a' | 'b'
  };
}

function getOrCreateSketchGame(roomId) {
  if (!sketchGames.has(roomId)) sketchGames.set(roomId, createSketchGame());
  return sketchGames.get(roomId);
}

function sketchPublicState(roomId) {
  const game = sketchGames.get(roomId);
  if (!game || game.status === 'idle') {
    return { status: 'idle', round: game ? game.round : 0, optionA: null, optionB: null, authorName: null, counts: { a: 0, b: 0 }, total: 0 };
  }
  const counts = { a: 0, b: 0 };
  for (const v of game.votes.values()) counts[v] += 1;
  return {
    status: game.status,
    round: game.round,
    optionA: game.optionA,
    optionB: game.optionB,
    authorName: game.authorName,
    counts,
    total: game.votes.size,
  };
}

function broadcastSketchState(roomId) {
  io.to(roomId).emit('sketch-state', sketchPublicState(roomId));
}

function maybeAutoEndSketchVote(roomId, game) {
  if (game.status !== 'voting') return;
  const room = rooms.get(roomId);
  const roomSize = room ? room.size : 0;
  if (roomSize > 0 && game.votes.size >= roomSize) game.status = 'ended';
}

// Convite de minijogo: quando alguem abre o lobby / comeca um minijogo,
// avisa todo mundo da sala (menos quem iniciou) pra aparecer o pop-up
// "Fulano iniciou um jogo de X - Entrar / Agora nao" no app de cada um.
const MINIGAME_NAMES = { codenames: 'Codenames', stop: 'Stop / Adedonha', sketch: 'Sketch do PC' };

function notifyMinigameStarted(socket, roomId, gameId) {
  const byName = (rooms.get(roomId)?.get(socket.id)?.name) || 'Alguém';
  socket.to(roomId).emit('minigame-invite', { gameId, gameName: MINIGAME_NAMES[gameId], byName });
}

// roomId -> Set<socketId> de admins espectando essa sala de forma invisivel
// (nao entram no Map "rooms" acima - nao contam como participante, nao
// aparecem pra ninguem, so recebem video/audio dos outros).
const spectatorsByRoom = new Map();

// Sockets autenticados com a ADMIN_PASSWORD - recebem o snapshot de todas as
// salas em tempo real e podem entrar em qualquer uma.
const adminSockets = new Set();

const serverStartedAt = Date.now();
// Entradas/saidas de sala pro painel de admin. Fica so na memoria: some
// quando o Render reinicia (deploy ou "dormir") - o cliente de admin guarda
// uma copia no PC dele a cada vez que busca (ver admin-history).
const presenceLog = [];
let presenceSeq = 0;
function logPresence(type, name, roomId, version) {
  presenceLog.push({ id: `${serverStartedAt}-${++presenceSeq}`, t: Date.now(), type, name, roomId, version: version || null });
  if (presenceLog.length > 5000) presenceLog.splice(0, presenceLog.length - 5000);
}
let peakRooms = 0;
let peakParticipants = 0;

function getPeersInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.entries()).map(([id, info]) => ({ id, name: info.name, shareMode: info.shareMode || null, version: info.version || null, joinedAt: info.joinedAt || null }));
}

function getRoomsSnapshot() {
  return Array.from(rooms.keys()).map((roomId) => ({
    roomId,
    participants: getPeersInRoom(roomId),
    codenames: codenamesAdminView(roomId),
  }));
}

function getFullAdminSnapshot() {
  const roomsList = getRoomsSnapshot();
  const totalParticipants = roomsList.reduce((sum, r) => sum + r.participants.length, 0);
  peakRooms = Math.max(peakRooms, roomsList.length);
  peakParticipants = Math.max(peakParticipants, totalParticipants);
  return {
    rooms: roomsList,
    stats: {
      totalRooms: roomsList.length,
      totalParticipants,
      peakRooms,
      peakParticipants,
      serverStartedAt,
    },
  };
}

function broadcastRoomsToAdmins() {
  if (adminSockets.size === 0) return;
  const snapshot = getFullAdminSnapshot();
  adminSockets.forEach((s) => s.emit('admin-rooms-updated', snapshot));
}

io.use((socket, next) => {
  const provided = socket.handshake.auth?.password || '';
  if (ADMIN_PASSWORD && provided === ADMIN_PASSWORD) {
    socket.data.isAdmin = true;
    return next();
  }
  if (!APP_PASSWORD) return next();
  if (provided === APP_PASSWORD) return next();
  next(new Error('senha invalida'));
});

// Tamanho maximo do codigo da sala e do nome de exibicao.
const MAX_ROOM_ID_LEN = 20;

// "Paygorn", "paygorn " e "paygorn/" sao a MESMA sala: sem diferenca de
// maiuscula/minuscula, sem espaco nas pontas e sem barra no fim (alguns
// navegadores/apps colocam uma "/" no fim do link telinhafix://join?room=X
// e a pessoa caia sozinha numa sala "X/"). Feito aqui no servidor pra
// valer ate pra quem esta com versao antiga do app.
function normalizeRoomId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\/+$/, '').trim().toLowerCase();
}
const MAX_NAME_LEN = 20;

// Limite de acoes por conexao ("balde de fichas"): cada evento gasta 1
// ficha; o balde enche RATE_REFILL_PER_SEC por segundo ate RATE_BUCKET.
// A folga cobre o pico normal de quando alguem entra numa call (muitos
// sinais WebRTC de uma vez). Passou disso: o evento e ignorado (e quem
// esperava resposta recebe um erro); quem continuar inundando e desconectado.
const RATE_BUCKET = 150;
const RATE_REFILL_PER_SEC = 50;
const RATE_DROPS_BEFORE_KICK = 300;

io.on('connection', (socket) => {
  let rateTokens = RATE_BUCKET;
  let rateLastRefill = Date.now();
  let rateDrops = 0;
  socket.use((packet, next) => {
    const now = Date.now();
    rateTokens = Math.min(RATE_BUCKET, rateTokens + ((now - rateLastRefill) / 1000) * RATE_REFILL_PER_SEC);
    rateLastRefill = now;
    if (rateTokens >= 1) {
      rateTokens -= 1;
      rateDrops = Math.max(0, rateDrops - 1);
      return next();
    }
    rateDrops += 1;
    const ack = packet[packet.length - 1];
    if (typeof ack === 'function') ack({ ok: false, error: 'Muitas ações seguidas - espera um pouquinho' });
    if (rateDrops >= RATE_DROPS_BEFORE_KICK) {
      console.warn(`[rate-limit] desconectando ${socket.id} (inundando o servidor)`);
      socket.disconnect(true);
    }
  });

  let currentRoom = null;
  let spectatingRoom = null;

  if (socket.data.isAdmin) {
    adminSockets.add(socket);
    socket.emit('admin-rooms-updated', getFullAdminSnapshot());
  }

  // Em TODOS os handlers de admin abaixo: sempre chama o ack, mesmo quando
  // nao autorizado. Um "return" sem ack deixa a Promise do lado do cliente
  // esperando pra sempre (ex: alguem digita a senha normal por engano em
  // vez da ADMIN_PASSWORD - o socket conecta normal, mas sem isso aqui a
  // tela fica travada em "Conectando..." sem nenhum erro).
  // Recebe (dado, ack) mesmo sem usar "dado" - o client manda um payload
  // (mesmo que undefined) + callback de ack, e isso chega aqui como dois
  // argumentos separados. Com so "(ack)" no parametro, "ack" vira o dado
  // (undefined) por engano e o calback de ack de verdade nunca e chamado -
  // a Promise do lado do cliente fica esperando pra sempre.
  socket.on('admin-list-rooms', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ error: 'nao autorizado' }); return; }
    if (ack) ack(getFullAdminSnapshot());
  });

  // Remove uma pessoa de uma sala direto (sem o admin precisar entrar nela)
  // - so desconecta o socket dela, o resto (avisar os outros, limpar a sala)
  // reaproveita exatamente a mesma logica do disconnect normal abaixo.
  socket.on('admin-history', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    if (ack) ack({ ok: true, serverStartedAt, events: presenceLog });
  });

  socket.on('admin-server-health', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const mem = process.memoryUsage();
    let playing = 0;
    codenamesGames.forEach((g) => { if (g.status === 'playing') playing += 1; });
    if (ack) ack({
      ok: true,
      now: Date.now(),
      serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt,
      connections: io.engine.clientsCount,
      admins: adminSockets.size,
      rooms: rooms.size,
      people: Array.from(rooms.values()).reduce((n, r) => n + r.size, 0),
      codenamesPlaying: playing,
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      node: process.version,
    });
  });

  // Aviso que aparece como faixa na tela das pessoas (todas, ou de uma sala).
  socket.on('admin-notice', (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const text = String((data && data.text) || '').trim().slice(0, 300);
    const roomId = data && data.roomId ? String(data.roomId) : null;
    if (!text) { if (ack) ack({ ok: false, error: 'Escreva o aviso' }); return; }
    let count = 0;
    io.sockets.sockets.forEach((s) => {
      if (s.data.isAdmin) return;
      if (roomId && !(rooms.get(roomId) && rooms.get(roomId).has(s.id))) return;
      s.emit('admin-notice', { text });
      count += 1;
    });
    if (ack) ack({ ok: true, count });
  });

  // "Pedir pra atualizar": cada app aberto (3.5.6+) confere se tem versao
  // nova e, se tiver, baixa e PERGUNTA se quer reiniciar - nunca reinicia sozinho.
  socket.on('admin-request-update', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    let count = 0;
    io.sockets.sockets.forEach((s) => { if (!s.data.isAdmin) { s.emit('update-prompt'); count += 1; } });
    if (ack) ack({ ok: true, count });
  });

  socket.on('admin-game-reset', (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const roomId = data && data.roomId;
    const old = codenamesGames.get(roomId);
    if (!old) { if (ack) ack({ ok: false, error: 'Sem partida nessa sala' }); return; }
    clearAnswerTimer(old);
    const fresh = createCodenamesGame(roomId);
    fresh.spectators = old.spectators;
    fresh.category = old.category;
    codenamesGames.set(roomId, fresh);
    broadcastGameState(roomId);
    if (ack) ack({ ok: true });
  });

  socket.on('admin-game-skip-turn', (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const roomId = data && data.roomId;
    const game = codenamesGames.get(roomId);
    if (!game || game.status !== 'playing') { if (ack) ack({ ok: false, error: 'Nenhuma partida rolando' }); return; }
    game.log.push(`Admin passou a vez da Equipe ${TEAM_LABEL[game.currentTeam]}`);
    endGameTurn(game);
    broadcastGameState(roomId);
    if (ack) ack({ ok: true });
  });

  socket.on('admin-kick', (data, ack) => {
    const { socketId } = data || {};
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const target = io.sockets.sockets.get(socketId);
    if (target) target.disconnect(true);
    if (ack) ack({ ok: !!target });
  });

  // Desconecta todo mundo de uma sala de uma vez (participantes E
  // espectadores admin que estiverem la).
  socket.on('admin-close-room', (data, ack) => {
    const { roomId } = data || {};
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const room = rooms.get(roomId);
    if (room) Array.from(room.keys()).forEach((id) => io.sockets.sockets.get(id)?.disconnect(true));
    const specs = spectatorsByRoom.get(roomId);
    if (specs) Array.from(specs).forEach((id) => io.sockets.sockets.get(id)?.disconnect(true));
    if (ack) ack({ ok: true });
  });

  // Modo espectador invisivel: o admin passa a receber video/audio de todo
  // mundo na sala, mas NAO entra no Map "rooms" (nao conta como
  // participante, nao aparece na lista de ninguem) - os participantes de
  // verdade so sabem que precisam mandar midia pra esse id via o evento
  // 'spectator-joined' (ver abaixo), nunca via o 'peer-joined' normal.
  socket.on('admin-spectate-room', (data, ack) => {
    const { roomId } = data || {};
    if (!socket.data.isAdmin) {
      if (ack) ack({ ok: false, error: 'nao autorizado' });
      return;
    }
    if (!roomId || typeof roomId !== 'string' || !rooms.has(roomId)) {
      if (ack) ack({ ok: false, error: 'sala nao encontrada' });
      return;
    }
    spectatingRoom = roomId;
    if (!spectatorsByRoom.has(roomId)) spectatorsByRoom.set(roomId, new Set());
    spectatorsByRoom.get(roomId).add(socket.id);

    const existingPeers = getPeersInRoom(roomId);
    if (ack) ack({ ok: true, selfId: socket.id, peers: existingPeers, iceServers: getIceServers() });
    socket.to(roomId).emit('spectator-joined', { id: socket.id });
  });

  socket.on('join-room', (data, ack) => {
    const { version } = data || {};
    const appVersion = typeof version === 'string' ? version.slice(0, 20) : null; // apps antigos (<= 3.5.5) nao mandam
    const roomId = normalizeRoomId(data && data.roomId);
    if (!roomId) {
      if (ack) ack({ ok: false, error: 'roomId invalido' });
      return;
    }
    if (roomId.length > MAX_ROOM_ID_LEN) {
      if (ack) ack({ ok: false, error: `O código da sala pode ter no máximo ${MAX_ROOM_ID_LEN} caracteres` });
      return;
    }
    // nome: so texto, ate MAX_NAME_LEN caracteres (o resto e cortado)
    const name = (typeof data.name === 'string' ? data.name : '').trim().slice(0, MAX_NAME_LEN) || 'Anonimo';
    currentRoom = roomId;
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);

    const existingPeers = getPeersInRoom(roomId);

    room.set(socket.id, { name: name || 'Anonimo', shareMode: null, version: appVersion, joinedAt: Date.now() });
    logPresence('join', name || 'Anonimo', roomId, appVersion);
    socket.join(roomId);

    if (ack) ack({ ok: true, selfId: socket.id, peers: existingPeers, iceServers: getIceServers() });

    socket.to(roomId).emit('peer-joined', { id: socket.id, name: name || 'Anonimo' });
    // Espectadores invisiveis tambem precisam saber de gente nova pra
    // conseguir receber a midia dela - 'peer-joined' direto pra cada um
    // (nao via socket.to, porque eles nunca dao socket.join na sala).
    const specs = spectatorsByRoom.get(roomId);
    if (specs) specs.forEach((id) => io.to(id).emit('peer-joined', { id: socket.id, name: name || 'Anonimo' }));

    // Codenames: quem caiu com a partida rolando e voltou com o MESMO nome
    // reassume o lugar no time, se a vaga ainda estiver livre.
    const game = codenamesGames.get(roomId);
    if (game && game.status !== 'lobby') {
      const cleanName = String(name || 'Anonimo').trim().toLowerCase();
      const i = game.vacated.findIndex((v) => String(v.name).trim().toLowerCase() === cleanName);
      if (i >= 0) {
        const v = game.vacated[i];
        const t = game.teams[v.team];
        const free = v.role === 'spymaster' ? !t.spymaster : t.agents.length < GAME_MODES[game.mode].maxAgents;
        if (free && !playerGameRole(game, socket.id)) {
          if (v.role === 'spymaster') t.spymaster = socket.id; else t.agents.push(socket.id);
          game.vacated.splice(i, 1);
          if (!game.joinOrder.includes(socket.id)) game.joinOrder.push(socket.id);
          game.log.push(`${name || 'Anonimo'} voltou pra Equipe ${TEAM_LABEL[v.team]}`);
          broadcastGameState(roomId);
        }
      }
    }
    broadcastRoomsToAdmins();
  });

  // So repassa pra quem esta na MESMA sala (ou, pro modo espectador do
  // admin, entre o espectador e os participantes daquela sala) - antes
  // dava pra mandar sinal pra qualquer conexao do servidor sabendo o id.
  socket.on('signal', (payload) => {
    const { to, data } = payload || {};
    if (!to || typeof to !== 'string') return;
    const myRoom = currentRoom ? rooms.get(currentRoom) : null;
    const mySpecs = currentRoom ? spectatorsByRoom.get(currentRoom) : null;
    const memberToMemberOrSpectator = !!myRoom && (myRoom.has(to) || (!!mySpecs && mySpecs.has(to)));
    const spectatorToMember = !!spectatingRoom && !!rooms.get(spectatingRoom) && rooms.get(spectatingRoom).has(to);
    if (!memberToMemberOrSpectator && !spectatorToMember) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  // Avisa a sala o que a pessoa esta transmitindo agora ('camera' | 'screen'
  // | 'screen-native' | null) - guarda no participante pra quem entrar
  // depois ja saber (ver getPeersInRoom), e repassa pra quem ja esta na
  // sala (inclusive espectadores invisiveis, mesmo padrao do join-room).
  socket.on('share-mode-changed', (data) => {
    if (!currentRoom) return;
    const mode = (data && typeof data.mode === 'string') ? data.mode : null;
    const room = rooms.get(currentRoom);
    if (room && room.has(socket.id)) room.get(socket.id).shareMode = mode;
    socket.to(currentRoom).emit('peer-share-mode', { id: socket.id, mode });
    const specs = spectatorsByRoom.get(currentRoom);
    if (specs) specs.forEach((id) => io.to(id).emit('peer-share-mode', { id: socket.id, mode }));
  });

  // Minijogo "Codigo Secreto" (Codenames) - os jogadores sao sempre quem
  // estiver na MESMA sala (mesmo codigo), currentRoom (fechado aqui em cima
  // pelo join-room). Estado fica so no servidor (por sala) pra garantir que
  // todo mundo ve exatamente o mesmo tabuleiro/vez/placar; o mapa secreto
  // (qual palavra e de qual time) so e mandado pro socket do Mestre-Espiao
  // de cada equipe, nunca pro grupo todo.
  socket.on('game-get-state', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (ack) ack({ ok: true, state: publicGameState(currentRoom) });
  });

  socket.on('game-get-secret-map', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || (game.status !== 'playing' && game.status !== 'over')) {
      if (ack) ack({ ok: false, error: 'Nenhuma partida em andamento' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    // Espectador que escolheu "assistir com mapa" tambem recebe o mapa.
    if (!role && game.spectators[socket.id] === true) {
      if (ack) ack({ ok: true, round: game.round, boardId: game.boardId, map: game.board.map((c) => c.team) });
      return;
    }
    if (!role || role.role !== 'spymaster') {
      if (ack) ack({ ok: false, error: 'Só o Mestre-Espião vê o mapa secreto' });
      return;
    }
    if (game.status === 'playing' && game.eliminated.includes(role.team)) {
      if (ack) ack({ ok: false, error: 'Sua equipe foi eliminada' });
      return;
    }
    if (ack) ack({ ok: true, round: game.round, boardId: game.boardId, map: game.board.map((c) => c.team) });
  });

  // So pode trocar o modo (livre/2x2/3x3/ffa3) com a partida parada - troca
  // zera as equipes escolhidas ate agora, porque os times disponiveis (e o
  // teto de agentes) podem mudar inteiramente (ex: ffa3 tem uma 3a equipe).
  socket.on('game-set-mode', (data, ack) => {
    const { mode } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar o modo com a partida em andamento' }); return; }
    if (!GAME_MODES[mode]) { if (ack) ack({ ok: false, error: 'Modo inválido' }); return; }
    game.mode = mode;
    game.teams = emptyTeams(mode);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Categoria das palavras (Normal / Counter-Strike) - mesma regra do modo:
  // qualquer um troca, so fora da partida. Vale pro proximo tabuleiro.
  socket.on('game-set-category', (data, ack) => {
    const { category } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar as palavras com a partida em andamento' }); return; }
    if (!CODENAMES_CATEGORIES[category]) { if (ack) ack({ ok: false, error: 'Categoria inválida' }); return; }
    game.category = category;
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-set-role', (data, ack) => {
    const { team, role } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar de equipe com a partida em andamento' }); return; }
    const validTeams = GAME_MODES[game.mode].teams;
    if (!validTeams.includes(team)) { if (ack) ack({ ok: false, error: 'Equipe inválida' }); return; }
    if (role !== 'spymaster' && role !== 'agent') { if (ack) ack({ ok: false, error: 'Papel inválido' }); return; }
    if (role === 'spymaster' && game.teams[team].spymaster && game.teams[team].spymaster !== socket.id) {
      if (ack) ack({ ok: false, error: 'Essa equipe já tem um Mestre-Espião' });
      return;
    }
    const maxAgents = GAME_MODES[game.mode].maxAgents;
    if (role === 'agent' && game.teams[team].agents.length >= maxAgents && !game.teams[team].agents.includes(socket.id)) {
      if (ack) ack({ ok: false, error: 'Essa equipe já está cheia nesse modo' });
      return;
    }
    const lobbyWasEmpty = validTeams.every((t) => !game.teams[t].spymaster && game.teams[t].agents.length === 0);
    removeFromGameTeams(game, socket.id);
    delete game.spectators[socket.id]; // escolheu um time: deixa de ser espectador
    if (role === 'spymaster') game.teams[team].spymaster = socket.id;
    else game.teams[team].agents.push(socket.id);
    if (!game.joinOrder.includes(socket.id)) game.joinOrder.push(socket.id);
    broadcastGameState(currentRoom);
    // Codenames nao tem um "abrir lobby" explicito - o primeiro a escolher
    // equipe num lobby vazio e quem "iniciou" o jogo, e tambem quem fica
    // marcado como anfitriao (so ele pode apertar "Iniciar partida").
    if (lobbyWasEmpty) {
      game.hostId = socket.id;
      notifyMinigameStarted(socket, currentRoom, 'codenames');
    }
    if (ack) ack({ ok: true });
  });

  // "Sortear times" (so o anfitriao, so no lobby): embaralha TODO MUNDO da
  // sala nos times do modo - primeiro 1 mestre-espiao por time, depois os
  // agentes em rodizio ate o limite do modo; quem sobrar fica assistindo.
  socket.on('game-shuffle-teams', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status !== 'lobby') { if (ack) ack({ ok: false, error: 'Só dá pra sortear no lobby' }); return; }
    if (game.hostId && !isGameHost(game, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode sortear os times' });
      return;
    }
    const room = rooms.get(currentRoom);
    // Quem esta em Espectadores fica de fora do sorteio.
    const people = shuffle(Array.from(room ? room.keys() : []).filter((id) => !(id in game.spectators)));
    const teams = GAME_MODES[game.mode].teams;
    const maxAgents = GAME_MODES[game.mode].maxAgents;
    game.teams = emptyTeams(game.mode);
    const queue = [...people];
    teams.forEach((t) => { if (queue.length) game.teams[t].spymaster = queue.shift(); });
    let ti = 0;
    let fullRounds = 0;
    while (queue.length && fullRounds < teams.length) {
      const t = teams[ti % teams.length];
      if (game.teams[t].agents.length < maxAgents) { game.teams[t].agents.push(queue.shift()); fullRounds = 0; } else { fullRounds += 1; }
      ti += 1;
    }
    if (!game.hostId) game.hostId = socket.id;
    game.joinOrder = [socket.id, ...people.filter((id) => id !== socket.id && playerGameRole(game, id))];
    broadcastGameState(currentRoom);
    notifyMinigameStarted(socket, currentRoom, 'codenames');
    if (ack) ack({ ok: true });
  });

  // Entrar em Espectadores (com ou sem o mapa secreto). Da pra virar
  // espectador ou trocar com/sem mapa a qualquer hora - mas quem esta num
  // time so sai dele no lobby (com a partida rolando o time ficaria
  // desfalcado), e espectador so entra num time no lobby (ver game-set-role).
  socket.on('game-set-spectator', (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (playerGameRole(game, socket.id)) {
      if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra sair da equipe com a partida em andamento' }); return; }
      removeFromGameTeams(game, socket.id);
      delete game.marks[socket.id];
    }
    game.spectators[socket.id] = !!(data && data.withMap);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-leave-role', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game) { if (ack) ack({ ok: true }); return; }
    // Sair de Espectadores pode a qualquer hora (nao desfalca ninguem).
    if (socket.id in game.spectators) {
      delete game.spectators[socket.id];
      broadcastGameState(currentRoom);
      if (ack) ack({ ok: true });
      return;
    }
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra sair da equipe com a partida em andamento' }); return; }
    removeFromGameTeams(game, socket.id);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-start', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Já tem uma partida em andamento' }); return; }
    if (!isGameHost(game, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode iniciar a partida' });
      return;
    }
    if (!gameTeamsBothReady(game)) {
      if (ack) ack({ ok: false, error: 'Cada equipe precisa de 1 Mestre-Espião e pelo menos 1 Agente' });
      return;
    }
    game.hostId = socket.id;
    startNewGameRound(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-play-again', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'over') { if (ack) ack({ ok: false, error: 'A partida ainda não acabou' }); return; }
    if (!isGameHost(game, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode iniciar a partida' });
      return;
    }
    if (!gameTeamsBothReady(game)) {
      if (ack) ack({ ok: false, error: 'Cada equipe precisa de 1 Mestre-Espião e pelo menos 1 Agente' });
      return;
    }
    game.hostId = socket.id;
    startNewGameRound(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-reset-lobby', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const oldGame = codenamesGames.get(currentRoom);
    // So restringe pro anfitriao quando esta ENCERRANDO uma partida em
    // andamento (botao "Encerrar partida") - voltar ao lobby depois que a
    // partida ja acabou sozinha ("Trocar equipes"/"Jogar de novo") continua
    // livre pra qualquer um, isso nunca foi a parte sensivel.
    if (oldGame && oldGame.status === 'playing' && !isGameHost(oldGame, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode encerrar a partida' });
      return;
    }
    if (oldGame) clearAnswerTimer(oldGame);
    const fresh = createCodenamesGame(currentRoom);
    if (oldGame) {
      fresh.spectators = oldGame.spectators; // quem escolheu so assistir continua assistindo
      fresh.category = oldGame.category; // e as palavras escolhidas continuam as mesmas
    }
    codenamesGames.set(currentRoom, fresh);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-give-clue', (data, ack) => {
    const { word, number, targets } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'clue') {
      if (ack) ack({ ok: false, error: 'Não é hora de dar uma pista' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam || role.role !== 'spymaster') {
      if (ack) ack({ ok: false, error: 'Só o Mestre-Espião da vez pode dar a pista' });
      return;
    }
    const cleanWord = String(word || '').trim().slice(0, 40);
    if (!cleanWord) { if (ack) ack({ ok: false, error: 'Escreva uma palavra-pista' }); return; }
    let n = Number(number);
    if (!Number.isInteger(n) || n < 0) n = 0;
    if (n > 9) n = 9;
    const remaining = countRemaining(game, game.currentTeam);
    game.clue = { word: cleanWord, number: n, guessesMade: 0, guessesAllowed: n === 0 ? Infinity : Math.min(n + 1, remaining) };
    const cleanTargets = Array.isArray(targets)
      ? [...new Set(targets.map(Number))].filter((i) => Number.isInteger(i) && game.board[i] && !game.board[i].revealed).slice(0, 9)
      : [];
    game.clueHistory.push({ team: game.currentTeam, word: cleanWord, number: n, hits: 0, targets: cleanTargets });
    const teamLabel = TEAM_LABEL[game.currentTeam];
    const name = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    game.log.push(`${name} (Mestre-Espião ${teamLabel}) deu a pista "${cleanWord.toUpperCase()}" ${n}`);
    game.phase = 'guess';

    game.clueGivenAt = Date.now();
    startPhaseTimer(game);

    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-reveal-word', (data, ack) => {
    const { index } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') {
      if (ack) ack({ ok: false, error: 'Não é hora de escolher uma palavra' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam || role.role !== 'agent') {
      if (ack) ack({ ok: false, error: 'Só os agentes da equipe da vez podem escolher uma palavra' });
      return;
    }
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= game.board.length || !game.board[i] || game.board[i].revealed) {
      if (ack) ack({ ok: false, error: 'Palavra inválida' });
      return;
    }

    const cell = game.board[i];
    cell.revealed = true;
    for (const [id, idx] of Object.entries(game.marks)) if (idx === i) delete game.marks[id];
    const name = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    const teamLabel = TEAM_LABEL[game.currentTeam];

    if (cell.team === 'assassin') {
      game.log.push(`${name} (${teamLabel}) revelou o ASSASSINO: "${cell.word}"!`);
      if (game.mode === 'ffa3') {
        // No modo "Todos contra todos" quem cai num assassino e eliminado
        // (nao perde a partida inteira) - o jogo continua pros outros times
        // ainda vivos, a nao ser que so sobre 1, que ja vence na hora.
        game.eliminated.push(game.currentTeam);
        const survivors = GAME_MODES[game.mode].teams.filter((t) => !game.eliminated.includes(t));
        if (survivors.length <= 1) {
          game.status = 'over';
          game.winner = survivors[0] || null;
          game.winReason = 'last-standing';
          game.phase = null;
        } else {
          endGameTurn(game);
        }
      } else {
        const otherTeam = GAME_MODES[game.mode].teams.find((t) => t !== game.currentTeam);
        game.status = 'over';
        game.winner = otherTeam;
        game.winReason = 'assassin';
        game.phase = null;
      }
    } else if (cell.team === game.currentTeam) {
      game.log.push(`${name} (${teamLabel}) acertou "${cell.word}"`);
      game.clue.guessesMade += 1;
      const lastClue = game.clueHistory[game.clueHistory.length - 1];
      if (lastClue && lastClue.team === game.currentTeam) lastClue.hits += 1;
      checkGameWinConditions(game);
      if (game.status === 'playing' && game.clue.guessesAllowed !== Infinity && game.clue.guessesMade >= game.clue.guessesAllowed) {
        endGameTurn(game);
      }
    } else {
      const otherLabel = cell.team === 'neutral' ? 'uma palavra neutra' : `uma palavra do time ${TEAM_LABEL[cell.team]}`;
      game.log.push(`${name} (${teamLabel}) revelou ${otherLabel}: "${cell.word}"`);
      checkGameWinConditions(game);
      if (game.status === 'playing') endGameTurn(game);
    }

    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-mark-cell', (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') { if (ack) ack({ ok: false, error: 'Não é hora de palpitar' }); return; }
    const role = playerGameRole(game, socket.id);
    if (!role || role.role !== 'agent' || role.team !== game.currentTeam) { if (ack) ack({ ok: false, error: 'Só os agentes da vez podem marcar' }); return; }
    const index = data && data.index;
    if (index === null || index === undefined) {
      delete game.marks[socket.id];
    } else {
      const i = Number(index);
      if (!Number.isInteger(i) || !game.board[i] || game.board[i].revealed) { if (ack) ack({ ok: false, error: 'Carta inválida' }); return; }
      game.marks[socket.id] = i;
    }
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-end-turn', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') {
      if (ack) ack({ ok: false, error: 'Não dá pra passar a vez agora' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam) { if (ack) ack({ ok: false, error: 'Você não está na equipe da vez' }); return; }
    if (role.role !== 'agent') { if (ack) ack({ ok: false, error: 'Só os agentes podem passar a vez' }); return; }
    const teamLabel = TEAM_LABEL[game.currentTeam];
    game.log.push(`Equipe ${teamLabel} passou a vez`);
    endGameTurn(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Minijogo "Stop / Adedonha" - sem equipes/papeis, todo mundo que estiver
  // na sala quando a rodada comecar vira jogador dessa rodada.
  socket.on('stop-get-state', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (ack) ack({ ok: true, state: stopPublicState(currentRoom) });
  });

  // Abre o LOBBY (nao comeca a rodada direto) - todo mundo precisa apertar
  // "Pronto" (ver stop-toggle-ready) pra rodada comecar igual pra todo
  // mundo ao mesmo tempo, em vez de quem clicou primeiro sair na frente.
  socket.on('stop-start-round', (data, ack) => {
    const { categories } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateStopGame(currentRoom);
    if (game.status === 'lobby' || game.status === 'playing') { if (ack) ack({ ok: false, error: 'Já tem uma rodada em andamento' }); return; }
    // Quem abre o lobby pode mandar a lista de categorias que montou (ver
    // stop-view no renderer); se nao mandar nada valido, repete as da
    // ultima rodada (ou o padrao, numa sala que nunca jogou).
    if (categories !== undefined) {
      const clean = sanitizeCategoryList(categories);
      if (!clean) { if (ack) ack({ ok: false, error: `Escolha entre ${STOP_MIN_CATEGORIES} e ${STOP_MAX_CATEGORIES} categorias (sem repetir)` }); return; }
      game.categories = clean;
    }
    if (game.timer) { clearTimeout(game.timer); game.timer = null; }
    game.status = 'lobby';
    game.readyPlayers = new Set();
    game.results = null;
    broadcastStopState(currentRoom);
    notifyMinigameStarted(socket, currentRoom, 'stop');
    if (ack) ack({ ok: true });
  });

  // Liga/desliga o "Pronto" de quem chamou. Quando todo mundo que esta na
  // sala agora estiver pronto, a rodada comeca sozinha (tryStartStopRoundFromLobby).
  socket.on('stop-toggle-ready', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'lobby') { if (ack) ack({ ok: false, error: 'Não tem lobby aberto' }); return; }
    if (game.readyPlayers.has(socket.id)) game.readyPlayers.delete(socket.id);
    else game.readyPlayers.add(socket.id);
    tryStartStopRoundFromLobby(currentRoom, game);
    broadcastStopState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Escape hatch: comeca a rodada mesmo sem todo mundo pronto (ex: alguem
  // ficou ausente/AFK e o resto nao quer esperar pra sempre).
  socket.on('stop-force-start', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'lobby') { if (ack) ack({ ok: false, error: 'Não tem lobby aberto' }); return; }
    beginStopRound(currentRoom, game);
    broadcastStopState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Fecha o lobby sem comecar (volta pro editor de categorias).
  socket.on('stop-cancel-lobby', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'lobby') { if (ack) ack({ ok: true }); return; }
    game.status = 'idle';
    game.readyPlayers = new Set();
    broadcastStopState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Sincroniza em tempo real o que a pessoa ja digitou (sem isso, quando
  // alguem aperta "Parar" o servidor nao teria como saber o que os OUTROS
  // jogadores ja tinham escrito na hora de fechar a rodada pra todo mundo).
  // Sem ack de proposito - e so uma atualizacao de rascunho, disparada a
  // cada pausa de digitacao; nao precisa de confirmacao de ida e volta.
  socket.on('stop-sync-answers', (data) => {
    const { values } = data || {};
    if (!currentRoom) return;
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'playing') return;
    const p = game.players.get(socket.id);
    if (!p) return;
    p.values = sanitizeStopValues(values, game.categories);
  });

  socket.on('stop-call-stop', (data, ack) => {
    const { values } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'playing') { if (ack) ack({ ok: false, error: 'Não tem rodada em andamento' }); return; }
    const p = game.players.get(socket.id);
    if (!p) { if (ack) ack({ ok: false, error: 'Você não está jogando essa rodada' }); return; }
    const elapsed = Date.now() - game.startedAt;
    if (elapsed < game.minStopMs) {
      const remaining = Math.ceil((game.minStopMs - elapsed) / 1000);
      if (ack) ack({ ok: false, error: `Espera mais ${remaining}s antes de dar Stop (${game.categories.length} categorias)` });
      return;
    }
    const clean = sanitizeStopValues(values, game.categories);
    const missing = game.categories.some((cat) => !clean[cat]);
    if (missing) { if (ack) ack({ ok: false, error: 'Preencha todas as categorias antes de dar Stop' }); return; }
    p.values = clean;
    finalizeStopRound(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Minijogo "Sketch do PC" - "Voce prefere A ou B?" com votacao ao vivo.
  // Sem roster fixo (diferente do Stop): qualquer um que estiver na sala
  // pode votar a qualquer momento enquanto a votacao estiver aberta, mesmo
  // quem entrou depois da pergunta ter sido criada.
  socket.on('sketch-get-state', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (ack) ack({ ok: true, state: sketchPublicState(currentRoom) });
  });

  socket.on('sketch-create', (data, ack) => {
    const { optionA, optionB } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateSketchGame(currentRoom);
    if (game.status === 'voting') { if (ack) ack({ ok: false, error: 'Já tem uma votação em andamento' }); return; }
    const cleanA = String(optionA || '').trim().slice(0, SKETCH_OPTION_MAX_LEN);
    const cleanB = String(optionB || '').trim().slice(0, SKETCH_OPTION_MAX_LEN);
    if (!cleanA || !cleanB) { if (ack) ack({ ok: false, error: 'Preencha as duas opções' }); return; }
    game.optionA = cleanA;
    game.optionB = cleanB;
    game.authorName = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    game.votes = new Map();
    game.status = 'voting';
    game.round += 1;
    broadcastSketchState(currentRoom);
    notifyMinigameStarted(socket, currentRoom, 'sketch');
    if (ack) ack({ ok: true });
  });

  socket.on('sketch-vote', (data, ack) => {
    const { choice } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = sketchGames.get(currentRoom);
    if (!game || game.status !== 'voting') { if (ack) ack({ ok: false, error: 'Não tem votação em andamento' }); return; }
    if (choice !== 'a' && choice !== 'b') { if (ack) ack({ ok: false, error: 'Escolha inválida' }); return; }
    game.votes.set(socket.id, choice);
    maybeAutoEndSketchVote(currentRoom, game);
    broadcastSketchState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('sketch-end-vote', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = sketchGames.get(currentRoom);
    if (!game || game.status !== 'voting') { if (ack) ack({ ok: false, error: 'Não tem votação em andamento' }); return; }
    game.status = 'ended';
    broadcastSketchState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('sketch-reset', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateSketchGame(currentRoom);
    game.status = 'idle';
    game.optionA = null;
    game.optionB = null;
    game.authorName = null;
    game.votes = new Map();
    broadcastSketchState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket);

    if (spectatingRoom && spectatorsByRoom.has(spectatingRoom)) {
      spectatorsByRoom.get(spectatingRoom).delete(socket.id);
      if (spectatorsByRoom.get(spectatingRoom).size === 0) spectatorsByRoom.delete(spectatingRoom);
      socket.to(spectatingRoom).emit('spectator-left', { id: socket.id });
    }

    if (currentRoom && rooms.has(currentRoom)) {
      const leavingName = rooms.get(currentRoom).get(socket.id)?.name || 'Alguém';
      logPresence('leave', leavingName, currentRoom, rooms.get(currentRoom).get(socket.id)?.version);
      rooms.get(currentRoom).delete(socket.id);
      const specs = spectatorsByRoom.get(currentRoom);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
        const deadGame = codenamesGames.get(currentRoom);
        if (deadGame) clearAnswerTimer(deadGame);
        codenamesGames.delete(currentRoom);
        const stopGame = stopGames.get(currentRoom);
        if (stopGame && stopGame.timer) clearTimeout(stopGame.timer);
        stopGames.delete(currentRoom);
        sketchGames.delete(currentRoom);
      } else {
        socket.to(currentRoom).emit('peer-left', { id: socket.id });
        const game = codenamesGames.get(currentRoom);
        if (game) {
          const role = playerGameRole(game, socket.id);
          // Partida rolando: guarda o lugar pra pessoa voltar se reconectar
          // com o mesmo nome (ver join-room).
          if (role && game.status !== 'lobby') {
            game.vacated.push({ name: leavingName, team: role.team, role: role.role });
            game.log.push(`${leavingName} saiu da sala (Equipe ${TEAM_LABEL[role.team]})`);
          }
          removeFromGameTeams(game, socket.id);
          delete game.marks[socket.id];
          delete game.spectators[socket.id];
          if (game.hostId === socket.id) game.hostId = pickNextHost(game, currentRoom, socket.id);
          // O time da vez ficou sem quem precisa agir AGORA (mestre-espiao na
          // fase de pista, ou nenhum agente): pula a vez na hora. Se so o
          // mestre saiu durante os palpites, os agentes terminam essa pista.
          const t = role && game.teams[role.team];
          const stuckNow = t && (t.agents.length === 0 || (game.phase === 'clue' && !t.spymaster));
          if (role && game.status === 'playing' && role.team === game.currentTeam && stuckNow) {
            game.log.push(`Equipe ${TEAM_LABEL[role.team]} está desfalcada - vez pulada`);
            endGameTurn(game);
          }
          broadcastGameState(currentRoom);
        }
        // Quem sai pode ter sido justamente quem faltava votar - reavalia
        // se a votacao deve se encerrar sozinha agora.
        const sketchGame = sketchGames.get(currentRoom);
        if (sketchGame) {
          maybeAutoEndSketchVote(currentRoom, sketchGame);
          broadcastSketchState(currentRoom);
        }
        // Mesma logica pro lobby do Stop: quem saiu pode ter sido
        // justamente quem faltava ficar pronto.
        const stopGameState = stopGames.get(currentRoom);
        if (stopGameState && stopGameState.status === 'lobby') {
          stopGameState.readyPlayers.delete(socket.id);
          tryStartStopRoundFromLobby(currentRoom, stopGameState);
          broadcastStopState(currentRoom);
        }
      }
      // Mesma logica do join: espectadores recebem o peer-left direto.
      if (specs) specs.forEach((id) => io.to(id).emit('peer-left', { id: socket.id }));
      broadcastRoomsToAdmins();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de sinalizacao rodando na porta ${PORT}`);
});
