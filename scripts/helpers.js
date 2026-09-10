export const registerHelpers = () => {
  // Comparison helpers
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('ne', (a, b) => a !== b);
  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('gt', (a, b) => a > b);
  Handlebars.registerHelper('lt', (a, b) => a < b);
  Handlebars.registerHelper('lte', (a, b) => a <= b);
  Handlebars.registerHelper('or', (...args) => args.slice(0, -1).some(Boolean));
  Handlebars.registerHelper('and', (...args) => args.slice(0, -1).every(Boolean));
  Handlebars.registerHelper('not', (val) => !val);

  // Math helpers
  Handlebars.registerHelper('abs', (value) => Math.abs(value));
  Handlebars.registerHelper('add', (a, b) => a + b);
  Handlebars.registerHelper('subtract', (a, b) => a - b);

  // String helpers
  Handlebars.registerHelper('lowercase', (str) => str ? String(str).toLowerCase() : '');
  Handlebars.registerHelper('uppercase', (str) => str ? String(str).toUpperCase() : '');

  // Array helpers
  Handlebars.registerHelper('limit', (arr, limit) => arr ? arr.slice(0, limit) : []);
  Handlebars.registerHelper('reverse', (arr) => arr ? [...arr].reverse() : []);
  Handlebars.registerHelper('lookup', (obj, field) => obj ? obj[field] : '');
  Handlebars.registerHelper('includes', (arr, val) => Array.isArray(arr) ? arr.includes(val) : false);
};
