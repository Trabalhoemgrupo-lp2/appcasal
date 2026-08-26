# Diagnóstico móvel — 21 de agosto de 2026

As capturas reais em Safari/iOS revelam que, no modo noturno, alguns cartões de conteúdo ainda recebem uma superfície clara ou cinza, enquanto títulos, textos auxiliares e indicadores permanecem claros. O resultado é contraste insuficiente nas áreas de **Foto em destaque**, estados vazios de **Filmes** e em cartões inferiores. A barra de ações do cabeçalho também se sobrepõe ao conteúdo durante a rolagem em telas estreitas.

O ajuste deve substituir cores de superfície rígidas por tokens temáticos escuros, assegurar que cartões claros tenham texto escuro somente quando forem intencionalmente claros e reservar espaço superior seguro para o cabeçalho móvel. A correção deve ser validada em Safari/iOS e em um viewport móvel antes da publicação.

Na autorização Spotify, a pessoa usuária confirmou que o Spotify abre e aprova o acesso, mas o Caderno retorna sem refletir a identidade vinculada. Isso indica que a interface precisa reconciliar a sessão Supabase e reler `user.identities` após o retorno OAuth antes de renderizar o estado da Sala Spotify.

## Referência técnica

A documentação do Supabase confirma que `linkIdentity()` vincula uma identidade OAuth ao usuário já autenticado após o retorno ao aplicativo e que `getUserIdentities()` busca as identidades associadas ao usuário. A correção usa essa leitura autenticada para substituir o objeto de sessão potencialmente desatualizado após o retorno.

- <https://supabase.com/docs/guides/auth/auth-identity-linking>
- <https://supabase.com/docs/reference/javascript/auth-linkidentity>

## Correção publicada — versão 9dd85c22

| Área | Evidência registrada | Situação |
| --- | --- | --- |
| Sala Spotify em viewport móvel | Prévia em 390 × 844 px exibiu título, cartão de conexão, formulário de sala e controles sem sobreposição ou transbordamento. | Validada em prévia. |
| Cartões translúcidos no modo noturno | As superfícies `bg-white/*` usadas pela interface agora recebem uma superfície escura quando o documento está no modo noturno; a navegação inferior recebeu tratamento próprio e área segura para iPhone. | Validada por regressão e checagem técnica; requer confirmação no Safari/iOS real. |
| Retorno de autorização Spotify | O retorno agora inclui o marcador `spotify_return=1`, renova a sessão e consulta `getUserIdentities()` antes de atualizar o estado exibido. | Validado por regressão, TypeScript e build; requer confirmação com conta Spotify real. |

> A versão publicada não registra tokens Spotify no Caderno. A confirmação final deve ocorrer no mesmo aparelho e navegador em que a autorização foi aprovada, para validar o comportamento da sessão real.

## Referência complementar para o próximo ajuste

A documentação oficial informa que o login Spotify redireciona a pessoa usuária de volta ao aplicativo após a autorização e que, em fluxos de navegador com PKCE, o retorno precisa trocar o código por uma sessão. Já a documentação de vínculo manual explica que `linkIdentity()` anexa o provedor à pessoa autenticada, enquanto `getUserIdentities()` recupera os provedores ligados.

Como a autorização está sendo aprovada, mas a interface ainda não recebe uma identidade Spotify, o próximo ajuste não deve gravar token ou senha. Ele deve preservar uma confirmação local vinculada ao identificador da pessoa, limpá-la no encerramento da sessão e manter uma ação explícita para abrir apenas um endereço HTTPS válido do Spotify.

- <https://supabase.com/docs/guides/auth/social-login/auth-spotify>
- <https://supabase.com/docs/guides/auth/auth-identity-linking>
