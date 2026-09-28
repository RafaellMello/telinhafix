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

const NAME_PLACEHOLDERS = [
  'Ex: bunny',
  'Ex: zicaneto',
  'Ex: chama2k19',
  'Ex: pc',
  'Ex: babini',
  'Ex: cokaizi',
];

function startNamePlaceholderCycle() {
  const input = document.getElementById('display-name');
  let i = 0;
  input.placeholder = NAME_PLACEHOLDERS[i];
  setInterval(() => {
    i = (i + 1) % NAME_PLACEHOLDERS.length;
    input.placeholder = NAME_PLACEHOLDERS[i];
  }, 2000);
}

startNamePlaceholderCycle();

const AVATAR_FILES = [
  'babini.jpg', 'babini2.jpg', 'coka.jpg', 'dani.jpg', 'rudeus.jpg',
  'fab.jpg', 'hent.jpg', 'img-20240330-wa0127_original.jpg', 'nathan.jpg',
  'nathanthegoat.jpg', 'pc.jpg', 'screenshot_20251112_185935_discord.jpg',
  'thiaginfn.jpg', 'thiaguinis.jpg', 'tutuzada.jpg', 'yuri.jpg',
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function avatarFor(key) {
  const file = AVATAR_FILES[hashString(key) % AVATAR_FILES.length];
  return `assets/avatars/${file}`;
}

function populateMembersColumns() {
  const left = document.getElementById('members-left');
  const right = document.getElementById('members-right');
  if (!left || !right) return;

  AVATAR_FILES.forEach((file, i) => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.style.setProperty('--tilt', `${(i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 3)}deg`);
    const img = document.createElement('img');
    img.src = `assets/avatars/${file}`;
    img.alt = '';
    card.appendChild(img);
    (i % 2 === 0 ? left : right).appendChild(card);
  });
}

populateMembersColumns();

let selfId = null;
let localStream = null;
// Qualidade (resolucao/fps/bitrate) escolhida no seletor de tela.
let currentQuality = null;
// peerId -> { pc, polite, makingOffer, ignoreOffer, name }
const peers = new Map();
// peerId -> nome, usado para a lista de participantes
const peerNames = new Map();

async function applyBitrateToSender(sender, quality) {
  if (!sender || !quality) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = quality.maxBitrate;
    await sender.setParameters(params);
  } catch (err) {
    console.error('Falha ao ajustar bitrate do video:', err);
  }
}

function setLoginError(msg) {
  loginError.textContent = msg || '';
}

function addParticipantRow(id, name, isSelf) {
  const li = document.createElement('li');
  li.id = `participant-${id}`;

  const avatar = document.createElement('img');
  avatar.className = 'avatar-dot';
  avatar.src = avatarFor(name || id);
  avatar.alt = '';

  const label = document.createElement('span');
  label.textContent = isSelf ? `${name} (voce)` : name;

  li.appendChild(avatar);
  li.appendChild(label);
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

  // Se ja estamos compartilhando quando essa conexao e criada (ex: alguem
  // entrou na sala depois que voce comecou a compartilhar), manda o video
  // atual pra essa pessoa tambem.
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStream);
      if (track.kind === 'video') applyBitrateToSender(sender, currentQuality);
    });
  }

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
    stream.getTracks().forEach((track) => {
      const sender = state.pc.addTrack(track, stream);
      if (track.kind === 'video') applyBitrateToSender(sender, currentQuality);
    });
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

// Recebe o audio cru (PCM float32, 48kHz, estereo) do helper nativo
// (que captura o sistema todo excluindo o Discord) e alimenta um
// AudioWorklet com um ring buffer, gerando uma MediaStreamTrack de audio
// continua pra juntar com o video da tela compartilhada.
const AUDIO_WORKLET_CODE = `
class PcmRingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 96000; // 2s de buffer a 48kHz
    this.bufferL = new Float32Array(this.capacity);
    this.bufferR = new Float32Array(this.capacity);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.available = 0;
    this.port.onmessage = (e) => {
      const interleaved = e.data;
      const frames = interleaved.length / 2;
      for (let i = 0; i < frames; i++) {
        this.bufferL[this.writeIndex] = interleaved[i * 2];
        this.bufferR[this.writeIndex] = interleaved[i * 2 + 1];
        this.writeIndex = (this.writeIndex + 1) % this.capacity;
        if (this.available < this.capacity) {
          this.available++;
        } else {
          this.readIndex = (this.readIndex + 1) % this.capacity;
        }
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    for (let i = 0; i < left.length; i++) {
      if (this.available > 0) {
        left[i] = this.bufferL[this.readIndex];
        right[i] = this.bufferR[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available--;
      } else {
        left[i] = 0;
        right[i] = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-ring-processor', PcmRingProcessor);
`;

let audioCtx = null;
let workletNode = null;

function bytesToFloat32Array(uint8) {
  const floatCount = Math.floor(uint8.byteLength / 4);
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const out = new Float32Array(floatCount);
  for (let i = 0; i < floatCount; i++) {
    out[i] = view.getFloat32(i * 4, true);
  }
  return out;
}

window.audioCapture.onChunk((chunk) => {
  if (!workletNode) return;
  const samples = bytesToFloat32Array(chunk);
  workletNode.port.postMessage(samples, [samples.buffer]);
});

async function setupCapturedAudioTrack() {
  audioCtx = new AudioContext({ sampleRate: 48000 });
  const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  await audioCtx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  workletNode = new AudioWorkletNode(audioCtx, 'pcm-ring-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const destination = audioCtx.createMediaStreamDestination();
  workletNode.connect(destination);

  await window.audioCapture.start();

  return destination.stream.getAudioTracks()[0];
}

function teardownCapturedAudioTrack() {
  window.audioCapture.stop();
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

let localVideoStream = null;

async function startShare() {
  try {
    localVideoStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (err) {
    console.error('Falha ao iniciar compartilhamento:', err);
    return;
  }

  currentQuality = await window.screenPicker.getQuality();
  const videoTrack = localVideoStream.getVideoTracks()[0];
  if (currentQuality && videoTrack) {
    try {
      await videoTrack.applyConstraints({
        width: { ideal: currentQuality.width, max: currentQuality.width },
        height: { ideal: currentQuality.height, max: currentQuality.height },
        frameRate: { ideal: currentQuality.frameRate, max: currentQuality.frameRate },
      });
    } catch (err) {
      console.error('Falha ao aplicar qualidade escolhida:', err);
    }
    // Ajuda o codec a priorizar nitidez (texto/UI) em 30fps ou fluidez em 60fps.
    videoTrack.contentHint = currentQuality.frameRate >= 60 ? 'motion' : 'detail';
  }

  let audioTrack = null;
  try {
    audioTrack = await setupCapturedAudioTrack();
  } catch (err) {
    console.error('Falha ao capturar audio do sistema (compartilhando so a tela):', err);
  }

  const tracks = [...localVideoStream.getVideoTracks()];
  if (audioTrack) tracks.push(audioTrack);
  localStream = new MediaStream(tracks);

  attachLocalStreamToAllPeers(localStream);

  const video = getOrCreateVideoTile(selfId, 'Você (compartilhando)');
  video.srcObject = localStream;

  btnShare.classList.add('hidden');
  btnStopShare.classList.remove('hidden');

  localVideoStream.getVideoTracks()[0].addEventListener('ended', stopShare);
}

function stopShare() {
  if (!localStream) return;
  detachLocalStreamFromAllPeers(localStream);
  localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  localVideoStream = null;
  currentQuality = null;

  teardownCapturedAudioTrack();

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
    setLoginError('Preencha o servidor e o código da sala.');
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
      setLoginError('Conexão com o servidor perdida.');
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
