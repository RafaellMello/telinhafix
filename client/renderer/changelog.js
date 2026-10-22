// "Novidades" (aba nas configuracoes) - o que mudou em cada versao, da mais
// nova pra mais antiga. Ao lancar uma versao nova, adicionar a entrada dela
// no TOPO com a mesma "version" do package.json: e ela que faz a aba abrir
// sozinha na primeira vez que a pessoa abre o app depois de atualizar.
window.TELINHAFIX_CHANGELOG = [
  {
    version: '4.3.3',
    date: '21/10/2026',
    title: 'Site novo: telinhafix.site',
    items: [
      'O TelinhaFix tem endereço próprio: telinhafix.site.',
    ],
  },
  {
    version: '4.3.2',
    date: '21/10/2026',
    title: 'Botão do Discord leva pro site',
    items: [
      'O botão "Baixar o TelinhaFix" no seu card do Discord agora leva pro site do TelinhaFix (telinhafix.vercel.app).',
    ],
  },
  {
    version: '4.3.1',
    date: '21/10/2026',
    title: 'TelinhaFix no seu perfil do Discord',
    items: [
      'Com o Discord do computador aberto, seu perfil mostra o TelinhaFix como um jogo: na tela inicial, transmitindo, assistindo, ou "Jogando Codenames" com o placar da partida.',
      'Embaixo aparece a sala e quantas pessoas estão nela. Em Configurações > Transmissão dá pra esconder a sala (vira "Sala Privada"), esconder o número de pessoas ou desligar o status no Discord.',
    ],
  },
  {
    version: '4.3.0',
    date: '21/10/2026',
    title: 'Senha na sala, apontar na tela e Perfil',
    items: [
      'Senha da sala: o cadeado do lado do "Convidar" deixa quem abriu a sala pôr uma senha. Quem entrar depois (inclusive pelo convite) precisa digitar; quem já está dentro continua. A senha some quando todo mundo sai.',
      'Apontar na tela: segure Alt e clique num ponto da transmissão de tela de alguém - aparece uma seta com o seu nome pra todo mundo, e por cima do monitor de quem está transmitindo. Dá pra não permitir em Configurações > Transmissão.',
      'Perfil: o botão de gráfico agora abre o seu Perfil, com seus números no TelinhaFix e 12 conquistas em bronze, prata e ouro. Clicando no nome de alguém na lista, você vê o perfil dela. A retrospectiva fica num botão dentro do seu Perfil.',
    ],
  },
  {
    version: '4.2.0',
    date: '21/10/2026',
    title: 'Fundos animados novos',
    items: [
      'Seis fundos novos em Configurações > Aparência > Fundo animado: Fluid Particles, Pixels (o TELINHAFIX feito de pixels na sua cor principal), Aurora, Estática, Brasas e Ondas.',
      'Todos seguem a cor principal que você escolher. Pixels, Brasas e Ondas reagem ao mouse.',
      'O fundo "Feixe de luz" saiu - quem estava usando passou pro Brasas.',
    ],
  },
  {
    version: '4.1.2',
    date: '20/10/2026',
    title: 'Música do dia mais audível',
    items: [
      'A música do dia agora começa no volume 50% (antes 10%, que ficava baixo demais). Se você já tinha mexido no volume dela, continua o que você escolheu.',
    ],
  },
  {
    version: '4.1.1',
    date: '20/10/2026',
    title: 'Música do dia mais firme',
    items: [
      'Corrigido: às vezes a música do dia aparecia "Não deu pra carregar a música agora" ao abrir o app. Agora ele tenta de novo sozinho até conseguir (e ainda toca a música, se for a primeira vez no dia), com um botão "Tentar de novo".',
      'A tela inicial não mostra mais barras de rolagem.',
    ],
  },
  {
    version: '4.1.0',
    date: '20/10/2026',
    title: 'Música do dia',
    items: [
      'Novo card "Música do dia" na tela inicial: uma música por dia pra todo mundo, com capa e player. Ela toca sozinha baixinho só na primeira vez que você abre o app no dia; depois é só dar play.',
      'Vote na sua música: busque pelo nome, ouça o trecho e vote. Cada PC tem 3 votos por dia, cada voto põe a música na fila da música do dia (votar numa que já está na fila adianta ela).',
      'Todos os controles deslizantes do app (volumes dos sons, transparência da tela inicial) ganharam o mesmo visual do volume das transmissões.',
      'O "Apoie o Projeto do TelinhaFix" virou um card do lado direito da tela inicial.',
    ],
  },
  {
    version: '4.0.0',
    date: '20/10/2026',
    title: 'Big Update 4.0',
    items: [
      'Volta sozinho pra sala: se a sua internet piscar ou o servidor reiniciar, o app reconecta e te coloca de volta na call (e no seu lugar no Codenames). Um aviso no topo mostra quando está reconectando.',
      'Chat com memória: quem entra na sala vê as últimas 50 mensagens da conversa.',
      'Aviso do Windows quando alguém começa a transmitir a tela ou a câmera (só aparece se o TelinhaFix não estiver na sua frente). Dá pra desligar em Configurações > Sons.',
      'Print da live: novo botão de câmera em cima da transmissão de cada pessoa - copia a imagem, é só colar com Ctrl+V.',
      'Codenames: listas de palavras do pessoal. Clique em "+ Criar lista" no lobby, escreva as palavras e ela fica salva na sala pra próxima vez.',
      'Codenames: abrir o jogo com uma partida rolando mostra "Tem uma partida em andamento" - assistir com mapa, sem mapa, ou pegar uma vaga livre. Ninguém é mais colocado num time sozinho.',
      'Retrospectiva: o novo botão de gráfico no topo da sala mostra a sua semana ou o seu mês na sala (horas em call, quem mais ficou com você, transmissões, vitórias) num card pra copiar e mandar no grupo.',
      'Novo botão "Apoie o Projeto do TelinhaFix" na tela inicial: o Pix ajuda a ter um servidor próprio pra conexão das telas.',
    ],
  },
  {
    version: '3.9.0',
    date: '19/10/2026',
    title: 'Controle de volume novo',
    items: [
      'O controle de volume em cima da transmissão de cada pessoa foi redesenhado. Em Configurações > Sons você escolhe o visual: "Ícone que abre" (um botão que se abre mostrando uma linha fina) ou "Degraus" (barrinhas que sobem como um medidor de sinal, e pulsam quando a pessoa tem som tocando).',
      'A porcentagem mostrada é sempre exatamente o volume aplicado: até 100% em branco, acima disso (amplificando, até 200%) em âmbar.',
      'Rodinha do mouse ou setas do teclado ajustam de 5 em 5%, e duplo clique volta pra 100%.',
      'Quem você mutou fica com o controle sempre à vista (no "Ícone que abre", o botão fica vermelho).',
    ],
  },
  {
    version: '3.8.2',
    date: '19/10/2026',
    title: 'Dê uma sugestão ao dev',
    items: [
      'Novo botão "Dê uma sugestão ao dev" na tela de entrar, embaixo do "developed by": escreve seu nome e a sugestão e ela vai direto pro Bunny.',
    ],
  },
  {
    version: '3.7.3',
    date: '19/10/2026',
    title: 'Tela cheia da transmissão de volta',
    items: [
      'Corrigido: o botão de tela cheia de uma transmissão (e os 2 cliques no vídeo) não fazia nada.',
      'Esc sai da tela cheia da transmissão.',
    ],
  },
  {
    version: '3.7.2',
    date: '19/10/2026',
    title: 'Ocultar transmissão de verdade',
    items: [
      'Transmissão oculta (botão direito) continua oculta e sem som mesmo se a pessoa parar e voltar a transmitir - só volta quando você mandar mostrar.',
      'Com a transmissão oculta, o controle de volume continua clicável.',
    ],
  },
  {
    version: '3.7.1',
    date: '19/10/2026',
    title: 'Mudo da live que sempre funciona',
    items: [
      'Corrigido: depois de sair e entrar de novo numa sala (ou trocar de sala pelo convite), o mudo e o volume da live de alguém não faziam nada.',
      'Se você mutar alguém e essa pessoa parar e voltar a transmitir, ela continua mutada (e com o volume que você escolheu).',
      'O botão de mudo não fica mais "travado" enquanto o app silencia os outros pra evitar eco - o que você escolher vale quando parar de compartilhar.',
    ],
  },
  {
    version: '3.7.0',
    date: '17/10/2026',
    title: 'Codenames: palavras de Counter-Strike e Espectadores',
    items: [
      'Nova escolha de "Palavras" no lobby do Codenames: Normal ou Counter-Strike (armas, mapas, gírias, patentes, jogadores e callouts da Mirage).',
      'Novo "time" Espectadores no lobby do Codenames, pra quem só quer assistir.',
      'O espectador escolhe assistir com mapa (vê a cor de todas as cartas, como os mestres-espiões) ou sem mapa - e pode trocar no meio da partida.',
      'Espectadores ficam de fora do "Sortear times" e só entram num time pelo lobby.',
    ],
  },
  {
    version: '3.6.3',
    date: '17/10/2026',
    title: 'Ajustes visuais',
    items: [
      'Nomes dos minijogos em branco, mais fáceis de ler.',
      'Nas configurações, só a aba selecionada fica em branco - as outras ficam em cinza.',
    ],
  },
  {
    version: '3.6.2',
    date: '16/10/2026',
    title: 'Convite entra direto na sala',
    items: [
      'Abrir um link de convite agora já entra na sala - não precisa mais clicar em Entrar (se for a primeira vez no app, ele só pede seu nome antes).',
    ],
  },
  {
    version: '3.6.1',
    date: '16/10/2026',
    title: 'Convites que funcionam sempre',
    items: [
      'O botão "Convidar" agora copia um link normal (https) que fica clicável no Discord e no WhatsApp: ele abre o TelinhaFix já na sala, e quem ainda não tem o app vê o botão de baixar.',
      'Corrigido: abrir um link de convite às vezes jogava a pessoa sozinha numa sala com uma "/" no fim do nome.',
      'O código da sala não diferencia mais maiúsculas de minúsculas: "Paygorn" e "paygorn" são a mesma sala.',
      'Clicar num convite estando em outra sala agora mostra um aviso com o botão "Entrar" (antes não acontecia nada).',
    ],
  },
  {
    version: '3.6.0',
    date: '16/10/2026',
    title: 'Ouvir os outros enquanto compartilha',
    items: [
      'Agora dá pra ouvir a tela dos seus amigos enquanto você também está compartilhando a sua - antes o app mutava todo mundo pra evitar eco.',
      'O áudio do sistema que você transmite deixa de fora o próprio TelinhaFix (e o Discord), então quem te assiste não ouve eco da própria tela.',
      'Corrigido: quem começava a compartilhar depois de outra pessoa ficava sem o limite de qualidade de vídeo escolhido.',
    ],
  },
  {
    version: '3.5.9',
    date: '16/10/2026',
    title: 'Conexão para todo mundo e mais segurança',
    items: [
      'Quem não conseguia ver a tela de alguém (internet com CGNAT, firewall, 4G) agora conecta: quando a ligação direta não fecha, o vídeo passa por um servidor intermediário (TURN).',
      'Na lista de participantes aparece "via servidor" quando a conexão com alguém está passando pelo intermediário, e "sem conexão" quando não deu para ligar.',
      'Nome e código da sala agora têm no máximo 20 caracteres.',
      'O servidor ficou mais protegido contra abuso: limita ações em excesso e só deixa a conexão de vídeo acontecer entre quem está na mesma sala.',
    ],
  },
  {
    version: '3.5.8',
    date: '16/10/2026',
    title: 'Aviso de atualização mais rápido',
    items: [
      'Com o app aberto, ele confere se saiu versão nova a cada 1 minuto: o botão "Procurar atualizações" começa a piscar quase na hora.',
    ],
  },
  {
    version: '3.5.7',
    date: '16/10/2026',
    title: 'Tema dos agentes no Codenames',
    items: [
      'Nova opção "Tema dos agentes" no lobby do Codenames: "Lata de lixo" mostra as fotos da galera nas cartas viradas (como antes) e "Normal" mostra só a cor do time com a palavra.',
    ],
  },
  {
    version: '3.5.6',
    date: '16/10/2026',
    title: 'Senha automática e atualização sem susto',
    items: [
      'A senha global agora já vem preenchida no app: é só colocar seu nome e a sala e entrar.',
      'O app não reinicia mais sozinho pra atualizar: quando você abre, ele avisa da versão nova e pergunta se quer reiniciar agora ou depois.',
      'Quando sair versão nova com o app aberto, o botão "Procurar atualizações" da tela inicial fica piscando.',
      'Avisos importantes (tipo "vou reiniciar o servidor") agora aparecem numa faixa no topo da tela.',
    ],
  },
  {
    version: '3.5.5',
    date: '14/10/2026',
    title: 'Aba de Novidades',
    items: [
      'Nova aba "Novidades" nas configurações: mostra o que mudou em cada versão.',
      'Depois de cada atualização, o app abre ela sozinho na primeira vez pra você ver o que chegou.',
    ],
  },
  {
    version: '3.5.4',
    date: '14/10/2026',
    title: 'Codenames: marcas, histórico e comemoração',
    items: [
      '2x2x2 agora tem 37 cartas: 9 do time que começa, 8 de cada um dos outros, 9 neutras e 3 assassinos.',
      'Quando um agente aponta uma carta, o time todo vê as iniciais dele nela.',
      'Cada time tem o histórico das suas pistas, com quantas palavras foram achadas em cada uma.',
      '"O que os mestres quiseram dizer": o mestre-espião pode marcar em segredo as cartas que tinha em mente, e o fim da partida mostra tudo.',
      'Sons de acerto, erro, assassino e troca de vez.',
      'Revelou o assassino? A tela treme e aparece a caveira. No fim, confete e letreiro de vitória na cor do time.',
      'Botão "Sortear times" pro anfitrião: distribui todo mundo da sala nos times.',
    ],
  },
  {
    version: '3.5.3',
    date: '14/10/2026',
    title: 'Correção no Codenames',
    items: [
      'Corrigido: na segunda partida, o mestre-espião via as cores da partida anterior.',
    ],
  },
  {
    version: '3.5.2',
    date: '14/10/2026',
    title: 'Fotos nas cartas e atualização automática',
    items: [
      'Carta revelada mostra uma foto da galera com a cor da carta por cima. Clique nela pra ver a palavra.',
      'Cartas no formato do jogo oficial.',
      'Fundo do tabuleiro preto ou branco, direto na tela do jogo.',
      'Mestre-espião também tem 1min30 pra dar a pista, com aviso grande de "Tempo esgotado".',
      'Time que fica desfalcado tem a vez pulada (o jogo não trava mais), e quem cai e volta com o mesmo nome volta pro mesmo lugar.',
      'Só agentes passam a vez; no fim do jogo todas as cartas mostram a cor.',
      'O TelinhaFix agora se atualiza sozinho quando sai versão nova.',
    ],
  },
  {
    version: '3.5.1',
    date: '14/10/2026',
    title: 'Câmera no Codenames',
    items: [
      'Botão "Ligar câmera" dentro do Codenames: sua câmera aparece no lugar do seu avatar na coluna do time.',
    ],
  },
  {
    version: '3.5.0',
    date: '14/10/2026',
    title: 'Codenames de cara nova',
    items: [
      'Novo layout com as colunas dos times nas laterais do tabuleiro, e o jogo abre em tela cheia.',
      'Clicar numa palavra só seleciona: precisa confirmar pra revelar.',
      'Modo "2x2x2 Todos contra todos".',
      'Só quem abriu o lobby inicia ou encerra a partida.',
      'Mais de 1000 palavras com acento, sorteadas de novo a cada partida.',
      'Botão "Procurar atualizações" na tela de login.',
      'Câmeras aparecem espelhadas pra todo mundo.',
    ],
  },
];
