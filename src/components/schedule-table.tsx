import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    EmployeeFunction,
    NotatieGrafic,
    ScheduleCellCode,
    Compartment,
} from "@/lib/constants";
import { NOTATII_GRAFIC } from "@/lib/constants";
import {
    calculateScheduleHours,
    getDateKey,
    isDoubleHoursDate,
    isWeekendDate,
} from "@/lib/schedule-hours";

export const INACTIVE_DAY_MARKER = "///";
const ALL_SCHEDULE_CELL_CODES = Object.keys(
    NOTATII_GRAFIC,
) as Array<ScheduleCellCode>;

export type EmployeeSchedule = {
    id: string;
    name: string;
    functie: EmployeeFunction;
    values: Record<number, string>;
};

type SaveScheduleCell = (params: {
    employeeId: string;
    year: number;
    monthIndex: number;
    day: number;
    compartment: Compartment;
    value: string;
}) => Promise<void>;

type ScheduleTableProps = {
    year: number;
    monthIndex: number;
    initialRows: Array<EmployeeSchedule>;
    holidayDateKeys: Array<string>;
    isNextMonthFirstDayHoliday: boolean;
    expectedDailyShiftCount?: number;
    showHourTotals?: boolean;
    showWarnings?: boolean;
    readOnly?: boolean;
    compartment: Compartment;
    scheduleCellCodes?: ReadonlyArray<ScheduleCellCode>;
    saveScheduleCell?: SaveScheduleCell;
};

type CellPosition = {
    day: number;
    rowIndex: number;
};

const allDays = Array.from({ length: 31 }, (_, index) => index + 1);

function getDaysInMonth(year: number, monthIndex: number) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function getCellKey(rowIndex: number, day: number) {
    return `${rowIndex}-${day}`;
}

function normalizeNotation(
    value: string,
    scheduleCellCodes: ReadonlyArray<ScheduleCellCode>,
) {
    const trimmedValue = value.trim().toLocaleUpperCase("ro-RO");

    if (trimmedValue === "") {
        return "";
    }

    return isNotationKey(trimmedValue) &&
        scheduleCellCodes.includes(trimmedValue)
        ? trimmedValue
        : "";
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

export function ScheduleTable({
    year,
    monthIndex,
    initialRows,
    holidayDateKeys,
    isNextMonthFirstDayHoliday,
    expectedDailyShiftCount,
    showHourTotals = true,
    showWarnings = true,
    readOnly = false,
    compartment,
    scheduleCellCodes = ALL_SCHEDULE_CELL_CODES,
    saveScheduleCell,
}: ScheduleTableProps) {
    const daysInMonth = useMemo(
        () => getDaysInMonth(year, monthIndex),
        [monthIndex, year],
    );
    const holidayDateKeySet = useMemo(
        () => new Set(holidayDateKeys),
        [holidayDateKeys],
    );
    const nextMonthFirstDay = useMemo(
        () => new Date(year, monthIndex + 1, 1),
        [monthIndex, year],
    );
    const isLegalHoliday = useCallback(
        (date: Date) =>
            isNextMonthFirstDayHoliday &&
            date.getFullYear() === nextMonthFirstDay.getFullYear() &&
            date.getMonth() === nextMonthFirstDay.getMonth() &&
            date.getDate() === 1,
        [isNextMonthFirstDayHoliday, nextMonthFirstDay],
    );
    const doubleDateKeySet = useMemo(
        () =>
            new Set([
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
            ]),
        [daysInMonth, holidayDateKeySet, monthIndex, year],
    );
    const monthlyWorkingHours = useMemo(() => {
        const workingDays = Array.from(
            { length: daysInMonth },
            (_, index) => index + 1,
        ).filter(
            day => !isDoubleHoursDate(year, monthIndex, day, doubleDateKeySet),
        );

        return workingDays.length * 8;
    }, [daysInMonth, doubleDateKeySet, monthIndex, year]);
    const [rows, setRows] = useState<Array<EmployeeSchedule>>(initialRows);
    const shiftCountMismatchDaySet = useMemo(() => {
        if (expectedDailyShiftCount === undefined) {
            return new Set<number>();
        }

        return new Set(
            Array.from({ length: daysInMonth }, (_, index) => index + 1).filter(
                day => {
                    const counts = rows.reduce(
                        (currentCounts, row) => {
                            const value = row.values[day];

                            if (value === "Z") {
                                currentCounts.z += 1;
                            }

                            if (value === "N") {
                                currentCounts.n += 1;
                            }

                            return currentCounts;
                        },
                        {
                            n: 0,
                            z: 0,
                        },
                    );

                    return (
                        counts.z !== expectedDailyShiftCount ||
                        counts.n !== expectedDailyShiftCount
                    );
                },
            ),
        );
    }, [daysInMonth, expectedDailyShiftCount, rows]);
    const totalDoubleHours = useMemo(
        () =>
            rows.reduce(
                (tableTotal, row) =>
                    tableTotal +
                    getRowDoubleHours(row, daysInMonth, {
                        doubleDateKeySet,
                        isLegalHoliday,
                        monthIndex,
                        year,
                    }),
                0,
            ),
        [daysInMonth, doubleDateKeySet, isLegalHoliday, monthIndex, rows, year],
    );
    const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
    const [draftValue, setDraftValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const cellRefs = useRef(new Map<string, HTMLButtonElement>());

    useEffect(() => {
        setRows(initialRows);
        setEditingCell(null);
    }, [initialRows]);

    useEffect(() => {
        if (!editingCell) {
            return;
        }

        inputRef.current?.focus();
        inputRef.current?.select();
    }, [editingCell]);

    const focusCell = useCallback((position: CellPosition) => {
        requestAnimationFrame(() => {
            cellRefs.current
                .get(getCellKey(position.rowIndex, position.day))
                ?.focus();
        });
    }, []);

    const getNextCell = useCallback(
        (
            currentCell: CellPosition,
            direction: "down" | "left" | "right" | "up",
        ) => {
            const lastRowIndex = rows.length - 1;

            if (direction === "right") {
                if (currentCell.day < daysInMonth) {
                    return { ...currentCell, day: currentCell.day + 1 };
                }

                if (currentCell.rowIndex < lastRowIndex) {
                    return { rowIndex: currentCell.rowIndex + 1, day: 1 };
                }

                return null;
            }

            if (direction === "left") {
                if (currentCell.day > 1) {
                    return { ...currentCell, day: currentCell.day - 1 };
                }

                if (currentCell.rowIndex > 0) {
                    return {
                        rowIndex: currentCell.rowIndex - 1,
                        day: daysInMonth,
                    };
                }

                return null;
            }

            if (direction === "down" && currentCell.rowIndex < lastRowIndex) {
                return { ...currentCell, rowIndex: currentCell.rowIndex + 1 };
            }

            if (direction === "up" && currentCell.rowIndex > 0) {
                return { ...currentCell, rowIndex: currentCell.rowIndex - 1 };
            }

            return null;
        },
        [daysInMonth, rows.length],
    );

    const commitCell = useCallback(
        async (nextCell?: CellPosition | null) => {
            if (!editingCell) {
                return;
            }

            const row = rows[editingCell.rowIndex];
            const value = normalizeNotation(draftValue, scheduleCellCodes);

            setRows(currentRows =>
                currentRows.map((currentRow, rowIndex) =>
                    rowIndex === editingCell.rowIndex
                        ? {
                              ...currentRow,
                              values: {
                                  ...currentRow.values,
                                  [editingCell.day]: value,
                              },
                          }
                        : currentRow,
                ),
            );
            setEditingCell(null);

            if (saveScheduleCell) {
                await saveScheduleCell({
                    employeeId: row.id,
                    year,
                    monthIndex,
                    day: editingCell.day,
                    compartment,
                    value,
                });
            }

            if (nextCell) {
                focusCell(nextCell);
            }
        },
        [
            draftValue,
            editingCell,
            focusCell,
            monthIndex,
            rows,
            scheduleCellCodes,
            saveScheduleCell,
            year,
        ],
    );

    const cancelCell = useCallback(() => {
        setEditingCell(null);
        if (editingCell) {
            focusCell(editingCell);
        }
    }, [editingCell, focusCell]);

    function startEditing(position: CellPosition, value: string) {
        setDraftValue(value);
        setEditingCell(position);
    }

    function handleCellKeyDown(
        event: React.KeyboardEvent<HTMLInputElement>,
        currentCell: CellPosition,
    ) {
        if (event.key === "Escape") {
            event.preventDefault();
            cancelCell();
            return;
        }

        const directionByKey: Partial<
            Record<string, "down" | "left" | "right" | "up">
        > = {
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
        };
        const direction = directionByKey[event.key];

        if (direction) {
            event.preventDefault();
            return commitCell(getNextCell(currentCell, direction));
        }

        if (event.key === "Enter") {
            event.preventDefault();
            return commitCell(
                getNextCell(currentCell, event.shiftKey ? "up" : "down"),
            );
        }

        if (event.key === "Tab") {
            event.preventDefault();
            return commitCell(
                getNextCell(currentCell, event.shiftKey ? "left" : "right"),
            );
        }
    }

    return (
        <section className="space-y-3">
            <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-base font-bold whitespace-nowrap">
                    <colgroup>
                        <col className="w-36" />
                        {allDays.map(day => (
                            <col key={day} />
                        ))}
                        {showHourTotals ? (
                            <>
                                <col className="w-20" />
                                <col className="w-20" />
                            </>
                        ) : null}
                    </colgroup>
                    <thead>
                        <tr>
                            <th
                                className="w-max border border-black px-px py-0.5 text-center whitespace-nowrap"
                                rowSpan={2}
                            >
                                Nume Prenume
                            </th>
                            <th
                                className="border border-black px-0 py-1 text-center"
                                colSpan={allDays.length}
                            >
                                Grafic
                            </th>
                            {showHourTotals ? (
                                <>
                                    <th className="w-max border border-black px-1 py-0.5 text-center whitespace-nowrap">
                                        Total ore
                                    </th>
                                    <th className="w-max border border-black px-1 py-0.5 text-center whitespace-nowrap">
                                        Ore S/D
                                    </th>
                                </>
                            ) : null}
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
                                const hasShiftCountMismatch =
                                    shiftCountMismatchDaySet.has(day);

                                return (
                                    <th
                                        className={`h-7 border border-black px-0 text-center leading-7 ${
                                            showWarnings &&
                                            hasShiftCountMismatch
                                                ? "bg-yellow-100"
                                                : isDoubleHours
                                                  ? "bg-red-100"
                                                  : ""
                                        }`}
                                        key={day}
                                    >
                                        {day}
                                    </th>
                                );
                            })}
                            {showHourTotals ? (
                                <>
                                    <th className="h-7 border border-black px-1 py-0.5 text-center whitespace-nowrap tabular-nums">
                                        {monthlyWorkingHours}
                                    </th>
                                    <th className="h-7 border border-black px-1 py-0.5 text-center whitespace-nowrap tabular-nums">
                                        {totalDoubleHours}
                                    </th>
                                </>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            const values = allDays.map(day =>
                                day <= daysInMonth
                                    ? (row.values[day] ?? "")
                                    : INACTIVE_DAY_MARKER,
                            );
                            const validValues = values.slice(0, daysInMonth);
                            const calculatedTotalHours = validValues.reduce(
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
                                    }).workedHours,
                                0,
                            );
                            const calculatedDoubleHours = validValues.reduce(
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
                            const totalHours = calculatedTotalHours;
                            const doubleHours = calculatedDoubleHours;

                            return (
                                <tr key={row.id}>
                                    <th className="z-10 w-max border border-black bg-inherit px-px py-0.5 text-center whitespace-nowrap">
                                        {row.name.toLocaleUpperCase("ro-RO")}
                                    </th>
                                    {values.map((value, index) => {
                                        const day = index + 1;
                                        const isInactive = day > daysInMonth;
                                        const currentCell = {
                                            rowIndex,
                                            day,
                                        };
                                        const isEditing =
                                            editingCell?.rowIndex ===
                                                rowIndex &&
                                            editingCell.day === day;

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
                                                {isInactive ? (
                                                    <div className="h-7 w-full overflow-hidden px-0 text-center leading-7">
                                                        {INACTIVE_DAY_MARKER}
                                                    </div>
                                                ) : isEditing && !readOnly ? (
                                                    <input
                                                        className={`box-border block h-7 w-full max-w-full min-w-0 border-0 px-0 text-center tabular-nums outline-2 outline-black ${
                                                            isDoubleHours
                                                                ? "bg-red-100"
                                                                : "bg-white"
                                                        }`}
                                                        onBlur={() =>
                                                            commitCell()
                                                        }
                                                        onChange={event =>
                                                            setDraftValue(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        onKeyDown={event =>
                                                            handleCellKeyDown(
                                                                event,
                                                                currentCell,
                                                            )
                                                        }
                                                        ref={inputRef}
                                                        size={1}
                                                        value={draftValue}
                                                    />
                                                ) : readOnly ? (
                                                    <div
                                                        className={`h-7 w-full overflow-hidden px-0 text-center leading-7 tabular-nums ${
                                                            isDoubleHours
                                                                ? "bg-red-100"
                                                                : ""
                                                        }`}
                                                    >
                                                        {renderNotation(value)}
                                                    </div>
                                                ) : (
                                                    <button
                                                        className={`block h-7 w-full min-w-0 overflow-hidden px-0 text-center leading-7 tabular-nums focus:outline-2 focus:outline-black ${
                                                            isDoubleHours
                                                                ? "bg-red-100"
                                                                : ""
                                                        }`}
                                                        onClick={() =>
                                                            startEditing(
                                                                currentCell,
                                                                value,
                                                            )
                                                        }
                                                        onFocus={() =>
                                                            startEditing(
                                                                currentCell,
                                                                value,
                                                            )
                                                        }
                                                        ref={element => {
                                                            if (element) {
                                                                cellRefs.current.set(
                                                                    getCellKey(
                                                                        rowIndex,
                                                                        day,
                                                                    ),
                                                                    element,
                                                                );
                                                            } else {
                                                                cellRefs.current.delete(
                                                                    getCellKey(
                                                                        rowIndex,
                                                                        day,
                                                                    ),
                                                                );
                                                            }
                                                        }}
                                                        type="button"
                                                    >
                                                        {renderNotation(value)}
                                                    </button>
                                                )}
                                            </td>
                                        );
                                    })}
                                    {showHourTotals ? (
                                        <>
                                            <td
                                                className={`w-max border border-black px-1 py-0.5 text-center whitespace-nowrap tabular-nums ${
                                                    showWarnings &&
                                                    totalHours !==
                                                        monthlyWorkingHours
                                                        ? "bg-yellow-100"
                                                        : ""
                                                }`}
                                            >
                                                {totalHours}
                                            </td>
                                            <td className="w-max border border-black px-1 py-0.5 text-center whitespace-nowrap tabular-nums">
                                                {doubleHours}
                                            </td>
                                        </>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function getRowDoubleHours(
    row: EmployeeSchedule,
    daysInMonth: number,
    {
        doubleDateKeySet,
        isLegalHoliday,
        monthIndex,
        year,
    }: {
        doubleDateKeySet: ReadonlySet<string>;
        isLegalHoliday: (date: Date) => boolean;
        monthIndex: number;
        year: number;
    },
) {
    return Array.from({ length: daysInMonth }, (_, index) => index + 1).reduce(
        (rowTotal, day) =>
            rowTotal +
            calculateScheduleHours({
                day,
                doubleDateKeys: doubleDateKeySet,
                isLegalHoliday,
                monthIndex,
                functie: row.functie,
                shiftCode: row.values[day] ?? "",
                year,
            }).doubleWorkedHours,
        0,
    );
}
