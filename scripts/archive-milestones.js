/**
 * @file archive-milestones.js
 * @module scripts/archive-milestones
 * @description Automated utility script and quality gate that partitions historical completed milestones from .agents/memory/state.md into fixed-size archive files (max 20 milestones per file).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see parseMilestones
 * @see archiveStateMilestones
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Maximum number of active milestones permitted in state.md before archiving triggers.
 *
 * @type {number}
 */
export const MAX_ACTIVE_MILESTONES = 20;

/**
 * Fixed milestone chunk size per archive file.
 *
 * @type {number}
 */
export const ARCHIVE_CHUNK_SIZE = 20;

/**
 * @typedef {Object} MilestoneEntry
 * @property {number} number - The sequential milestone number (e.g. 101).
 * @property {string} title - Milestone headline or title text.
 * @property {string} rawText - Full raw markdown content for the milestone including indentation.
 */

/**
 * @typedef {Object} ArchiveFileInfo
 * @property {number} index - 1-based sequential archive index (e.g. 1 for state-archive-1.md).
 * @property {string} fileName - File name (e.g. 'state-archive-1.md').
 * @property {string} filePath - Absolute path to the archive file on disk.
 * @property {number} startMilestone - Earliest milestone number contained in the archive.
 * @property {number} endMilestone - Latest milestone number contained in the archive.
 * @property {number} count - Total number of milestones in the archive.
 */

/**
 * @typedef {Object} ArchiveOptions
 * @property {string} [workspaceRoot] - Workspace root directory containing .agents and docs.
 * @property {string} [statePath] - Absolute path to state.md.
 * @property {string} [memoryDir] - Absolute path to .agents/memory directory.
 * @property {boolean} [dryRun] - Whether to simulate archiving without writing files.
 * @property {boolean} [checkOnly] - If true, checks compliance without modifying files and reports status.
 */

/**
 * @typedef {Object} ArchiveResult
 * @property {boolean} archived - Whether any new archive chunks were generated.
 * @property {number} initialActiveCount - Number of active milestones before processing.
 * @property {number} finalActiveCount - Number of active milestones remaining in state.md.
 * @property {string[]} createdFiles - List of generated archive file paths.
 * @property {ArchiveFileInfo[]} allArchives - Comprehensive list of all current archive files.
 */

/**
 * Parses markdown text and extracts all numbered milestone entries matching the pattern 'N. Title'.
 *
 * @function parseMilestones
 * @param {string} markdownText - Markdown text containing numbered milestone blocks.
 * @returns {MilestoneEntry[]} Parsed milestone entries.
 */
export function parseMilestones(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') {
    return [];
  }

  const lines = markdownText.split('\n');
  const milestones = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([0-9]+)\.\s+(.*)$/);

    if (match) {
      if (current) {
        milestones.push({
          number: current.number,
          title: current.title,
          rawText: current.lines.join('\n').trimEnd(),
        });
      }
      current = {
        number: parseInt(match[1], 10),
        title: match[2].trim(),
        lines: [line],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    milestones.push({
      number: current.number,
      title: current.title,
      rawText: current.lines.join('\n').trimEnd(),
    });
  }

  return milestones;
}

/**
 * Deduplicates consecutive milestone entries that share identical numbering and content.
 *
 * @function deduplicateMilestones
 * @param {MilestoneEntry[]} milestones - Array of milestone entries.
 * @returns {MilestoneEntry[]} Deduplicated array of milestones.
 */
export function deduplicateMilestones(milestones) {
  if (!milestones || milestones.length <= 1) {
    return milestones || [];
  }

  const result = [];
  for (let i = 0; i < milestones.length; i++) {
    const current = milestones[i];
    const prev = result[result.length - 1];
    if (prev && prev.number === current.number && prev.rawText === current.rawText) {
      continue;
    }
    result.push(current);
  }
  return result;
}

/**
 * Scans the memory directory for all existing state-archive-N.md files and parses their milestone ranges.
 *
 * @function getArchiveFiles
 * @param {string} memoryDir - Directory containing state archives.
 * @returns {ArchiveFileInfo[]} List of existing archives sorted by index ascending.
 */
export function getArchiveFiles(memoryDir) {
  if (!fs.existsSync(memoryDir)) {
    return [];
  }

  const files = fs.readdirSync(memoryDir);
  const archives = [];

  for (const fileName of files) {
    const match = fileName.match(/^state-archive-(\d+)\.md$/);
    if (!match) {
      continue;
    }

    const index = parseInt(match[1], 10);
    const filePath = path.join(memoryDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parseMilestones(content);

    if (parsed.length > 0) {
      archives.push({
        index,
        fileName,
        filePath,
        startMilestone: parsed[0].number,
        endMilestone: parsed[parsed.length - 1].number,
        count: parsed.length,
      });
    } else {
      archives.push({
        index,
        fileName,
        filePath,
        startMilestone: 0,
        endMilestone: 0,
        count: 0,
      });
    }
  }

  archives.sort((a, b) => a.index - b.index);
  return archives;
}

/**
 * Generates the standardized markdown content for an archive file.
 *
 * @function formatArchiveMarkdown
 * @param {Object} params - Formatting parameters.
 * @param {number} params.index - Archive index number (e.g. 1).
 * @param {number} params.startMilestone - First milestone number.
 * @param {number} params.endMilestone - Last milestone number.
 * @param {MilestoneEntry[]} params.milestones - Milestones included in the archive.
 * @param {string|null} [params.prevArchiveName] - File name of previous archive, or null if first.
 * @param {string|null} [params.nextArchiveName] - File name of next archive, or null if latest.
 * @param {string} params.workspaceRoot - Absolute workspace root path for file:// links.
 * @returns {string} Formatted markdown content.
 */
export function formatArchiveMarkdown(params) {
  const {
    index,
    startMilestone,
    endMilestone,
    milestones,
    prevArchiveName,
    nextArchiveName,
    workspaceRoot,
  } = params;

  const memoryDir = path.join(workspaceRoot, '.agents', 'memory');
  const stateLink = `[.agents/memory/state.md](file://${path.join(memoryDir, 'state.md')})`;

  const prevLink = prevArchiveName
    ? `[${prevArchiveName}](file://${path.join(memoryDir, prevArchiveName)})`
    : 'None (First Archive)';

  const nextLink = nextArchiveName
    ? `[${nextArchiveName}](file://${path.join(memoryDir, nextArchiveName)})`
    : `Active state in ${stateLink}`;

  const milestoneBody = milestones.map((m) => m.rawText).join('\n\n');

  return `# Cartouche Milestones Archive ${index} (Milestones ${startMilestone}–${endMilestone})

> [!NOTE]
> This document archives historical milestones ${startMilestone}–${endMilestone} of the Cartouche project for context optimization and progressive disclosure.
> - **Previous Archive**: ${prevLink}
> - **Next Archive**: ${nextLink}
> - **Active State**: ${stateLink}

## Historical Milestones (${startMilestone}–${endMilestone})

${milestoneBody}
`;
}

/**
 * Splits legacy milestones-archive.md into 20-milestone state-archive-N.md files if present.
 *
 * @function migrateLegacyArchive
 * @param {ArchiveOptions} options - Migration options.
 * @returns {ArchiveFileInfo[]} List of created archive file info objects.
 */
export function migrateLegacyArchive(options = {}) {
  const workspaceRoot = options.workspaceRoot || path.resolve(process.cwd(), '..');
  const memoryDir = options.memoryDir || path.join(workspaceRoot, '.agents', 'memory');
  const legacyPath = path.join(memoryDir, 'milestones-archive.md');

  if (!fs.existsSync(legacyPath)) {
    return [];
  }

  const legacyContent = fs.readFileSync(legacyPath, 'utf8');
  const rawMilestones = parseMilestones(legacyContent);
  const milestones = deduplicateMilestones(rawMilestones);

  if (milestones.length === 0) {
    return [];
  }

  const createdArchives = [];
  const totalChunks = Math.ceil(milestones.length / ARCHIVE_CHUNK_SIZE);

  for (let c = 0; c < totalChunks; c++) {
    const chunkIndex = c + 1;
    const chunk = milestones.slice(c * ARCHIVE_CHUNK_SIZE, (c + 1) * ARCHIVE_CHUNK_SIZE);
    const startNum = chunk[0].number;
    const endNum = chunk[chunk.length - 1].number;
    const fileName = `state-archive-${chunkIndex}.md`;
    const prevFileName = chunkIndex > 1 ? `state-archive-${chunkIndex - 1}.md` : null;
    const nextFileName = chunkIndex < totalChunks ? `state-archive-${chunkIndex + 1}.md` : null;

    const fileContent = formatArchiveMarkdown({
      index: chunkIndex,
      startMilestone: startNum,
      endMilestone: endNum,
      milestones: chunk,
      prevArchiveName: prevFileName,
      nextArchiveName: nextFileName,
      workspaceRoot,
    });

    const targetPath = path.join(memoryDir, fileName);
    if (!options.dryRun) {
      fs.writeFileSync(targetPath, fileContent, 'utf8');
    }
    createdArchives.push({
      index: chunkIndex,
      fileName,
      filePath: targetPath,
      startMilestone: startNum,
      endMilestone: endNum,
      count: chunk.length,
    });
  }

  if (!options.dryRun) {
    fs.unlinkSync(legacyPath);
  }

  return createdArchives;
}

/**
 * Updates Section 3 ("Directory Layout" tree) in state.md to reflect current archive files and ADR count.
 *
 * @function updateStateDirectoryTree
 * @param {string} stateContent - Original state.md markdown content.
 * @param {ArchiveFileInfo[]} archives - Sorted list of current archive files.
 * @param {string} workspaceRoot - Absolute workspace root directory.
 * @returns {string} Updated state.md markdown content.
 */
export function updateStateDirectoryTree(stateContent, archives, workspaceRoot) {
  const treeMatch = stateContent.match(/(## 3\. Directory Layout[\s\S]*?```tree\n)([\s\S]*?)(\n```)/);
  if (!treeMatch) {
    return stateContent;
  }

  const prefix = treeMatch[1];
  const treeBody = treeMatch[2];
  const suffix = treeMatch[3];

  const treeLines = treeBody.split('\n');
  const memoryStartIndex = treeLines.findIndex((line) => line.includes('├── memory/') || line.includes('│   ├── memory/'));

  if (memoryStartIndex === -1) {
    return stateContent;
  }

  // Find boundaries of memory directory entries
  let memoryEndIndex = memoryStartIndex + 1;
  while (memoryEndIndex < treeLines.length) {
    const line = treeLines[memoryEndIndex];
    if (line.match(/^│\s+├──\s+[a-zA-Z]/) || line.match(/^├──\s+[a-zA-Z]/) || line.match(/^[a-zA-Z]/)) {
      break;
    }
    memoryEndIndex++;
  }

  const memoryIndent = '│   │   ├── ';
  const memoryLastIndent = '│   │   └── ';

  const newMemoryEntries = [
    `${memoryIndent}project.json   # Machine-readable project settings`,
  ];

  for (const archive of archives) {
    newMemoryEntries.push(
      `${memoryIndent}${archive.fileName} # Historical completed milestone archive (Milestones ${archive.startMilestone}–${archive.endMilestone})`
    );
  }

  newMemoryEntries.push(`${memoryLastIndent}state.md       # Project architecture log, milestones & context`);

  // Splice into tree lines
  treeLines.splice(memoryStartIndex + 1, memoryEndIndex - (memoryStartIndex + 1), ...newMemoryEntries);

  // Update ADR line if docs/adr has ADR 0014
  const adrDir = path.join(workspaceRoot, 'docs', 'adr');
  if (fs.existsSync(adrDir)) {
    const adrFiles = fs.readdirSync(adrDir).filter((f) => f.match(/^\d{4}-.*\.md$/));
    if (adrFiles.length > 0) {
      adrFiles.sort();
      const lastAdr = adrFiles[adrFiles.length - 1];
      const match = lastAdr.match(/^(\d{4})/);
      if (match) {
        const adrMax = match[1];
        for (let i = 0; i < treeLines.length; i++) {
          if (treeLines[i].includes('├── adr/')) {
            treeLines[i] = treeLines[i].replace(/ADR \d{4}–\d{4}/, `ADR 0001–${adrMax}`);
          }
        }
      }
    }
  }

  const updatedTreeBlock = prefix + treeLines.join('\n') + suffix;
  return stateContent.replace(treeMatch[0], updatedTreeBlock);
}

/**
 * Regenerates Section 5 note and active milestones list in state.md.
 *
 * @function formatStateMilestonesSection
 * @param {ArchiveFileInfo[]} allArchives - All historical archive files.
 * @param {MilestoneEntry[]} activeMilestones - Remaining active milestones in state.md.
 * @param {string} workspaceRoot - Absolute workspace root directory.
 * @returns {string} Formatted Section 5 markdown content.
 */
export function formatStateMilestonesSection(allArchives, activeMilestones, workspaceRoot) {
  const memoryDir = path.join(workspaceRoot, '.agents', 'memory');
  const activeStart = activeMilestones.length > 0 ? activeMilestones[0].number : 'Active';

  const archiveBullets = allArchives
    .map(
      (a) =>
        `> - [Archive ${a.index} (Milestones ${a.startMilestone}–${a.endMilestone})](file://${path.join(memoryDir, a.fileName)})`
    )
    .join('\n');

  const activeMilestonesBody = activeMilestones.map((m) => m.rawText).join('\n\n');

  return `## 5. Completed Milestones

> [!NOTE]
> Historical milestones have been archived into 20-milestone partitions for progressive disclosure and context optimization:
${archiveBullets}
>
> Active milestones (${activeStart}+) continue below.

${activeMilestonesBody}
`;
}

/**
 * Performs fixed-size milestone archiving on state.md according to project directives.
 *
 * @function archiveStateMilestones
 * @param {ArchiveOptions} [options] - Archival execution options.
 * @returns {ArchiveResult} Execution and status summary.
 */
export function archiveStateMilestones(options = {}) {
  const workspaceRoot = options.workspaceRoot || path.resolve(process.cwd(), '..');
  const memoryDir = options.memoryDir || path.join(workspaceRoot, '.agents', 'memory');
  const statePath = options.statePath || path.join(memoryDir, 'state.md');

  if (!fs.existsSync(statePath)) {
    throw new Error(`state.md not found at path: ${statePath}`);
  }

  // Handle migration of legacy milestones-archive.md if it exists
  const migratedArchives = migrateLegacyArchive({ workspaceRoot, memoryDir, dryRun: options.dryRun });

  const stateContent = fs.readFileSync(statePath, 'utf8');
  const sec5Split = stateContent.split(/## 5\. Completed Milestones/);
  if (sec5Split.length < 2) {
    throw new Error(`Section 5 ('## 5. Completed Milestones') not found in ${statePath}`);
  }

  const preSection5 = sec5Split[0];
  const section5Content = sec5Split[1];

  const parsedActive = parseMilestones(section5Content);
  const activeMilestones = deduplicateMilestones(parsedActive);
  const initialActiveCount = activeMilestones.length;

  let existingArchives = getArchiveFiles(memoryDir);
  if (existingArchives.length === 0 && migratedArchives.length > 0) {
    existingArchives = [...migratedArchives];
  }

  if (options.checkOnly) {
    return {
      archived: false,
      initialActiveCount,
      finalActiveCount: initialActiveCount,
      createdFiles: [],
      allArchives: existingArchives,
    };
  }

  const createdFiles = [...migratedArchives.map((a) => a.fileName)];

  // Archive in chunks of ARCHIVE_CHUNK_SIZE while active count >= MAX_ACTIVE_MILESTONES
  while (activeMilestones.length >= MAX_ACTIVE_MILESTONES) {
    const chunk = activeMilestones.splice(0, ARCHIVE_CHUNK_SIZE);
    const newIndex = existingArchives.length + 1;
    const startNum = chunk[0].number;
    const endNum = chunk[chunk.length - 1].number;
    const fileName = `state-archive-${newIndex}.md`;
    const filePath = path.join(memoryDir, fileName);

    const prevArchive = existingArchives.length > 0 ? existingArchives[existingArchives.length - 1] : null;

    const archiveContent = formatArchiveMarkdown({
      index: newIndex,
      startMilestone: startNum,
      endMilestone: endNum,
      milestones: chunk,
      prevArchiveName: prevArchive ? prevArchive.fileName : null,
      nextArchiveName: null,
      workspaceRoot,
    });

    if (!options.dryRun) {
      fs.writeFileSync(filePath, archiveContent, 'utf8');

      // Update previous archive's Next link if exists
      if (prevArchive && fs.existsSync(prevArchive.filePath)) {
        let prevContent = fs.readFileSync(prevArchive.filePath, 'utf8');
        prevContent = prevContent.replace(
          /> - \*\*Next Archive\*\*: .*$/m,
          `> - **Next Archive**: [${fileName}](file://${filePath})`
        );
        fs.writeFileSync(prevArchive.filePath, prevContent, 'utf8');
      }
    }

    const newArchiveInfo = {
      index: newIndex,
      fileName,
      filePath,
      startMilestone: startNum,
      endMilestone: endNum,
      count: chunk.length,
    };

    existingArchives.push(newArchiveInfo);
    createdFiles.push(fileName);
  }

  if (createdFiles.length > 0 || initialActiveCount !== activeMilestones.length) {
    const updatedSec5 = formatStateMilestonesSection(existingArchives, activeMilestones, workspaceRoot);
    let updatedFullState = preSection5 + updatedSec5;
    updatedFullState = updateStateDirectoryTree(updatedFullState, existingArchives, workspaceRoot);

    if (!options.dryRun) {
      fs.writeFileSync(statePath, updatedFullState, 'utf8');
    }

    return {
      archived: true,
      initialActiveCount,
      finalActiveCount: activeMilestones.length,
      createdFiles,
      allArchives: existingArchives,
    };
  }

  return {
    archived: false,
    initialActiveCount,
    finalActiveCount: activeMilestones.length,
    createdFiles: [],
    allArchives: existingArchives,
  };
}

/**
 * CLI entry point.
 *
 * @function archiveMilestonesCli
 * @param {string[]} [argv] - Process arguments.
 * @param {ArchiveOptions} [options] - Explicit options overrides.
 * @returns {number} Exit code (0 for success, 1 for check failure or error).
 */
export function archiveMilestonesCli(argv = process.argv.slice(2), options = {}) {
  const isCheck = argv.includes('--check');
  const isDryRun = argv.includes('--dry-run');

  try {
    const result = archiveStateMilestones({
      ...options,
      checkOnly: isCheck,
      dryRun: isDryRun,
    });

    if (isCheck) {
      if (result.finalActiveCount >= MAX_ACTIVE_MILESTONES) {
        console.error(
          `[archive:milestones] FAILED: state.md contains ${result.finalActiveCount} active milestones (limit is < ${MAX_ACTIVE_MILESTONES}).`
        );
        console.error(`[archive:milestones] Please run 'npm run archive:milestones' to partition older milestones.`);
        return 1;
      }
      console.log(
        `[archive:milestones] OK: state.md has ${result.finalActiveCount} active milestones (< ${MAX_ACTIVE_MILESTONES}). All archives within limit.`
      );
      return 0;
    }

    if (result.archived) {
      console.log(
        `[archive:milestones] SUCCESS: Archived ${result.createdFiles.length} file(s): ${result.createdFiles.join(', ')}.`
      );
      console.log(
        `[archive:milestones] Active milestones in state.md reduced from ${result.initialActiveCount} to ${result.finalActiveCount}.`
      );
    } else {
      console.log(
        `[archive:milestones] No archiving needed: state.md currently has ${result.finalActiveCount} active milestones (< ${MAX_ACTIVE_MILESTONES}).`
      );
    }
    return 0;
  } catch (err) {
    console.error(`[archive:milestones] ERROR:`, err);
    return 1;
  }
}

// Auto-run if executed directly
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const exitCode = archiveMilestonesCli();
  process.exit(exitCode);
}
