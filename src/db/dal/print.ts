import { db } from "../connection";
import { ResultAsync } from "neverthrow";

import * as schema from "../schema";
import type { PrintableScheduleView, PrintSettings } from "@/domain/schedule";
import { SCHEDULE_GROUPS, TIMESHEET_GROUPS } from "@/lib/constants";
import type { UnknownDbError } from "./utils";
import { unknownDbError } from "./utils";
import { getMonthlySchedule } from "./schedule";

export type PrintScheduleParams = {
    monthIndex: number;
    printSlug: string;
    year: number;
};

async function _getPrintSchedule({
    monthIndex,
    printSlug,
    year,
}: PrintScheduleParams): Promise<PrintableScheduleView | null> {
    const monthlyResult = await getMonthlySchedule({ monthIndex, year });
    const printSettings = await _getPrintSettings();

    if (monthlyResult.isErr()) {
        throw monthlyResult.error;
    }

    const monthlySchedule = monthlyResult.value;

    if (monthlySchedule.isBlocked) {
        return null;
    }

    const timesheetGroup = TIMESHEET_GROUPS.find(
        currentGroup => currentGroup.printSlug === printSlug,
    );

    if (timesheetGroup) {
        if (!monthlySchedule.isLocked) {
            return null;
        }

        const monthlyTimesheetGroup = monthlySchedule.timesheetGroups.find(
            currentGroup => currentGroup.printSlug === printSlug,
        );

        return monthlyTimesheetGroup
            ? {
                  holidayDateKeys: monthlyTimesheetGroup.holidayDateKeys,
                  isNextMonthFirstDayHoliday:
                      monthlyTimesheetGroup.isNextMonthFirstDayHoliday,
                  kind: "timesheet",
                  printSettings,
                  rows: monthlyTimesheetGroup.rows,
                  timesheetGroup,
              }
            : null;
    }

    const group = SCHEDULE_GROUPS.find(
        scheduleGroup => scheduleGroup.printSlug === printSlug,
    );
    const monthlyScheduleGroup = monthlySchedule.scheduleGroups.find(
        currentGroup => currentGroup.printSlug === printSlug,
    );

    return group && monthlyScheduleGroup
        ? {
              group,
              holidayDateKeys: monthlyScheduleGroup.holidayDateKeys,
              isNextMonthFirstDayHoliday:
                  monthlyScheduleGroup.isNextMonthFirstDayHoliday,
              kind: "schedule",
              printSettings,
              rows: monthlyScheduleGroup.rows,
          }
        : null;
}

async function _getPrintSettings(): Promise<PrintSettings> {
    const settings = await db.select().from(schema.printSettings);
    const settingsByKey = new Map(
        settings.map(setting => [setting.key, setting.value]),
    );

    return {
        managerName: settingsByKey.get("managerName") ?? "",
        preparedByName: settingsByKey.get("preparedByName") ?? "",
        sectionChiefName: settingsByKey.get("sectionChiefName") ?? "",
    };
}

export function getPrintSchedule(
    params: PrintScheduleParams,
): ResultAsync<PrintableScheduleView | null, UnknownDbError> {
    return ResultAsync.fromPromise(_getPrintSchedule(params), unknownDbError);
}
