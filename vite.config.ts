import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    build: {
        rolldownOptions: {
            checks: { pluginTimings: false },
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: "vendor",
                            test: /node_modules/,
                            minSize: 100_000,
                            maxSize: 350_000,
                        },
                    ],
                },
            },
        },
    },
    plugins: [
        devtools(),
        nitro({ rollupConfig: { external: [/^@sentry\//] } }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
        babel({ presets: [reactCompilerPreset()] }),
    ],
});

export default config;
