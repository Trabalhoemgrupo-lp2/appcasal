# Exclusão de conta

O caminho recomendado é a ação **Mais → Conta e privacidade → Excluir conta** no Caderno de Dois. Ela renova a sessão, remove mídias privadas no Storage e apaga definitivamente a identidade pelo servidor.

## Exclusão administrativa

Para que uma remoção feita diretamente na área de usuários do Supabase não seja bloqueada por referências com `RESTRICT`, aplique a migration `supabase/migrations/0015_account_deletion_cleanup.sql` no **SQL Editor** do projeto **meu casal**. A migration instala a função de gatilho `public.cleanup_account_before_profile_delete()` — ela não cria uma função chamada `delete_own_account()`.

> A exclusão administrativa direta remove a identidade e os dados relacionais. Para a remoção também dos arquivos privados no Storage, utilize preferencialmente o fluxo do aplicativo.
