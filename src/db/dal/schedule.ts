import { db } from "../connection";
import { and, asc, eq, inArray } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

import * as schema from "../schema";
import {
    getDaysInMonth,
    getLiveGroupRows,
    getSnapshotScheduleGroups,
    getSnapshotTimesheetGroups,
    getValuesByCompartment,
    isScheduleCellCode,
} from "@/domain/schedule";
import type {
    MonthlyScheduleView,
    ScheduleSnapshotEntry,
} from "@/domain/schedule";
import { getDateKey } from "@/lib/schedule-hours";
import type { ScheduleCellCode, Compartment } from "@/lib/constants";
import { SCHEDULE_GROUPS } from "@/lib/constants";
import { getLegalHolidayYear } from "./holidays";
import type { UnknownDbError } from "./utils";
import { unknownDbError } from "./utils";

export type SchedulePeriod = {
    monthIndex: number;
    year: number;
};

export type SaveScheduleCell = SchedulePeriod & {
    day: number;
    employeeId: number;
    compartment: Compartment;
    value: "" | ScheduleCellCode;
};

export type MonthLockedError = { type: "month_locked" };
export type InvalidScheduleCellCodeError = {
    type: "invalid_schedule_cell_code";
};
export type IncompleteLegalHolidaysError = {
    type: "incomplete_legal_holidays";
};
export type SnapshotEmployeeMismatchError = {
    type: "snapshot_employee_mismatch";
};

const monthLockedError = (): MonthLockedError => ({ type: "month_locked" });
const invalidScheduleCellCodeError = (): InvalidScheduleCellCodeError => ({
    type: "invalid_schedule_cell_code",
});
const incompleteLegalHolidaysError = (): IncompleteLegalHolidaysError => ({
    type: "incomplete_legal_holidays",
});
const snapshotEmployeeMismatchError = (): SnapshotEmployeeMismatchError => ({
    type: "snapshot_employee_mismatch",
});

export function isMonthLockedError(error: {
    type: string;
}): error is MonthLockedError {
    return error.type === "month_locked";
}

export function isInvalidScheduleCellCodeError(error: {
    type: string;
}): error is InvalidScheduleCellCodeError {
    return error.type === "invalid_schedule_cell_code";
}

export function isIncompleteLegalHolidaysError(error: {
    type: string;
}): error is IncompleteLegalHolidaysError {
    return error.type === "incomplete_legal_holidays";
}

export function isSnapshotEmployeeMismatchError(error: {
    type: string;
}): error is SnapshotEmployeeMismatchError {
    return error.type === "snapshot_employee_mismatch";
}

async function _getHolidayContext({ monthIndex, year }: SchedulePeriod) {
    const holidayResult = await getLegalHolidayYear(year);

    if (holidayResult.isErr()) {
        throw holidayResult.error;
    }

    if (!holidayResult.value.isComplete) {
        return {
            missingVariableHolidays: holidayResult.value.variableHolidays
                .filter(
                    holiday => holiday.day === null || holiday.month === null,
                )
                .map(holiday => holiday.name),
            type: "blocked",
        } as const;
    }

    return {
        holidayDateKeys: await _getCurrentMonthHolidayDateKeys({
            monthIndex,
            year,
        }),
        isNextMonthFirstDayHoliday: await _isNextMonthFirstDayHoliday({
            monthIndex,
            year,
        }),
        type: "ready",
    } as const;
}

async function _getCurrentMonthHolidayDateKeys({
    monthIndex,
    year,
}: SchedulePeriod) {
    const month = monthIndex + 1;
    const [fixedHolidays, variableHolidays] = await Promise.all([
        db
            .select({
                day: schema.fixedLegalHolidays.day,
            })
            .from(schema.fixedLegalHolidays)
            .where(eq(schema.fixedLegalHolidays.month, month)),
        db
            .select({
                day: schema.variableLegalHolidayDates.day,
            })
            .from(schema.variableLegalHolidayDates)
            .where(
                and(
                    eq(schema.variableLegalHolidayDates.year, year),
                    eq(schema.variableLegalHolidayDates.month, month),
                ),
            ),
    ]);

    return [...fixedHolidays, ...variableHolidays].map(holiday =>
        getDateKey(year, monthIndex, holiday.day),
    );
}

async function _isNextMonthFirstDayHoliday({
    monthIndex,
    year,
}: SchedulePeriod) {
    const date = new Date(year, monthIndex + 1, 1);
    const nextDay = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
    };
    const [fixedHoliday, variableHoliday] = await Promise.all([
        db
            .select({ id: schema.fixedLegalHolidays.id })
            .from(schema.fixedLegalHolidays)
            .where(
                and(
                    eq(schema.fixedLegalHolidays.month, nextDay.month),
                    eq(schema.fixedLegalHolidays.day, nextDay.day),
                ),
            )
            .limit(1),
        db
            .select({
                definitionId: schema.variableLegalHolidayDates.definitionId,
            })
            .from(schema.variableLegalHolidayDates)
            .where(
                and(
                    eq(schema.variableLegalHolidayDates.year, nextDay.year),
                    eq(schema.variableLegalHolidayDates.month, nextDay.month),
                    eq(schema.variableLegalHolidayDates.day, nextDay.day),
                ),
            )
            .limit(1),
    ]);

    return fixedHoliday.length > 0 || variableHoliday.length > 0;
}

async function _getSnapshotEntries({
    month,
    year,
}: {
    month: number;
    year: number;
}): Promise<Array<ScheduleSnapshotEntry>> {
    const rows = await db
        .select()
        .from(schema.scheduleSnapshotRows)
        .where(
            and(
                eq(schema.scheduleSnapshotRows.year, year),
                eq(schema.scheduleSnapshotRows.month, month),
            ),
        );
    const rowIds = rows.map(row => row.id);

    if (rowIds.length === 0) {
        return [];
    }

    const cells = await db
        .select()
        .from(schema.scheduleSnapshotCells)
        .where(inArray(schema.scheduleSnapshotCells.snapshotRowId, rowIds));
    const rowsById = new Map(rows.map(row => [row.id, row]));

    return cells.flatMap(cell => {
        const row = rowsById.get(cell.snapshotRowId);

        if (!row) {
            return [];
        }

        return {
            day: cell.day,
            employeeMatricol: row.employeeMatricol,
            employeeName: row.employeeName,
            employeeFunction: row.employeeFunction,
            groupOrder: row.groupOrder,
            month: row.month,
            compartment: row.compartment,
            shiftCode: cell.shiftCode,
            year: row.year,
        };
    });
}

async function _getMonthlySchedule({
    monthIndex,
    year,
}: SchedulePeriod): Promise<MonthlyScheduleView> {
    const holidayContext = await _getHolidayContext({ monthIndex, year });

    if (holidayContext.type === "blocked") {
        return {
            isBlocked: true,
            missingVariableHolidays: holidayContext.missingVariableHolidays,
            year,
        };
    }

    const month = monthIndex + 1;
    const employeeData = await db
        .select()
        .from(schema.employees)
        .orderBy(asc(schema.employees.name));
    const snapshot = await db
        .select()
        .from(schema.scheduleSnapshots)
        .where(
            and(
                eq(schema.scheduleSnapshots.year, year),
                eq(schema.scheduleSnapshots.month, month),
            ),
        )
        .limit(1);
    const entries = await db
        .select()
        .from(schema.scheduleEntries)
        .where(
            and(
                eq(schema.scheduleEntries.year, year),
                eq(schema.scheduleEntries.month, month),
            ),
        );

    if (snapshot.length > 0) {
        const snapshotEntries = await _getSnapshotEntries({ month, year });

        return {
            isBlocked: false,
            isLocked: true,
            scheduleGroups: getSnapshotScheduleGroups({
                holidayDateKeys: holidayContext.holidayDateKeys,
                isNextMonthFirstDayHoliday:
                    holidayContext.isNextMonthFirstDayHoliday,
                snapshotEntries,
            }),
            timesheetGroups: getSnapshotTimesheetGroups({
                holidayDateKeys: holidayContext.holidayDateKeys,
                isNextMonthFirstDayHoliday:
                    holidayContext.isNextMonthFirstDayHoliday,
                snapshotEntries,
            }),
        };
    }

    const valuesByCompartment = getValuesByCompartment(entries);

    return {
        isBlocked: false,
        isLocked: false,
        scheduleGroups: SCHEDULE_GROUPS.map(group => ({
            ...group,
            holidayDateKeys: holidayContext.holidayDateKeys,
            isNextMonthFirstDayHoliday:
                holidayContext.isNextMonthFirstDayHoliday,
            rows: getLiveGroupRows({
                employeeData,
                group,
                valuesByCompartment,
            }),
        })),
        timesheetGroups: [],
    };
}

export function getMonthlySchedule(
    period: SchedulePeriod,
): ResultAsync<MonthlyScheduleView, UnknownDbError> {
    return ResultAsync.fromPromise(_getMonthlySchedule(period), unknownDbError);
}

async function _generateSnapshot({ monthIndex, year }: SchedulePeriod) {
    const holidayContext = await _getHolidayContext({ monthIndex, year });

    if (holidayContext.type === "blocked") {
        return { type: "incomplete_holidays" } as const;
    }

    const month = monthIndex + 1;
    const existingSnapshot = await db
        .select({ year: schema.scheduleSnapshots.year })
        .from(schema.scheduleSnapshots)
        .where(
            and(
                eq(schema.scheduleSnapshots.year, year),
                eq(schema.scheduleSnapshots.month, month),
            ),
        )
        .limit(1);

    if (existingSnapshot.length > 0) {
        return { type: "locked" } as const;
    }

    const employeeData = await db
        .select()
        .from(schema.employees)
        .orderBy(asc(schema.employees.name));
    const entries = await db
        .select()
        .from(schema.scheduleEntries)
        .where(
            and(
                eq(schema.scheduleEntries.year, year),
                eq(schema.scheduleEntries.month, month),
            ),
        );
    const valuesByCompartment = getValuesByCompartment(entries);
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const rows = SCHEDULE_GROUPS.flatMap(group =>
        getLiveGroupRows({
            employeeData,
            group,
            valuesByCompartment,
        })
            .map(employee => ({
                employeeMatricol: Number(employee.id),
                employeeName: employee.name,
                employeeFunction: employee.functie,
                groupOrder: group.groupOrder,
                month,
                compartment: group.compartment,
                values: employee.values,
                year,
            }))
            .filter(row =>
                Array.from(
                    { length: daysInMonth },
                    (_, index) => index + 1,
                ).some(day => Object.hasOwn(row.values, day)),
            ),
    );

    db.transaction(tx => {
        tx.insert(schema.scheduleSnapshots).values({ month, year }).run();

        for (const row of rows) {
            const snapshotRow = tx
                .insert(schema.scheduleSnapshotRows)
                .values({
                    employeeMatricol: row.employeeMatricol,
                    employeeName: row.employeeName,
                    employeeFunction: row.employeeFunction,
                    groupOrder: row.groupOrder,
                    month: row.month,
                    compartment: row.compartment,
                    year: row.year,
                })
                .returning({ id: schema.scheduleSnapshotRows.id })
                .get();
            const cells = Array.from(
                { length: daysInMonth },
                (_, index) => index + 1,
            )
                .map(day => ({
                    day,
                    shiftCode: row.values[day] ?? "",
                    snapshotRowId: snapshotRow.id,
                }))
                .filter(cell => cell.shiftCode !== "");

            if (cells.length > 0) {
                tx.insert(schema.scheduleSnapshotCells).values(cells).run();
            }
        }

        tx.delete(schema.scheduleEntries)
            .where(
                and(
                    eq(schema.scheduleEntries.year, year),
                    eq(schema.scheduleEntries.month, month),
                ),
            )
            .run();
    });

    return { type: "generated" } as const;
}

export function generateSnapshot(
    period: SchedulePeriod,
): ResultAsync<
    void,
    IncompleteLegalHolidaysError | MonthLockedError | UnknownDbError
> {
    return ResultAsync.fromPromise(
        _generateSnapshot(period),
        unknownDbError,
    ).andThen(outcome => {
        switch (outcome.type) {
            case "generated":
                return okAsync();
            case "incomplete_holidays":
                return errAsync(incompleteLegalHolidaysError());
            case "locked":
                return errAsync(monthLockedError());
        }
    });
}

async function _invalidateSnapshot({ monthIndex, year }: SchedulePeriod) {
    const month = monthIndex + 1;
    const snapshot = await db
        .select()
        .from(schema.scheduleSnapshots)
        .where(
            and(
                eq(schema.scheduleSnapshots.year, year),
                eq(schema.scheduleSnapshots.month, month),
            ),
        )
        .limit(1);
    const rows = await db
        .select()
        .from(schema.scheduleSnapshotRows)
        .where(
            and(
                eq(schema.scheduleSnapshotRows.year, year),
                eq(schema.scheduleSnapshotRows.month, month),
            ),
        );

    if (snapshot.length === 0) {
        return { type: "invalidated" } as const;
    }

    const employeeIds = [...new Set(rows.map(row => row.employeeMatricol))];
    const employees =
        employeeIds.length === 0
            ? []
            : await db
                  .select()
                  .from(schema.employees)
                  .where(inArray(schema.employees.matricol, employeeIds));
    const employeesByMatricol = new Map(
        employees.map(employee => [employee.matricol, employee]),
    );
    const hasEmployeeMismatch = rows.some(row => {
        const employee = employeesByMatricol.get(row.employeeMatricol);

        return (
            !employee ||
            employee.name !== row.employeeName ||
            employee.functie !== row.employeeFunction
        );
    });

    if (hasEmployeeMismatch) {
        return { type: "employee_mismatch" } as const;
    }

    const rowIds = rows.map(row => row.id);
    const cells =
        rowIds.length === 0
            ? []
            : await db
                  .select()
                  .from(schema.scheduleSnapshotCells)
                  .where(
                      inArray(
                          schema.scheduleSnapshotCells.snapshotRowId,
                          rowIds,
                      ),
                  );
    const rowsById = new Map(rows.map(row => [row.id, row]));
    const restoredEntries = cells.flatMap(cell => {
        const row = rowsById.get(cell.snapshotRowId);

        if (!row || !isScheduleCellCode(cell.shiftCode)) {
            return [];
        }

        return {
            day: cell.day,
            employeeMatricol: row.employeeMatricol,
            month,
            compartment: row.compartment,
            shiftCode: cell.shiftCode,
            year,
        };
    });

    db.transaction(tx => {
        tx.delete(schema.scheduleEntries)
            .where(
                and(
                    eq(schema.scheduleEntries.year, year),
                    eq(schema.scheduleEntries.month, month),
                ),
            )
            .run();

        if (restoredEntries.length > 0) {
            tx.insert(schema.scheduleEntries).values(restoredEntries).run();
        }

        if (rowIds.length > 0) {
            tx.delete(schema.scheduleSnapshotCells)
                .where(
                    inArray(schema.scheduleSnapshotCells.snapshotRowId, rowIds),
                )
                .run();
        }

        tx.delete(schema.scheduleSnapshotRows)
            .where(
                and(
                    eq(schema.scheduleSnapshotRows.year, year),
                    eq(schema.scheduleSnapshotRows.month, month),
                ),
            )
            .run();
        tx.delete(schema.scheduleSnapshots)
            .where(
                and(
                    eq(schema.scheduleSnapshots.year, year),
                    eq(schema.scheduleSnapshots.month, month),
                ),
            )
            .run();
    });

    return { type: "invalidated" } as const;
}

export function invalidateSnapshot(
    period: SchedulePeriod,
): ResultAsync<void, SnapshotEmployeeMismatchError | UnknownDbError> {
    return ResultAsync.fromPromise(
        _invalidateSnapshot(period),
        unknownDbError,
    ).andThen(outcome =>
        outcome.type === "invalidated"
            ? okAsync()
            : errAsync(snapshotEmployeeMismatchError()),
    );
}

function _saveScheduleCell(data: SaveScheduleCell) {
    const month = data.monthIndex + 1;

    return db.transaction(tx => {
        const existingSnapshot = tx
            .select({ year: schema.scheduleSnapshots.year })
            .from(schema.scheduleSnapshots)
            .where(
                and(
                    eq(schema.scheduleSnapshots.year, data.year),
                    eq(schema.scheduleSnapshots.month, month),
                ),
            )
            .limit(1)
            .all();

        if (existingSnapshot.length > 0) {
            return { type: "locked" } as const;
        }

        if (data.value === "") {
            tx.delete(schema.scheduleEntries)
                .where(
                    and(
                        eq(
                            schema.scheduleEntries.employeeMatricol,
                            data.employeeId,
                        ),
                        eq(schema.scheduleEntries.year, data.year),
                        eq(schema.scheduleEntries.month, month),
                        eq(schema.scheduleEntries.day, data.day),
                        eq(
                            schema.scheduleEntries.compartment,
                            data.compartment,
                        ),
                    ),
                )
                .run();

            return { type: "saved" } as const;
        }

        const employee = tx
            .select({
                functie: schema.employees.functie,
            })
            .from(schema.employees)
            .where(eq(schema.employees.matricol, data.employeeId))
            .get();

        if (!employee) {
            return { type: "invalid_cell_code" } as const;
        }

        const scheduleGroup = SCHEDULE_GROUPS.find(
            group =>
                group.compartment === data.compartment &&
                group.functions.some(
                    ([functie]) => functie === employee.functie,
                ),
        );

        if (!scheduleGroup?.scheduleCellCodes.includes(data.value)) {
            return { type: "invalid_cell_code" } as const;
        }

        tx.insert(schema.scheduleEntries)
            .values({
                day: data.day,
                employeeMatricol: data.employeeId,
                month,
                compartment: data.compartment,
                shiftCode: data.value,
                year: data.year,
            })
            .onConflictDoUpdate({
                set: {
                    shiftCode: data.value,
                },
                target: [
                    schema.scheduleEntries.employeeMatricol,
                    schema.scheduleEntries.year,
                    schema.scheduleEntries.month,
                    schema.scheduleEntries.day,
                    schema.scheduleEntries.compartment,
                ],
            })
            .run();

        return { type: "saved" } as const;
    });
}

export function saveScheduleCell(
    data: SaveScheduleCell,
): ResultAsync<
    void,
    | IncompleteLegalHolidaysError
    | InvalidScheduleCellCodeError
    | MonthLockedError
    | UnknownDbError
> {
    return getLegalHolidayYear(data.year).andThen(holidayResult => {
        if (!holidayResult.isComplete) {
            return errAsync(incompleteLegalHolidaysError());
        }

        return ResultAsync.fromPromise(
            Promise.resolve(_saveScheduleCell(data)),
            unknownDbError,
        ).andThen(outcome => {
            switch (outcome.type) {
                case "saved":
                    return okAsync();
                case "locked":
                    return errAsync(monthLockedError());
                case "invalid_cell_code":
                    return errAsync(invalidScheduleCellCodeError());
            }
        });
    });
}
