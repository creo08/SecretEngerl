/** Upper tail probability of the chi-squared distribution, P(X >= x) with k degrees of freedom. */
export function chiSquaredPValue(x: number, k: number): number {
  return upperRegularizedGamma(k / 2, x / 2);
}

function logGamma(z: number): number {
  // Lanczos approximation, g = 7.
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0]!;
  for (let i = 1; i < 9; i++) x += c[i]! / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function upperRegularizedGamma(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 10_000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction (Lentz).
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10_000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Chi-squared statistic of observed counts against expected counts. */
export function chiSquared(observed: readonly number[], expected: readonly number[]): number {
  return observed.reduce((sum, o, i) => sum + (o - expected[i]!) ** 2 / expected[i]!, 0);
}
