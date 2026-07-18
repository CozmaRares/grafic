import { input } from "@inquirer/prompts";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env" });

const [{ db }, schema] = await Promise.all([
    import("../src/db/connection"),
    import("../src/db/schema"),
]);

const fixedLegalHolidays = [
    { day: 1, month: 1, name: "Anul Nou" },
    { day: 2, month: 1, name: "A doua zi de Anul Nou" },
    { day: 6, month: 1, name: "Boboteaza" },
    { day: 7, month: 1, name: "Sfantul Ioan Botezătorul" },
    { day: 24, month: 1, name: "Ziua Unirii Principatelor Române" },
    { day: 1, month: 5, name: "Ziua Muncii" },
    { day: 1, month: 6, name: "Ziua Copilului" },
    { day: 15, month: 8, name: "Adormirea Maicii Domnului" },
    { day: 30, month: 11, name: "Sfântul Andrei" },
    { day: 1, month: 12, name: "Ziua Națională a României" },
    { day: 25, month: 12, name: "Prima zi de Crăciun" },
    { day: 26, month: 12, name: "A doua zi de Crăciun" },
];

const variableLegalHolidayDefinitions = [
    { name: "Vinerea Mare" },
    { name: "Prima zi de Paște" },
    { name: "A doua zi de Paște" },
    { name: "A treia zi de Paște" },
    { name: "Prima zi de Rusalii" },
    { name: "A doua zi de Rusalii" },
];

const printSettingPrompts = [
    {
        key: "managerName",
        message: "Nume manager",
    },
    {
        key: "sectionChiefName",
        message: "Nume șef secție",
    },
    {
        key: "preparedByName",
        message: "Nume întocmit de",
    },
] as const;

const printSettings = [];

for (const prompt of printSettingPrompts) {
    const value = await input({
        message: prompt.message,
        required: true,
    });

    printSettings.push({
        key: prompt.key,
        value,
    });
}

await db
    .insert(schema.fixedLegalHolidays)
    .values(fixedLegalHolidays)
    .onConflictDoUpdate({
        set: {
            name: sql`excluded.name`,
        },
        target: [
            schema.fixedLegalHolidays.month,
            schema.fixedLegalHolidays.day,
        ],
    });

await db
    .insert(schema.variableLegalHolidayDefinitions)
    .values(variableLegalHolidayDefinitions)
    .onConflictDoNothing();

await db
    .insert(schema.printSettings)
    .values(printSettings)
    .onConflictDoUpdate({
        set: {
            value: sql`excluded.value`,
        },
        target: schema.printSettings.key,
    });

console.log("Configurarea bazei de date a fost inițializată.");
