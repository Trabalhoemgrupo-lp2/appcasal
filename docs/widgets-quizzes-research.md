# Widgets e quizzes — decisão de produto

## Princípios de privacidade

Os widgets do Caderno de Dois são **opt-in e compartilhados apenas entre integrantes do mesmo casal**. O cartão de bateria será um retrato enviado por ação consciente da pessoa usuária; ele não acompanha o dispositivo em segundo plano, não registra histórico de carga e pode ser substituído a qualquer momento. A API de bateria depende de HTTPS e tem disponibilidade limitada entre navegadores, portanto o aplicativo deve tratar sua ausência como um estado esperado, sem degradar a experiência. [1]

O clima será configurado pela cidade que o casal escolher escrever. O app não solicitará geolocalização para esse propósito. Serão persistidos somente o nome da cidade, as coordenadas aproximadas retornadas pela busca, a condição atual e o momento da atualização — todos sob RLS por casal. A API pública escolhida aceita latitude e longitude e devolve variáveis de condições atuais, como temperatura e código meteorológico. [2]

| Widget | Ação da pessoa usuária | Dados compartilhados | O que não será coletado |
|---|---|---|---|
| Dias juntos | Informar a data de início já existente nos rituais | Total de dias | Localização e atividade no dispositivo |
| Bateria | Tocar em “compartilhar agora” | Percentual arredondado, estado de carga e hora | Histórico, identificador do aparelho e atualização contínua |
| Clima | Informar uma cidade para o casal | Cidade escolhida, condição e hora | Localização precisa do aparelho |

## Formato dos quizzes

Os quizzes serão pequenos jogos privados, com respostas individuais. A resposta fica guardada somente no casal e será revelada quando as duas pessoas responderem à mesma pergunta. A primeira versão terá três blocos: **nossa próxima aventura**, **memórias que dão risada** e **rituais que combinam**, totalizando nove perguntas de múltipla escolha. Nenhum dado de quiz será público ou usado como avaliação de pessoas.

## Referências

1. [MDN — Battery Status API](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API)
2. [Open-Meteo — Weather Forecast API](https://open-meteo.com/en/docs)
