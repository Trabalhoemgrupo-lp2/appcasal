# Segurança e privacidade — appCasal

O **Caderno de Dois** foi desenhado para compartilhar dados íntimos somente entre as duas pessoas vinculadas ao mesmo casal. Este documento registra os controles implementados e também deixa explícitos os limites que cada pessoa deve conhecer ao usar serviços externos.

> Este documento descreve controles técnicos do produto; ele não substitui uma auditoria independente, análise jurídica ou certificação de segurança.

## Princípios adotados

| Princípio | Aplicação no app |
| --- | --- |
| **Privado por padrão** | Dados persistentes são associados ao casal e protegidos por políticas RLS do Supabase. |
| **Consentimento explícito** | Localização, bateria, notificações Web e conexão Spotify são ativados voluntariamente. |
| **Minimização** | O lembrete Web Push envia apenas o texto necessário; identificadores internos do casal não são incluídos no payload. |
| **Revogação** | Pausar localização remove a posição atual; sair da conta limpa preferências locais de proximidade e encerra rastreadores em execução. |
| **Segredos fora do navegador** | A chave `service_role` do Supabase e a chave VAPID privada ficam somente no servidor. |

## Proteções técnicas

| Área | Controle implementado |
| --- | --- |
| Banco de dados | RLS por pessoa e por casal nas tabelas de conteúdo, localização, Sala Spotify, widgets, quizzes e inscrições Web Push. |
| Arquivos privados | Fotos de memórias, avatares e capas musicais usam buckets privados com políticas baseadas na pessoa autenticada e no vínculo do casal. |
| Localização | Compartilhamento é opt-in, não armazena histórico de trajetos e apaga a posição atual ao pausar. |
| Notificações Web | Inscrições são privadas por dispositivo; endpoints inválidos são revogados e o emissor usa reserva temporária para evitar notificações duplicadas. |
| Agendador | A rota de lembretes aceita apenas chamadas autenticadas do trabalho recorrente; erros devolvem uma resposta genérica sem detalhes internos. |
| Logs do navegador | Detalhes de falhas de API são exibidos apenas no desenvolvimento, não no console de produção. |
| Mapas externos | Antes de abrir uma coordenada no Google Maps, o app pede confirmação e informa que as coordenadas serão enviadas ao provedor escolhido. |

## Dados que podem sair do app por escolha da pessoa

| Ação voluntária | Destino | Informação enviada |
| --- | --- | --- |
| Abrir localização no mapa | Google Maps | As coordenadas escolhidas para visualização. |
| Atualizar o clima do widget | Open-Meteo | A cidade digitada para obter previsão; o app não usa a localização do aparelho para este widget. |
| Conectar Spotify | Spotify via Supabase Auth | Dados necessários ao fluxo OAuth autorizado pela própria pessoa. |
| Permitir notificações | Serviço Push do navegador | Endpoint criptográfico do dispositivo e mensagem mínima do lembrete. |

## Recomendações para quem usa o app

1. Use uma senha exclusiva e mantenha o e-mail da conta protegido.
2. Compartilhe localização apenas enquanto isso fizer sentido; pause imediatamente ao terminar.
3. Revogue a permissão de notificações ou localização nas configurações do navegador quando não quiser mais utilizá-las.
4. Não use a prévia local para dados reais: ela serve apenas à demonstração e pode usar armazenamento do dispositivo.
5. Antes de abrir o mapa externo, confirme que deseja realmente compartilhar aquela coordenada com o provedor indicado.

## Verificações automatizadas desta versão

A suíte de regressão cobre o isolamento de migrations, políticas de Storage, configuração VAPID, inscrição Web Push, chave de serviço, consulta de lembretes por `couple_id`, limpeza de preferências locais, minimização do payload e supressão de detalhes de erro em produção. Na validação desta versão, foram aprovados **37 testes**, a checagem TypeScript e a compilação de produção.

## Próxima validação manual

Ainda é recomendável testar, em um dispositivo real, o ciclo completo da notificação Web: inscrever o navegador, criar um lembrete próximo, fechar o navegador e confirmar a entrega. Esse teste confirma permissões e limitações específicas do navegador e do sistema operacional, que não podem ser simuladas integralmente no servidor.
