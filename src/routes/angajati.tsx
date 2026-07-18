import { useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { CalendarDays } from "lucide-react";
import { z } from "zod";
import {
    addEmployee as addEmployeeRecord,
    deleteEmployee as deleteEmployeeRecord,
    getEmployees,
    isDuplicateEmployeeMatricolError,
} from "@/db";
import type { EmployeeFunction } from "@/lib/constants";
import { EMPLOYEE_FUNCTIONS } from "@/lib/constants";
import { unwrapServerResult } from "@/lib/server-result";

const addEmployeeSchema = z.object({
    matricol: z.coerce
        .number("Completează numărul matricol.")
        .int("Numărul matricol trebuie să fie un număr întreg.")
        .positive("Numărul matricol trebuie să fie pozitiv."),
    name: z.string().trim().min(1, "Completează numele angajatului."),
    functie: z.enum(EMPLOYEE_FUNCTIONS),
});

const deleteEmployeeSchema = z.object({
    matricol: z.coerce.number().int().positive(),
});

type FormStatus = {
    message: string;
    type: "error";
} | null;

const getEmployeeRows = createServerFn({ method: "GET" }).handler(async () => {
    return unwrapServerResult(getEmployees());
});

const addEmployee = createServerFn({ method: "POST" })
    .validator(addEmployeeSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(
            addEmployeeRecord(data),
            getEmployeeErrorMessage,
        );
    });

const deleteEmployee = createServerFn({ method: "POST" })
    .validator(deleteEmployeeSchema)
    .handler(async ({ data }) => {
        return unwrapServerResult(deleteEmployeeRecord(data.matricol));
    });

export const Route = createFileRoute("/angajati")({
    head: () => ({
        meta: [
            {
                title: "Angajați",
            },
        ],
    }),
    loader: () => getEmployeeRows(),
    component: RouteComponent,
});

function getEmployeeErrorMessage(error: { type: string }) {
    if (isDuplicateEmployeeMatricolError(error)) {
        return "Există deja un angajat cu acest matricol.";
    }

    return "Angajatul nu a putut fi salvat.";
}

function RouteComponent() {
    const initialEmployees = Route.useLoaderData();
    const addEmployeeFn = useServerFn(addEmployee);
    const deleteEmployeeFn = useServerFn(deleteEmployee);
    const matricolInputRef = useRef<HTMLInputElement>(null);
    const [employeeRows, setEmployeeRows] = useState(initialEmployees);
    const [status, setStatus] = useState<FormStatus>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingMatricol, setDeletingMatricol] = useState<number | null>(
        null,
    );

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus(null);
        setIsSaving(true);

        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
            const employee = await addEmployeeFn({
                data: {
                    matricol: String(formData.get("matricol") ?? ""),
                    name: String(formData.get("name") ?? ""),
                    functie: String(
                        formData.get("functie") ?? "",
                    ) as EmployeeFunction,
                },
            });

            setEmployeeRows(currentRows =>
                [...currentRows, employee].sort(
                    (first, second) => first.matricol - second.matricol,
                ),
            );
            form.reset();
            matricolInputRef.current?.focus();
        } catch (error) {
            setStatus({
                message:
                    error instanceof Error
                        ? error.message
                        : "Angajatul nu a putut fi adăugat.",
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteEmployee(matricol: number) {
        setStatus(null);
        setDeletingMatricol(matricol);

        try {
            await deleteEmployeeFn({
                data: {
                    matricol,
                },
            });
            setEmployeeRows(currentRows =>
                currentRows.filter(employee => employee.matricol !== matricol),
            );
        } catch (error) {
            setStatus({
                message:
                    error instanceof Error
                        ? error.message
                        : "Angajatul nu a putut fi șters.",
                type: "error",
            });
        } finally {
            setDeletingMatricol(null);
        }
    }

    return (
        <main className="min-h-screen p-2">
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold tracking-wide uppercase">
                            Angajați
                        </p>
                        <h1 className="text-2xl font-bold sm:text-3xl">
                            Adaugă angajat
                        </h1>
                    </div>
                    <Link
                        className="inline-flex w-fit items-center gap-2 rounded-md border border-black bg-white px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100"
                        to="/"
                    >
                        <CalendarDays
                            aria-hidden="true"
                            className="size-4"
                        />
                        Calendar
                    </Link>
                </header>

                <form
                    className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2"
                    onSubmit={handleSubmit}
                >
                    <label className="grid gap-1 text-sm font-medium">
                        Matricol
                        <input
                            ref={matricolInputRef}
                            className="rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                            min={1}
                            name="matricol"
                            required
                            step={1}
                            type="number"
                        />
                    </label>

                    <label className="grid gap-1 text-sm font-medium">
                        Nume
                        <input
                            className="rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                            name="name"
                            required
                        />
                    </label>

                    <label className="grid gap-1 text-sm font-medium">
                        Funcție
                        <select
                            className="rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                            name="functie"
                            required
                        >
                            {EMPLOYEE_FUNCTIONS.map(functie => (
                                <option
                                    key={functie}
                                    value={functie}
                                >
                                    {functie}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex items-end">
                        <button
                            className="w-full rounded-md border border-black bg-white px-4 py-2 font-bold text-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                            disabled={isSaving}
                            type="submit"
                        >
                            {isSaving ? "Se salvează..." : "Adaugă"}
                        </button>
                    </div>

                    {status ? (
                        <p
                            className="text-sm font-medium text-red-700 sm:col-span-2"
                            role="status"
                        >
                            {status.message}
                        </p>
                    ) : null}
                </form>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">
                        Angajați existenți
                    </h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">
                                        Matricol
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                        Nume
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                        Funcție
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold">
                                        Acțiuni
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeRows.length > 0 ? (
                                    employeeRows.map(employee => (
                                        <tr
                                            className="border-t border-gray-100"
                                            key={employee.matricol}
                                        >
                                            <td className="px-3 py-2">
                                                {employee.matricol}
                                            </td>
                                            <td className="px-3 py-2">
                                                {employee.name}
                                            </td>
                                            <td className="px-3 py-2">
                                                {employee.functie}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    className="rounded-md border border-red-200 bg-white px-3 py-1 font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                                                    disabled={
                                                        deletingMatricol !==
                                                        null
                                                    }
                                                    onClick={() =>
                                                        handleDeleteEmployee(
                                                            employee.matricol,
                                                        )
                                                    }
                                                    type="button"
                                                >
                                                    Șterge
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            className="px-3 py-6 text-center text-gray-500"
                                            colSpan={4}
                                        >
                                            Nu există angajați adăugați.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
