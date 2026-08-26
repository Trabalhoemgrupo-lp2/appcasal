# Ativação de Momentos, Leituras e Filmes

As abas **Momentos**, **Leituras** e **Filmes** já estão presentes no aplicativo. As fotos continuam no mesmo fluxo privado de memórias: a imagem é enviada para o armazenamento protegido e aparece apenas para os membros do casal definidos pelas regras de acesso existentes.

> **Status do projeto "meu casal":** a migration `0014_couple_library_and_media_shortcut.sql` foi executada em 20 de agosto de 2026. Leituras e Filmes já podem persistir itens privados e sincronizá-los entre os membros do casal.

## 1. Aplicar a estrutura compartilhada

No painel do projeto Supabase, abra **SQL Editor**, crie uma consulta e execute integralmente o arquivo:

```text
supabase/migrations/0014_couple_library_and_media_shortcut.sql
```

Essa migration cria `couple_library_items`, ativa RLS e limita leitura, criação, alteração e remoção aos membros do mesmo casal. Sem ela, Momentos continua disponível; Leituras e Filmes mostram listas vazias até a estrutura ser ativada.

## 2. Usar a galeria de Momentos

Na aba **Momentos**, escreva um bilhete e escolha uma foto. Depois de guardar, a foto aparece no álbum privado. Em cada imagem há a ação para escolhê-la como **foto em destaque**. Essa preferência fica apenas no aparelho atual e é removida ao sair do aplicativo.

## 3. Adicionar o app à tela inicial

O app agora é instalável como PWA e oferece o atalho **Momentos**:

| Sistema | Como instalar | Resultado |
| --- | --- | --- |
| iPhone/iPad | Abra o site no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. | Um ícone do app é criado; ao abrir, a galeria fica a um toque. |
| Android | Abra no Chrome e escolha **Instalar app** ou **Adicionar à tela inicial**. | Um ícone do app é criado; alguns lançadores também exibem o atalho Momentos ao pressionar o ícone. |

> Um site instalado não pode criar um widget nativo do sistema com uma foto dinâmica no iPhone ou Android. O que foi preparado é o aplicativo instalável com um atalho direto e um cartão de foto em destaque dentro da aba Momentos. Um widget nativo com foto exigiria um aplicativo móvel próprio para iOS/Android.

## 4. Verificações recomendadas

1. Com duas contas no mesmo casal, inclua um livro e confirme a atualização na outra conta.
2. Inclua um filme com data de estreia e mova-o entre as colunas da lista.
3. Publique uma foto em Momentos, escolha-a como destaque e saia do app para conferir a limpeza da preferência local.
