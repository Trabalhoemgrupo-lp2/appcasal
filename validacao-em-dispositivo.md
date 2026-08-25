# Validação em dispositivo real — Caderno de Dois

## Objetivo

Este roteiro cobre as validações que não podem ser reproduzidas integralmente em prévia ou testes automatizados: identidade real, permissões do sistema, links recebidos por e-mail, notificações persistentes e dados privados do casal. Realize os passos na versão pública `https://appcasal-kzzvckwa.manus.space` e não envie senhas, códigos de confirmação, tokens ou capturas que revelem informações sensíveis.

| Ordem | Validação | Procedimento | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Confirmação de e-mail | Cadastre um e-mail novo, abra a mensagem recebida no celular e use o link de confirmação. | O navegador retorna ao domínio público do Caderno, a sessão é reconhecida e não há referência a `localhost`. |
| 2 | Dados privados | Entre na conta confirmada, percorra Início, Chat, Momentos, Planos, Tempo, Música, A dois, Localização, Leituras e Filmes. | As áreas carregam sem o aviso global de indisponibilidade; uma falha opcional, se ocorrer, fica isolada à própria área. |
| 3 | Localização | Primeiro recuse a permissão; depois permita, verifique a atualização e use a ação de pausa. | A recusa não bloqueia o app; após aceitar, o status muda; a pausa encerra o compartilhamento. |
| 4 | Aparência | Em Início, Música e Localização, teste Claro, Noturno e Automático nas cores Hibisco, Ameixa e Sálvia. | A superfície inteira muda de modo, textos e controles preservam leitura, e os cartões não ficam brancos no modo noturno. |
| 5 | Spotify | Em Música, selecione **Entrar no Spotify**, conclua a autorização na conta Spotify e permita o retorno. | O retorno ocorre no domínio público do Caderno e a Sala passa a indicar que a conta foi vinculada, sem expor token ou senha. |
| 6 | Playlist privada | Depois de vincular o Spotify, selecione **Criar nossa playlist**, confirme o nome sugerido ou informe outro e conclua a autorização de escrita quando solicitada. | O Spotify cria uma playlist privada na conta conectada e a abre. O Caderno não mostra, registra ou compartilha o token da conta. |
| 7 | Navegação e conta | Com a conta real, role o menu lateral ou móvel até o fim, saia da conta, entre novamente e teste a exclusão somente se for uma conta descartável. | Todos os itens de menu são alcançáveis; sair limpa a sessão local; a exclusão exige digitar `EXCLUIR`, remove a conta e permite reutilizar o e-mail em novo cadastro. |
| 8 | Web Push | Instale o PWA quando o sistema oferecer essa opção, permita notificações, agende um lembrete de música para alguns minutos à frente e feche o app. | O lembrete chega ao dispositivo inscrito. Em iPhone/iPad, a instalação na tela inicial normalmente é necessária para receber Web Push. |

## Como registrar o resultado

Após cada linha, basta responder neste chat com **“validado”**, **“falhou”** ou **“não disponível”** e informar a etapa. Caso algo falhe, descreva o texto exibido e o modelo/navegador do dispositivo, sem compartilhar informações de conta. Uma captura pode ajudar apenas se ocultar e-mail, nomes, códigos de convite, fotos privadas, localização e notificações pessoais.

> A exclusão de conta deve ser usada somente com uma conta de teste. Ela é definitiva e remove o histórico privado dessa identidade.

## Situação já confirmada tecnicamente

O aplicativo já possui validação automatizada, verificação de tipos e build de produção aprovados. A configuração Spotify está habilitada com vinculação manual de identidades; a Sala Spotify foi revisada em desktop e celular, e o modo noturno recebeu superfícies próprias para evitar os blocos claros observados anteriormente. As validações deste roteiro existem para confirmar o que depende do serviço de e-mail, da conta Spotify, da permissão do aparelho e do sistema de notificações.

> **Atualização da versão 5fb3501e:** antes das etapas Spotify, feche e reabra o site ou atualize completamente a página. Depois da autorização, o Caderno identifica o marcador seguro de retorno, renova a sessão e consulta novamente as identidades vinculadas antes de exibir o estado conectado. A criação de playlist usa uma autorização de escrita exclusiva da conta conectada, cria apenas playlists privadas e abre somente um endereço validado de `open.spotify.com`.
