import { createMiddleware } from "@tanstack/react-start";
import { assertAuthed } from "./assert-authed";
import { getClerkSignInUrl } from "./url";

type ClerkRequestContext = {
    auth?: Parameters<typeof assertAuthed>[0];
};

function isServerFunctionRequest(request: Request) {
    return request.headers.get("x-tsr-serverFn") === "true";
}

function unauthorizedServerFunctionResponse() {
    return new Response("Unauthorized", {
        headers: {
            "content-type": "text/plain; charset=UTF-8",
        },
        status: 401,
    });
}

export const serverFunctionAuthRedirectMiddleware = createMiddleware().server(
    async ({ request, next }) => {
        try {
            return await next();
        } catch (error) {
            if (
                error instanceof Response &&
                error.status >= 300 &&
                error.status < 400 &&
                isServerFunctionRequest(request)
            ) {
                throw unauthorizedServerFunctionResponse();
            }

            throw error;
        }
    },
);

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

            if (isServerFunctionRequest(request)) {
                throw unauthorizedServerFunctionResponse();
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
