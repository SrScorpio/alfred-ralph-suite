/**
 * planImport.ts — Parser de markdown (plan agent) → prd.json e ID generator
 *
 * Extraído de kanbanPanel.ts durante la modularización (ADR-014).
 */

import { Prd } from '../prdManager';

// ── Types ────────────────────────────────────────────────────────────────────

interface ImportedPrd {
	project:     string;
	description: string;
	version:     string;
	issues:      any[];
}

// ── Plan markdown → prd.json parser ──────────────────────────────────────────

const BOLD_NUMBERED_STEP = /^\d+[.)]\s+\*\*(.+?)\*\*/;
const BOLD_NAMED_STEP = /^\*\*(?:step|paso)\s+\d+\s*[.:\-–)]\s*(.+?)\*\*/i;
const HEADING_NAMED_STEP = /^#{1,6}\s+(?:step|paso)\s+\d+\s*[.:\-–)]\s*(.+?)\s*$/i;
const HEADING_NUMBERED_STEP = /^#{1,6}\s+\d+[.)\-–]\s+(.+?)\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const STEP_SECTION = /^(?:\*\*)?\s*(?:steps?|pasos?|tareas?|tasks?|fases?|plan de implementaci[oó]n|implementation plan)\s*(?:\*\*)?\s*:?\s*$/i;
const SECTION_BREAK = /^(?:\*\*)?\s*(?:verification|verificaci[oó]n|riesgos|risks|notas|notes|archivos|files|referencias|references)\s*(?:\*\*)?\s*:?\s*$/i;
const BREAKING_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_STATUSES = new Set(['todo', 'inprogress', 'completed', 'blocked', 'failed']);

function cleanTitle(value: string): string {
	return value.replace(/\*\*/g, '').replace(/`/g, '').trim().slice(0, 160) || 'Untitled step';
}

function emptyStep(title: string, existing: any[]): any {
	return {
		id: generateNextId(existing.map(item => String(item.id))),
		title: cleanTitle(title),
		description: '',
		epic: undefined,
		priority: 'P2',
		status: 'todo',
		acceptanceCriteria: [] as string[],
		dependencies: [] as string[],
		labels: [] as string[],
	};
}

/**
 * Importa un prd.json ya escrito. Sin esto, elegir el propio backlog en el
 * diálogo devolvía "no se encontraron tareas".
 */
function parseJsonBacklog(text: string): ImportedPrd | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith('{')) { return null; }
	let data: any;
	try { data = JSON.parse(trimmed); } catch { return null; }
	const list = Array.isArray(data?.issues) ? data.issues
		: Array.isArray(data?.userStories) ? data.userStories
			: null;
	if (!list) { return null; }

	const issues = list.map((raw: any, index: number) => {
		const priority = String(raw?.priority ?? '').toUpperCase();
		const status = String(raw?.status ?? '').toLowerCase();
		return {
			id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : `ISSUE-${String(index + 1).padStart(3, '0')}`,
			title: cleanTitle(String(raw?.title ?? raw?.name ?? `Issue ${index + 1}`)),
			description: String(raw?.description ?? '').trim(),
			epic: raw?.epic ? String(raw.epic) : undefined,
			priority: BREAKING_PRIORITIES.has(priority) ? priority : 'P2',
			status: VALID_STATUSES.has(status) ? status : 'todo',
			acceptanceCriteria: Array.isArray(raw?.acceptanceCriteria) ? raw.acceptanceCriteria.map(String) : [],
			dependencies: Array.isArray(raw?.dependencies) ? raw.dependencies.map(String) : [],
			labels: Array.isArray(raw?.labels) ? raw.labels.map(String) : [],
		};
	});

	return {
		project: String(data?.project ?? data?.projectName ?? 'Imported Project').trim() || 'Imported Project',
		description: String(data?.description ?? '').trim(),
		version: String(data?.version ?? '1.0.0').trim() || '1.0.0',
		issues,
	};
}

export function importPlanToPrd(markdown: string): ImportedPrd | null {
	const fromJson = parseJsonBacklog(markdown);
	if (fromJson) { return fromJson; }

	const lines = markdown.split(/\r?\n/);

	// Extract title from "## Plan: <title>" or first H1
	let project     = 'Imported Project';
	let description = '';

	const titleMatch = markdown.match(/##\s+Plan:\s*(.+)/);
	if (titleMatch) { project = titleMatch[1].trim(); }
	else {
		const h1 = markdown.match(/^#\s+(.+)/m);
		if (h1) { project = h1[1].trim(); }
	}

	// Extract TL;DR as description
	const tldrMatch = markdown.match(/TL;DR[^\n]*[-–]\s*(.+)/i);
	if (tldrMatch) { description = tldrMatch[1].trim(); }

	// Relevant files for later cross-referencing
	const relevantFiles: string[] = [];
	const fileMatches = markdown.matchAll(/`([^`]+\.[a-z]{2,6})`/g);
	for (const m of fileMatches) { relevantFiles.push(m[1]); }

	// Verification section
	const verification: string[] = [];
	let inVerification = false;
	for (const line of lines) {
		if (/^\*\*Verification\*\*/i.test(line)) { inVerification = true; continue; }
		if (inVerification) {
			if (/^\*\*/.test(line)) { inVerification = false; continue; }
			const v = line.replace(/^[-*]\s*/, '').trim();
			if (v) { verification.push(v); }
		}
	}

	const issues: any[] = [];
	let currentStep: any = null;
	let inSteps = false;
	let stepSectionLevel: number | null = null;

	const pushStep = (title: string) => {
		if (currentStep) { issues.push(currentStep); }
		currentStep = emptyStep(title, issues);
		inSteps = true;
	};

	for (const line of lines) {
		const trimmed = line.trim();

		// Numbered or named steps: "1. **Title**", "**Step 1: Title**",
		// "### 1. Title", "## Paso 1: Title", "#### 2) Title".
		const named = line.match(BOLD_NAMED_STEP) || line.match(HEADING_NAMED_STEP);
		const numbered = line.match(BOLD_NUMBERED_STEP) || line.match(HEADING_NUMBERED_STEP);
		if (named) { pushStep(named[1]); continue; }
		if (numbered) { pushStep(numbered[1]); continue; }

		const heading = line.match(HEADING);
		if (heading) {
			const level = heading[1].length;
			const content = heading[2];
			if (STEP_SECTION.test(content)) {
				stepSectionLevel = level;
				continue;
			}
			if (stepSectionLevel !== null) {
				if (level > stepSectionLevel) { pushStep(content); continue; }
				stepSectionLevel = null;
			}
			continue;
		}

		if (SECTION_BREAK.test(trimmed)) {
			stepSectionLevel = null;
			continue;
		}

		if (!currentStep || !inSteps) { continue; }
		if (!trimmed) { continue; }

		// Detect deprecation
		if (/deprecat|reemplazar|replace|migrate/i.test(trimmed)) {
			currentStep.labels.push('migration');
		}

		// Detect criteria (checklist items)
		const acMatch = trimmed.match(/^[-*]\s*\[.?\]\s*(.+)/);
		if (acMatch) {
			currentStep.acceptanceCriteria.push(acMatch[1].trim());
			continue;
		}

		// Detect epics
		const epicMatch = trimmed.match(/^Epic[:\s]+(.+)/i);
		if (epicMatch) {
			currentStep.epic = epicMatch[1].trim();
			continue;
		}

		// Detect priority
		const prioMatch = trimmed.match(/^Priority[:\s]+(.+)/i);
		if (prioMatch) {
			currentStep.priority = prioMatch[1].trim().toUpperCase();
			continue;
		}

		// Everything else is description
		if (currentStep.description) {
			currentStep.description += '\n' + trimmed;
		} else {
			currentStep.description = trimmed;
		}
	}

	// Push last step
	if (currentStep) { issues.push(currentStep); }

	// Chain steps with sequential dependencies (step N depends on step N-1)
	for (let i = 1; i < issues.length; i++) {
		issues[i].dependencies.push(issues[i - 1].id);
	}

	// Add relevant file references to descriptions
	if (relevantFiles.length > 0) {
		for (const issue of issues) {
			issue.description += `\n\n**Related files:** ${relevantFiles.join(', ')}`;
		}
	}

	// Add verification to the last step if it is not already included
	if (verification.length > 0 && issues.length > 0) {
		issues[issues.length - 1].acceptanceCriteria.push(...verification);
	}

	return {
		project,
		description,
		version: '1.0.0',
		issues,
	};
}

// ── ID generation ────────────────────────────────────────────────────────────

/** Canonical format for NEW backlog IDs: at least 3 letters, optional -/_, then digits. */
export const NEW_BACKLOG_ID_RE = /^[A-Za-z]{3,}[-_]?[0-9]+$/;

export function isValidNewBacklogId(id: unknown): boolean {
	return typeof id === 'string' && NEW_BACKLOG_ID_RE.test(id);
}

function numericSuffix(id: unknown): number | null {
	const match = String(id ?? '').match(/(\d+)$/);
	if (!match) { return null; }
	const value = parseInt(match[1], 10);
	return Number.isFinite(value) ? value : null;
}

export function generateNextId(existingIds: string[]): string {
	const nums = existingIds
		.map(numericSuffix)
		.filter((n): n is number => n !== null);
	const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
	return `ISSUE-${String(next).padStart(3, '0')}`;
}

export function allocateNewBacklogId(proposed: unknown, existingIds: string[]): string {
	const id = String(proposed ?? '').trim();
	if (isValidNewBacklogId(id) && !existingIds.includes(id)) {
		return id;
	}
	return generateNextId(existingIds);
}

export function persistNewBacklogItem<T extends Record<string, unknown>>(item: T, existingIds: string[]): T & { id: string } {
	return { ...item, id: allocateNewBacklogId(item.id, existingIds) };
}

export function applyEditedBacklogId(original: string, proposed: unknown, existingIds: string[]): string {
	if (proposed === undefined || proposed === null) { return original; }
	const next = String(proposed).trim();
	if (!next || next === original) { return original; }
	const others = existingIds.filter(id => id !== original);
	if (isValidNewBacklogId(next) && !others.includes(next)) { return next; }
	return original;
}

export function appendImportedIssues<T extends { id: unknown; dependencies?: unknown }>(existing: T[], imported: T[]): T[] {
	const existingIds = new Set(existing.map(item => String(item.id)));
	const idMap = new Map<string, string>();
	return imported.map(item => {
		const persisted = persistNewBacklogItem(item, [...existingIds]);
		idMap.set(String(item.id), persisted.id);
		existingIds.add(persisted.id);
		if (!Array.isArray(persisted.dependencies)) {
			return persisted;
		}
		return {
			...persisted,
			dependencies: persisted.dependencies.map((dep: unknown) => idMap.get(String(dep)) ?? dep),
		};
	});
}

// ── Add from Chat prompt ─────────────────────────────────────────────────────

export function buildAddFromChatPrompt(prd: Prd | null, prdPath: string): string {
	const projectName = prd?.project ?? 'this project';
	const existingIds = (prd?.issues ?? []).map(i => i.id);
	const nextId      = generateNextId(existingIds);
	const epics       = prd ? [...new Set(prd.issues.map(i => i.epic || 'General'))].join(', ') : '';

	return [
		`I want to add one or more new issues to the prd.json for **${projectName}**.`,
		``,
		`Existing epics: ${epics || 'none yet'}`,
		`Next available ID: ${nextId}`,
		`prd.json location: \`${prdPath.replace(/\\/g, '/')}\``,
		``,
		`Use ISSUE-NNN (padding 3). Do not use numeric-only IDs (1 or 001). Do not infer GitHub #N from the local ID.`,
		``,
		`Please ask me what I want to add (in natural language), then:`,
		`1. Break it down into one or more concrete issues`,
		`2. For each issue generate a JSON object following this schema:`,
		`   - id: string starting from ${nextId} (increment for each new ISSUE-NNN)`,
		`   - title: short descriptive title`,
		`   - description: what needs to be done`,
		`   - epic: pick from existing epics or create a new one`,
		`   - priority: "P0" | "P1" | "P2" | "P3"`,
		`   - status: always "todo"`,
		`   - acceptanceCriteria: array of strings`,
		`   - dependencies: array of existing issue IDs this depends on (empty if none)`,
		`   - labels: array of strings`,
		`3. Add the new issue(s) to the \`issues\` array (or \`userStories\` if that key exists) in \`${prdPath.replace(/\\/g, '/')}\``,
		`4. Do NOT modify any existing issues — only append`,
		`5. Confirm what was added with a brief summary`,
	].join('\n');
}