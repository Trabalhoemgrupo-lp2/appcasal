import type { SupabaseClient } from "@supabase/supabase-js";

export const ACCOUNT_DELETION_CONFIRMATION = "EXCLUIR";

const PRIVATE_BUCKETS = [
  "memory-photos",
  "profile-avatars",
  "music-room-covers",
] as const;

type StorageObject = {
  bucket_id: (typeof PRIVATE_BUCKETS)[number];
  name: string;
};

/**
 * Apaga os dados que impedem a remoção do perfil e trata os objetos privados
 * da pessoa. Esta função recebe exclusivamente um cliente com chave de serviço
 * e nunca é chamada pelo navegador.
 */
export async function removeAccountData(
  admin: SupabaseClient,
  userId: string
) {
  const { data: ownedObjects, error: objectsError } = await admin
    .schema("storage")
    .from("objects")
    .select("bucket_id, name")
    .eq("owner_id", userId)
    .in("bucket_id", [...PRIVATE_BUCKETS]);

  if (objectsError) throw objectsError;

  const objectsByBucket = new Map<string, string[]>();
  for (const object of (ownedObjects ?? []) as StorageObject[]) {
    const paths = objectsByBucket.get(object.bucket_id) ?? [];
    paths.push(object.name);
    objectsByBucket.set(object.bucket_id, paths);
  }

  // Remove primeiro os arquivos enviados pela própria conta. Se isso falhar,
  // a identidade permanece ativa e a pessoa pode tentar novamente sem perda de acesso.
  for (const [bucket, paths] of Array.from(objectsByBucket.entries())) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) throw error;
  }

  const removedCoverPaths = objectsByBucket.get("music-room-covers") ?? [];
  if (removedCoverPaths.length > 0) {
    const { error } = await admin
      .from("couple_music_rooms")
      .update({ cover_path: null })
      .in("cover_path", removedCoverPaths);
    if (error) throw error;
  }

  // A Sala Spotify protege seu anfitrião contra alteração. Ao excluir a
  // identidade anfitriã, removemos sua sala para não transferir uma permissão
  // de autoria sem consentimento; o parceiro continua no casal e pode criar
  // uma nova sala própria.
  const { error: roomError } = await admin
    .from("couple_music_rooms")
    .delete()
    .eq("host_id", userId);
  if (roomError) throw roomError;

  // Estas são as únicas referências com on delete restrict. As demais são
  // eliminadas por cascade quando auth.users e profiles são removidos.
  for (const table of [
    "posts",
    "messages",
    "plans",
    "partner_invites",
    "favorite_places",
  ] as const) {
    const authorColumn =
      table === "posts"
        ? "author_id"
        : table === "messages"
          ? "sender_id"
          : table === "plans" || table === "favorite_places"
            ? "created_by"
            : "invited_by";
    const { error } = await admin.from(table).delete().eq(authorColumn, userId);
    if (error) throw error;
  }

}
