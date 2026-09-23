import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgresql', 'postgres'],
    })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),

  JWT_ACCESS_TTL: Joi.string().default('15m'),

  SESSION_TTL_DAYS: Joi.number().integer().positive().default(30),
  REDIS_HOST: Joi.string().required(),

  REDIS_PORT: Joi.number().port().default(6379),
});
