// "Novidades" (aba nas configuracoes) - o que mudou em cada versao, da mais
// nova pra mais antiga. Ao lancar uma versao nova, adicionar a entrada dela
// no TOPO com a mesma "version" do package.json: e ela que faz a aba abrir
// sozinha na primeira vez que a pessoa abre o app depois de atualizar.
window.TELINHAFIX_CHANGELOG = [
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
