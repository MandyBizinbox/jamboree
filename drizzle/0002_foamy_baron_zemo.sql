CREATE TABLE `formFieldConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceColumn` int NOT NULL,
	`displayLabel` text NOT NULL,
	`sectionKey` varchar(80) NOT NULL,
	`visible` int NOT NULL DEFAULT 1,
	`required` int NOT NULL DEFAULT 0,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `formFieldConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `formFieldConfigs_sourceColumn_unique` UNIQUE(`sourceColumn`)
);
--> statement-breakpoint
CREATE TABLE `formSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionKey` varchar(80) NOT NULL,
	`displayLabel` varchar(180) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`visible` int NOT NULL DEFAULT 1,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `formSections_id` PRIMARY KEY(`id`),
	CONSTRAINT `formSections_sectionKey_unique` UNIQUE(`sectionKey`)
);
