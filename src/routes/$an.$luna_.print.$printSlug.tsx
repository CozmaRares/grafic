import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ScheduleTable } from "@/components/schedule-table";
import { TimesheetTable } from "@/components/timesheet-table";
import { getPrintSchedule as getPrintScheduleView } from "@/db";
import type { PrintableScheduleView, PrintSettings } from "@/domain/schedule";
import type { Compartment } from "@/lib/constants";
import { COLORS, COMPARTMENT_LABELS } from "@/lib/constants";
import { unwrapServerResult } from "@/lib/server-result";

const printScheduleSchema = z.object({
    monthIndex: z.number().int().min(0).max(11),
    printSlug: z.string().trim().min(1),
    year: z.number().int().positive(),
});

const getPrintSchedule = createServerFn({ method: "GET" })
    .validator(printScheduleSchema)
    .handler(({ data }) => unwrapServerResult(getPrintScheduleView(data)));

export const Route = createFileRoute("/$an/$luna_/print/$printSlug")({
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

        const printSchedule = await getPrintSchedule({
            data: {
                monthIndex,
                printSlug: params.printSlug,
                year,
            },
        });

        if (!printSchedule) {
            throw redirect({
                params: {
                    an: String(year),
                    luna: String(monthIndex + 1),
                },
                to: "/$an/$luna",
            });
        }

        return {
            monthIndex,
            monthLabel: monthNames[monthIndex],
            printSchedule,
            year,
        };
    },
    head: ({ loaderData }) => ({
        meta: [
            {
                title: `${getPrintScheduleTitle(loaderData!.printSchedule)} - ${capitalize(loaderData!.monthLabel)} ${loaderData!.year}`,
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

function getPrintScheduleTitle(printSchedule: PrintableScheduleView | null) {
    if (!printSchedule) {
        return "";
    }

    return printSchedule.kind === "timesheet"
        ? printSchedule.timesheetGroup.title
        : printSchedule.group.title;
}

function RouteComponent() {
    const { monthIndex, monthLabel, printSchedule, year } =
        Route.useLoaderData();

    return (
        <>
            <a
                className="m-4 inline-flex w-fit items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100 print:hidden"
                href={`/${year}/${monthIndex + 1}`}
            >
                Inapoi
            </a>

            <div className="space-y-4 p-8 print:flex print:min-h-screen print:flex-col print:justify-center print:space-y-4">
                {printSchedule.kind === "timesheet" ? (
                    <>
                        <TimesheetPrintHeader
                            compartment={
                                printSchedule.timesheetGroup.compartment
                            }
                            monthLabel={monthLabel}
                            year={year}
                        />
                        <TimesheetTable
                            holidayDateKeys={printSchedule.holidayDateKeys}
                            isNextMonthFirstDayHoliday={
                                printSchedule.isNextMonthFirstDayHoliday
                            }
                            monthIndex={monthIndex}
                            rows={printSchedule.rows}
                            year={year}
                        />
                        <TimesheetPrintFooter
                            printSettings={printSchedule.printSettings}
                        />
                    </>
                ) : (
                    <>
                        <PrintHeader
                            compartment={printSchedule.group.compartment}
                            monthLabel={monthLabel}
                            printSettings={printSchedule.printSettings}
                            year={year}
                        />
                        <ScheduleTable
                            expectedDailyShiftCount={
                                printSchedule.group.expectedDailyShiftCount
                            }
                            holidayDateKeys={printSchedule.holidayDateKeys}
                            initialRows={printSchedule.rows}
                            isNextMonthFirstDayHoliday={
                                printSchedule.isNextMonthFirstDayHoliday
                            }
                            monthIndex={monthIndex}
                            showHourTotals={printSchedule.group.showHourTotals}
                            showWarnings={false}
                            readOnly
                            scheduleCellCodes={
                                printSchedule.group.scheduleCellCodes
                            }
                            compartment={printSchedule.group.compartment}
                            year={year}
                        />
                        <PrintFooter
                            printSettings={printSchedule.printSettings}
                        />
                    </>
                )}
            </div>
        </>
    );
}

function PrintHeader({
    compartment,
    monthLabel,
    printSettings,
    year,
}: {
    compartment: Compartment;
    monthLabel: string;
    printSettings: PrintSettings;
    year: number;
}) {
    return (
        <div className="px-4 font-bold">
            <div className="flex items-start justify-between text-center">
                <div className="text-center">
                    <p>COMPARTIMENTUL</p>
                    <p>{COMPARTMENT_LABELS[compartment]}</p>
                </div>
                <div className="text-center">
                    <p>GRAFICUL</p>
                    <p>
                        CU EVIDENȚA TIMPULUI DE LUCRU A PERSONALULUI PE LUNA{" "}
                        {monthLabel.toLocaleUpperCase("ro-RO")} {year}
                    </p>
                </div>
                <div className="text-center">
                    <p>APROBAT MANAGER,</p>
                    <p>{printSettings.managerName}</p>
                </div>
            </div>
        </div>
    );
}

function PrintFooter({ printSettings }: { printSettings: PrintSettings }) {
    return (
        <div className="flex justify-between px-4 font-bold">
            <div className="text-center">
                <p>ȘEF SECȚIE,</p>
                <p>{printSettings.sectionChiefName}</p>
            </div>
            <div className="text-center">
                <p>ÎNTOCMIT,</p>
                <p>{printSettings.preparedByName}</p>
            </div>
        </div>
    );
}

function TimesheetPrintHeader({
    compartment,
    monthLabel,
    year,
}: {
    compartment: Compartment;
    monthLabel: string;
    year: number;
}) {
    return (
        <div className="grid grid-cols-[1fr_4fr_1fr_1fr_1fr] items-start px-4 font-bold">
            <div>
                <p>COMPARTIMENTUL</p>
                <p>{COMPARTMENT_LABELS[compartment]}</p>
            </div>
            <div className="text-center">
                <p>FOAIE DE PREZENȚĂ COLECTIVĂ</p>
                <p>
                    PE LUNA {monthLabel.toLocaleUpperCase("ro-RO")} {year}
                </p>
            </div>
            <div>
                <p>
                    <span
                        className={`inline-block w-8 text-right ${COLORS.tura1}`}
                    >
                        8
                    </span>{" "}
                    - tură I
                </p>
                <p>
                    <span
                        className={`inline-block w-8 text-right ${COLORS.tura2}`}
                    >
                        4
                    </span>{" "}
                    - tură II
                </p>
                <p>
                    <span
                        className={`inline-block w-8 text-right ${COLORS.tura3}`}
                    >
                        8
                    </span>{" "}
                    - tură III
                </p>
            </div>
            <div>
                <p>B - boală</p>
                <p>C - concedii de odihnă</p>
                <p>ZS - ziua sănătății</p>
            </div>
            <div>
                <p>CF - concedii formare profesională</p>
                <p>CE - concedii evenimente</p>
            </div>
        </div>
    );
}

function TimesheetPrintFooter({
    printSettings,
}: {
    printSettings: PrintSettings;
}) {
    return (
        <div className="grid grid-cols-3 px-4 font-bold">
            <div className="text-center">
                <p>MANAGER,</p>
                <p>{printSettings.managerName}</p>
            </div>
            <div className="text-center">
                <p>ȘEF SECȚIE,</p>
                <p>{printSettings.sectionChiefName}</p>
            </div>
            <div className="text-center">
                <p>ÎNTOCMIT,</p>
                <p>{printSettings.preparedByName}</p>
            </div>
        </div>
    );
}
