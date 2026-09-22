// Safe, eval-free evaluation of workflow logic conditions.
//
// Replaces the previous `new Function(...)` approach, which executed arbitrary
// user-supplied strings as JavaScript inside the API/worker process (an RCE hole).
// This module understands the constrained set of expressions the visual builder
// and AI generator actually produce — comparisons, membership checks, and
// structured { field, operator, value } configs — without ever running user input
// as code. Anything it cannot parse evaluates to `false` (fail-closed).

type AnyRecord = Record<string, any>;

/** Resolve a dotted path (optionally prefixed with `payload.`) against the event. */
function getPath(path: string, payload: AnyRecord): any {
  const clean = path.trim().replace(/^payload\./, '');
  if (clean === '' || clean === 'payload') return clean === 'payload' ? payload : undefined;
  return clean
    .split('.')
    .reduce<any>((acc, key) => (acc == null ? undefined : acc[key.trim()]), payload);
}

/** Parse a token as a literal (quoted string, number, boolean, null). Returns
 *  `undefined` when the token is not a recognizable literal. */
function coerceLiteral(token: string): any {
  const t = token.trim();
  if (
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2) ||
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  return undefined;
}

/** Resolve an operand: a literal if it looks like one, otherwise a payload path. */
function operand(token: string, payload: AnyRecord): any {
  const lit = coerceLiteral(token);
  if (lit !== undefined) return lit;
  return getPath(token, payload);
}

function compare(lhs: any, op: string, rhs: any): boolean {
  switch (op) {
    case '===': return lhs === rhs;
    case '!==': return lhs !== rhs;
    case '==': // eslint-disable-next-line eqeqeq
      return lhs == rhs;
    case '!=': // eslint-disable-next-line eqeqeq
      return lhs != rhs;
    case '>': return Number(lhs) > Number(rhs);
    case '<': return Number(lhs) < Number(rhs);
    case '>=': return Number(lhs) >= Number(rhs);
    case '<=': return Number(lhs) <= Number(rhs);
    // Named operators emitted by the AI generator / structured configs:
    case 'equals': return lhs == rhs || String(lhs) === String(rhs); // eslint-disable-line eqeqeq
    case 'not_equals': return !(lhs == rhs || String(lhs) === String(rhs)); // eslint-disable-line eqeqeq
    case 'contains':
    case 'includes': return String(lhs ?? '').includes(String(rhs ?? ''));
    case 'greater_than': return Number(lhs) > Number(rhs);
    case 'less_than': return Number(lhs) < Number(rhs);
    default: return false;
  }
}

/** Evaluate a structured condition ({ field, operator, value }). */
export function evaluateStructuredCondition(
  field: string,
  operator: string,
  value: any,
  payload: AnyRecord
): boolean {
  const lhs = getPath(String(field ?? ''), payload);
  const rhs = typeof value === 'string' ? coerceLiteral(value) ?? value : value;
  return compare(lhs, operator, rhs);
}

/** Evaluate a single-expression string (e.g. "amount > 100",
 *  "account_tier === 'enterprise'", "customer.email.endsWith('.io')"). */
export function evaluateConditionExpression(expr: string, payload: AnyRecord): boolean {
  if (!expr || !expr.trim()) return true;
  const s = expr.replace(/^IF:\s*/i, '').replace(/^eval:\s*/i, '').trim();

  // Method form: SUBJECT.(includes|startsWith|endsWith)(ARG)
  const method = s.match(/^(.+?)\.(includes|startsWith|endsWith)\(\s*(.*?)\s*\)$/);
  if (method) {
    const subjectToken = method[1].trim();
    const fn = method[2];
    const argVal = operand(method[3], payload);
    const strWrap = subjectToken.match(/^String\(\s*(.+?)\s*\)$/);
    const subjVal = operand(strWrap ? strWrap[1] : subjectToken, payload);
    const subject = subjVal == null ? '' : String(subjVal);
    const arg = argVal == null ? '' : String(argVal);
    if (fn === 'includes') return subject.includes(arg);
    if (fn === 'startsWith') return subject.startsWith(arg);
    if (fn === 'endsWith') return subject.endsWith(arg);
    return false;
  }

  // Comparison form: LHS <op> RHS (longer operators listed first).
  const cmp = s.match(/^(.*?)\s*(===|!==|>=|<=|==|!=|>|<)\s*(.*)$/);
  if (cmp) {
    return compare(operand(cmp[1], payload), cmp[2], operand(cmp[3], payload));
  }

  // Bare path → truthiness.
  return Boolean(getPath(s, payload));
}

/** Evaluate a logic node's condition from its config. Accepts either a raw
 *  expression string or a node config object ({ condition | subtitle } and/or
 *  { field, operator, value }). Unparseable input fails closed (false). */
export function evaluateCondition(
  config: AnyRecord | string | undefined | null,
  payload: AnyRecord
): boolean {
  if (config == null) return true;
  if (typeof config === 'string') return evaluateConditionExpression(config, payload);

  if (config.operator && config.field !== undefined) {
    return evaluateStructuredCondition(config.field, config.operator, config.value, payload);
  }
  const expr = config.condition || config.subtitle;
  if (expr) return evaluateConditionExpression(String(expr), payload);
  return true;
}
