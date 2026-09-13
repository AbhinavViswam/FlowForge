export function interpolate(template: string | null | undefined, payload: any): string {
  if (!template || typeof template !== 'string') return '';
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = path.trim().split('.').reduce((acc: any, part: string) => acc && acc[part], payload);
    return value !== undefined && value !== null ? String(value) : match;
  });
}

export function interpolateObj(obj: any, payload: any): any {
  if (typeof obj === 'string') {
    return interpolate(obj, payload);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObj(item, payload));
  }
  if (typeof obj === 'object' && obj !== null) {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = interpolateObj(obj[key], payload);
    }
    return res;
  }
  return obj;
}

