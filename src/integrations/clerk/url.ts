const SIGN_IN_URL = import.meta.env.VITE_CLERK_SIGN_IN_URL;

if (!SIGN_IN_URL) {
    throw new Error("Add your Clerk Sign In URL to the .env.local file");
}

export function getClerkSignInUrl(redirectUrl: string) {
    const signInUrl = new URL(SIGN_IN_URL);
    signInUrl.searchParams.set("redirect_url", redirectUrl);

    return signInUrl.href;
}

export { SIGN_IN_URL };
