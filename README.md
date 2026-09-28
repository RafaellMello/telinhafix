# TelinhaFix

App caseiro pra compartilhar tela com os amigos pela internet, sem passar pelo Discord. Vídeo e áudio vão direto de um PC pro outro (WebRTC) — só um servidorzinho leve ajuda todo mundo a se achar. Zero custo.

`server/` é esse servidorzinho (Node), roda de graça no Render. `client/` é o app em si (Electron), que vira o .exe pros amigos.

## Subindo o servidor

Cria conta grátis no Render, conecta esse repo, Root Directory `server`, build `npm install`, start `npm start`, plano Free. Bota uma senha na variável `APP_PASSWORD` pra ninguém de fora usar o servidor à toa. No fim ele te dá uma URL tipo `https://telinhafix.onrender.com`, que vai no campo "Endereço do servidor" do app.

No plano grátis o servidor dorme depois de um tempo parado e demora uns 30-50s pra acordar na primeira conexão do dia. Normal.

## Rodando e gerando o app

Dentro de `client/`: `npm install` e `npm start` pra testar. Pra gerar o de verdade: `npm run dist`, que produz um `.zip` — manda esse arquivo pros amigos, eles extraem uma vez e usam o `.exe` de dentro. (O formato "portable" de um `.exe` só parecia mais prático, mas ele se autoextraía toda vez que abria e travava uns 5-6s à toa; o `.zip` abre na hora.)

## Usando

Preenche servidor, senha, nome e um código de sala (igual pra todo mundo), clica em Entrar. Quem for compartilhar clica em Compartilhar tela — escolhe tela inteira ou uma janela específica, a qualidade (até 1080p60) e a fonte de áudio (sistema sem o Discord, sistema todo, ou só de um programa). Também dá pra ligar a webcam, que fica como uma bolinha no canto.

Quem assiste ajusta o volume de cada stream separado, dá tela cheia, destaca num Picture-in-Picture, ou foca um stream só. Cada vídeo mostra um indicador de qualidade da conexão.

## Áudio por processo

O filtro de áudio (excluir só o Discord, ou pegar só um programa) usa um helper nativo (`client/native-audio/`) que fala direto com a API de áudio do Windows — precisa do Windows 10 2004 ou mais novo, e se não der certo cai pro áudio do sistema todo sem travar nada. Pra compilar esse helper precisa do .NET SDK 9 e rodar `npm run build:native`; ele não vai pro Git (passa do limite de tamanho), o `npm run dist` empacota ele automaticamente.

## Limitações

A conexão é direta entre todo mundo (mesh), então funciona bem até uns 5-6 pessoas — com mais gente, quem compartilha precisa de bastante upload. Não tem microfone nem chat de voz, só tela e o áudio de quem compartilha. Em rede muito fechada a conexão direta pode falhar de vez em quando; se acontecer com frequência dá pra configurar um servidor TURN.
