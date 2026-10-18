/**
 * Accesos de paleta que abren el chat nombrando a Alfred.
 * No orquestan: el protocolo vive en la ficha del agente.
 */
export interface AlfredPaletteAction {
	id: string;
	label: string;
	prompt: string;
	description?: string;
}

export const ALFRED_FLOWS: readonly AlfredPaletteAction[] = [
	{ id: 'feature', label: 'Feature (idea -> entrega)', prompt: '@alfred Arranca el flujo Feature (Idea -> Entrega)' },
	{ id: 'quick', label: 'Quick (cambio acotado)', prompt: '@alfred Arranca el flujo Quick: cambio pequeño y delimitado, menos ceremonia que Feature, TDD igual.' },
	{ id: 'fix', label: 'Fix (diagnóstico -> TDD -> QA)', prompt: '@alfred Arranca el flujo Fix (Diagnóstico -> TDD -> QA)' },
	{ id: 'spike', label: 'Spike (investigación sin implementar)', prompt: '@alfred Arranca el flujo Spike (investigación sin implementar)' },
	{ id: 'discuss', label: 'Discuss (refinar idea antes de un PRD)', prompt: '@alfred Arranca el flujo Discuss (refinar idea antes de un PRD)' },
	{ id: 'map-codebase', label: 'Map codebase (brownfield, sin implementar)', prompt: '@alfred Arranca el flujo Map-codebase: analiza el repo, deja artefactos de descubrimiento y no implementes código de producto.' },
	{ id: 'audit', label: 'Audit (seguridad + calidad)', prompt: '@alfred Arranca el flujo Audit (Seguridad + Calidad)' },
	{ id: 'uat', label: 'UAT (confirmación humana, no tests)', prompt: '@alfred Arranca el flujo UAT (confirmación humana, no tests)' },
	{ id: 'ship', label: 'Ship (publicación)', prompt: '@alfred Arranca el flujo Ship (Publicación)' },
	{ id: 'lucius', label: 'Lucius (segunda opinión en solo lectura)', prompt: '@alfred Arranca el flujo Lucius (segunda opinión en solo lectura)' },
];

export const ALFRED_CONTINUITY: readonly AlfredPaletteAction[] = [
	{ id: 'progress', label: 'Ver progreso', prompt: '@alfred Reconstruye el progreso: issues y PRs de GitHub, y docs/project/status.md. No inventes estado.' },
	{ id: 'pause', label: 'Pausar trabajo', prompt: '@alfred Pausa el trabajo actual: deja el handoff en la issue in-progress o en el snapshot. No implementes código.' },
	{ id: 'retomar', label: 'Retomar trabajo', prompt: '@alfred Retoma el trabajo in-progress o in-review, o el snapshot local. No reinventes el flujo.' },
];

export function withDescriptions(actions: readonly AlfredPaletteAction[]): AlfredPaletteAction[] {
	return actions.map((action) => ({ ...action, description: action.id }));
}
