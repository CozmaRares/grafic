import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import AuthGate from "@/integrations/clerk/auth-gate";
import HeaderUser from "@/integrations/clerk/header-user";
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
            <body className="mt-4 font-sans wrap-anywhere antialiased selection:bg-[rgba(79,184,178,0.24)] print:mt-0">
                <ClerkProvider>
                    <AuthGate>
                        <div className="fixed top-2 right-2 z-50 print:hidden">
                            <HeaderUser />
                        </div>
                        {children}
                    </AuthGate>
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
                </ClerkProvider>
                <Scripts />
            </body>
        </html>
    );
}
