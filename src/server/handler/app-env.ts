import type { Actor } from '../domain/entities/actor.entity';

export interface AppEnv {
  Variables: {
    actor: Actor;
  };
}
