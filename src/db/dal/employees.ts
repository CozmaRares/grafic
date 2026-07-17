import { db } from "../connection";
import { asc, eq } from "drizzle-orm";
import { okAsync, ResultAsync } from "neverthrow";

import * as schema from "../schema";
import type { EmployeeFunction } from "@/lib/constants";
import type { UnknownDbError } from "./utils";
import {
    isUniqueConstraintError,
    logErrorAndCreate,
    unknownDbError,
} from "./utils";

export type EmployeeListItem = {
    matricol: number;
    name: string;
    functie: EmployeeFunction;
};

export type CreateEmployee = EmployeeListItem;
export type DuplicateEmployeeMatricolError = {
    type: "duplicate_employee_matricol";
};

const maybeDuplicateEmployeeMatricolError = logErrorAndCreate(
    (error: unknown): DuplicateEmployeeMatricolError | UnknownDbError =>
        isUniqueConstraintError(error)
            ? { type: "duplicate_employee_matricol" }
            : { error, type: "unknown_db_error" },
);

export function isDuplicateEmployeeMatricolError(error: {
    type: string;
}): error is DuplicateEmployeeMatricolError {
    return error.type === "duplicate_employee_matricol";
}

async function _getEmployees() {
    return db
        .select()
        .from(schema.employees)
        .orderBy(asc(schema.employees.matricol));
}

export function getEmployees(): ResultAsync<
    Array<EmployeeListItem>,
    UnknownDbError
> {
    return ResultAsync.fromPromise(_getEmployees(), unknownDbError);
}

async function _addEmployee(data: CreateEmployee) {
    await db.insert(schema.employees).values(data);
}

export function addEmployee(
    data: CreateEmployee,
): ResultAsync<
    EmployeeListItem,
    DuplicateEmployeeMatricolError | UnknownDbError
> {
    return ResultAsync.fromPromise(
        _addEmployee(data),
        maybeDuplicateEmployeeMatricolError,
    ).andThen(() => okAsync(data));
}

async function _deleteEmployee(matricol: number) {
    await db
        .delete(schema.employees)
        .where(eq(schema.employees.matricol, matricol));
}

export function deleteEmployee(
    matricol: number,
): ResultAsync<{ matricol: number }, UnknownDbError> {
    return ResultAsync.fromPromise(
        _deleteEmployee(matricol),
        unknownDbError,
    ).andThen(() => okAsync({ matricol }));
}
