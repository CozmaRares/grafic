import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart } from "@tanstack/react-start";
import {
    requireAuthMiddleware,
    serverFunctionAuthRedirectMiddleware,
} from "@/integrations/clerk/middleware";

export const startInstance = createStart(() => {
    return {
        requestMiddleware: [
            serverFunctionAuthRedirectMiddleware,
            clerkMiddleware(),
            requireAuthMiddleware,
        ],
    };
});
