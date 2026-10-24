export type TaskRunReservationPhase = 'reserved' | 'sending' | 'sent' | 'recovery';

export interface TaskRunReservation {
	readonly root: string;
	readonly taskId: string;
	phase: TaskRunReservationPhase;
}

let currentReservation: TaskRunReservation | undefined;

/** A single extension-host-wide lease; roots and task IDs do not partition it. */
export function reserveTaskRun(root: string, taskId: string): TaskRunReservation | null {
	if (currentReservation) { return null; }
	const reservation: TaskRunReservation = { root, taskId, phase: 'reserved' };
	currentReservation = reservation;
	return reservation;
}

export function getTaskRunReservation(): TaskRunReservation | undefined {
	return currentReservation;
}

export function markTaskRunSending(reservation: TaskRunReservation): boolean {
	if (currentReservation !== reservation || reservation.phase !== 'reserved') { return false; }
	reservation.phase = 'sending';
	return true;
}

export function markTaskRunNotSent(reservation: TaskRunReservation): boolean {
	if (currentReservation !== reservation || reservation.phase !== 'sending') { return false; }
	reservation.phase = 'reserved';
	return true;
}

export function markTaskRunSent(reservation: TaskRunReservation): boolean {
	if (currentReservation !== reservation || reservation.phase !== 'sending') { return false; }
	reservation.phase = 'sent';
	return true;
}

export function markTaskRunUnknown(reservation: TaskRunReservation): boolean {
	if (currentReservation !== reservation || (reservation.phase !== 'sending' && reservation.phase !== 'sent')) { return false; }
	reservation.phase = 'recovery';
	return true;
}

/** Releases only the exact lease owner, and never clears an ambiguous send. */
export function releaseTaskRunReservation(reservation: TaskRunReservation): boolean {
	if (currentReservation !== reservation || (reservation.phase !== 'reserved' && reservation.phase !== 'sent')) { return false; }
	currentReservation = undefined;
	return true;
}

/** Called only after the user confirms the previous agent was checked/stopped. */
export function recoverTaskRunReservation(reservation: TaskRunReservation, approved: boolean): boolean {
	if (!approved || currentReservation !== reservation || reservation.phase !== 'recovery') { return false; }
	currentReservation = undefined;
	return true;
}

/** Acquire synchronously before invoking an async entry action (for example identity lookup). */
export async function withTaskRunReservation(
	root: string,
	taskId: string,
	action: (reservation: TaskRunReservation) => Promise<void>,
): Promise<boolean> {
	const reservation = reserveTaskRun(root, taskId);
	if (!reservation) { return false; }
	try {
		await action(reservation);
		return true;
	} finally {
		releaseTaskRunReservation(reservation);
	}
}
