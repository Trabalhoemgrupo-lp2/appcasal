# Validação visual do projeto permanente

A prévia do projeto `appcasal-permanente` foi capturada em viewport móvel de 390×844 para `/` e `/?preview=1&tab=localizacao`.

A tela de entrada mantém o logotipo appCasal, o formulário de autenticação e o CTA legível sem overflow horizontal. A tela de localização mantém a navegação inferior, o cartão de compartilhamento e o resumo do círculo em composição mobile-first. Não foi observada quebra visual nas capturas realizadas.

A validação automatizada também confirmou TypeScript sem erros, 115 testes aprovados e um teste externo de Spotify omitido por ser opt-in. O build Vite/esbuild de produção foi concluído com sucesso; permanece um aviso de chunk JavaScript grande, sem falha de compilação.

Ainda é necessária a validação manual da URL publicada, incluindo registro/instalação do PWA e testes entre dois dispositivos.

A captura adicional em viewport desktop de 1280×720 confirmou que a tela de entrada mantém a divisão editorial entre formulário e painel visual, com conteúdo legível e sem overflow horizontal.

A captura desktop de 1280×720 para `/?preview=1&tab=localizacao` confirmou a navegação lateral, o cabeçalho Mapa afetivo, o cartão de compartilhamento ao vivo, o resumo do círculo e o início da área do mapa sem regressões de layout ou overflow horizontal.
