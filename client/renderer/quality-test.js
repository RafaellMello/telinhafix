// Teste automatico (opcional) de qualidade: mede o que o PC da pessoa
// aguenta codificar em tempo real (CPU) e quanto de upload real a conexao
// dela tem, pra recomendar uma qualidade padrao em vez de sempre comecar
// em 1080p30 pra todo mundo. So roda quando a pessoa pede (nunca sozinho
// sem avisar) e o resultado fica salvo (localStorage) ate ela pedir de novo.
//
// Tudo dentro de uma IIFE (em vez de const/function soltos no escopo global
// do script) de proposito: esse arquivo as vezes executa mais de uma vez
// no ciclo de vida do renderer (visto na pratica - um segundo
// executionContextId aparecia com os mesmos top-level const), e sem isso a
// segunda execucao quebrava com "Identifier ja declarado" e derrubava o
// arquivo inteiro, inclusive a parte que liga os botoes.
(function () {
if (window.__qualityTestModuleLoaded) return;
window.__qualityTestModuleLoaded = true;

const QUALITY_TEST_STORAGE_KEY = 'telinhafix-quality-profile';
const QUALITY_TEST_PROMPTED_KEY = 'telinhafix-quality-test-prompted';

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gera um canvas com conteudo SEMPRE mudando (ruido colorido + texto) - de
// proposito o pior caso pro encoder, pra nao superestimar o que a maquina
// aguenta com uma imagem parada ou quase parada (facil de comprimir).
function createSyntheticVideoTrack(width, height, frameRate) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  let frame = 0;
  let rafId = null;

  function draw() {
    frame++;
    ctx.fillStyle = `hsl(${(frame * 7) % 360}, 65%, 45%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(canvas.height / 18)}px monospace`;
    ctx.fillText(`teste de qualidade - frame ${frame}`, 20, 50);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgb(${(Math.random() * 255) | 0},${(Math.random() * 255) | 0},${(Math.random() * 255) | 0})`;
      ctx.fillRect((Math.random() * canvas.width) | 0, (Math.random() * canvas.height) | 0, 5, 5);
    }
    rafId = requestAnimationFrame(draw);
  }
  draw();

  const stream = canvas.captureStream(frameRate);
  const track = stream.getVideoTracks()[0];
  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    track.stop();
  };
  return { stream, track, stop };
}

// Forca UM codec especifico (em vez da ordem de preferencia padrao) numa
// conexao - usado pelo teste pra isolar cada codec e medir ele sozinho.
// H264 fica de fora por completo: o Chromium (testado no Electron 33)
// joga "InvalidModificationError: invalid codec with name H264" quando a
// lista passada pra setCodecPreferences inclui as variantes de H264 que
// getCapabilities devolve, e como os dois lados de uma chamada sempre
// rodam o mesmo Electron embutido, H264 nunca faz falta como fallback de
// compatibilidade mesmo.
function setSpecificCodecPreference(pc, mimeType) {
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps || !caps.codecs) return false;
  const candidates = caps.codecs.filter((c) => c.mimeType === mimeType);
  if (candidates.length === 0) return false;
  const rest = caps.codecs.filter((c) => c.mimeType !== mimeType && c.mimeType !== 'video/H264');
  const sorted = [...candidates, ...rest];
  let ok = true;
  pc.getTransceivers().forEach((t) => {
    if (t.sender && t.sender.track && t.sender.track.kind === 'video' && t.setCodecPreferences) {
      try { t.setCodecPreferences(sorted); } catch (err) { ok = false; }
    }
  });
  return ok;
}

// Testa UMA combinacao de resolucao/fps/codec: manda a track sintetica por
// uma conexao WebRTC local (duas RTCPeerConnection na mesma pagina,
// conectadas direto uma na outra via candidatos de host - nao sai da
// maquina, nao precisa de STUN/servidor) e le getStats() pra ver se o
// encoder realmente aguentou aquele fps/codec ou se ficou limitado por
// CPU - e confirma, pelo proprio getStats, qual codec foi de fato usado
// (setCodecPreferences pede, mas nao garante - por exemplo se as duas
// pontas nao baterem em nenhum codec em comum, o que aqui nunca acontece
// porque pc1/pc2 sao o mesmo navegador, mas e uma checagem barata).
async function testEncodeConfig({ width, height, frameRate, maxBitrate, codec }) {
  const { stream, track, stop } = createSyntheticVideoTrack(width, height, frameRate);

  const pc1 = new RTCPeerConnection();
  const pc2 = new RTCPeerConnection();
  pc1.onicecandidate = (e) => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {}); };
  pc2.onicecandidate = (e) => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {}); };

  const remoteTrackPromise = new Promise((resolve) => { pc2.ontrack = (e) => resolve(e.track); });

  const sender = pc1.addTrack(track, stream);
  if (codec) {
    setSpecificCodecPreference(pc1, codec);
  } else if (typeof preferVideoCodecs === 'function') {
    preferVideoCodecs(pc1);
  }

  try {
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);
    await remoteTrackPromise;

    try {
      await track.applyConstraints({ width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } });
    } catch (err) { /* alguns navegadores nao deixam mudar depois de captureStream - ok, ja nasceu nesse tamanho */ }

    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxBitrate;
    await sender.setParameters(params).catch(() => {});

    await sleepMs(3000);

    const stats = await pc1.getStats();
    let outboundVideo = null;
    let actualCodec = null;
    stats.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') outboundVideo = r; });
    if (outboundVideo) {
      stats.forEach((r) => { if (r.type === 'codec' && r.id === outboundVideo.codecId) actualCodec = r.mimeType; });
    }

    if (!outboundVideo) return { ok: false, feasible: false };

    const achievedFps = outboundVideo.framesPerSecond || 0;
    const fpsRatio = frameRate > 0 ? achievedFps / frameRate : 0;
    const limitedByCpu = outboundVideo.qualityLimitationReason === 'cpu';
    const codecMatched = !codec || actualCodec === codec;

    return {
      ok: true,
      achievedFps: Math.round(achievedFps * 10) / 10,
      targetFps: frameRate,
      fpsRatio: Math.round(fpsRatio * 100) / 100,
      qualityLimitationReason: outboundVideo.qualityLimitationReason || 'none',
      actualCodec,
      feasible: !limitedByCpu && fpsRatio >= 0.85 && codecMatched,
    };
  } finally {
    stop();
    pc1.close();
    pc2.close();
  }
}

// Sobe um payload de tamanho conhecido pro servidor de sinalizacao e
// cronometra - da uma estimativa real do upload disponivel (nao e um
// servidor de teste de velocidade de verdade, mas e o mesmo caminho de
// rede que a transmissao real vai usar ate certo ponto).
async function measureUploadBandwidth(serverUrl) {
  const sizeBytes = 3 * 1024 * 1024; // 3MB
  const payload = new Uint8Array(sizeBytes);
  crypto.getRandomValues(payload.subarray(0, Math.min(65536, sizeBytes))); // nao precisa aleatorizar tudo, so o suficiente pra nao ser so zeros

  const url = serverUrl.replace(/\/$/, '') + '/bandwidth-test';
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    await fetch(url, { method: 'POST', body: payload, signal: controller.signal });
    clearTimeout(timeout);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const elapsedSec = (performance.now() - start) / 1000;
  const mbps = (sizeBytes * 8) / elapsedSec / 1_000_000;
  return { ok: true, mbps: Math.round(mbps * 10) / 10, elapsedSec: Math.round(elapsedSec * 10) / 10 };
}

// A escada de configuracoes testadas - de proposito curta (3 pontos) pra
// nao demorar demais: 1080p30 (base, quase todo mundo passa), 1080p60
// (testa se fps alto e viavel) e 1440p30 (testa se resolucao mais alta e
// viavel). Nao testa 4K/120fps aqui - se a maquina ja passa em 1440p30 com
// folga, esses ja tendem a funcionar, e testar tudo deixaria o teste longo
// demais pra algo opcional.
const ENCODE_TEST_LADDER = [
  { key: '1080p30', width: 1920, height: 1080, frameRate: 30, maxBitrate: 6_000_000 },
  { key: '1080p60', width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_500_000 },
  { key: '1440p30', width: 2560, height: 1440, frameRate: 30, maxBitrate: 9_000_000 },
];

const CODEC_CANDIDATES = ['video/AV1', 'video/VP9', 'video/VP8'];

// Teto real da escala de QP (quantizacao) de cada codec no libvpx/libaom -
// AV1 usa 0-255, VP8/VP9 usam 0-63. Sem normalizar por isso, comparar o
// qpSum bruto entre codecs da conta errada (o mesmo tipo de erro que ja
// causou uma recomendacao ruim antes, so que na escala de QP em vez de
// prioridade fixa).
const CODEC_QP_MAX = {
  'video/AV1': 255,
  'video/VP9': 63,
  'video/VP8': 63,
};

// Ordem de eficiencia de compressao estabelecida (fato documentado da
// industria, nao um palpite) - AV1 > VP9 > VP8 pra manter a MESMA
// qualidade com MENOS bits. So entra em jogo como desempate ENTRE os
// codecs que ja passaram nos dois testes empiricos abaixo (fluidez e
// "nao esta sendo esganado pelo bitrate") - nunca decide sozinha.
//
// Por que nao mediu a nitidez de cada um diretamente (ex: comparando o
// pixel decodificado contra o original)? Foi a primeira tentativa, e nao
// se mostrou confiavel: um teste de sanidade isolado mostrou o PSNR
// medido piorando com o bitrate MAIOR (o oposto do esperado), porque o
// WebRTC adapta resolucao/bitrate por conta propria em tempo real e isso
// contamina qualquer comparacao pixel-a-pixel de um unico frame. O que DA
// pra medir com confianca, e o que esse teste faz: se o codec mantem
// fluidez em tempo real, e se o QP medio indica que o bitrate testado e
// SUFICIENTE pra ele (em vez de tentar quantificar "quao mais nitido"
// com precisao, o que se mostrou fragil demais pra um teste de poucos
// segundos).
const CODEC_PRIORITY = ['video/AV1', 'video/VP9', 'video/VP8'];
const QP_STARVED_PERCENT = 85; // % do teto de QP daquele codec - acima disso, o bitrate testado claramente nao da conta

// Testa UM codec: mede fluidez (fps real) e le o QP medio reportado pelo
// proprio encoder (normalizado pelo teto de QP desse codec) no mesmo
// trecho de conteudo sempre mudando - sem fase separada de imagem parada,
// que se mostrou fragil (ver comentario acima).
async function testCodecQuality(codec, targetFps) {
  const { stream, track, stop } = createSyntheticVideoTrack(1920, 1080, targetFps);
  const maxBitrate = 6_000_000;

  const pc1 = new RTCPeerConnection();
  const pc2 = new RTCPeerConnection();
  pc1.onicecandidate = (e) => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {}); };
  pc2.onicecandidate = (e) => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {}); };
  const remoteTrackPromise = new Promise((resolve) => { pc2.ontrack = (e) => resolve(e.track); });

  const sender = pc1.addTrack(track, stream);
  setSpecificCodecPreference(pc1, codec);

  try {
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);
    await remoteTrackPromise;

    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxBitrate;
    await sender.setParameters(params).catch(() => {});

    await sleepMs(3000);

    const stats = await pc1.getStats();
    let outboundVideo = null;
    let actualCodec = null;
    stats.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') outboundVideo = r; });
    if (outboundVideo) {
      stats.forEach((r) => { if (r.type === 'codec' && r.id === outboundVideo.codecId) actualCodec = r.mimeType; });
    }

    if (!outboundVideo) return { ok: false, feasible: false };

    const achievedFps = outboundVideo.framesPerSecond || 0;
    const fpsRatio = targetFps > 0 ? achievedFps / targetFps : 0;
    const limitedByCpu = outboundVideo.qualityLimitationReason === 'cpu';
    const codecMatched = actualCodec === codec;

    let qpPercent = null;
    if (outboundVideo.qpSum != null && outboundVideo.framesEncoded > 0) {
      const avgQp = outboundVideo.qpSum / outboundVideo.framesEncoded;
      const qpMax = CODEC_QP_MAX[codec] || 63;
      qpPercent = Math.round((avgQp / qpMax) * 1000) / 10;
    }
    const bitrateStarved = qpPercent !== null && qpPercent > QP_STARVED_PERCENT;

    return {
      ok: true,
      achievedFps: Math.round(achievedFps * 10) / 10,
      fpsRatio: Math.round(fpsRatio * 100) / 100,
      qualityLimitationReason: outboundVideo.qualityLimitationReason || 'none',
      actualCodec,
      qpPercent,
      bitrateStarved,
      feasible: !limitedByCpu && fpsRatio >= 0.85 && codecMatched && !bitrateStarved,
    };
  } finally {
    stop();
    pc1.close();
    pc2.close();
  }
}

// Testa cada codec candidato numa resolucao fixa (1080p, o caso de uso
// mais comum) - isola so a variavel "codec", separado da escada de
// resolucao/fps. Fluidez e "bitrate suficiente" (QP normalizado, ver
// CODEC_QP_MAX) sao os dois pisos EMPIRICOS - desclassificam quem nao
// aguenta ou quem ta sendo claramente esganado pelo bitrate. Entre os que
// passam nos dois, a ordem de eficiencia de compressao estabelecida
// decide (CODEC_PRIORITY) - ver o comentario ali pra entender por que a
// decisao final usa isso em vez de tentar medir "quem parece mais nitido"
// com precisao.
async function testCodecs(onProgress) {
  const targetFps = 30;
  const results = {};
  for (const codec of CODEC_CANDIDATES) {
    if (onProgress) onProgress(`Testando codec ${codec.replace('video/', '')}...`);
    results[codec] = await testCodecQuality(codec, targetFps);
  }

  const feasible = CODEC_CANDIDATES.filter((c) => results[c] && results[c].feasible);
  let best = 'video/VP8'; // piso seguro: o mais leve de codificar, se nada mais passar
  if (feasible.length > 0) {
    best = CODEC_PRIORITY.find((c) => feasible.includes(c)) || feasible[0];
  } else {
    const anyOk = CODEC_CANDIDATES.filter((c) => results[c] && results[c].ok);
    if (anyOk.length > 0) best = anyOk.reduce((a, b) => (results[b].fpsRatio > results[a].fpsRatio ? b : a));
  }
  return { results, best };
}

// A partir dos resultados, escolhe a melhor qualidade que passou no teste
// de CPU E cujo bitrate cabe numa fracao segura da banda medida (deixa
// margem pra nao usar 100% do upload - sobra nada pra audio/overhead/
// variacao real da rede, e numa sala com mais gente compartilhando ao
// mesmo tempo precisa de folga tambem).
function recommendQuality(encodeResults, bandwidthMbps) {
  const bandwidthBps = bandwidthMbps > 0 ? bandwidthMbps * 1_000_000 * 0.7 : 0;
  let best = '720p30'; // piso seguro - quase qualquer PC/conexao aguenta
  for (const config of ENCODE_TEST_LADDER) {
    const result = encodeResults[config.key];
    if (result && result.feasible && config.maxBitrate <= bandwidthBps) {
      best = config.key;
    }
  }
  return best;
}

async function runQualityTest(serverUrl, onProgress) {
  const report = (msg) => { if (onProgress) onProgress(msg); };

  report('Medindo upload da sua internet...');
  const bandwidth = await measureUploadBandwidth(serverUrl);

  const codecTest = await testCodecs(report);

  const encodeResults = {};
  for (const config of ENCODE_TEST_LADDER) {
    report(`Testando ${config.key} (${codecTest.best.replace('video/', '')})...`);
    encodeResults[config.key] = await testEncodeConfig({ ...config, codec: codecTest.best });
  }

  const recommended = recommendQuality(encodeResults, bandwidth.ok ? bandwidth.mbps : 0);

  const profile = {
    testedAt: Date.now(),
    bandwidth,
    codecResults: codecTest.results,
    recommendedCodec: codecTest.best,
    encodeResults,
    recommendedQuality: recommended,
  };

  try {
    localStorage.setItem(QUALITY_TEST_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) { /* localStorage indisponivel - segue sem salvar */ }

  return profile;
}

function getSavedQualityProfile() {
  try {
    const raw = localStorage.getItem(QUALITY_TEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function wasQualityTestPrompted() {
  try {
    return localStorage.getItem(QUALITY_TEST_PROMPTED_KEY) === '1';
  } catch (err) {
    return true; // se nao da pra saber, nao fica insistindo
  }
}

function markQualityTestPrompted() {
  try { localStorage.setItem(QUALITY_TEST_PROMPTED_KEY, '1'); } catch (err) { /* ok */ }
}

// --- UI ---------------------------------------------------------------

const QUALITY_LABELS = {
  '720p30': '720p',
  '1080p30': '1080p a 30fps',
  '1080p60': '1080p a 60fps',
  '1440p30': '1440p (2K) a 30fps',
};

function formatQualitySummary(profile) {
  if (!profile) return 'Nunca testado.';
  const date = new Date(profile.testedAt);
  const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const bw = profile.bandwidth && profile.bandwidth.ok ? `${profile.bandwidth.mbps} Mbps de upload` : 'upload não medido';
  const rec = QUALITY_LABELS[profile.recommendedQuality] || profile.recommendedQuality;
  const codec = (profile.recommendedCodec || 'video/VP9').replace('video/', '');
  return `Testado em ${dateStr} - ${bw} - codec: ${codec} - qualidade: ${rec}`;
}

function renderQualityResults(container, profile) {
  container.innerHTML = '';

  const bwRow = document.createElement('div');
  bwRow.className = 'result-row';
  bwRow.innerHTML = `<span>Upload medido</span><span class="value">${profile.bandwidth.ok ? profile.bandwidth.mbps + ' Mbps' : 'falhou'}</span>`;
  container.appendChild(bwRow);

  if (profile.codecResults) {
    for (const codec of CODEC_CANDIDATES) {
      const r = profile.codecResults[codec];
      const isChosen = codec === profile.recommendedCodec;
      const row = document.createElement('div');
      row.className = 'result-row' + (isChosen ? ' pass' : '');
      const label = codec.replace('video/', '');
      let status;
      if (!r || !r.ok) status = 'erro no teste';
      else if (r.qualityLimitationReason === 'cpu') status = `travou (CPU fraca)`;
      else if (r.bitrateStarved) status = `${r.achievedFps}fps, mas comprimido demais pro bitrate testado`;
      else if (!r.feasible) status = `travou (${r.achievedFps}fps)`;
      else status = `${r.achievedFps}fps, uso do bitrate: ${r.qpPercent != null ? r.qpPercent + '%' : '?'}${isChosen ? ' - escolhido' : ''}`;
      row.innerHTML = `<span>Codec ${label}</span><span class="value">${status}</span>`;
      container.appendChild(row);
    }
    const codecRecRow = document.createElement('div');
    codecRecRow.className = 'recommended';
    codecRecRow.textContent = `Codec recomendado: ${(profile.recommendedCodec || 'video/VP9').replace('video/', '')} (o de melhor compressao entre os que rodaram fluidos e com bitrate suficiente)`;
    container.appendChild(codecRecRow);
  }

  const bandwidthBps = profile.bandwidth.ok ? profile.bandwidth.mbps * 1_000_000 * 0.7 : 0;
  for (const config of ENCODE_TEST_LADDER) {
    const r = profile.encodeResults[config.key];
    const fitsBandwidth = config.maxBitrate <= bandwidthBps;
    const isChosen = config.key === profile.recommendedQuality;
    const row = document.createElement('div');
    row.className = 'result-row' + (isChosen ? ' pass' : '');
    const label = QUALITY_LABELS[config.key] || config.key;
    let status;
    if (!r || !r.ok) status = 'erro no teste';
    else if (!r.feasible) status = `travou (${r.qualityLimitationReason === 'cpu' ? 'CPU fraca' : r.achievedFps + 'fps'})`;
    else if (!fitsBandwidth) status = `PC aguenta (${r.achievedFps}fps), mas passa da sua banda`;
    else status = `${r.achievedFps}fps${isChosen ? ' - escolhido' : ''}`;
    row.innerHTML = `<span>${label}</span><span class="value">${status}</span>`;
    container.appendChild(row);
  }

  const recRow = document.createElement('div');
  recRow.className = 'recommended';
  recRow.textContent = `Qualidade recomendada: ${QUALITY_LABELS[profile.recommendedQuality] || profile.recommendedQuality}`;
  container.appendChild(recRow);

  container.classList.remove('hidden');
}

function setupQualityTestUI() {
  const banner = document.getElementById('quality-test-banner');
  const btnRun = document.getElementById('btn-quality-test-run');
  const btnDismiss = document.getElementById('btn-quality-test-dismiss');
  const btnOpenFromSettings = document.getElementById('btn-quality-test-open');
  const summaryEl = document.getElementById('quality-test-summary');
  const overlay = document.getElementById('quality-test-overlay');
  const progressEl = document.getElementById('quality-test-progress');
  const resultsEl = document.getElementById('quality-test-results');
  const btnClose = document.getElementById('btn-quality-test-close');

  if (!banner) return; // index.html sem os elementos (nao deveria acontecer, mas nao trava o app)

  function refreshSummary() {
    if (summaryEl) summaryEl.textContent = formatQualitySummary(getSavedQualityProfile());
  }
  refreshSummary();

  // So mostra o banner de primeira vez se a pessoa nunca testou nem
  // dispensou antes - nunca insiste de novo sozinho depois disso.
  if (!wasQualityTestPrompted() && !getSavedQualityProfile()) {
    banner.classList.remove('hidden');
  }

  async function startTest() {
    banner.classList.add('hidden');
    markQualityTestPrompted();

    resultsEl.classList.add('hidden');
    btnClose.classList.add('hidden');
    progressEl.textContent = 'Preparando...';
    progressEl.classList.remove('hidden');
    overlay.classList.remove('hidden');

    const serverUrl = (document.getElementById('server-url').value || '').trim() || 'https://screenbunny.onrender.com';

    try {
      const profile = await runQualityTest(serverUrl, (msg) => { progressEl.textContent = msg; });
      progressEl.classList.add('hidden');
      renderQualityResults(resultsEl, profile);
      refreshSummary();
    } catch (err) {
      progressEl.textContent = 'Falha ao testar: ' + (err && err.message ? err.message : String(err));
    } finally {
      btnClose.classList.remove('hidden');
    }
  }

  btnRun.addEventListener('click', startTest);
  btnDismiss.addEventListener('click', () => {
    banner.classList.add('hidden');
    markQualityTestPrompted();
  });
  if (btnOpenFromSettings) btnOpenFromSettings.addEventListener('click', startTest);
  btnClose.addEventListener('click', () => overlay.classList.add('hidden'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupQualityTestUI);
} else {
  setupQualityTestUI();
}

})();
