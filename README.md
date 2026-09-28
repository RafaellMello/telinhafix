# MeuDiscordLocal

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
   `https://meudiscordlocal.onrender.com`. E esse endereco que vai no campo
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

Isso gera um arquivo `MeuDiscordLocal.exe` portatil dentro da pasta `dist/`.
Basta mandar esse .exe pros seus amigos — eles baixam, clicam duas vezes, e
o app abre direto (sem instalacao).

## 4. Como usar

1. Abra o app.
2. Preencha o endereco do servidor (o do Render), a senha combinada (se
   configurou uma), seu nome e um codigo de sala (qualquer palavra, todo
   mundo usa o mesmo codigo pra cair na mesma "sala").
3. Clique em **Entrar**.
4. Quem for compartilhar clica em **Compartilhar tela** — vai abrir o
   seletor de tela do proprio Windows, onde da pra escolher qual monitor (ou
   janela) transmitir e marcar a opcao de incluir o audio do sistema.
5. Todo mundo que estiver na sala ve o video automaticamente.

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
