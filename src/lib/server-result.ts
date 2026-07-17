import type { ResultAsync } from "neverthrow";

type ServerResultError = { type: string };

function getDefaultServerErrorMessage(error: ServerResultError) {
    if (error.type === "unknown_db_error") {
        return "Operația nu a putut fi finalizată.";
    }

    return "Operația nu a putut fi finalizată.";
}

export async function unwrapServerResult<T, TError extends ServerResultError>(
    result: ResultAsync<T, TError>,
    getMessage: (error: TError) => string = getDefaultServerErrorMessage,
): Promise<T> {
    return result.match(
        value => value,
        error => {
            throw new Error(getMessage(error));
        },
    );
}
