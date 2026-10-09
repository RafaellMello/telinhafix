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

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TelinhaFix signaling server ok');
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// roomId -> Map<socketId, { name }>
const rooms = new Map();

// Banco de palavras do minijogo "Codigo Secreto" (Codenames) - precisa de
// pelo menos 25 pra montar um tabuleiro; bem mais que isso pra nao repetir
// toda hora entre partidas seguidas no mesmo grupo.
const CODENAMES_WORDS = [
  'CASTELO', 'LUA', 'MEDICO', 'BANANA', 'AVIAO', 'ROBO', 'PRAIA', 'PIRATA', 'GELO', 'REI',
  'AGUIA', 'BANCO', 'FOGO', 'MOUSE', 'MARTE', 'ESCOLA', 'CHAVE', 'CACHORRO', 'RIO', 'COROA',
  'TELEFONE', 'DRAGAO', 'MUSICA', 'PONTE', 'NEVE', 'GATO', 'LEAO', 'CARRO', 'SOL', 'ESPACO',
  'SATURNO', 'SERPENTE', 'FLORESTA', 'MONTANHA', 'OCEANO', 'DESERTO', 'VULCAO', 'CHURRASCO',
  'PROFESSOR', 'ENGENHEIRO', 'ADVOGADO', 'BOMBEIRO', 'POLICIAL', 'ASTRONAUTA', 'CIENTISTA',
  'PINTOR', 'MUSICO', 'ATOR', 'JORNALISTA', 'COZINHEIRO', 'ELEFANTE', 'GIRAFA', 'MACACO',
  'TIGRE', 'URSO', 'LOBO', 'RAPOSA', 'COBRA', 'TARTARUGA', 'GOLFINHO', 'TUBARAO', 'BALEIA',
  'POLVO', 'CAMALEAO', 'PINGUIM', 'CANGURU', 'ZEBRA', 'RINOCERONTE', 'HIPOPOTAMO',
  'COMPUTADOR', 'CELULAR', 'TECLADO', 'MONITOR', 'IMPRESSORA', 'FONE', 'CAMERA', 'RELOGIO',
  'OCULOS', 'BICICLETA', 'MOTO', 'TREM', 'NAVIO', 'FOGUETE', 'HELICOPTERO', 'METRO', 'ONIBUS',
  'CAMINHAO', 'ESTRADA', 'TUNEL', 'FAROL', 'BUSSOLA', 'MAPA', 'TESOURO', 'BAU', 'MOEDA',
  'DIAMANTE', 'OURO', 'PRATA', 'ANEL', 'ESPADA', 'ESCUDO', 'ARCO', 'FLECHA', 'ARMADURA',
  'CAVALEIRO', 'PRINCESA', 'BRUXA', 'FANTASMA', 'VAMPIRO', 'ZUMBI', 'MONSTRO', 'LABIRINTO',
  'TORRE', 'MURALHA', 'PORTAO', 'JARDIM', 'FONTE', 'ESTATUA', 'IGREJA', 'TEMPLO', 'PIRAMIDE',
  'MUMIA', 'FARAO', 'OASIS', 'CAMELO', 'CACTO', 'TERREMOTO', 'FURACAO', 'TEMPESTADE', 'RAIO',
  'TROVAO', 'ARCO-IRIS', 'NUVEM', 'CHUVA', 'GRANIZO', 'GELEIRA', 'ILHA', 'CACHOEIRA', 'LAGO',
  'PANTANO', 'CAVERNA', 'ROCHA', 'AREIA', 'CONCHA', 'CORAL', 'RECIFE', 'PEIXE', 'CAVALO-MARINHO',
  'CARANGUEJO', 'LAGOSTA', 'GAIVOTA', 'PELICANO', 'CORUJA', 'MORCEGO', 'ARANHA', 'ESCORPIAO',
  'FORMIGA', 'ABELHA', 'BORBOLETA', 'GAFANHOTO', 'JOANINHA', 'VIOLAO', 'PIANO', 'BATERIA',
  'GUITARRA', 'TROMPETE', 'FLAUTA', 'MICROFONE', 'PALCO', 'TEATRO', 'CINEMA', 'LIVRO',
  'CADERNO', 'LAPIS', 'CANETA', 'TINTA', 'PINCEL', 'TELA', 'QUADRO', 'ESCULTURA', 'MUSEU',
  'BIBLIOTECA', 'HOSPITAL', 'FARMACIA', 'MERCADO', 'PADARIA', 'RESTAURANTE', 'HOTEL',
  'AEROPORTO', 'ESTACAO', 'FABRICA', 'USINA', 'FAZENDA', 'CELEIRO', 'TRATOR', 'MOINHO',
  'PLANTACAO', 'COLHEITA', 'SEMENTE',
];

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
// Mestre-Espiao da a pista - "null" (Iniciante) = sem limite, igual sempre
// foi. Quem abre a sala escolhe, junto com o modo de equipes.
const ANSWER_TIME_MODES = { especialista: 20000, sargento: 40000, novato: 60000, iniciante: null };
const DEFAULT_ANSWER_TIME_MODE = 'iniciante';

function emptyTeams(mode) {
  const teams = {};
  GAME_MODES[mode].teams.forEach((t) => { teams[t] = { spymaster: null, agents: [] }; });
  return teams;
}

function createCodenamesGame() {
  return {
    status: 'lobby', // lobby | playing | over
    round: 0,
    mode: DEFAULT_GAME_MODE,
    board: [], // [{ word, team: 'red'|'blue'|'green'|'neutral'|'assassin', revealed }]
    currentTeam: null,
    eliminated: [], // times que caíram num assassino no modo ffa3 - fora da rodada, mas o jogo continua pros outros
    phase: null, // 'clue' | 'guess'
    clue: null, // { word, number, guessesMade, guessesAllowed }
    teams: emptyTeams(DEFAULT_GAME_MODE),
    winner: null,
    winReason: null, // 'words' | 'assassin' | 'last-standing'
    log: [],
    answerTimeMode: DEFAULT_ANSWER_TIME_MODE,
    clueGivenAt: null,
    answerTimer: null,
  };
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
  if (!codenamesGames.has(roomId)) codenamesGames.set(roomId, createCodenamesGame());
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

function generateBoard(mode, startingTeam) {
  const words = shuffle(CODENAMES_WORDS).slice(0, 25);
  let counts;
  if (mode === 'ffa3') {
    counts = { red: 6, blue: 6, green: 6, neutral: 5, assassin: 2 };
  } else {
    const otherTeam = GAME_MODES[mode].teams.find((t) => t !== startingTeam);
    counts = { [startingTeam]: 9, [otherTeam]: 8, neutral: 7, assassin: 1 };
  }
  const teamsArr = [];
  Object.entries(counts).forEach(([team, count]) => {
    for (let i = 0; i < count; i++) teamsArr.push(team);
  });
  const shuffledTeams = shuffle(teamsArr);
  return words.map((word, i) => ({ word, team: shuffledTeams[i], revealed: false }));
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
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(idx + step) % order.length];
    if (!game.eliminated.includes(candidate)) { game.currentTeam = candidate; break; }
  }
  game.phase = 'clue';
  game.clue = null;
}

function startNewGameRound(game) {
  clearAnswerTimer(game);
  const teams = GAME_MODES[game.mode].teams;
  const startingTeam = teams[Math.floor(Math.random() * teams.length)];
  game.board = generateBoard(game.mode, startingTeam);
  game.round += 1;
  game.status = 'playing';
  game.currentTeam = startingTeam;
  game.eliminated = [];
  game.phase = 'clue';
  game.clue = null;
  game.clueGivenAt = null;
  game.winner = null;
  game.winReason = null;
  game.log = [`Nova partida! Equipe ${TEAM_LABEL_FEM[startingTeam]} comeca.`];
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
      status: 'lobby', round: 0, mode: DEFAULT_GAME_MODE, board: [], currentTeam: null, eliminated: [], phase: null, clue: null,
      teams: emptyTeams(DEFAULT_GAME_MODE),
      winner: null, winReason: null, remaining: { red: 0, blue: 0 }, log: [],
      answerTimeMode: DEFAULT_ANSWER_TIME_MODE, clueGivenAt: null, answerTimeMs: null,
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
    mode: game.mode,
    board: game.board.map((c) => ({ word: c.word, revealed: c.revealed, team: c.revealed ? c.team : null })),
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
    answerTimeMode: game.answerTimeMode,
    clueGivenAt: game.clueGivenAt,
    answerTimeMs: ANSWER_TIME_MODES[game.answerTimeMode],
  };
}

function broadcastGameState(roomId) {
  io.to(roomId).emit('game-state', publicGameState(roomId));
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
let peakRooms = 0;
let peakParticipants = 0;

function getPeersInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.entries()).map(([id, info]) => ({ id, name: info.name }));
}

function getRoomsSnapshot() {
  return Array.from(rooms.keys()).map((roomId) => ({
    roomId,
    participants: getPeersInRoom(roomId),
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

io.on('connection', (socket) => {
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
    if (ack) ack({ ok: true, selfId: socket.id, peers: existingPeers });
    socket.to(roomId).emit('spectator-joined', { id: socket.id });
  });

  socket.on('join-room', (data, ack) => {
    const { roomId, name } = data || {};
    if (!roomId || typeof roomId !== 'string') {
      if (ack) ack({ ok: false, error: 'roomId invalido' });
      return;
    }
    currentRoom = roomId;
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);

    const existingPeers = getPeersInRoom(roomId);

    room.set(socket.id, { name: name || 'Anonimo' });
    socket.join(roomId);

    if (ack) ack({ ok: true, selfId: socket.id, peers: existingPeers });

    socket.to(roomId).emit('peer-joined', { id: socket.id, name: name || 'Anonimo' });
    // Espectadores invisiveis tambem precisam saber de gente nova pra
    // conseguir receber a midia dela - 'peer-joined' direto pra cada um
    // (nao via socket.to, porque eles nunca dao socket.join na sala).
    const specs = spectatorsByRoom.get(roomId);
    if (specs) specs.forEach((id) => io.to(id).emit('peer-joined', { id: socket.id, name: name || 'Anonimo' }));
    broadcastRoomsToAdmins();
  });

  socket.on('signal', (payload) => {
    const { to, data } = payload || {};
    if (!to || (!currentRoom && !spectatingRoom)) return;
    io.to(to).emit('signal', { from: socket.id, data });
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
    if (!role || role.role !== 'spymaster') {
      if (ack) ack({ ok: false, error: 'Só o Mestre-Espião vê o mapa secreto' });
      return;
    }
    if (ack) ack({ ok: true, round: game.round, map: game.board.map((c) => c.team) });
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

  socket.on('game-set-answer-time', (data, ack) => {
    const { answerTimeMode } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar com a partida em andamento' }); return; }
    if (!Object.prototype.hasOwnProperty.call(ANSWER_TIME_MODES, answerTimeMode)) {
      if (ack) ack({ ok: false, error: 'Modo inválido' });
      return;
    }
    game.answerTimeMode = answerTimeMode;
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
    if (role === 'spymaster') game.teams[team].spymaster = socket.id;
    else game.teams[team].agents.push(socket.id);
    broadcastGameState(currentRoom);
    // Codenames nao tem um "abrir lobby" explicito - o primeiro a escolher
    // equipe num lobby vazio e quem "iniciou" o jogo.
    if (lobbyWasEmpty) notifyMinigameStarted(socket, currentRoom, 'codenames');
    if (ack) ack({ ok: true });
  });

  socket.on('game-leave-role', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game) { if (ack) ack({ ok: true }); return; }
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra sair da equipe com a partida em andamento' }); return; }
    removeFromGameTeams(game, socket.id);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-start', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Já tem uma partida em andamento' }); return; }
    if (!gameTeamsBothReady(game)) {
      if (ack) ack({ ok: false, error: 'Cada equipe precisa de 1 Mestre-Espião e pelo menos 1 Agente' });
      return;
    }
    startNewGameRound(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-play-again', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'over') { if (ack) ack({ ok: false, error: 'A partida ainda não acabou' }); return; }
    if (!gameTeamsBothReady(game)) {
      if (ack) ack({ ok: false, error: 'Cada equipe precisa de 1 Mestre-Espião e pelo menos 1 Agente' });
      return;
    }
    startNewGameRound(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-reset-lobby', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const oldGame = codenamesGames.get(currentRoom);
    if (oldGame) clearAnswerTimer(oldGame);
    codenamesGames.set(currentRoom, createCodenamesGame());
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-give-clue', (data, ack) => {
    const { word, number } = data || {};
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
    const teamLabel = TEAM_LABEL[game.currentTeam];
    const name = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    game.log.push(`${name} (Mestre-Espião ${teamLabel}) deu a pista "${cleanWord.toUpperCase()}" ${n}`);
    game.phase = 'guess';

    clearAnswerTimer(game);
    game.clueGivenAt = Date.now();
    const limitMs = ANSWER_TIME_MODES[game.answerTimeMode];
    if (limitMs) {
      const roomIdForTimer = currentRoom; // nao usar currentRoom direto dentro do timeout - e um "let" por socket, pode mudar antes do timer disparar
      const teamAtClueTime = game.currentTeam;
      game.answerTimer = setTimeout(() => {
        if (game.status !== 'playing' || game.phase !== 'guess' || game.currentTeam !== teamAtClueTime) return;
        game.log.push(`Tempo esgotado - Equipe ${TEAM_LABEL[teamAtClueTime]} perdeu a vez`);
        endGameTurn(game);
        broadcastGameState(roomIdForTimer);
      }, limitMs);
    }

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
    if (!Number.isInteger(i) || i < 0 || i > 24 || !game.board[i] || game.board[i].revealed) {
      if (ack) ack({ ok: false, error: 'Palavra inválida' });
      return;
    }

    const cell = game.board[i];
    cell.revealed = true;
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

  socket.on('game-end-turn', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') {
      if (ack) ack({ ok: false, error: 'Não dá pra passar a vez agora' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam) { if (ack) ack({ ok: false, error: 'Você não está na equipe da vez' }); return; }
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
      rooms.get(currentRoom).delete(socket.id);
      const specs = spectatorsByRoom.get(currentRoom);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
        codenamesGames.delete(currentRoom);
        const stopGame = stopGames.get(currentRoom);
        if (stopGame && stopGame.timer) clearTimeout(stopGame.timer);
        stopGames.delete(currentRoom);
        sketchGames.delete(currentRoom);
      } else {
        socket.to(currentRoom).emit('peer-left', { id: socket.id });
        const game = codenamesGames.get(currentRoom);
        if (game) {
          removeFromGameTeams(game, socket.id);
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
