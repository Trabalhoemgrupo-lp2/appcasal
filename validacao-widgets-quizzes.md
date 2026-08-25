# Validação visual — Widgets, quizzes e conexão Spotify

## Prévia verificada

Em 19 de agosto de 2026, a prévia em `?preview=1` apresentou a aba **A dois** com a abertura editorial “Um pedacinho de vocês na tela”, cartões para dias juntos, bateria voluntária e clima por cidade, seguidos por três conjuntos de quizzes. A composição permaneceu responsiva no viewport desktop, com os cartões em uma grade legível e a navegação lateral preservada.

Uma resposta de demonstração foi selecionada no primeiro quiz. A interface confirmou a ação e trocou o estado da pergunta para “Sua resposta está lacrada até a outra pessoa escolher”, sem revelar qualquer resposta de par na prévia.

Na aba **Música**, o cartão “Sua conta Spotify” apareceu antes da criação da sala. Em modo prévia, o botão permanece deliberadamente indisponível e a interface esclarece que a vinculação exige uma conta real e o provedor Spotify habilitado no Supabase. A cópia afirma que a conexão é individual e que senha, token e biblioteca não são compartilhados.

## Validações técnicas

| Verificação | Resultado |
| --- | --- |
| Vitest | 4 arquivos e 9 testes aprovados |
| TypeScript | Sem erros com `tsc --noEmit` |
| Build de produção | Concluído com sucesso |
| Console após a prévia | Sem erro de ciclo de vida detectado |

> A ativação com dados reais depende de executar as migrations 0001–0011 e habilitar o provedor Spotify no projeto Supabase. O lembrete com o navegador fechado continua dependente da configuração Push documentada separadamente.
