export type DbError = { type: string };
export type UnknownDbError = { type: "unknown_db_error"; error: unknown };

export function logErrorAndCreate<
    TArgs extends Array<unknown>,
    TError extends DbError,
>(cb: (...args: TArgs) => TError): (...args: TArgs) => TError {
    return (...args) => cb(...args);
}

export const unknownDbError = logErrorAndCreate(
    (error: unknown): UnknownDbError => ({ error, type: "unknown_db_error" }),
);

export function isUnknownDbError(error: DbError): error is UnknownDbError {
    return error.type === "unknown_db_error";
}

export function isUniqueConstraintError(error: unknown) {
    return (
        error instanceof Error &&
        /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(
            `${error.message} ${error.cause}`,
        )
    );
}
