import type {
    Compartment,
    EmployeeFunction,
    ScheduleCellCode,
} from "@/lib/constants";
import { SCHEDULE_SHIFT_DEFINITIONS } from "@/lib/constants";

export type ScheduleHours = {
    doubleWorkedHours: number;
    effectiveHours: number;
    workedHours: number;
};

type CalculateScheduleHoursParams = {
    compartment?: Compartment;
    day: number;
    doubleDateKeys: ReadonlySet<string>;
    isLegalHoliday?: (date: Date) => boolean;
    monthIndex: number;
    functie: EmployeeFunction;
    shiftCode: string;
    year: number;
};

type ShiftInterval = {
    endHour: number;
    startHour: number;
};

type ResolvedShiftDefinition = {
    effectiveHours?: 0;
    interval?: ShiftInterval;
    workedHours: number;
};

export function getDateKey(year: number, monthIndex: number, day: number) {
    const date = new Date(year, monthIndex, day);
    const normalizedYear = date.getFullYear();
    const normalizedMonth = String(date.getMonth() + 1).padStart(2, "0");
    const normalizedDay = String(date.getDate()).padStart(2, "0");

    return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
}

export function isWeekendDate(year: number, monthIndex: number, day: number) {
    const weekday = new Date(year, monthIndex, day).getDay();

    return weekday === 0 || weekday === 6;
}

export function isDoubleHoursDate(
    year: number,
    monthIndex: number,
    day: number,
    holidayDateKeys: ReadonlySet<string>,
) {
    return (
        isWeekendDate(year, monthIndex, day) ||
        holidayDateKeys.has(getDateKey(year, monthIndex, day))
    );
}

export function calculateScheduleHours({
    compartment,
    day,
    doubleDateKeys,
    isLegalHoliday,
    monthIndex,
    functie,
    shiftCode,
    year,
}: CalculateScheduleHoursParams): ScheduleHours {
    if (!isScheduleCellCode(shiftCode)) {
        return emptyScheduleHours();
    }

    const definition = SCHEDULE_SHIFT_DEFINITIONS[shiftCode];
    const resolvedDefinition = resolveShiftDefinition(
        definition,
        functie,
        compartment,
    );

    if (!resolvedDefinition) {
        return emptyScheduleHours();
    }

    return {
        doubleWorkedHours:
            resolvedDefinition.effectiveHours ??
            calculateDoubleWorkedHours({
                day,
                doubleDateKeys,
                interval: resolvedDefinition.interval,
                isLegalHoliday,
                monthIndex,
                workedHours: resolvedDefinition.workedHours,
                year,
            }),
        effectiveHours:
            resolvedDefinition.effectiveHours === 0
                ? 0
                : resolvedDefinition.workedHours,
        workedHours: resolvedDefinition.workedHours,
    };
}

function calculateDoubleWorkedHours({
    day,
    doubleDateKeys,
    interval,
    isLegalHoliday,
    monthIndex,
    workedHours,
    year,
}: {
    day: number;
    doubleDateKeys: ReadonlySet<string>;
    interval: ShiftInterval | undefined;
    isLegalHoliday?: (date: Date) => boolean;
    monthIndex: number;
    workedHours: number;
    year: number;
}) {
    if (workedHours === 0) {
        return 0;
    }

    if (!interval) {
        return isDoubleHoursDate(year, monthIndex, day, doubleDateKeys)
            ? workedHours
            : 0;
    }

    const start = getDateTime(year, monthIndex, day, interval.startHour);
    const end = getShiftEndDateTime(year, monthIndex, day, interval);
    const intervalHours = (end.getTime() - start.getTime()) / 3_600_000;

    if (intervalHours <= 0) {
        return 0;
    }

    let doubleIntervalHours = 0;
    let segmentStart = start;

    while (segmentStart < end) {
        const nextMidnight = new Date(
            segmentStart.getFullYear(),
            segmentStart.getMonth(),
            segmentStart.getDate() + 1,
        );
        const segmentEnd = nextMidnight < end ? nextMidnight : end;
        const isDoubleSegment =
            isDoubleHoursDate(
                segmentStart.getFullYear(),
                segmentStart.getMonth(),
                segmentStart.getDate(),
                doubleDateKeys,
            ) ||
            (isLegalHoliday?.(segmentStart) ?? false);

        if (isDoubleSegment) {
            doubleIntervalHours +=
                (segmentEnd.getTime() - segmentStart.getTime()) / 3_600_000;
        }

        segmentStart = segmentEnd;
    }

    return roundHours((doubleIntervalHours / intervalHours) * workedHours);
}

function getShiftEndDateTime(
    year: number,
    monthIndex: number,
    day: number,
    interval: ShiftInterval,
) {
    const endDayOffset = interval.endHour <= interval.startHour ? 1 : 0;

    return getDateTime(year, monthIndex, day + endDayOffset, interval.endHour);
}

function getDateTime(
    year: number,
    monthIndex: number,
    day: number,
    hour: number,
) {
    return new Date(year, monthIndex, day, hour);
}

function resolveShiftDefinition(
    definition: (typeof SCHEDULE_SHIFT_DEFINITIONS)[ScheduleCellCode],
    functie: EmployeeFunction,
    compartment: Compartment | undefined,
): ResolvedShiftDefinition | undefined {
    if (
        "intervalByFunction" in definition &&
        definition.intervalByFunction !== undefined
    ) {
        const resolvedFunction =
            compartment === "medici_garda" ? "Medic Gardă" : functie;
        const functionDefinition =
            definition.intervalByFunction[resolvedFunction];

        if (!functionDefinition) {
            return undefined;
        }

        return {
            interval: {
                endHour: functionDefinition.endHour,
                startHour: functionDefinition.startHour,
            },
            workedHours: functionDefinition.workedHours,
        };
    }

    if ("interval" in definition) {
        return {
            interval: definition.interval,
            workedHours: definition.workedHours,
        };
    }

    return {
        effectiveHours: definition.effectiveHours,
        workedHours: definition.workedHours,
    };
}

function isScheduleCellCode(value: string): value is ScheduleCellCode {
    return Object.hasOwn(SCHEDULE_SHIFT_DEFINITIONS, value);
}

function roundHours(hours: number) {
    return Math.round(hours * 100) / 100;
}

function emptyScheduleHours(): ScheduleHours {
    return {
        doubleWorkedHours: 0,
        effectiveHours: 0,
        workedHours: 0,
    };
}
