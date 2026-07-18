import {
    HeadContent,
    Scripts,
    createRootRoute,
    useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import AuthGate from "@/integrations/clerk/auth-gate";
import ClerkProvider from "@/integrations/clerk/provider";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
    head: () => ({
        meta: [
            {
                charSet: "utf-8",
            },
            {
                name: "viewport",
                content: "width=device-width, initial-scale=1",
            },
            {
                title: "Grafic",
            },
        ],
        links: [
            {
                rel: "stylesheet",
                href: appCss,
            },
        ],
    }),
    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
        >
            <head>
                <HeadContent />
            </head>
            <body className="font-sans wrap-anywhere antialiased selection:bg-[rgba(79,184,178,0.24)]">
                <ClerkProvider>
                    <AuthGate>{children}</AuthGate>
                    <Devtools />
                </ClerkProvider>
                <Scripts />
            </body>
        </html>
    );
}

function Devtools() {
    const pathname = useRouterState({
        select: state => state.location.pathname,
    });

    if (pathname.includes("/print/")) {
        return null;
    }

    return (
        <TanStackDevtools
            config={{
                position: "bottom-right",
            }}
            plugins={[
                {
                    name: "Tanstack Router",
                    render: <TanStackRouterDevtoolsPanel />,
                },
            ]}
        />
    );
}
