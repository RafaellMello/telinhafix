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

  socket.on('admin-list-rooms', (ack) => {
    if (!socket.data.isAdmin) return;
    if (ack) ack(getFullAdminSnapshot());
  });

  // Remove uma pessoa de uma sala direto (sem o admin precisar entrar nela)
  // - so desconecta o socket dela, o resto (avisar os outros, limpar a sala)
  // reaproveita exatamente a mesma logica do disconnect normal abaixo.
  socket.on('admin-kick', ({ socketId }, ack) => {
    if (!socket.data.isAdmin) return;
    const target = io.sockets.sockets.get(socketId);
    if (target) target.disconnect(true);
    if (ack) ack({ ok: !!target });
  });

  // Desconecta todo mundo de uma sala de uma vez (participantes E
  // espectadores admin que estiverem la).
  socket.on('admin-close-room', ({ roomId }, ack) => {
    if (!socket.data.isAdmin) return;
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
      } else {
        socket.to(currentRoom).emit('peer-left', { id: socket.id });
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
