import type { Actor } from '../domain/entities/actor.entity.js';

export interface AppEnv {
  Variables: {
    actor: Actor;
  };
}
