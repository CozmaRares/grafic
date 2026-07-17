//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";

export default [
    ...tanstackConfig,
    {
        rules: {
            "import/no-cycle": "off",
            "import/order": "off",
            "sort-imports": "off",
            "@typescript-eslint/array-type": "off",
            "@typescript-eslint/require-await": "off",
            "pnpm/json-enforce-catalog": "off",
        },
    },
    {
        files: ["src/**/*.{ts,tsx}"],
        ignores: ["src/db/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "@/db/connection",
                            message:
                                "Database connection access must stay inside src/db.",
                        },
                        {
                            name: "@/db/schema",
                            message:
                                "Database schema access must stay inside src/db.",
                        },
                        {
                            name: "drizzle-orm",
                            message:
                                "Database access must go through the DAL exported from @/db.",
                        },
                    ],
                    patterns: [
                        {
                            group: ["drizzle-orm/*"],
                            message:
                                "Database access must go through the DAL exported from @/db.",
                        },
                    ],
                },
            ],
        },
    },
    {
        ignores: [".output/**", "eslint.config.js", "prettier.config.js"],
    },
];
