import type { HistoryCandidate, RetentionRule } from "../shared/types";

export interface SimulatorRuleGroup {
  rule: RetentionRule;
  candidates: HistoryCandidate[];
  matched: number;
  expired: number;
}

export function groupSimulatorCandidates(rules: RetentionRule[], candidates: HistoryCandidate[]): SimulatorRuleGroup[] {
  const candidatesByRule = new Map<string, HistoryCandidate[]>();
  for (const candidate of candidates) {
    const current = candidatesByRule.get(candidate.rule.id) ?? [];
    current.push(candidate);
    candidatesByRule.set(candidate.rule.id, current);
  }
  return rules.filter((rule) => rule.enabled).map((rule) => {
    const matchingCandidates = candidatesByRule.get(rule.id) ?? [];
    return {
      rule,
      candidates: matchingCandidates,
      matched: matchingCandidates.length,
      expired: matchingCandidates.filter((candidate) => candidate.expired).length,
    };
  });
}
