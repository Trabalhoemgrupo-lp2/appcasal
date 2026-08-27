# Validação visual — 27/08/2026

A aba **Galeria** foi verificada em viewport móvel de 390×844 px. O cabeçalho, o Composer com “adicionar foto ou vídeo”, a área de destaque e o estado vazio cabem na tela sem overflow horizontal aparente.

A aba **Tempo** foi verificada no mesmo viewport. O contador mostra quatro cartões alinhados para dias, horas, minutos e segundos; o formulário de data e o botão de instalação permanecem acessíveis em largura móvel. Quando não há data configurada, as quatro unidades exibem “—”, como esperado.

A suíte local passou com 118 testes aprovados e 1 ignorado; o build de produção também passou. A validação com mídia real ainda depende de uma sessão autenticada e de arquivos no bucket privado.
