# ScreenBunny

App proprio, sem custo, para voce e seus amigos compartilharem tela (com audio
do sistema) pela internet — sem depender do Discord.

Como funciona:
- Um servidorzinho ("sinalizacao") so ajuda os PCs de voces a se encontrarem.
  Ele **nao** carrega video/audio, entao roda de graca tranquilamente.
- O video e audio da tela compartilhada vai **direto** de um PC pro outro
  (WebRTC, peer-to-peer), sem passar por nenhum servidor pago.
- O app dos seus amigos e um .exe unico (Electron) — baixa e executa, sem
  instalador.

Estrutura:
- `server/` — servidor de sinalizacao (Node.js). Sobe de graca no Render.
- `client/` — o app que vira o .exe (Electron).

---

## 1. Subir o servidor de sinalizacao (gratis, no Render)

1. Crie uma conta gratuita em https://render.com (da pra usar login do GitHub).
2. Suba a pasta `server/` para um repositorio no GitHub (pode ser privado).
3. No Render: **New +** -> **Web Service** -> conecte o repositorio.
4. Configuracoes:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. (Recomendado) Em **Environment**, adicione a variavel `APP_PASSWORD` com
   uma senha qualquer, so pra impedir que estranhos usem seu servidor caso
   descubram o endereco. Combine essa senha com seus amigos.
6. Depois do deploy, o Render te da uma URL tipo
   `https://screenbunny.onrender.com`. E esse endereco que vai no campo
   "Endereco do servidor" do app.

> Observacao: no plano gratis do Render, o servidor "dorme" depois de um
> tempo sem uso e demora uns 30-50s pra acordar na primeira conexao do dia.
> Isso e normal e nao custa nada.

## 2. Rodar o app em modo desenvolvimento (para testar)

Dentro de `client/`:

```
npm install
npm start
```

Abra duas instancias (voce e um "amigo" de teste) apontando para o mesmo
servidor e mesma sala pra validar o compartilhamento de tela antes de gerar
o .exe final.

## 3. Gerar o .exe para distribuir aos amigos

Dentro de `client/`:

```
npm run dist
```

Isso gera um arquivo `ScreenBunny.exe` portatil dentro da pasta `dist/`.
Basta mandar esse .exe pros seus amigos — eles baixam, clicam duas vezes, e
o app abre direto (sem instalacao).

## 4. Como usar

1. Abra o app.
2. Preencha o endereco do servidor (o do Render), a senha combinada (se
   configurou uma), seu nome e um codigo de sala (qualquer palavra, todo
   mundo usa o mesmo codigo pra cair na mesma "sala").
3. Clique em **Entrar**.
4. Quem for compartilhar clica em **Compartilhar tela** — abre um seletor
   proprio do app onde da pra escolher: tela inteira ou janela de um
   programa especifico (um jogo, o navegador, etc.), a qualidade
   (720p/1080p, 30 ou 60fps) e a fonte do audio (sistema sem o Discord,
   sistema todo, ou so de um programa especifico).
5. Todo mundo que estiver na sala ve o video automaticamente. Cada pessoa
   pode ajustar o volume de cada stream individualmente (so afeta o que ela
   ouve), dar 2 cliques (ou usar o botao) pra ver em tela cheia, destacar
   numa janela flutuante (Picture-in-Picture) pra acompanhar enquanto usa
   outro programa, ou focar um stream encolhendo os outros. Cada tile mostra
   um indicador colorido de qualidade da conexao, e quem compartilha ve
   quantas pessoas estao na sala.

## Audio: controle fino sobre o que vai na transmissao

Pra isso o app usa um helper nativo do Windows (`client/native-audio/`, vira
`ScreenBunnyAudioHelper.exe`) que captura audio por processo via
`ActivateAudioInterfaceAsync` (biblioteca [NAudio](https://github.com/naudio/NAudio)).
No seletor de "Compartilhar tela" da pra escolher entre 3 modos:
- **Sistema, sem o Discord** (padrao) — ouve a call do Discord normalmente,
  mas esse audio nao vaza pra transmissao (`ProcessLoopbackMode.ExcludeTargetProcessTree`).
- **Sistema todo** — sem filtro nenhum.
- **So um programa** — captura *somente* o audio de um processo especifico
  (ex: so o audio de um jogo, sem Spotify/notificacoes/etc.), usando o mesmo
  mecanismo em modo `IncludeTargetProcessTree`. A lista de programas vem de
  `Get-Process` (processos com janela visivel).

Requisitos e limitacoes dessa parte:
- Precisa do **Windows 10 versao 2004 (build 19041) ou mais novo** — a API
  de exclusao por processo nao existe em versoes mais antigas. Se a
  ativacao falhar, o app cai para so compartilhar a tela sem audio (nao
  trava).
- Se o programa alvo (Discord, ou o que voce escolheu no modo "so um
  programa") nao estiver aberto no momento do compartilhamento, o filtro nao
  tem o que fazer e o helper captura o audio do sistema todo normalmente.
- O filtro mira o processo que ja esta aberto quando voce clica em
  "Compartilhar tela". Se voce fechar e abrir esse programa de novo
  **durante** a transmissao, reinicie o compartilhamento pra pegar o novo
  processo.
- Para compilar esse helper voce precisa do **[.NET SDK 9](https://dotnet.microsoft.com/download)**
  instalado (gratuito). O binario final (~140MB, self-contained) ja fica
  pronto em `client/native/ScreenBunnyAudioHelper.exe` apos rodar, dentro de
  `client/`:
  ```
  npm run build:native
  ```
  Esse `.exe` nao vai pro Git (passa do limite de tamanho do GitHub) — ele e
  gerado localmente e o `npm run dist` empacota ele dentro do
  `ScreenBunny.exe` final automaticamente.

## Limitacoes a saber

- **Numero de pessoas**: a conexao e peer-to-peer (mesh) entre todos da
  sala. Funciona bem para grupos pequenos (ate uns 5-6 amigos). Com muita
  gente, quem esta compartilhando a tela precisa de mais upload de internet,
  porque o video sai da maquina dele uma vez pra cada pessoa assistindo.
- **Audio do sistema**: a captura pega o audio geral do PC de quem
  compartilha (nao tem microfone/chat de voz entre os participantes nessa
  versao — so a tela + audio de quem compartilha).
- **Firewall/rede**: na grande maioria dos casos o WebRTC atravessa o
  roteador sozinho (usando um servidor STUN publico do Google, que so ajuda
  a achar o caminho, sem custo). Em redes muito restritas raramente pode
  falhar a conexao direta — se isso acontecer bastante, o proximo passo
  seria adicionar um servidor TURN gratuito (posso te ajudar a configurar
  se precisar).
