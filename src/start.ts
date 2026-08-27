import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import {
    requireAuthMiddleware,
    serverFunctionAuthRedirectMiddleware,
} from "@/integrations/clerk/middleware";

const csrfMiddleware = createCsrfMiddleware({
    filter: ctx => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => {
    return {
        requestMiddleware: [
            csrfMiddleware,
            serverFunctionAuthRedirectMiddleware,
            clerkMiddleware(),
            requireAuthMiddleware,
        ],
    };
});
