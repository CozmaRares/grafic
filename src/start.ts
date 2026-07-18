import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart } from "@tanstack/react-start";
import { requireAuthMiddleware } from "@/integrations/clerk/middleware";

export const startInstance = createStart(() => {
    return {
        requestMiddleware: [clerkMiddleware(), requireAuthMiddleware],
    };
});
