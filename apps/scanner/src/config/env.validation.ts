import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  LOG_LEVEL: Joi.string().default('info'),

  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgresql', 'postgres'],
    })
    .required(),

  REDIS_HOST: Joi.string().required(),

  REDIS_PORT: Joi.number().port().default(6379),

  SCANNER_NAVIGATION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(120000)
    .default(30000),

  SCANNER_MAX_REQUESTS: Joi.number().integer().min(1).max(5000).default(500),

  SCANNER_MAX_CONSOLE_MESSAGES: Joi.number()
    .integer()
    .min(0)
    .max(1000)
    .default(100),
});
