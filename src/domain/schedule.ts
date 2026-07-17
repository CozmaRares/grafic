import type { EmployeeSchedule } from "@/components/schedule-table";
import type { TimesheetRow } from "@/components/timesheet-table";
import type {
    EmployeeFunction,
    ScheduleCellCode,
    ScheduleGroup,
    Compartment,
} from "@/lib/constants";
import {
    SCHEDULE_CELL_CODES,
    SCHEDULE_GROUPS,
    TIMESHEET_GROUPS,
} from "@/lib/constants";
import {
    calculateScheduleHours,
    getDateKey,
    isWeekendDate,
} from "@/lib/schedule-hours";

export type ScheduleEmployee = {
    matricol: number;
    name: string;
    functie: EmployeeFunction;
};

export type ScheduleEntry = {
    day: number;
    employeeMatricol: number;
    month: number;
    compartment: Compartment;
    shiftCode: ScheduleCellCode;
    year: number;
};

export type HolidayDate = {
    day: number;
    month: number;
};

export type ScheduleSnapshotEntry = {
    day: number;
    employeeMatricol: number;
    employeeName: string;
    employeeFunction: EmployeeFunction;
    groupOrder: number;
    month: number;
    compartment: Compartment;
    shiftCode: string;
    year: number;
};

export type MonthlyScheduleGroup = ScheduleGroup & {
    holidayDateKeys: Array<string>;
    isNextMonthFirstDayHoliday: boolean;
    rows: Array<EmployeeSchedule>;
};

export type MonthlyTimesheetGroup = (typeof TIMESHEET_GROUPS)[number] & {
    holidayDateKeys: Array<string>;
    isNextMonthFirstDayHoliday: boolean;
    rows: Array<TimesheetRow>;
};

export type MonthlyScheduleView =
    | {
          isBlocked: false;
          isLocked: boolean;
          scheduleGroups: Array<MonthlyScheduleGroup>;
          timesheetGroups: Array<MonthlyTimesheetGroup>;
      }
    | {
          isBlocked: true;
          missingVariableHolidays: Array<string>;
          year: number;
      };

export type PrintSettings = {
    managerName: string;
    preparedByName: string;
    sectionChiefName: string;
};

export type PrintableScheduleView =
    | {
          group: ScheduleGroup;
          holidayDateKeys: Array<string>;
          isNextMonthFirstDayHoliday: boolean;
          kind: "schedule";
          printSettings: PrintSettings;
          rows: Array<EmployeeSchedule>;
      }
    | {
          holidayDateKeys: Array<string>;
          isNextMonthFirstDayHoliday: boolean;
          kind: "timesheet";
          printSettings: PrintSettings;
          rows: Array<TimesheetRow>;
          timesheetGroup: (typeof TIMESHEET_GROUPS)[number];
      };

export function getDaysInMonth(year: number, monthIndex: number) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

export function getHolidayDateKeys(year: number, holidays: Array<HolidayDate>) {
    return holidays.map(holiday =>
        getDateKey(year, holiday.month - 1, holiday.day),
    );
}

export function getDoubleDateKeySet({
    holidayDateKeys,
    monthIndex,
    year,
}: {
    holidayDateKeys: Array<string>;
    monthIndex: number;
    year: number;
}) {
    const daysInMonth = getDaysInMonth(year, monthIndex);

    return new Set([
        ...holidayDateKeys,
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
}

export function getValuesByCompartment(entries: Array<ScheduleEntry>) {
    const valuesByCompartment = new Map<
        Compartment,
        Map<number, Record<number, string>>
    >();

    for (const entry of entries) {
        const valuesByEmployee =
            valuesByCompartment.get(entry.compartment) ?? new Map();
        const values = valuesByEmployee.get(entry.employeeMatricol) ?? {};
        values[entry.day] = entry.shiftCode;
        valuesByEmployee.set(entry.employeeMatricol, values);
        valuesByCompartment.set(entry.compartment, valuesByEmployee);
    }

    return valuesByCompartment;
}

export function getLiveGroupRows({
    employeeData,
    group,
    valuesByCompartment,
}: {
    employeeData: Array<ScheduleEmployee>;
    group: ScheduleGroup;
    valuesByCompartment: Map<Compartment, Map<number, Record<number, string>>>;
}) {
    return employeeData
        .filter(
            employee =>
                group.functions.find(
                    ([functie]) => functie === employee.functie,
                ) !== undefined,
        )
        .sort((first, second) => {
            const firstFunctionPriority = getFunctionPriority(
                group.functions,
                first.functie,
            );
            const secondFunctionPriority = getFunctionPriority(
                group.functions,
                second.functie,
            );

            if (firstFunctionPriority !== secondFunctionPriority) {
                return secondFunctionPriority - firstFunctionPriority;
            }

            return first.name.localeCompare(second.name, "ro-RO");
        })
        .map(employee => ({
            id: String(employee.matricol),
            name: employee.name,
            functie: employee.functie,
            values:
                valuesByCompartment
                    .get(group.compartment)
                    ?.get(employee.matricol) ?? {},
        }));
}

export function getRowTotals({
    daysInMonth,
    doubleDateKeySet,
    isLegalHoliday,
    monthIndex,
    functie,
    values,
    year,
}: {
    daysInMonth: number;
    doubleDateKeySet: ReadonlySet<string>;
    isLegalHoliday?: (date: Date) => boolean;
    monthIndex: number;
    functie: EmployeeFunction;
    values: Record<number, string>;
    year: number;
}) {
    return Array.from({ length: daysInMonth }, (_, index) => index + 1).reduce(
        (totals, day) => {
            const hours = calculateScheduleHours({
                day,
                doubleDateKeys: doubleDateKeySet,
                isLegalHoliday,
                monthIndex,
                functie,
                shiftCode: values[day] ?? "",
                year,
            });

            return {
                doubleHours: totals.doubleHours + hours.doubleWorkedHours,
                totalHours: totals.totalHours + hours.workedHours,
            };
        },
        {
            doubleHours: 0,
            totalHours: 0,
        },
    );
}

export function getSnapshotScheduleGroups({
    holidayDateKeys,
    isNextMonthFirstDayHoliday,
    snapshotEntries,
}: {
    holidayDateKeys: Array<string>;
    isNextMonthFirstDayHoliday: boolean;
    snapshotEntries: Array<ScheduleSnapshotEntry>;
}) {
    const entriesByGroup = new Map<number, Array<ScheduleSnapshotEntry>>();

    for (const entry of snapshotEntries) {
        const groupEntries = entriesByGroup.get(entry.groupOrder) ?? [];
        groupEntries.push(entry);
        entriesByGroup.set(entry.groupOrder, groupEntries);
    }

    return [...entriesByGroup.entries()]
        .sort(
            ([firstOrder], [secondOrder]) =>
                getScheduleGroupPriority(firstOrder) -
                getScheduleGroupPriority(secondOrder),
        )
        .map(([groupOrder, groupEntries]) => {
            const group =
                SCHEDULE_GROUPS.find(
                    scheduleGroup => scheduleGroup.groupOrder === groupOrder,
                ) ?? SCHEDULE_GROUPS[0];

            return {
                ...group,
                groupOrder,
                holidayDateKeys,
                isNextMonthFirstDayHoliday,
                rows: getSnapshotRows({
                    snapshotEntries: groupEntries,
                }).sort((first, second) => {
                    const firstFunctionPriority = getFunctionPriority(
                        group.functions,
                        first.functie,
                    );
                    const secondFunctionPriority = getFunctionPriority(
                        group.functions,
                        second.functie,
                    );

                    if (firstFunctionPriority !== secondFunctionPriority) {
                        return secondFunctionPriority - firstFunctionPriority;
                    }

                    return first.name.localeCompare(second.name, "ro-RO");
                }),
            };
        });
}

export function getSnapshotTimesheetGroups({
    holidayDateKeys,
    isNextMonthFirstDayHoliday,
    snapshotEntries,
}: {
    holidayDateKeys: Array<string>;
    isNextMonthFirstDayHoliday: boolean;
    snapshotEntries: Array<ScheduleSnapshotEntry>;
}) {
    return TIMESHEET_GROUPS.map(timesheetGroup => {
        const rows = getSnapshotTimesheetRows({
            compartment: timesheetGroup.compartment,
            snapshotEntries: snapshotEntries.filter(
                entry => entry.compartment === timesheetGroup.compartment,
            ),
        });

        return {
            ...timesheetGroup,
            holidayDateKeys,
            isNextMonthFirstDayHoliday,
            rows,
        };
    }).filter(timesheetGroup => timesheetGroup.rows.length > 0);
}

export function getScheduleGroupPriority(groupOrder: number) {
    const index = SCHEDULE_GROUPS.findIndex(
        group => group.groupOrder === groupOrder,
    );

    return index === -1 ? SCHEDULE_GROUPS.length : index;
}

export function getSnapshotRows({
    snapshotEntries,
}: {
    snapshotEntries: Array<ScheduleSnapshotEntry>;
}) {
    const entriesByEmployee = new Map<number, Array<ScheduleSnapshotEntry>>();

    for (const entry of snapshotEntries) {
        const employeeEntries =
            entriesByEmployee.get(entry.employeeMatricol) ?? [];
        employeeEntries.push(entry);
        entriesByEmployee.set(entry.employeeMatricol, employeeEntries);
    }

    return [...entriesByEmployee.entries()]
        .map(([employeeMatricol, employeeEntries]) => {
            const firstEntry = employeeEntries[0];
            const values = Object.fromEntries(
                employeeEntries.map(entry => [entry.day, entry.shiftCode]),
            ) as Record<number, string>;

            return {
                id: String(employeeMatricol),
                name: firstEntry.employeeName,
                functie: firstEntry.employeeFunction,
                values,
            };
        })
        .sort((first, second) =>
            first.name.localeCompare(second.name, "ro-RO"),
        );
}

export function getSnapshotTimesheetRows({
    compartment,
    snapshotEntries,
}: {
    compartment: (typeof TIMESHEET_GROUPS)[number]["compartment"];
    snapshotEntries: Array<ScheduleSnapshotEntry>;
}) {
    const entriesByEmployee = new Map<number, Array<ScheduleSnapshotEntry>>();

    for (const entry of snapshotEntries) {
        const employeeEntries =
            entriesByEmployee.get(entry.employeeMatricol) ?? [];
        employeeEntries.push(entry);
        entriesByEmployee.set(entry.employeeMatricol, employeeEntries);
    }

    return [...entriesByEmployee.entries()]
        .map(([employeeMatricol, employeeEntries]) => {
            const firstEntry = employeeEntries[0];
            const values = Object.fromEntries(
                employeeEntries.map(entry => [entry.day, entry.shiftCode]),
            ) as Record<number, string>;

            return {
                groupOrder: firstEntry.groupOrder,
                id: `${compartment}-${employeeMatricol}`,
                matricol: employeeMatricol,
                name: firstEntry.employeeName,
                functie: firstEntry.employeeFunction,
                values,
            };
        })
        .sort((first, second) => {
            if (first.groupOrder !== second.groupOrder) {
                return first.groupOrder - second.groupOrder;
            }

            const firstFunctionPriority = getSnapshotFunctionPriority(
                first.groupOrder,
                first.functie,
            );
            const secondFunctionPriority = getSnapshotFunctionPriority(
                second.groupOrder,
                second.functie,
            );

            if (firstFunctionPriority !== secondFunctionPriority) {
                return secondFunctionPriority - firstFunctionPriority;
            }

            return first.name.localeCompare(second.name, "ro-RO");
        }) satisfies Array<TimesheetRow>;
}

export function getSnapshotFunctionPriority(
    groupOrder: number,
    functie: EmployeeFunction,
) {
    const group = SCHEDULE_GROUPS.find(
        scheduleGroup => scheduleGroup.groupOrder === groupOrder,
    );

    return group ? getFunctionPriority(group.functions, functie) : 0;
}

export function getFunctionPriority(
    functions: ReadonlyArray<readonly [EmployeeFunction, number]>,
    functie: EmployeeFunction,
) {
    return (
        functions.find(
            ([currentFunction]) => currentFunction === functie,
        )?.[1] ?? 0
    );
}

export function isScheduleCellCode(value: string): value is ScheduleCellCode {
    return SCHEDULE_CELL_CODES.includes(value as ScheduleCellCode);
}
