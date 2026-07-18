export type NotatieGrafic = {
    color: string;
    type: "normal" | "superscript";
};

export const EMPLOYEE_FUNCTIONS = [
    "Medic",
    "Medic Gardă",
    "As. Medical",
    "As. Șef",
    "Infirmier",
    "Îngr. Curățenie",
] as const;

export type EmployeeFunction = (typeof EMPLOYEE_FUNCTIONS)[number];

export const SCHEDULE_CELL_CODES = [
    "7",
    "16",
    "17",
    "18",
    "23",
    "24",
    "Z",
    "N",
    "C",
    "=",
    "1",
    "B",
    "CE",
    "CF",
    "ZS",
] as const;

export type ScheduleCellCode = (typeof SCHEDULE_CELL_CODES)[number];
export type ScheduleNotationMap = Record<ScheduleCellCode, NotatieGrafic>;

export type TimesheetNotationPart = {
    color: string;
    text: string;
    type: "normal" | "superscript";
};

export const COMPARTMENTS = ["pneumoftiziologie", "medici_garda"] as const;
export type Compartment = (typeof COMPARTMENTS)[number];

export const COMPARTMENT_LABELS: Record<Compartment, string> = {
    medici_garda: "MEDICI-GARDĂ",
    pneumoftiziologie: "PNEUMOFTIZIOLOGIE",
};

type ShiftInterval = {
    startHour: number;
    endHour: number;
};

type ShiftDefinitionBase = {
    workedHours: number;
};

type IntervalShiftDefinition = ShiftDefinitionBase & {
    effectiveHours?: never;
    interval: ShiftInterval;
    intervalByFunction?: never;
};

type FunctionIntervalShiftDefinition = ShiftDefinitionBase & {
    effectiveHours?: never;
    interval?: never;
    intervalByFunction: Partial<Record<EmployeeFunction, ShiftInterval>>;
};

type ZeroEffectiveShiftDefinition = ShiftDefinitionBase & {
    effectiveHours: 0;
    interval?: never;
    intervalByFunction?: never;
};

export type ScheduleShiftDefinition =
    | IntervalShiftDefinition
    | FunctionIntervalShiftDefinition
    | ZeroEffectiveShiftDefinition;

export const SCHEDULE_SHIFT_DEFINITIONS: Record<
    ScheduleCellCode,
    ScheduleShiftDefinition
> = {
    "7": {
        workedHours: 7,
        interval: {
            startHour: 7,
            endHour: 14,
        },
    },
    "16": {
        workedHours: 16,
        interval: {
            startHour: 16,
            endHour: 6,
        },
    },
    "17": {
        workedHours: 17,
        interval: {
            startHour: 15,
            endHour: 8,
        },
    },
    "18": {
        workedHours: 18,
        interval: {
            startHour: 14,
            endHour: 8,
        },
    },
    "23": {
        workedHours: 23,
        interval: {
            startHour: 8,
            endHour: 7,
        },
    },
    "24": {
        workedHours: 24,
        interval: {
            startHour: 8,
            endHour: 8,
        },
    },
    "1": {
        workedHours: 8,
        interval: {
            startHour: 7,
            endHour: 15,
        },
    },
    Z: {
        workedHours: 12,
        interval: {
            startHour: 7,
            endHour: 19,
        },
    },
    N: {
        workedHours: 12,
        intervalByFunction: {
            "As. Medical": {
                startHour: 19,
                endHour: 7,
            },
            "As. Șef": {
                startHour: 19,
                endHour: 7,
            },
            Infirmier: {
                startHour: 18,
                endHour: 6,
            },
            "Îngr. Curățenie": {
                startHour: 18,
                endHour: 6,
            },
        },
    },
    C: {
        workedHours: 8,
        effectiveHours: 0,
    },
    B: {
        workedHours: 8,
        effectiveHours: 0,
    },
    CE: {
        workedHours: 8,
        effectiveHours: 0,
    },
    CF: {
        workedHours: 8,
        effectiveHours: 0,
    },
    ZS: {
        workedHours: 8,
        effectiveHours: 0,
    },
    "=": {
        effectiveHours: 0,
        workedHours: 0,
    },
};

export const COLORS = {
    tura1: "text-blue-700",
    tura2: "text-black",
    tura3: "text-green-700",
    placeholder: "text-gray-400",
};

export const TIMESHEET_NOTATION_LABELS = {
    "1": [{ color: COLORS.tura1, text: "8", type: "normal" }],
    N: [
        { color: COLORS.tura2, text: "4", type: "superscript" },
        { color: COLORS.tura3, text: "8", type: "normal" },
    ],
    Z: [
        { color: COLORS.tura1, text: "8", type: "normal" },
        { color: COLORS.tura2, text: "4", type: "superscript" },
    ],
} as const satisfies Partial<
    Record<ScheduleCellCode, Array<TimesheetNotationPart>>
>;

export const NOTATII_GRAFIC = {
    "7": { color: COLORS.tura1, type: "normal" },
    "16": { color: COLORS.tura1, type: "normal" },
    "17": { color: COLORS.tura1, type: "normal" },
    "18": { color: COLORS.tura1, type: "normal" },
    "23": { color: COLORS.tura1, type: "normal" },
    "24": { color: COLORS.tura1, type: "normal" },
    "1": { color: COLORS.tura1, type: "normal" },
    Z: { color: COLORS.tura1, type: "normal" },
    N: { color: COLORS.tura3, type: "normal" },
    C: { color: COLORS.tura1, type: "normal" },
    B: { color: COLORS.tura1, type: "normal" },
    CE: { color: COLORS.tura1, type: "normal" },
    CF: { color: COLORS.tura1, type: "normal" },
    ZS: { color: COLORS.tura1, type: "normal" },
    "=": { color: COLORS.placeholder, type: "normal" },
} as const satisfies Record<ScheduleCellCode, NotatieGrafic>;

export const DEFAULT_SCHEDULE_CELL_CODES = [
    "Z",
    "N",
    "C",
    "=",
    "1",
    "B",
    "CE",
    "CF",
    "ZS",
] as const satisfies ReadonlyArray<ScheduleCellCode>;

export const DOCTOR_SCHEDULE_CELL_CODES = [
    "7",
    "C",
    "B",
    "CE",
    "CF",
    "ZS",
] as const satisfies ReadonlyArray<ScheduleCellCode>;

export const DOCTOR_ON_CALL_SCHEDULE_CELL_CODES = [
    "16",
    "17",
    "18",
    "23",
    "24",
    "B",
    "C",
    "CE",
    "CF",
    "ZS",
] as const satisfies ReadonlyArray<ScheduleCellCode>;

export type ScheduleGroup = {
    expectedDailyShiftCount?: number;
    groupOrder: number;
    showHourTotals?: boolean;
    printSlug: string;
    functions: ReadonlyArray<readonly [EmployeeFunction, number]>;
    scheduleCellCodes: ReadonlyArray<ScheduleCellCode>;
    compartment: Compartment;
    title: string;
};

export type TimesheetGroup = {
    printSlug: string;
    compartment: Compartment;
    title: string;
};

export const TIMESHEET_GROUPS: ReadonlyArray<TimesheetGroup> = [
    {
        printSlug: "pontaj",
        compartment: "pneumoftiziologie",
        title: "Pontaj",
    },
    {
        printSlug: "pontaj-garzi",
        compartment: "medici_garda",
        title: "Pontaj gărzi",
    },
];

export const SCHEDULE_GROUPS: ReadonlyArray<ScheduleGroup> = [
    {
        expectedDailyShiftCount: 3,
        groupOrder: 2,
        printSlug: "asistenti",
        functions: [
            ["As. Medical", 0],
            ["As. Șef", 0],
        ],
        scheduleCellCodes: DEFAULT_SCHEDULE_CELL_CODES,
        compartment: "pneumoftiziologie",
        title: "Asistenți",
    },
    {
        expectedDailyShiftCount: 2,
        groupOrder: 3,
        printSlug: "infirmieri-ingrijitori",
        functions: [
            ["Infirmier", 1],
            ["Îngr. Curățenie", 0],
        ],
        scheduleCellCodes: DEFAULT_SCHEDULE_CELL_CODES,
        compartment: "pneumoftiziologie",
        title: "Infirmieri și îngrijitori",
    },
    {
        groupOrder: 1,
        printSlug: "medici",
        functions: [["Medic", 0]],
        scheduleCellCodes: DOCTOR_SCHEDULE_CELL_CODES,
        compartment: "pneumoftiziologie",
        title: "Medici",
        showHourTotals: false,
    },
    {
        groupOrder: 0,
        printSlug: "medici-garda",
        functions: [["Medic Gardă", 0]],
        scheduleCellCodes: DOCTOR_ON_CALL_SCHEDULE_CELL_CODES,
        compartment: "medici_garda",
        title: "Medici de gardă",
        showHourTotals: false,
    },
];
