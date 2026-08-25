# Revisão visual — localização e organização das telas

## Escopo validado

A prévia do Caderno de Dois foi revisada em desktop e em tela móvel, com foco em manter uma leitura **moderna, calma e acessível**. A aba **Mapa afetivo** agora é renderizada diretamente na área principal, sem depender de painel flutuante, e apresenta a ação de compartilhamento, o estado do casal, os lembretes de proximidade e os lugares guardados em uma sequência única.

As telas de Início, Chat, Planos e Música mantêm a hierarquia editorial: título curto no topo, uma área principal de tarefa e um trilho de contexto discreto. A revisão também revelou que a aba **A dois** dependia de uma montagem por portal e podia aparecer vazia durante a troca de abas; ela foi migrada para a mesma renderização direta do Mapa. Na área de quizzes, três colunas muito estreitas foram substituídas por duas colunas mais largas, com o último cartão ocupando a largura disponível, para preservar a leitura das perguntas e opções.

## Critérios de interface verificados

| Critério | Evidência na implementação |
| --- | --- |
| Hierarquia visual | Cada tela prioriza um título, uma ação principal e conteúdo relacionado, evitando sobreposição de painéis. |
| Leitura serena | Fundo em papel quente, contrastes suaves, espaçamento entre cartões e textos auxiliares curtos. |
| Acessibilidade de navegação | Navegação com rótulos textuais, `aria-current` para a aba ativa e botões nativos para ações. |
| Localização privada | Ação explícita para pausar; a abertura automática depende de autorização do dispositivo e não registra trajetos. |
| Responsividade | Aba Mapa revisada em viewport móvel de 375×812 e desktop de 1280×720. |
| Densidade de quizzes | Aba A dois revisada em desktop após ampliar os cartões e reduzir a grade de três para duas colunas. |

## Checklist objetivo por aba

| Aba | Hierarquia principal | Controles e acessibilidade verificados |
| --- | --- | --- |
| Início | Abertura editorial, memória do dia e ação de guardar memória. | Botões nativos para foto e envio; conteúdo privado apresentado em sequência. |
| Chat | Cabeçalho da conversa, histórico e campo de mensagem. | Botão de envio com rótulo acessível; campo preserva foco e uso por teclado. |
| Planos | Capítulo de abertura, calendário e criação de data. | Datas e conclusão de plano utilizam controles acionáveis com estado textual. |
| Música | Introdução, conexão opcional e sala privada. | Ações de conexão, criação e cópia são botões com texto visível. |
| A dois | Resumo de dias, bateria/clima opt-in e quizzes. | Cartões de quiz ampliados; alternativas usam botões e `aria-pressed`. |
| Mapa | Compartilhamento, estado do par, proximidade e lugares. | Ação de pausa/início visível; edição e remoção de lugares possuem `aria-label`. |
| Navegação | Trilho em desktop e barra inferior em telas menores. | Aba atual marcada com `aria-current="page"`; ações usam botões nativos. |

## Validação restante em dispositivo físico

Ainda é necessário testar no dispositivo real a autorização, a recusa e a revogação da permissão de geolocalização, pois navegadores móveis podem variar no modo como expõem esse diálogo.
