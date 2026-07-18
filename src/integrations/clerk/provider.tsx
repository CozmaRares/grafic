import { ClerkProvider } from "@clerk/tanstack-react-start";
import { SIGN_IN_URL } from "./url";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Add your Clerk Publishable Key to the .env file");
}

export default function AppClerkProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            signInUrl={SIGN_IN_URL}
            afterSignOutUrl="/"
        >
            {children}
        </ClerkProvider>
    );
}
