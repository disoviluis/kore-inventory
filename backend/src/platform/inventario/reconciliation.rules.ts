export interface CountRound {
  numero: number;
  ronda_id: number;
  cantidad: number | null;
}

export type ReconciliationState = 'incomplete' | 'matched' | 'difference' | 'review';

export interface RoundConsensus {
  physical: number | null;
  status: ReconciliationState;
  resolvingRoundId: number | null;
}

export const evaluateRoundConsensus = (rounds: CountRound[], maxRounds: number): RoundConsensus => {
  const byRound = new Map(rounds.map((round) => [Number(round.numero), round]));
  const first = byRound.get(1);
  const second = byRound.get(2);
  const third = byRound.get(3);
  const completedRoundNumber = Math.max(0, ...rounds.map((round) => Number(round.numero)));

  if (first?.cantidad === null || first?.cantidad === undefined
      || second?.cantidad === null || second?.cantidad === undefined) {
    return { physical: null, status: 'incomplete', resolvingRoundId: null };
  }
  if (Number(first.cantidad) === Number(second.cantidad)) {
    return { physical: Number(first.cantidad), status: 'matched', resolvingRoundId: Number(second.ronda_id) };
  }
  if (third?.cantidad !== null && third?.cantidad !== undefined
      && (Number(third.cantidad) === Number(first.cantidad) || Number(third.cantidad) === Number(second.cantidad))) {
    return { physical: Number(third.cantidad), status: 'matched', resolvingRoundId: Number(third.ronda_id) };
  }
  return {
    physical: null,
    status: completedRoundNumber >= maxRounds ? 'review' : 'difference',
    resolvingRoundId: null
  };
};