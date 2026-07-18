import { createMiddleware } from "@tanstack/react-start";
import { assertAuthed } from "./assert-authed";
import { getClerkSignInUrl } from "./url";

type ClerkRequestContext = {
    auth?: Parameters<typeof assertAuthed>[0];
};

export const requireAuthMiddleware = createMiddleware().server(
    async ({ context, request, next }) => {
        try {
            const authSource = (context as ClerkRequestContext | undefined)
                ?.auth;

            if (!authSource) {
                throw new Error("Unauthorized");
            }

            await assertAuthed(authSource);
        } catch (error) {
            if (!(error instanceof Error) || error.message !== "Unauthorized") {
                throw error;
            }

            throw new Response(null, {
                headers: {
                    Location: getClerkSignInUrl(request.url),
                },
                status: 302,
            });
        }

        return next();
    },
);
