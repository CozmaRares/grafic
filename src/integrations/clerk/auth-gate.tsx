import { useEffect } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { getClerkSignInUrl } from "./url";

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        if (!isLoaded || isSignedIn) {
            return;
        }

        globalThis.location.assign(getClerkSignInUrl(globalThis.location.href));
    }, [isLoaded, isSignedIn]);

    if (!isLoaded || !isSignedIn) {
        return (
            <main className="flex min-h-screen items-center justify-center p-6">
                <p className="text-sm font-medium text-gray-600">
                    Se verifica autentificarea...
                </p>
            </main>
        );
    }

    return children;
}
