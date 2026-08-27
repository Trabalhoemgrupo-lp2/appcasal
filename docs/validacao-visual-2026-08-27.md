# Validação visual — 27/08/2026

A aba **Galeria** foi verificada em viewport móvel de 390×844 px. O cabeçalho, o Composer com “adicionar foto ou vídeo”, a área de destaque e o estado vazio cabem na tela sem overflow horizontal aparente.

A aba **Tempo** foi verificada no mesmo viewport. O contador mostra quatro cartões alinhados para dias, horas, minutos e segundos; o formulário de data e o botão de instalação permanecem acessíveis em largura móvel. Quando não há data configurada, as quatro unidades exibem “—”, como esperado.

A suíte local passou com 118 testes aprovados e 1 ignorado; o build de produção também passou. A validação com mídia real ainda depende de uma sessão autenticada e de arquivos no bucket privado.

A revisão móvel posterior confirmou a navegação da aba como **Galeria de vocês**, o Composer com “adicionar foto ou vídeo”, o estado vazio responsivo e o contador com quatro unidades. A grade real e o visualizador em tela cheia dependem de existirem mídias na conta autenticada; o código cobre miniaturas quadradas, troca por setas/teclado e ações de baixar/excluir.

A aba **Galeria de vocês** também foi verificada em viewport desktop de 1280×720 px. O cabeçalho, o Composer e o estado vazio ocupam a coluna principal sem quebrar o trilho lateral. A grade quadrada e o visualizador ficam disponíveis quando a conta autenticada tiver mídias reais.
