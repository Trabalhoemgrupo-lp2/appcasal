import { COOKIE_NAME } from "@shared/const";
import { createClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  removeAccountData,
} from "./accountDeletion";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createPlaylistAuthorization } from "./spotifyPlaylists";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  account: router({
    delete: publicProcedure
      .input(
        z.object({
          accessToken: z.string().min(20),
          confirmation: z.literal(ACCOUNT_DELETION_CONFIRMATION),
        })
      )
      .mutation(async ({ input }) => {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A exclusão não está disponível neste momento.",
          });
        }

        const identityClient = createClient(supabaseUrl, publishableKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        });
        const { data: identity, error: identityError } =
          await identityClient.auth.getUser(input.accessToken);

        if (identityError || !identity.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Sua sessão expirou. Entre novamente para excluir a conta.",
          });
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        try {
          await removeAccountData(admin, identity.user.id);
          const { error } = await admin.auth.admin.deleteUser(identity.user.id, false);
          if (error) throw error;
        } catch (error) {
          console.error("[account-delete] Não foi possível concluir a remoção", {
            userId: identity.user.id,
            error: error instanceof Error ? error.name : "unknown",
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Não foi possível concluir a exclusão. Tente novamente.",
          });
        }

        return { success: true } as const;
      }),
  }),

	push: router({
    publicKey: publicProcedure.query(() => ({
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    })),
	}),

	spotify: router({
		createPlaylistAuthorization: publicProcedure
			.input(z.object({ accessToken: z.string().min(20) }))
			.mutation(({ ctx, input }) =>
				createPlaylistAuthorization(ctx.req, ctx.res, input.accessToken)
			),
	}),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
