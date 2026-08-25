# Criação de playlists Spotify — decisão de integração

## Necessidade

Criar uma playlist na conta Spotify da pessoa conectada exige autorização de escrita do titular. O Caderno não deve guardar senha, expor token no navegador nem compartilhar uma credencial de uma pessoa com a outra.

## Requisitos confirmados

| Aspecto | Evidência e implicação |
| --- | --- |
| Permissão de escrita | O Spotify exige `playlist-modify-private` para criar playlist privada e `playlist-modify-public` para uma pública. Para o Caderno, a opção padrão deve ser privada. |
| Autorização | A API Spotify usa OAuth 2.0; a autorização concedida emite um token de acesso para chamadas em nome da pessoa. |
| Renovação | Para uma função persistente de criação e edição, o fluxo com código de autorização permite renovar tokens no servidor. |
| Proteção de token | O Supabase não armazena tokens do provedor por padrão; a documentação recomenda enviá-los a um servidor confiável caso sejam usados fora do navegador. |
| Vínculo existente | A vinculação manual de identidade é apropriada para acrescentar Spotify à conta atual, mas é uma capacidade de autenticação, não um cofre de tokens para a API Spotify. |

## Alternativas avaliadas

| Alternativa | Experiência | Segurança e limite |
| --- | --- | --- |
| Abrir o Spotify para criação manual | O Caderno abre a biblioteca/uma playlist; a pessoa cria e depois cola o link na Sala. | Não requer novos escopos nem armazenamento de token; não cria automaticamente. |
| Integração direta de playlists | A pessoa concede `playlist-modify-private`; o Caderno cria uma playlist privada no Spotify com nome e descrição escolhidos. | Requer ampliar o OAuth, armazenar com criptografia o token de atualização em servidor e adicionar credenciais Spotify seguras no projeto. |

## Fontes oficiais

1. Spotify, [Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes): requisitos `playlist-modify-private` e `playlist-modify-public`.
2. Spotify, [Authorization](https://developer.spotify.com/documentation/web-api/concepts/authorization): fluxos OAuth e renovação de tokens.
3. Spotify, [Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow): retorno `code`, validação de `state` e troca segura no servidor.
4. Supabase, [Social Login](https://supabase.com/docs/guides/auth/social-login): tokens de provedores não são persistidos automaticamente e devem ser encaminhados a servidor confiável quando necessários fora do navegador.
5. Supabase, [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking): uso de vinculação manual e consulta das identidades associadas.
