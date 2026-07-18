import { auth } from "@clerk/tanstack-react-start/server";

type AuthResult = {
    userId: string | null;
};

type AuthFn = () => AuthResult | Promise<AuthResult>;

export async function assertAuthed(authSource?: AuthFn | AuthResult) {
    const authResult =
        typeof authSource === "function"
            ? await authSource()
            : (authSource ?? (await auth()));

    if (!authResult.userId) {
        throw new Error("Unauthorized");
    }

    return authResult;
}
