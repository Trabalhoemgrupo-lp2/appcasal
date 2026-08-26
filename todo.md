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
- [ ] Corrigir compatibilidade da coluna address em favorite_places
- [ ] Corrigir política RLS recursiva de couple_quiz_answers no Supabase
- [ ] Habilitar couple_locations e favorite_places no Supabase Realtime
- [x] Executar build de produção
- [x] Validar TypeScript e testes
- [x] Validar desktop e viewport móvel
- [ ] Criar checkpoint final
- [ ] Entregar URL estável e pendências obrigatórias do Supabase

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
- [ ] Enviar a correção de dependências ao GitHub
- [ ] Enviar `patches/wouter@3.7.1.patch` ao GitHub para corrigir o build Render
- [ ] Reexecutar o deploy Render depois de enviar o patch e validar a URL pública
- [ ] Garantir que `vite.config.ts` e arquivos de configuração essenciais estejam no GitHub
- [ ] Reexecutar o deploy Render após corrigir os arquivos ausentes
