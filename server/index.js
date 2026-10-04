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

function createCodenamesGame() {
  return {
    status: 'lobby', // lobby | playing | over
    round: 0,
    board: [], // [{ word, team: 'red'|'blue'|'neutral'|'assassin', revealed }]
    currentTeam: null, // 'red' | 'blue'
    phase: null, // 'clue' | 'guess'
    clue: null, // { word, number, guessesMade, guessesAllowed }
    teams: {
      red: { spymaster: null, agents: [] },
      blue: { spymaster: null, agents: [] },
    },
    winner: null,
    winReason: null, // 'words' | 'assassin'
    log: [],
  };
}

function getOrCreateGame(roomId) {
  if (!codenamesGames.has(roomId)) codenamesGames.set(roomId, createCodenamesGame());
  return codenamesGames.get(roomId);
}

function playerGameRole(game, socketId) {
  for (const team of ['red', 'blue']) {
    if (game.teams[team].spymaster === socketId) return { team, role: 'spymaster' };
    if (game.teams[team].agents.includes(socketId)) return { team, role: 'agent' };
  }
  return null;
}

function removeFromGameTeams(game, socketId) {
  for (const team of ['red', 'blue']) {
    if (game.teams[team].spymaster === socketId) game.teams[team].spymaster = null;
    game.teams[team].agents = game.teams[team].agents.filter((id) => id !== socketId);
  }
}

function generateBoard(startingTeam) {
  const otherTeam = startingTeam === 'red' ? 'blue' : 'red';
  const words = shuffle(CODENAMES_WORDS).slice(0, 25);
  const counts = { [startingTeam]: 9, [otherTeam]: 8, neutral: 7, assassin: 1 };
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
  if (countRemaining(game, 'red') === 0) { game.status = 'over'; game.winner = 'red'; game.winReason = 'words'; game.phase = null; }
  else if (countRemaining(game, 'blue') === 0) { game.status = 'over'; game.winner = 'blue'; game.winReason = 'words'; game.phase = null; }
}

function endGameTurn(game) {
  game.currentTeam = game.currentTeam === 'red' ? 'blue' : 'red';
  game.phase = 'clue';
  game.clue = null;
}

function startNewGameRound(game) {
  const startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
  game.board = generateBoard(startingTeam);
  game.round += 1;
  game.status = 'playing';
  game.currentTeam = startingTeam;
  game.phase = 'clue';
  game.clue = null;
  game.winner = null;
  game.winReason = null;
  game.log = [`Nova partida! Equipe ${startingTeam === 'red' ? 'Vermelha' : 'Azul'} comeca.`];
}

function gameTeamsBothReady(game) {
  return ['red', 'blue'].every((team) => game.teams[team].spymaster && game.teams[team].agents.length >= 1);
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
      status: 'lobby', round: 0, board: [], currentTeam: null, phase: null, clue: null,
      teams: { red: { spymaster: null, agents: [] }, blue: { spymaster: null, agents: [] } },
      winner: null, winReason: null, remaining: { red: 0, blue: 0 }, log: [],
    };
  }
  return {
    status: game.status,
    round: game.round,
    board: game.board.map((c) => ({ word: c.word, revealed: c.revealed, team: c.revealed ? c.team : null })),
    currentTeam: game.currentTeam,
    phase: game.phase,
    clue: game.clue ? {
      word: game.clue.word,
      number: game.clue.number,
      guessesMade: game.clue.guessesMade,
      guessesAllowed: game.clue.guessesAllowed === Infinity ? null : game.clue.guessesAllowed,
    } : null,
    teams: { red: gameTeamView(game, roomId, 'red'), blue: gameTeamView(game, roomId, 'blue') },
    winner: game.winner,
    winReason: game.winReason,
    remaining: { red: countRemaining(game, 'red'), blue: countRemaining(game, 'blue') },
    log: game.log.slice(-30),
  };
}

function broadcastGameState(roomId) {
  io.to(roomId).emit('game-state', publicGameState(roomId));
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
  socket.on('admin-kick', ({ socketId }, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const target = io.sockets.sockets.get(socketId);
    if (target) target.disconnect(true);
    if (ack) ack({ ok: !!target });
  });

  // Desconecta todo mundo de uma sala de uma vez (participantes E
  // espectadores admin que estiverem la).
  socket.on('admin-close-room', ({ roomId }, ack) => {
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
  socket.on('admin-spectate-room', ({ roomId }, ack) => {
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

  socket.on('join-room', ({ roomId, name }, ack) => {
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

  socket.on('signal', ({ to, data }) => {
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

  socket.on('game-set-role', ({ team, role } = {}, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar de equipe com a partida em andamento' }); return; }
    if (team !== 'red' && team !== 'blue') { if (ack) ack({ ok: false, error: 'Equipe inválida' }); return; }
    if (role !== 'spymaster' && role !== 'agent') { if (ack) ack({ ok: false, error: 'Papel inválido' }); return; }
    if (role === 'spymaster' && game.teams[team].spymaster && game.teams[team].spymaster !== socket.id) {
      if (ack) ack({ ok: false, error: 'Essa equipe já tem um Mestre-Espião' });
      return;
    }
    removeFromGameTeams(game, socket.id);
    if (role === 'spymaster') game.teams[team].spymaster = socket.id;
    else game.teams[team].agents.push(socket.id);
    broadcastGameState(currentRoom);
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
    codenamesGames.set(currentRoom, createCodenamesGame());
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-give-clue', ({ word, number } = {}, ack) => {
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
    const teamLabel = game.currentTeam === 'red' ? 'Vermelho' : 'Azul';
    const name = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    game.log.push(`${name} (Mestre-Espião ${teamLabel}) deu a pista "${cleanWord.toUpperCase()}" ${n}`);
    game.phase = 'guess';
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-reveal-word', ({ index } = {}, ack) => {
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
    const teamLabel = game.currentTeam === 'red' ? 'Vermelho' : 'Azul';

    if (cell.team === 'assassin') {
      game.log.push(`${name} (${teamLabel}) revelou o ASSASSINO: "${cell.word}"!`);
      game.status = 'over';
      game.winner = game.currentTeam === 'red' ? 'blue' : 'red';
      game.winReason = 'assassin';
      game.phase = null;
    } else if (cell.team === game.currentTeam) {
      game.log.push(`${name} (${teamLabel}) acertou "${cell.word}"`);
      game.clue.guessesMade += 1;
      checkGameWinConditions(game);
      if (game.status === 'playing' && game.clue.guessesAllowed !== Infinity && game.clue.guessesMade >= game.clue.guessesAllowed) {
        endGameTurn(game);
      }
    } else {
      const otherLabel = cell.team === 'neutral' ? 'uma palavra neutra' : `uma palavra do time ${cell.team === 'red' ? 'Vermelho' : 'Azul'}`;
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
    const teamLabel = game.currentTeam === 'red' ? 'Vermelho' : 'Azul';
    game.log.push(`Equipe ${teamLabel} passou a vez`);
    endGameTurn(game);
    broadcastGameState(currentRoom);
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
      } else {
        socket.to(currentRoom).emit('peer-left', { id: socket.id });
        const game = codenamesGames.get(currentRoom);
        if (game) {
          removeFromGameTeams(game, socket.id);
          broadcastGameState(currentRoom);
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
