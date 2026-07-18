import type {
    EmployeeFunction,
    NotatieGrafic,
    ScheduleCellCode,
    TimesheetNotationPart,
} from "@/lib/constants";
import { NOTATII_GRAFIC, TIMESHEET_NOTATION_LABELS } from "@/lib/constants";
import {
    calculateScheduleHours,
    getDateKey,
    isDoubleHoursDate,
    isWeekendDate,
} from "@/lib/schedule-hours";
import { INACTIVE_DAY_MARKER } from "./schedule-table";

export type TimesheetRow = {
    groupOrder: number;
    id: string;
    matricol: number;
    name: string;
    functie: EmployeeFunction;
    values: Record<number, string>;
};

type TimesheetTableProps = {
    holidayDateKeys: Array<string>;
    isNextMonthFirstDayHoliday: boolean;
    monthIndex: number;
    rows: Array<TimesheetRow>;
    year: number;
};

const allDays = Array.from({ length: 31 }, (_, index) => index + 1);
const summaryCodes = ["C", "CF", "CE", "B", "ZS"] as const;
const timesheetNotationLabels: Partial<
    Record<ScheduleCellCode, ReadonlyArray<TimesheetNotationPart>>
> = TIMESHEET_NOTATION_LABELS;

function getDaysInMonth(year: number, monthIndex: number) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function isNotationKey(value: string): value is keyof typeof NOTATII_GRAFIC {
    return Object.hasOwn(NOTATII_GRAFIC, value);
}

function renderNotation(value: string) {
    if (value === "" || !isNotationKey(value)) {
        return null;
    }

    const notation: NotatieGrafic = NOTATII_GRAFIC[value];
    const className = notation.color;

    if (notation.type === "superscript") {
        return <sup className={className}>{value}</sup>;
    }

    return <span className={className}>{value}</span>;
}

function renderTimesheetNotation(value: string) {
    if (value === "" || !isNotationKey(value)) {
        return null;
    }

    const mappedNotation = timesheetNotationLabels[value];

    if (!mappedNotation) {
        return renderNotation(value);
    }

    return mappedNotation.map((part, index) => {
        const className = part.color;
        const key = `${part.text}-${part.type}-${index}`;

        if (part.type === "superscript") {
            return (
                <sup
                    className={className}
                    key={key}
                >
                    {part.text}
                </sup>
            );
        }

        return (
            <span
                className={className}
                key={key}
            >
                {part.text}
            </span>
        );
    });
}

export function TimesheetTable({
    holidayDateKeys,
    isNextMonthFirstDayHoliday,
    monthIndex,
    rows,
    year,
}: TimesheetTableProps) {
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const holidayDateKeySet = new Set(holidayDateKeys);
    const nextMonthFirstDay = new Date(year, monthIndex + 1, 1);
    const isLegalHoliday = (date: Date) =>
        isNextMonthFirstDayHoliday &&
        date.getFullYear() === nextMonthFirstDay.getFullYear() &&
        date.getMonth() === nextMonthFirstDay.getMonth() &&
        date.getDate() === 1;
    const doubleDateKeySet = new Set([
        ...holidayDateKeySet,
        ...Array.from({ length: daysInMonth }, (_, index) =>
            getDateKey(year, monthIndex, index + 1),
        ).filter(dateKey => {
            const date = new Date(`${dateKey}T00:00:00`);

            return isWeekendDate(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
            );
        }),
    ]);

    return (
        <section className="space-y-3">
            <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-sm font-bold whitespace-nowrap">
                    <colgroup>
                        <col className="w-20" />
                        <col className="w-40" />
                        <col className="w-28" />
                        {allDays.map(day => (
                            <col key={day} />
                        ))}
                        <col className="w-16" />
                        <col className="w-16" />
                        <col className="w-12" />
                        {summaryCodes.map(code => (
                            <col
                                className="w-12"
                                key={code}
                            />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th
                                className="border border-black px-1 py-0.5 text-center whitespace-normal"
                                rowSpan={2}
                            >
                                <p>Nr.</p>
                                <p>Matricol</p>
                            </th>
                            <th
                                className="border border-black px-1 py-0.5 text-center whitespace-normal"
                                rowSpan={2}
                            >
                                <p>Nume</p>
                                <p>Prenume</p>
                            </th>
                            <th
                                className="border border-black px-1 py-0.5 text-center whitespace-normal"
                                rowSpan={2}
                            >
                                Funcție
                            </th>
                            <th
                                className="border border-black px-0 py-1 text-center"
                                colSpan={allDays.length}
                            >
                                Pontaj
                            </th>
                            <th
                                className="border border-black px-1 py-0.5 text-center whitespace-normal"
                                rowSpan={2}
                            >
                                Total Ore
                            </th>
                            <th
                                className="border border-black px-1 py-0.5 text-center whitespace-normal"
                                rowSpan={2}
                            >
                                Ore 100%
                            </th>
                            <th
                                className="border border-black px-1 py-0.5 text-center"
                                rowSpan={2}
                            >
                                Tura
                            </th>
                            {summaryCodes.map(code => (
                                <th
                                    className="border border-black px-1 py-0.5 text-center"
                                    key={code}
                                    rowSpan={2}
                                >
                                    {code}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {allDays.map(day => {
                                const isDoubleHours =
                                    day <= daysInMonth &&
                                    isDoubleHoursDate(
                                        year,
                                        monthIndex,
                                        day,
                                        doubleDateKeySet,
                                    );

                                return (
                                    <th
                                        className={`h-7 border border-black px-0 text-center leading-7 ${
                                            isDoubleHours ? "bg-red-100" : ""
                                        }`}
                                        key={day}
                                    >
                                        {day}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => {
                            const values = allDays.map(day =>
                                day <= daysInMonth
                                    ? (row.values[day] ?? "")
                                    : INACTIVE_DAY_MARKER,
                            );
                            const validValues = values.slice(0, daysInMonth);
                            const totalHours = validValues.reduce(
                                (total, value, index) =>
                                    total +
                                    calculateScheduleHours({
                                        day: index + 1,
                                        doubleDateKeys: doubleDateKeySet,
                                        isLegalHoliday,
                                        monthIndex,
                                        functie: row.functie,
                                        shiftCode: value,
                                        year,
                                    }).effectiveHours,
                                0,
                            );
                            const doubleHours = validValues.reduce(
                                (total, value, index) =>
                                    total +
                                    calculateScheduleHours({
                                        day: index + 1,
                                        doubleDateKeys: doubleDateKeySet,
                                        isLegalHoliday,
                                        monthIndex,
                                        functie: row.functie,
                                        shiftCode: value,
                                        year,
                                    }).doubleWorkedHours,
                                0,
                            );
                            const nightShiftCount = validValues.filter(
                                value => value === "N",
                            ).length;
                            const summaryCounts = Object.fromEntries(
                                summaryCodes.map(code => [
                                    code,
                                    validValues.filter(value => value === code)
                                        .length,
                                ]),
                            ) as Record<(typeof summaryCodes)[number], number>;

                            return (
                                <tr key={`${row.id}-${row.groupOrder}`}>
                                    <th className="border border-black px-1 py-0.5 text-center tabular-nums">
                                        {row.matricol}
                                    </th>
                                    <th className="border border-black px-1 py-0.5 text-center whitespace-normal">
                                        {row.name.toLocaleUpperCase("ro-RO")}
                                    </th>
                                    <td className="border border-black px-1 py-0.5 text-center whitespace-normal">
                                        {getTimesheetFunctionLabel(row.functie)}
                                    </td>
                                    {values.map((value, index) => {
                                        const day = index + 1;
                                        const isInactive = day > daysInMonth;
                                        const isDoubleHours =
                                            !isInactive &&
                                            isDoubleHoursDate(
                                                year,
                                                monthIndex,
                                                day,
                                                doubleDateKeySet,
                                            );

                                        return (
                                            <td
                                                className="border border-black p-0"
                                                key={`${row.id}-${day}`}
                                            >
                                                <div
                                                    className={`h-7 w-full overflow-hidden px-0 text-center leading-7 tabular-nums ${
                                                        isDoubleHours
                                                            ? "bg-red-100"
                                                            : ""
                                                    }`}
                                                >
                                                    {isInactive
                                                        ? INACTIVE_DAY_MARKER
                                                        : renderTimesheetNotation(
                                                              value,
                                                          )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                                        {totalHours}
                                    </td>
                                    <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                                        {doubleHours}
                                    </td>
                                    <td className="border border-black px-1 py-0.5 text-center">
                                        {nightShiftCount >= 3 ? "T" : ""}
                                    </td>
                                    {summaryCodes.map(code => (
                                        <td
                                            className="border border-black px-1 py-0.5 text-center tabular-nums"
                                            key={code}
                                        >
                                            {summaryCounts[code] || ""}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function getTimesheetFunctionLabel(functie: EmployeeFunction) {
    return functie === "Medic Garda" ? "Medic" : functie;
}
