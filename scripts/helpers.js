export const registerHelpers = () => {
  // Comparison helpers
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('lt', (a, b) => a < b);

  // Math helpers
  Handlebars.registerHelper('abs', (value) => Math.abs(value));
  Handlebars.registerHelper('add', (a, b) => a + b);
  Handlebars.registerHelper('subtract', (a, b) => a - b);

  // String helpers
  Handlebars.registerHelper('lowercase', (str) => str ? str.toLowerCase() : '');

  // Array helpers
  Handlebars.registerHelper('limit', (arr, limit) => arr ? arr.slice(0, limit) : []);
  Handlebars.registerHelper('reverse', (arr) => arr ? [...arr].reverse() : []);
  Handlebars.registerHelper('lookup', (obj, field) => obj ? obj[field] : '');
};
