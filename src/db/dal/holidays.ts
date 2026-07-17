import { db } from "../connection";
import { and, asc, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import * as schema from "../schema";
import type { UnknownDbError } from "./utils";
import { unknownDbError } from "./utils";

export type FixedLegalHolidayItem = {
    day: number;
    id: number;
    month: number;
    name: string;
};

export type VariableLegalHolidayItem = {
    day: number | null;
    definitionId: number;
    month: number | null;
    name: string;
    year: number;
};

export type LegalHolidayYearView = {
    fixedHolidays: Array<FixedLegalHolidayItem>;
    isComplete: boolean;
    variableHolidays: Array<VariableLegalHolidayItem>;
    year: number;
};

export type SaveVariableLegalHolidayDate = {
    day: number;
    definitionId: number;
    month: number;
    year: number;
};

export type LegalHolidayDate = {
    day: number;
    month: number;
};

async function _getLegalHolidayYear(
    year: number,
): Promise<LegalHolidayYearView> {
    const [fixedHolidays, definitions, dates] = await Promise.all([
        db
            .select()
            .from(schema.fixedLegalHolidays)
            .orderBy(
                asc(schema.fixedLegalHolidays.month),
                asc(schema.fixedLegalHolidays.day),
                asc(schema.fixedLegalHolidays.name),
            ),
        db
            .select()
            .from(schema.variableLegalHolidayDefinitions)
            .orderBy(asc(schema.variableLegalHolidayDefinitions.id)),
        db
            .select()
            .from(schema.variableLegalHolidayDates)
            .where(eq(schema.variableLegalHolidayDates.year, year)),
    ]);
    const datesByDefinition = new Map(
        dates.map(date => [date.definitionId, date]),
    );
    const variableHolidays = definitions.map(definition => {
        const date = datesByDefinition.get(definition.id);

        return {
            day: date?.day ?? null,
            definitionId: definition.id,
            month: date?.month ?? null,
            name: definition.name,
            year,
        };
    });

    return {
        fixedHolidays,
        isComplete: variableHolidays.every(
            holiday => holiday.day !== null && holiday.month !== null,
        ),
        variableHolidays,
        year,
    };
}

export function getLegalHolidayYear(
    year: number,
): ResultAsync<LegalHolidayYearView, UnknownDbError> {
    return ResultAsync.fromPromise(_getLegalHolidayYear(year), unknownDbError);
}

async function _saveVariableLegalHolidayDate(
    data: SaveVariableLegalHolidayDate,
) {
    await db
        .insert(schema.variableLegalHolidayDates)
        .values(data)
        .onConflictDoUpdate({
            set: {
                day: data.day,
                month: data.month,
            },
            target: [
                schema.variableLegalHolidayDates.definitionId,
                schema.variableLegalHolidayDates.year,
            ],
        });
}

export function saveVariableLegalHolidayDate(
    data: SaveVariableLegalHolidayDate,
): ResultAsync<SaveVariableLegalHolidayDate, UnknownDbError> {
    return ResultAsync.fromPromise(
        _saveVariableLegalHolidayDate(data),
        unknownDbError,
    ).map(() => data);
}

async function _getLegalHolidayDatesForYear(year: number) {
    const legalHolidayYear = await _getLegalHolidayYear(year);

    if (!legalHolidayYear.isComplete) {
        return { legalHolidayYear, type: "incomplete" } as const;
    }

    const dates: Array<LegalHolidayDate> = [
        ...legalHolidayYear.fixedHolidays,
        ...legalHolidayYear.variableHolidays.map(holiday => ({
            day: holiday.day!,
            month: holiday.month!,
        })),
    ];

    return {
        dates,
        type: "complete",
    } as const;
}

export type LegalHolidayDatesForYearResult =
    | {
          dates: Array<LegalHolidayDate>;
          type: "complete";
      }
    | {
          legalHolidayYear: LegalHolidayYearView;
          type: "incomplete";
      };

export function getLegalHolidayDatesForYear(
    year: number,
): ResultAsync<LegalHolidayDatesForYearResult, UnknownDbError> {
    return ResultAsync.fromPromise(
        _getLegalHolidayDatesForYear(year),
        unknownDbError,
    );
}

async function _isLegalHoliday({
    day,
    month,
    year,
}: {
    day: number;
    month: number;
    year: number;
}) {
    const fixedHoliday = await db
        .select({ id: schema.fixedLegalHolidays.id })
        .from(schema.fixedLegalHolidays)
        .where(
            and(
                eq(schema.fixedLegalHolidays.month, month),
                eq(schema.fixedLegalHolidays.day, day),
            ),
        )
        .limit(1);

    if (fixedHoliday.length > 0) {
        return true;
    }

    const variableHoliday = await db
        .select({ definitionId: schema.variableLegalHolidayDates.definitionId })
        .from(schema.variableLegalHolidayDates)
        .where(
            and(
                eq(schema.variableLegalHolidayDates.year, year),
                eq(schema.variableLegalHolidayDates.month, month),
                eq(schema.variableLegalHolidayDates.day, day),
            ),
        )
        .limit(1);

    return variableHoliday.length > 0;
}

export function isLegalHoliday(date: {
    day: number;
    month: number;
    year: number;
}): ResultAsync<boolean, UnknownDbError> {
    return ResultAsync.fromPromise(_isLegalHoliday(date), unknownDbError);
}
