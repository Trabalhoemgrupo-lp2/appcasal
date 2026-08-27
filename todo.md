# Project TODO

- [x] Migrar a versão atual do appCasal para o projeto permanente
- [x] Preservar a tela map-first e a navegação responsiva
- [x] Preservar localização em tempo real via Supabase Realtime
- [x] Preservar atualização GPS forçada e descarte de coordenadas antigas
- [x] Preservar enquadramento automático dos participantes no mapa
- [x] Preservar fotos dos participantes e identificação por lugares salvos
- [x] Preservar atalhos Casa e Trabalho
- [x] Preservar endereço digitável e geocodificação pelo Google Maps
- [x] Preservar Spotify OAuth e playlists
- [x] Preservar PWA, manifesto e service worker
- [x] Configurar variáveis de produção no projeto permanente
- [x] Documentar URLs autorizadas para Supabase, Google Maps e Spotify
- [x] Corrigir compatibilidade da coluna address em favorite_places — migration executada e coluna confirmada por consulta
- [ ] Confirmar política RLS recursiva de couple_quiz_answers no contexto autenticado — SQL executado pelo usuário; consulta administrativa passou, mas a verificação do RPC não foi conclusiva
- [ ] Habilitar couple_locations e favorite_places no Supabase Realtime
- [x] Executar build de produção
- [x] Validar TypeScript e testes
- [x] Validar desktop e viewport móvel
- [x] Criar checkpoint final
- [ ] Entregar URL estável e pendências obrigatórias do Supabase — URL estável entregue; aplicar migrations/RLS/Realtime no Supabase externo

## Histórico

- [x] Projeto WebDev permanente inicializado como appcasal-permanente
- [x] Reiniciar o servidor permanente após instalar as dependências migradas
- [ ] Habilitar `couple_locations` e `favorite_places` no Supabase Realtime e validar atualização entre dois participantes
- [ ] Configurar e documentar a URL permanente nas Redirect URLs do Spotify e executar validação live do OAuth/playlists
- [x] Confirmar presença e registro do service worker e validar instalação/funcionamento do PWA após build de produção
- [x] Executar build de produção e validar o deploy permanente

## Histórico de validação

- [x] Chaves VAPID validadas
- [x] Credenciais Supabase do projeto permanente validadas
- [ ] Credenciais Spotify live ainda não validadas porque o teste externo é opt-in
- [x] Atualizar o teste de consentimento para refletir a regra atual de solicitar novamente após recusa
- [x] Remover o domínio antigo hardcoded do fallback do Spotify e exigir APP_PUBLIC_ORIGIN em produção
- [x] Preparar configuração Render Free para o servidor Express e documentar a suspensão por inatividade
- [x] Validar build e pacote para hospedagem externa gratuita
- [x] Adicionar `@supabase/supabase-js` e demais dependências runtime ausentes antes do deploy Render
- [x] Enviar a correção de dependências ao GitHub
- [x] Enviar `patches/wouter@3.7.1.patch` ao GitHub para corrigir o build Render
- [x] Reexecutar o deploy Render depois de enviar o patch e validar a URL pública
- [x] Garantir que `vite.config.ts` e arquivos de configuração essenciais estejam no GitHub
- [x] Reexecutar o deploy Render após corrigir os arquivos ausentes — deploy 5172004 disparado e falha confirmada antes da correção estrutural seguinte
- [x] Salvar checkpoint pós-correção da configuração Vite inline
- [x] Confirmar no Render o resultado do deploy do commit 9fc2783 — falha confirmada por import antigo no bundle
- [x] Confirmar no painel Render o resultado dos commits 19530b0/c614ebb — deploys detectados; URL pública HTTP 200 e bundle corrigido confirmados
- [ ] Validar com sessão autenticada a correção do bloqueio de resposta e salvamento — handlers defensivos publicados; RLS externa ainda pode bloquear
- [ ] Adicionar testes funcionais dos handlers de resposta e salvamento — teste atual cobre contratos no código-fonte
- [x] Validar build, preview desktop/mobile e bundle público após a correção — HTTP 200 e marcador do handler de chat confirmados
- [ ] Confirmar que a política RLS definitiva removeu a mensagem “é preciso conferir a política” ao responder o quiz
- [ ] Validar resposta autenticada do quiz após aplicar a política não recursiva
- [x] Substituir a navegação/área Momentos por Galeria
- [x] Reutilizar `posts` e o bucket privado existente para metadados de fotos e vídeos, sem criar tabela redundante
- [x] Implementar upload autenticado para armazenamento privado — fotos até 5 MB e vídeos até 50 MB
- [x] Implementar visualização em grade, abertura da mídia e download de mídia
- [x] Adicionar cobertura estrutural para formatos de mídia, navegação da Galeria e download
- [ ] Validar a galeria em desktop/mobile, build e publicação — desktop/mobile e build concluídos; publicação após sincronização pendente
- [x] Exibir no contador dias, horas, minutos e segundos com atualização contínua
- [x] Reestruturar a Galeria para grade de miniaturas no padrão de telefone
- [x] Adicionar visualização em tela cheia com navegação entre fotos e vídeos
- [x] Adicionar ações de baixar e excluir na visualização de mídia
- [ ] Validar a experiência da galeria de telefone em telas móveis e desktop
