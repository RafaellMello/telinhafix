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

// Sockets autenticados com a ADMIN_PASSWORD - recebem o snapshot de todas as
// salas em tempo real e podem entrar em qualquer uma.
const adminSockets = new Set();

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

function broadcastRoomsToAdmins() {
  if (adminSockets.size === 0) return;
  const snapshot = getRoomsSnapshot();
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

  if (socket.data.isAdmin) {
    adminSockets.add(socket);
    socket.emit('admin-rooms-updated', getRoomsSnapshot());
  }

  socket.on('admin-list-rooms', (ack) => {
    if (!socket.data.isAdmin) return;
    if (ack) ack(getRoomsSnapshot());
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
    broadcastRoomsToAdmins();
  });

  socket.on('signal', ({ to, data }) => {
    if (!to || !currentRoom) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket);
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(socket.id);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      } else {
        socket.to(currentRoom).emit('peer-left', { id: socket.id });
      }
      broadcastRoomsToAdmins();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de sinalizacao rodando na porta ${PORT}`);
});
