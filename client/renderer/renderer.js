const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const loginScreen = document.getElementById('login-screen');
const roomScreen = document.getElementById('room-screen');
const loginError = document.getElementById('login-error');
const roomLabel = document.getElementById('room-label');
const participantsList = document.getElementById('participants-list');
const videoGrid = document.getElementById('video-grid');
const btnShare = document.getElementById('btn-share');
const btnStopShare = document.getElementById('btn-stop-share');
const btnLeave = document.getElementById('btn-leave');
const btnJoin = document.getElementById('btn-join');

let selfId = null;
let localStream = null;
// peerId -> { pc, polite, makingOffer, ignoreOffer, name }
const peers = new Map();
// peerId -> nome, usado para a lista de participantes
const peerNames = new Map();

function setLoginError(msg) {
  loginError.textContent = msg || '';
}

function addParticipantRow(id, name, isSelf) {
  const li = document.createElement('li');
  li.id = `participant-${id}`;
  li.textContent = isSelf ? `${name} (voce)` : name;
  participantsList.appendChild(li);
}

function removeParticipantRow(id) {
  const li = document.getElementById(`participant-${id}`);
  if (li) li.remove();
}

function getOrCreateVideoTile(peerId, label) {
  let tile = document.getElementById(`tile-${peerId}`);
  if (tile) return tile.querySelector('video');

  tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `tile-${peerId}`;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;

  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = label;

  tile.appendChild(video);
  tile.appendChild(labelEl);
  videoGrid.appendChild(tile);

  return video;
}

function removeVideoTile(peerId) {
  const tile = document.getElementById(`tile-${peerId}`);
  if (tile) tile.remove();
}

function createPeerConnection(peerId) {
  const polite = selfId < peerId; // regra combinada dos dois lados

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const state = { pc, polite, makingOffer: false, ignoreOffer: false };
  peers.set(peerId, state);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) window.rtc.sendSignal(peerId, { candidate });
  };

  pc.onnegotiationneeded = async () => {
    try {
      state.makingOffer = true;
      await pc.setLocalDescription();
      window.rtc.sendSignal(peerId, { description: pc.localDescription });
    } catch (err) {
      console.error('Erro ao negociar:', err);
    } finally {
      state.makingOffer = false;
    }
  };

  pc.ontrack = (event) => {
    const name = peerNames.get(peerId) || 'Participante';
    const video = getOrCreateVideoTile(peerId, name);
    video.srcObject = event.streams[0];

    event.track.onended = () => {
      removeVideoTile(peerId);
    };
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      removeVideoTile(peerId);
    }
  };

  return state;
}

async function handleSignal({ from, data }) {
  let state = peers.get(from);
  if (!state) state = createPeerConnection(from);
  const { pc, polite } = state;

  try {
    if (data.description) {
      const offerCollision =
        data.description.type === 'offer' &&
        (state.makingOffer || pc.signalingState !== 'stable');

      state.ignoreOffer = !polite && offerCollision;
      if (state.ignoreOffer) return;

      await pc.setRemoteDescription(data.description);
      if (data.description.type === 'offer') {
        await pc.setLocalDescription();
        window.rtc.sendSignal(from, { description: pc.localDescription });
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (err) {
        if (!state.ignoreOffer) throw err;
      }
    }
  } catch (err) {
    console.error('Erro ao tratar sinal de', from, err);
  }
}

function attachLocalStreamToAllPeers(stream) {
  for (const [, state] of peers) {
    stream.getTracks().forEach((track) => state.pc.addTrack(track, stream));
  }
}

function detachLocalStreamFromAllPeers(stream) {
  for (const [, state] of peers) {
    state.pc.getSenders().forEach((sender) => {
      if (sender.track && stream.getTracks().includes(sender.track)) {
        state.pc.removeTrack(sender);
      }
    });
  }
}

async function startShare() {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch (err) {
    console.error('Falha ao iniciar compartilhamento:', err);
    return;
  }

  attachLocalStreamToAllPeers(localStream);

  const video = getOrCreateVideoTile(selfId, 'Voce (compartilhando)');
  video.srcObject = localStream;

  btnShare.classList.add('hidden');
  btnStopShare.classList.remove('hidden');

  localStream.getVideoTracks()[0].addEventListener('ended', stopShare);
}

function stopShare() {
  if (!localStream) return;
  detachLocalStreamFromAllPeers(localStream);
  localStream.getTracks().forEach((t) => t.stop());
  localStream = null;

  removeVideoTile(selfId);

  btnShare.classList.remove('hidden');
  btnStopShare.classList.add('hidden');
}

function leaveRoom() {
  if (localStream) stopShare();
  for (const [, state] of peers) state.pc.close();
  peers.clear();
  peerNames.clear();
  videoGrid.innerHTML = '';
  participantsList.innerHTML = '';
  window.rtc.disconnect();

  roomScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

btnShare.addEventListener('click', startShare);
btnStopShare.addEventListener('click', stopShare);
btnLeave.addEventListener('click', leaveRoom);

btnJoin.addEventListener('click', async () => {
  setLoginError('');
  const serverUrl = document.getElementById('server-url').value.trim();
  const password = document.getElementById('server-password').value;
  const name = document.getElementById('display-name').value.trim() || 'Anonimo';
  const roomId = document.getElementById('room-id').value.trim();

  if (!serverUrl || !roomId) {
    setLoginError('Preencha o servidor e o codigo da sala.');
    return;
  }

  btnJoin.disabled = true;
  try {
    await window.rtc.connect(serverUrl, password);
    const { selfId: id, peers: existingPeers } = await window.rtc.joinRoom(roomId, name);
    selfId = id;

    window.rtc.onSignal(handleSignal);

    window.rtc.onPeerJoined(({ id: peerId, name: peerName }) => {
      peerNames.set(peerId, peerName);
      addParticipantRow(peerId, peerName, false);
      createPeerConnection(peerId);
    });

    window.rtc.onPeerLeft(({ id: peerId }) => {
      const state = peers.get(peerId);
      if (state) state.pc.close();
      peers.delete(peerId);
      peerNames.delete(peerId);
      removeParticipantRow(peerId);
      removeVideoTile(peerId);
    });

    window.rtc.onDisconnected(() => {
      setLoginError('Conexao com o servidor perdida.');
    });

    roomLabel.textContent = roomId;
    addParticipantRow(selfId, name, true);
    existingPeers.forEach((p) => {
      peerNames.set(p.id, p.name);
      addParticipantRow(p.id, p.name, false);
      createPeerConnection(p.id);
    });

    loginScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
  } catch (err) {
    setLoginError(err.message || 'Falha ao entrar.');
  } finally {
    btnJoin.disabled = false;
  }
});
