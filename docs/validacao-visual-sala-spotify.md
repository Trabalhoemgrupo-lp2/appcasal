# Validação visual — Sala Spotify

Revisado em 19 de agosto de 2026 no modo de prévia local (`?preview=1`). A sala foi criada com o título **“Nossa noite de sexta”** e exibiu corretamente o convite por QR, o campo de link do Spotify Jam, as ações de abrir/copiar/encerrar e a mensagem de privacidade.

Os cartões de **capa privada** e **próxima escuta** foram renderizados logo após a abertura da sala, com um seletor restrito a imagens e o aviso de que a entrega com a aba fechada depende da configuração de notificações. A área de fila afetiva ficou disponível para inclusão de faixas e é o local em que as reações por emoji aparecem depois de haver ao menos uma música.

Uma faixa de demonstração foi incluída na fila durante a revisão. O cartão de **reações na fila** foi exibido com os seis controles `❤️`, `🥹`, `✨`, `🫶`, `🔥` e `🎶`, cada qual associado de maneira acessível ao título da faixa. A faixa, o artista, o bilhete e a contagem da fila também foram exibidos sem perda de hierarquia visual.

Não foram observados cortes, sobreposições ou contraste insuficiente no desktop durante a revisão. A ativação em dados reais continua condicionada à execução manual das migrations 0001–0010 no projeto Supabase do casal.

Após a correção do ciclo de vida dos painéis auxiliares, a prévia foi recarregada normalmente no navegador. A tela inicial voltou a exibir a navegação, o caderno e os atalhos sem falha visível de montagem.

Os painéis auxiliares agora são hospedados por um portal dentro da mesma árvore React. Depois dessa migração, uma nova recarga da prévia exibiu normalmente os atalhos globais e a composição principal, sem criar uma raiz React paralela.
