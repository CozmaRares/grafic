import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { CalendarDays } from "lucide-react";
import { z } from "zod";
import {
    getLegalHolidayYear,
    saveVariableLegalHolidayDate as saveVariableLegalHolidayDateRecord,
} from "@/db";
import type { LegalHolidayYearView } from "@/db";
import { unwrapServerResult } from "@/lib/server-result";

const yearSchema = z.object({
    year: z.number().int().positive(),
});

const variableHolidayDateSchema = z.object({
    day: z.coerce
        .number("Completează ziua.")
        .int("Ziua trebuie să fie un număr întreg.")
        .min(1, "Ziua trebuie să fie între 1 și 31.")
        .max(31, "Ziua trebuie să fie între 1 și 31."),
    definitionId: z.number().int().positive(),
    month: z.coerce
        .number("Completează luna.")
        .int("Luna trebuie să fie un număr întreg.")
        .min(1, "Luna trebuie să fie între 1 și 12.")
        .max(12, "Luna trebuie să fie între 1 și 12."),
    year: z.number().int().positive(),
});

type VariableHolidayDraft = {
    day: string;
    month: string;
};

type FormStatus = {
    message: string;
    type: "error" | "success";
} | null;

const getHolidayYear = createServerFn({ method: "GET" })
    .validator(yearSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(getLegalHolidayYear(data.year));
    });

const saveVariableLegalHolidayDate = createServerFn({ method: "POST" })
    .validator(variableHolidayDateSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(saveVariableLegalHolidayDateRecord(data));
    });

export const Route = createFileRoute("/sarbatori")({
    head: () => ({
        meta: [
            {
                title: "Sărbători legale",
            },
        ],
    }),
    loader: () =>
        getHolidayYear({
            data: {
                year: getInitialYear(),
            },
        }),
    component: RouteComponent,
});

function getInitialYear() {
    const fallbackYear = new Date().getFullYear();

    if (typeof globalThis.location === "undefined") {
        return fallbackYear;
    }

    const parsedYear = Number(
        new URLSearchParams(globalThis.location.search).get("year"),
    );

    return Number.isInteger(parsedYear) && parsedYear > 0
        ? parsedYear
        : fallbackYear;
}

function RouteComponent() {
    const initialHolidayYear = Route.useLoaderData();
    const getHolidayYearFn = useServerFn(getHolidayYear);
    const saveVariableLegalHolidayDateFn = useServerFn(
        saveVariableLegalHolidayDate,
    );
    const [year, setYear] = useState(initialHolidayYear.year);
    const [holidayYear, setHolidayYear] =
        useState<LegalHolidayYearView>(initialHolidayYear);
    const [drafts, setDrafts] = useState(() => getDrafts(initialHolidayYear));
    const [status, setStatus] = useState<FormStatus>(null);
    const [savingDefinitionId, setSavingDefinitionId] = useState<number | null>(
        null,
    );

    useEffect(() => {
        setDrafts(getDrafts(holidayYear));
    }, [holidayYear]);

    const missingHolidayNames = useMemo(
        () =>
            holidayYear.variableHolidays
                .filter(
                    holiday => holiday.day === null || holiday.month === null,
                )
                .map(holiday => holiday.name),
        [holidayYear],
    );

    async function handleLoadYear(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus(null);

        try {
            const nextHolidayYear = await getHolidayYearFn({
                data: {
                    year,
                },
            });
            setHolidayYear(nextHolidayYear);
            globalThis.history.replaceState(
                null,
                "",
                `/sarbatori?year=${year}`,
            );
        } catch (error) {
            setStatus({
                message:
                    error instanceof Error
                        ? error.message
                        : "Sărbătorile nu au putut fi încărcate.",
                type: "error",
            });
        }
    }

    async function handleSaveVariableHoliday(definitionId: number) {
        const draft = drafts[definitionId] ?? {
            day: "",
            month: "",
        };

        setStatus(null);
        setSavingDefinitionId(definitionId);

        try {
            await saveVariableLegalHolidayDateFn({
                data: {
                    day: draft.day,
                    definitionId,
                    month: draft.month,
                    year: holidayYear.year,
                },
            });
            const nextHolidayYear = await getHolidayYearFn({
                data: {
                    year: holidayYear.year,
                },
            });
            setHolidayYear(nextHolidayYear);
            setStatus({
                message: "Sărbătoarea a fost salvată.",
                type: "success",
            });
        } catch (error) {
            setStatus({
                message:
                    error instanceof Error
                        ? error.message
                        : "Sărbătoarea nu a putut fi salvată.",
                type: "error",
            });
        } finally {
            setSavingDefinitionId(null);
        }
    }

    return (
        <main className="min-h-screen p-2">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                            Sărbători legale
                        </p>
                        <h1 className="text-2xl font-bold sm:text-3xl">
                            Configurare {holidayYear.year}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        <Link
                            className="inline-flex w-fit items-center gap-2 rounded-md border border-black bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-100"
                            search={{
                                year: holidayYear.year,
                            }}
                            to="/"
                        >
                            <CalendarDays
                                aria-hidden="true"
                                className="size-4"
                            />
                            Calendar
                        </Link>
                        <form
                            className="flex w-fit items-end gap-2"
                            onSubmit={handleLoadYear}
                        >
                            <label className="grid gap-1 text-sm font-medium">
                                An
                                <input
                                    className="w-28 rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                    min={1}
                                    onChange={event =>
                                        setYear(Number(event.target.value))
                                    }
                                    step={1}
                                    type="number"
                                    value={year}
                                />
                            </label>
                            <button
                                className="rounded-md border border-black bg-white px-4 py-2 font-bold text-black hover:bg-gray-100"
                                type="submit"
                            >
                                Încarcă
                            </button>
                        </form>
                    </div>
                </header>

                {missingHolidayNames.length > 0 ? (
                    <section className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                        <h2 className="font-bold">
                            An incomplet pentru grafic
                        </h2>
                        <p className="mt-1 text-sm">
                            Completează sărbătorile variabile nesetate.
                        </p>
                    </section>
                ) : null}

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Variabile</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">
                                        Nume
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                        Zi
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                        Luna
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold">
                                        Acțiuni
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {holidayYear.variableHolidays.map(holiday => {
                                    const draft = drafts[
                                        holiday.definitionId
                                    ] ?? {
                                        day: "",
                                        month: "",
                                    };

                                    return (
                                        <tr
                                            className="border-t border-gray-100"
                                            key={holiday.definitionId}
                                        >
                                            <td className="px-3 py-2 font-medium">
                                                {holiday.name}
                                                {holiday.day === null ||
                                                holiday.month === null ? (
                                                    <span className="ml-2 rounded-sm bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-900">
                                                        Nesetat
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    className="w-24 rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                    max={31}
                                                    min={1}
                                                    onChange={event =>
                                                        setDrafts(current => ({
                                                            ...current,
                                                            [holiday.definitionId]:
                                                                {
                                                                    ...draft,
                                                                    day: event
                                                                        .target
                                                                        .value,
                                                                },
                                                        }))
                                                    }
                                                    step={1}
                                                    type="number"
                                                    value={draft.day}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    className="w-24 rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                    max={12}
                                                    min={1}
                                                    onChange={event =>
                                                        setDrafts(current => ({
                                                            ...current,
                                                            [holiday.definitionId]:
                                                                {
                                                                    ...draft,
                                                                    month: event
                                                                        .target
                                                                        .value,
                                                                },
                                                        }))
                                                    }
                                                    step={1}
                                                    type="number"
                                                    value={draft.month}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    className="rounded-md border border-black bg-white px-3 py-1.5 font-bold text-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                                                    disabled={
                                                        savingDefinitionId ===
                                                        holiday.definitionId
                                                    }
                                                    onClick={() =>
                                                        handleSaveVariableHoliday(
                                                            holiday.definitionId,
                                                        )
                                                    }
                                                    type="button"
                                                >
                                                    Salvează
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Fixe</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">
                                        Zi
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                        Luna
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                        Nume
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {holidayYear.fixedHolidays.map(holiday => (
                                    <tr
                                        className="border-t border-gray-100"
                                        key={holiday.id}
                                    >
                                        <td className="px-3 py-2">
                                            {holiday.day}
                                        </td>
                                        <td className="px-3 py-2">
                                            {holiday.month}
                                        </td>
                                        <td className="px-3 py-2">
                                            {holiday.name}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {status ? (
                    <p
                        className={
                            status.type === "error"
                                ? "text-sm font-medium text-red-700"
                                : "text-sm font-medium text-green-700"
                        }
                        role="status"
                    >
                        {status.message}
                    </p>
                ) : null}
            </div>
        </main>
    );
}

function getDrafts(holidayYear: LegalHolidayYearView) {
    return Object.fromEntries(
        holidayYear.variableHolidays.map(holiday => [
            holiday.definitionId,
            {
                day: holiday.day === null ? "" : String(holiday.day),
                month: holiday.month === null ? "" : String(holiday.month),
            },
        ]),
    ) as Record<number, VariableHolidayDraft>;
}
