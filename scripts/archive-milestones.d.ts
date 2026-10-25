/**
 * @file archive-milestones.d.ts
 * @module scripts/archive-milestones
 * @description Type declarations for the automated milestone archiver and partition validator.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 */

export interface MilestoneEntry {
  number: number;
  title: string;
  rawText: string;
}

export interface ArchiveFileInfo {
  index: number;
  fileName: string;
  filePath: string;
  startMilestone: number;
  endMilestone: number;
  count: number;
}

export interface ArchiveOptions {
  workspaceRoot?: string;
  statePath?: string;
  memoryDir?: string;
  dryRun?: boolean;
  checkOnly?: boolean;
}

export interface ArchiveResult {
  archived: boolean;
  initialActiveCount: number;
  finalActiveCount: number;
  createdFiles: string[];
  allArchives: ArchiveFileInfo[];
}

export declare const MAX_ACTIVE_MILESTONES: number;
export declare const ARCHIVE_CHUNK_SIZE: number;

export declare function parseMilestones(markdownText: string): MilestoneEntry[];
export declare function deduplicateMilestones(milestones: MilestoneEntry[]): MilestoneEntry[];
export declare function getArchiveFiles(memoryDir: string): ArchiveFileInfo[];
export declare function formatArchiveMarkdown(params: {
  index: number;
  startMilestone: number;
  endMilestone: number;
  milestones: MilestoneEntry[];
  prevArchiveName?: string | null;
  nextArchiveName?: string | null;
  workspaceRoot: string;
}): string;
export declare function migrateLegacyArchive(options?: ArchiveOptions): ArchiveFileInfo[];
export declare function updateStateDirectoryTree(
  stateContent: string,
  archives: ArchiveFileInfo[],
  workspaceRoot: string
): string;
export declare function formatStateMilestonesSection(
  allArchives: ArchiveFileInfo[],
  activeMilestones: MilestoneEntry[],
  workspaceRoot: string
): string;
export declare function archiveStateMilestones(options?: ArchiveOptions): ArchiveResult;
export declare function archiveMilestonesCli(argv?: string[], options?: ArchiveOptions): number;
