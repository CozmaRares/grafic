import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { z } from "zod";

const homeSearchSchema = z.object({
    year: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/")({
    validateSearch: homeSearchSchema,
    head: () => ({
        meta: [
            {
                title: "Grafic",
            },
        ],
    }),
    component: RouteComponent,
});

const monthNames = [
    "Ianuarie",
    "Februarie",
    "Martie",
    "Aprilie",
    "Mai",
    "Iunie",
    "Iulie",
    "August",
    "Septembrie",
    "Octombrie",
    "Noiembrie",
    "Decembrie",
];

function RouteComponent() {
    const search = Route.useSearch();
    const selectedYear = search.year ?? new Date().getFullYear();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthIndex = currentDate.getMonth();

    return (
        <main className="min-h-screen p-2">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                            Grafic
                        </p>
                        <h1 className="text-2xl font-bold sm:text-3xl">
                            Calendar {selectedYear}
                        </h1>
                    </div>

                    <nav
                        aria-label="Administrare"
                        className="flex flex-wrap gap-2"
                    >
                        <Link
                            className="inline-flex items-center gap-2 rounded-md border border-black bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-100"
                            to="/angajati"
                        >
                            <Users
                                aria-hidden="true"
                                className="size-4"
                            />
                            Angajați
                        </Link>
                        <a
                            className="inline-flex items-center gap-2 rounded-md border border-black bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-100"
                            href={`/sarbatori?year=${selectedYear}`}
                        >
                            <CalendarDays
                                aria-hidden="true"
                                className="size-4"
                            />
                            Sărbători
                        </a>
                    </nav>
                </header>

                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <Link
                            aria-label={`Anul ${selectedYear - 1}`}
                            className="inline-flex size-10 items-center justify-center rounded-md border border-black bg-white text-black hover:bg-gray-100"
                            search={{
                                year: selectedYear - 1,
                            }}
                            to="/"
                        >
                            <ChevronLeft
                                aria-hidden="true"
                                className="size-5"
                            />
                        </Link>
                        <h2 className="text-xl font-bold tabular-nums">
                            {selectedYear}
                        </h2>
                        <Link
                            aria-label={`Anul ${selectedYear + 1}`}
                            className="inline-flex size-10 items-center justify-center rounded-md border border-black bg-white text-black hover:bg-gray-100"
                            search={{
                                year: selectedYear + 1,
                            }}
                            to="/"
                        >
                            <ChevronRight
                                aria-hidden="true"
                                className="size-5"
                            />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {monthNames.map((monthName, monthIndex) => {
                            const isCurrentMonth =
                                selectedYear === currentYear &&
                                monthIndex === currentMonthIndex;

                            return (
                                <Link
                                    className={`flex min-h-28 flex-col justify-between rounded-md border p-4 text-black hover:bg-gray-100 ${
                                        isCurrentMonth
                                            ? "border-teal-700 bg-teal-50"
                                            : "border-gray-200 bg-white"
                                    }`}
                                    key={monthName}
                                    params={{
                                        an: String(selectedYear),
                                        luna: String(monthIndex + 1),
                                    }}
                                    to="/$an/$luna"
                                >
                                    <span className="text-lg font-bold">
                                        {monthName}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        Luna {monthIndex + 1}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}
