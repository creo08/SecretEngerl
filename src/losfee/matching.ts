/**
 * Feasibility: maximum bipartite matching (Hopcroft-Karp) on the "who may give
 * to whom" matrix. If no perfect matching exists, König's theorem yields a
 * group of givers that together may give to fewer people than they are (Hall).
 */

/** Result of the feasibility check. */
export type Feasibility = { ok: true; matching: number[] } | { ok: false; givers: number[]; receivers: number[] };

/** Runs Hopcroft-Karp on `allowed[giver][receiver]` and explains a failure. */
export function checkFeasibility(allowed: readonly (readonly boolean[])[]): Feasibility {
  const n = allowed.length;
  const adj = allowed.map((row) => row.flatMap((ok, r) => (ok ? [r] : [])));
  const matchG = new Array<number>(n).fill(-1);
  const matchR = new Array<number>(n).fill(-1);
  const dist = new Array<number>(n);

  const bfs = (): boolean => {
    const queue: number[] = [];
    for (let g = 0; g < n; g++) {
      dist[g] = matchG[g] === -1 ? 0 : Infinity;
      if (matchG[g] === -1) queue.push(g);
    }
    let found = false;
    for (let i = 0; i < queue.length; i++) {
      const g = queue[i]!;
      for (const r of adj[g]!) {
        const next = matchR[r]!;
        if (next === -1) found = true;
        else if (dist[next] === Infinity) {
          dist[next] = dist[g]! + 1;
          queue.push(next);
        }
      }
    }
    return found;
  };

  const dfs = (g: number): boolean => {
    for (const r of adj[g]!) {
      const next = matchR[r]!;
      if (next === -1 || (dist[next] === dist[g]! + 1 && dfs(next))) {
        matchG[g] = r;
        matchR[r] = g;
        return true;
      }
    }
    dist[g] = Infinity;
    return false;
  };

  while (bfs()) for (let g = 0; g < n; g++) if (matchG[g] === -1) dfs(g);

  const free = matchG.indexOf(-1);
  if (free === -1) return { ok: true, matching: matchG };

  // Givers reachable from a free giver by alternating paths form a Hall violator:
  // all their possible receivers are matched to other givers of the same set.
  const givers = new Set([free]);
  const receivers = new Set<number>();
  const queue = [free];
  for (let i = 0; i < queue.length; i++) {
    for (const r of adj[queue[i]!]!) {
      if (receivers.has(r)) continue;
      receivers.add(r);
      const next = matchR[r]!;
      if (next !== -1 && !givers.has(next)) {
        givers.add(next);
        queue.push(next);
      }
    }
  }
  return { ok: false, givers: [...givers].sort((a, b) => a - b), receivers: [...receivers].sort((a, b) => a - b) };
}
