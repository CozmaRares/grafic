CREATE TABLE `employees` (
	`matricol` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`functie` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fixed_legal_holidays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`day` integer NOT NULL,
	`month` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_legal_holidays_date_idx` ON `fixed_legal_holidays` (`month`,`day`);--> statement-breakpoint
CREATE TABLE `print_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_entries` (
	`employeeMatricol` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`compartment` text NOT NULL,
	`shiftCode` text NOT NULL,
	PRIMARY KEY(`employeeMatricol`, `year`, `month`, `day`, `compartment`)
);
--> statement-breakpoint
CREATE TABLE `schedule_snapshot_cells` (
	`snapshotRowId` integer NOT NULL,
	`day` integer NOT NULL,
	`shiftCode` text NOT NULL,
	PRIMARY KEY(`snapshotRowId`, `day`)
);
--> statement-breakpoint
CREATE TABLE `schedule_snapshot_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`groupOrder` integer NOT NULL,
	`employeeMatricol` integer NOT NULL,
	`employeeName` text NOT NULL,
	`employeeFunction` text NOT NULL,
	`compartment` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_snapshot_rows_month_employee_idx` ON `schedule_snapshot_rows` (`year`,`month`,`groupOrder`,`employeeMatricol`,`compartment`);--> statement-breakpoint
CREATE TABLE `schedule_snapshots` (
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	PRIMARY KEY(`year`, `month`)
);
--> statement-breakpoint
CREATE TABLE `variable_legal_holiday_dates` (
	`definitionId` integer NOT NULL,
	`year` integer NOT NULL,
	`day` integer NOT NULL,
	`month` integer NOT NULL,
	PRIMARY KEY(`definitionId`, `year`)
);
--> statement-breakpoint
CREATE TABLE `variable_legal_holiday_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variable_legal_holiday_definitions_name_idx` ON `variable_legal_holiday_definitions` (`name`);