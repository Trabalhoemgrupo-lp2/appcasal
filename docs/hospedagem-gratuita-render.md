# Hospedagem externa gratuita do appCasal

## Decisão

Para manter o servidor Express, o callback OAuth do Spotify, o service worker e as rotas protegidas, a configuração preparada usa um **Render Web Service Free**. O arquivo `render.yaml` já contém os comandos de build e inicialização, mas a criação do serviço exige conexão manual a um repositório Git pelo usuário.

O Render documenta que serviços Free entram em suspensão após 15 minutos sem tráfego e podem levar cerca de um minuto para voltar quando recebem uma nova requisição [1]. O armazenamento local também é efêmero; os dados do appCasal permanecem no Supabase e os arquivos devem usar o Storage, não o disco local [1].

## Publicação

1. Crie ou conecte um repositório Git contendo este projeto.
2. No Render, escolha **New → Blueprint** e selecione o repositório.
3. O Render detectará `render.yaml` e solicitará os valores das variáveis marcadas como `sync: false`.
4. Use como `APP_PUBLIC_ORIGIN` a URL HTTPS gerada pelo Render, sem barra final.
5. Aguarde a execução de `pnpm install --frozen-lockfile && pnpm build` e o comando `pnpm start`.

## Variáveis

As variáveis privadas do Supabase, Spotify e VAPID devem ser adicionadas no painel do serviço. A chave `SUPABASE_SERVICE_ROLE_KEY`, o segredo Spotify e a chave privada VAPID nunca devem ser incluídos no Git.

## Redirects

Depois que o Render fornecer a URL, cadastrar:

```text
https://SEU-SERVICO.onrender.com/api/spotify/callback
```

no Spotify Developer Dashboard. No Supabase Authentication, cadastrar a URL raiz como Site URL e Redirect URL. Na chave do Google Maps, autorizar o domínio final quando a política de referrer estiver habilitada.

## Limitações importantes

A hospedagem Free é adequada para teste, protótipo e uso pessoal, mas não deve ser tratada como garantia de disponibilidade contínua. O Realtime de localização continua sendo responsabilidade do Supabase e funciona no navegador; o servidor Render é usado para servir o app, callbacks e tarefas protegidas. Tarefas de background que dependem de processo sempre ativo não são confiáveis em uma instância que pode dormir.

## Referências

[1]: https://render.com/docs/free "Render — Deploy for Free"
[2]: https://vercel.com/docs/frameworks/backend/express "Vercel — Express on Vercel"

## Configuração iniciada no painel

O repositório `Trabalhoemgrupo-lp2/appcasal` foi selecionado no Render. O serviço está configurado como Node, branch `main`, região Ohio e plano Free (`US$0/mês`, 512 MB RAM, 0,1 CPU). O nome escolhido é `appcasal-gratuito`; os comandos detectados são `pnpm install --frozen-lockfile; pnpm run build` e `pnpm run start`. As variáveis de produção ainda precisam ser inseridas no formulário do Render antes do deploy.

Na retomada do formulário, as sete variáveis secretas aparecem preenchidas e mascaradas, o plano Free continua selecionado e a região Ohio permanece ativa. O botão `Deploy Web Service` ainda aparece desabilitado; a causa do bloqueio será verificada no formulário antes de tentar novamente.

O serviço Render Free foi criado com sucesso como `appcasal-gratuito`, usando o repositório `Trabalhoemgrupo-lp2/appcasal`. O primeiro deploy foi iniciado no identificador `dep-da7343m7bikc73eo53sg` a partir do commit `fd6507d`; o painel ainda estava em estado `Building` na última verificação.
