import {
    integer,
    primaryKey,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
    EMPLOYEE_FUNCTIONS,
    SCHEDULE_CELL_CODES,
    COMPARTMENTS,
} from "@/lib/constants";

export const employees = sqliteTable("employees", {
    matricol: integer().primaryKey(),
    name: text().notNull(),
    functie: text({ enum: EMPLOYEE_FUNCTIONS }).notNull(),
});

export const fixedLegalHolidays = sqliteTable(
    "fixed_legal_holidays",
    {
        id: integer().primaryKey({ autoIncrement: true }),
        name: text().notNull(),
        day: integer().notNull(),
        month: integer().notNull(),
    },
    table => [
        uniqueIndex("fixed_legal_holidays_date_idx").on(table.month, table.day),
    ],
);

export const variableLegalHolidayDefinitions = sqliteTable(
    "variable_legal_holiday_definitions",
    {
        id: integer().primaryKey({ autoIncrement: true }),
        name: text().notNull(),
    },
    table => [
        uniqueIndex("variable_legal_holiday_definitions_name_idx").on(
            table.name,
        ),
    ],
);

export const variableLegalHolidayDates = sqliteTable(
    "variable_legal_holiday_dates",
    {
        definitionId: integer().notNull(),
        year: integer().notNull(),
        day: integer().notNull(),
        month: integer().notNull(),
    },
    table => [
        primaryKey({
            columns: [table.definitionId, table.year],
        }),
    ],
);

export const printSettings = sqliteTable("print_settings", {
    key: text().primaryKey(),
    value: text().notNull(),
});

export const scheduleEntries = sqliteTable(
    "schedule_entries",
    {
        employeeMatricol: integer().notNull(),
        year: integer().notNull(),
        month: integer().notNull(),
        day: integer().notNull(),
        compartment: text({ enum: COMPARTMENTS }).notNull(),
        shiftCode: text({ enum: SCHEDULE_CELL_CODES }).notNull(),
    },
    table => [
        primaryKey({
            columns: [
                table.employeeMatricol,
                table.year,
                table.month,
                table.day,
                table.compartment,
            ],
        }),
    ],
);

export const scheduleSnapshots = sqliteTable(
    "schedule_snapshots",
    {
        year: integer().notNull(),
        month: integer().notNull(),
    },
    table => [
        primaryKey({
            columns: [table.year, table.month],
        }),
    ],
);

export const scheduleSnapshotRows = sqliteTable(
    "schedule_snapshot_rows",
    {
        id: integer().primaryKey({ autoIncrement: true }),
        year: integer().notNull(),
        month: integer().notNull(),
        groupOrder: integer().notNull(),
        employeeMatricol: integer().notNull(),
        employeeName: text().notNull(),
        employeeFunction: text({ enum: EMPLOYEE_FUNCTIONS }).notNull(),
        compartment: text({ enum: COMPARTMENTS }).notNull(),
    },
    table => [
        uniqueIndex("schedule_snapshot_rows_month_employee_idx").on(
            table.year,
            table.month,
            table.groupOrder,
            table.employeeMatricol,
            table.compartment,
        ),
    ],
);

export const scheduleSnapshotCells = sqliteTable(
    "schedule_snapshot_cells",
    {
        snapshotRowId: integer().notNull(),
        day: integer().notNull(),
        shiftCode: text().notNull(),
    },
    table => [
        primaryKey({
            columns: [table.snapshotRowId, table.day],
        }),
    ],
);
