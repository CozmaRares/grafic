import {
    Link,
    createFileRoute,
    redirect,
    useRouter,
} from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { CalendarDays, Lock, LockOpen, Printer } from "lucide-react";
import { z } from "zod";
import { ScheduleTable } from "@/components/schedule-table";
import { TimesheetTable } from "@/components/timesheet-table";
import {
    generateSnapshot as generateScheduleSnapshot,
    getMonthlySchedule,
    invalidateSnapshot as invalidateScheduleSnapshot,
    isIncompleteLegalHolidaysError,
    isInvalidScheduleCellCodeError,
    isMonthLockedError,
    isSnapshotEmployeeMismatchError,
    saveScheduleCell as saveScheduleCellRecord,
} from "@/db";
import { SCHEDULE_CELL_CODES, COMPARTMENTS } from "@/lib/constants";
import { unwrapServerResult } from "@/lib/server-result";

const scheduleGroupsSchema = z.object({
    monthIndex: z.number().int().min(0).max(11),
    year: z.number().int().positive(),
});

const scheduleCellSchema = z.object({
    employeeId: z.coerce.number().int().positive(),
    year: z.number().int().positive(),
    monthIndex: z.number().int().min(0).max(11),
    day: z.number().int().min(1).max(31),
    compartment: z.enum(COMPARTMENTS),
    value: z
        .string()
        .trim()
        .transform(value => value.toLocaleUpperCase("ro-RO"))
        .pipe(z.union([z.literal(""), z.enum(SCHEDULE_CELL_CODES)])),
});

const getScheduleGroups = createServerFn({ method: "GET" })
    .validator(scheduleGroupsSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(getMonthlySchedule(data));
    });

const generateSnapshot = createServerFn({ method: "POST" })
    .validator(scheduleGroupsSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(
            generateScheduleSnapshot(data),
            getGenerateSnapshotErrorMessage,
        );
    });

const invalidateSnapshot = createServerFn({ method: "POST" })
    .validator(scheduleGroupsSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(
            invalidateScheduleSnapshot(data),
            getInvalidateSnapshotErrorMessage,
        );
    });

const saveScheduleCell = createServerFn({ method: "POST" })
    .validator(scheduleCellSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(
            saveScheduleCellRecord(data),
            getScheduleErrorMessage,
        );
    });

function getScheduleErrorMessage(error: { type: string }) {
    if (isMonthLockedError(error)) {
        return "Luna este blocată. Invalidează snapshot-ul pentru editare.";
    }

    if (isInvalidScheduleCellCodeError(error)) {
        return "Codul de tură nu este valid pentru acest angajat.";
    }

    if (isIncompleteLegalHolidaysError(error)) {
        return "Setează sărbătorile variabile înainte de a edita graficul.";
    }

    return "Graficul nu a putut fi salvat.";
}

function getGenerateSnapshotErrorMessage(error: { type: string }) {
    if (isMonthLockedError(error)) {
        return "Luna este deja blocată.";
    }

    if (isIncompleteLegalHolidaysError(error)) {
        return "Setează sărbătorile variabile înainte de a genera pontajul.";
    }

    return "Graficul nu a putut fi salvat.";
}

function getInvalidateSnapshotErrorMessage(error: { type: string }) {
    if (isSnapshotEmployeeMismatchError(error)) {
        return "Snapshot-ul nu poate fi invalidat deoarece datele angajaților s-au schimbat.";
    }

    return "Snapshot-ul nu a putut fi invalidat.";
}

export const Route = createFileRoute("/$an/$luna")({
    loader: async ({ params }) => {
        const year = getYear(params.an);
        const monthIndex = getMonthIndex(params.luna);

        if (year === null || monthIndex === null) {
            const currentDate = new Date();

            throw redirect({
                params: {
                    an: String(currentDate.getFullYear()),
                    luna: String(currentDate.getMonth() + 1),
                },
                to: "/$an/$luna",
            });
        }

        return {
            monthIndex,
            monthLabel: monthNames[monthIndex],
            scheduleGroups: await getScheduleGroups({
                data: {
                    monthIndex,
                    year,
                },
            }),
            year,
        };
    },
    head: ({ loaderData }) => ({
        meta: [
            {
                title: `${capitalize(loaderData!.monthLabel)} ${loaderData!.year}`,
            },
        ],
    }),
    component: RouteComponent,
});

const monthNames = [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
];

function capitalize(value: string) {
    return value.charAt(0).toLocaleUpperCase("ro-RO") + value.slice(1);
}

function getMonthIndex(luna: string) {
    const numericMonth = Number(luna);

    if (
        Number.isInteger(numericMonth) &&
        numericMonth >= 1 &&
        numericMonth <= 12
    ) {
        return numericMonth - 1;
    }

    const normalizedMonth = luna.toLocaleLowerCase("ro-RO");
    const monthIndex = monthNames.findIndex(month => month === normalizedMonth);

    return monthIndex === -1 ? null : monthIndex;
}

function getYear(an: string) {
    const parsedYear = Number(an);

    if (Number.isInteger(parsedYear) && parsedYear > 0) {
        return parsedYear;
    }

    return null;
}

function RouteComponent() {
    const {
        monthIndex,
        monthLabel,
        scheduleGroups: loadedScheduleData,
        year,
    } = Route.useLoaderData();
    const saveScheduleCellFn = useServerFn(saveScheduleCell);
    const generateSnapshotFn = useServerFn(generateSnapshot);
    const invalidateSnapshotFn = useServerFn(invalidateSnapshot);
    const router = useRouter();

    async function handleGenerateSnapshot() {
        await generateSnapshotFn({
            data: {
                monthIndex,
                year,
            },
        });
        await router.invalidate();
    }

    async function handleInvalidateSnapshot() {
        if (
            !globalThis.confirm(
                "Invalidezi pontajul și deblochezi luna pentru editare?",
            )
        ) {
            return;
        }

        await invalidateSnapshotFn({
            data: {
                monthIndex,
                year,
            },
        });
        await router.invalidate();
    }

    return (
        <main className="min-h-screen p-2">
            <div className="w-full space-y-3">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                            Grafic lunar
                        </p>
                        <h1 className="text-2xl font-bold capitalize sm:text-3xl">
                            {monthLabel} {year}
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            className="inline-flex w-fit items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                            search={{
                                year,
                            }}
                            to="/"
                        >
                            <CalendarDays
                                aria-hidden="true"
                                className="size-4"
                            />
                            Calendar
                        </Link>
                        {loadedScheduleData.isBlocked ? null : loadedScheduleData.isLocked ? (
                            <button
                                className="inline-flex w-fit items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                                onClick={handleInvalidateSnapshot}
                                type="button"
                            >
                                <LockOpen
                                    aria-hidden="true"
                                    className="size-4"
                                />
                                Invalidează pontaj
                            </button>
                        ) : (
                            <button
                                className="inline-flex w-fit items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                                onClick={handleGenerateSnapshot}
                                type="button"
                            >
                                <Lock
                                    aria-hidden="true"
                                    className="size-4"
                                />
                                Generează pontaj
                            </button>
                        )}
                    </div>
                </header>

                {loadedScheduleData.isBlocked ? (
                    <section className="max-w-xl space-y-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                        <h2 className="text-lg font-bold">
                            Sărbătorile variabile nu sunt setate
                        </h2>
                        <p className="text-sm">
                            Setează sărbătorile variabile pentru anul{" "}
                            {loadedScheduleData.year} înainte de a edita
                            graficul.
                        </p>
                        <ul className="list-disc pl-5 text-sm">
                            {loadedScheduleData.missingVariableHolidays.map(
                                holiday => (
                                    <li key={holiday}>{holiday}</li>
                                ),
                            )}
                        </ul>
                        <Link
                            className="inline-flex w-fit items-center rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                            search={{
                                year: loadedScheduleData.year,
                            }}
                            to="/sarbatori"
                        >
                            Setează sărbători
                        </Link>
                    </section>
                ) : loadedScheduleData.isLocked ? (
                    loadedScheduleData.timesheetGroups.map(group => (
                        <section
                            className="space-y-3"
                            key={group.printSlug}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold">
                                    {group.title}
                                </h2>
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                                    params={{
                                        an: String(year),
                                        luna: String(monthIndex + 1),
                                        printSlug: group.printSlug,
                                    }}
                                    to="/$an/$luna/print/$printSlug"
                                >
                                    <Printer
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                    Print
                                </Link>
                            </div>
                            <TimesheetTable
                                holidayDateKeys={group.holidayDateKeys}
                                isNextMonthFirstDayHoliday={
                                    group.isNextMonthFirstDayHoliday
                                }
                                monthIndex={monthIndex}
                                rows={group.rows}
                                year={year}
                            />
                        </section>
                    ))
                ) : null}

                {loadedScheduleData.isBlocked
                    ? null
                    : loadedScheduleData.scheduleGroups.map(group => (
                          <section
                              className="space-y-3"
                              key={group.title}
                          >
                              <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-lg font-bold">
                                      {group.title}
                                  </h2>
                                  {group.showHourTotals === false ? null : (
                                      <Link
                                          className="inline-flex items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                                          params={{
                                              an: String(year),
                                              luna: String(monthIndex + 1),
                                              printSlug: group.printSlug,
                                          }}
                                          to="/$an/$luna/print/$printSlug"
                                      >
                                          <Printer
                                              aria-hidden="true"
                                              className="size-4"
                                          />
                                          Print
                                      </Link>
                                  )}
                              </div>
                              <ScheduleTable
                                  expectedDailyShiftCount={
                                      group.expectedDailyShiftCount
                                  }
                                  holidayDateKeys={group.holidayDateKeys}
                                  initialRows={group.rows}
                                  isNextMonthFirstDayHoliday={
                                      group.isNextMonthFirstDayHoliday
                                  }
                                  monthIndex={monthIndex}
                                  readOnly={loadedScheduleData.isLocked}
                                  showHourTotals={group.showHourTotals}
                                  compartment={group.compartment}
                                  scheduleCellCodes={group.scheduleCellCodes}
                                  saveScheduleCell={
                                      loadedScheduleData.isLocked
                                          ? undefined
                                          : params =>
                                                saveScheduleCellFn({
                                                    data: params,
                                                })
                                  }
                                  year={year}
                              />
                          </section>
                      ))}
            </div>
        </main>
    );
}
