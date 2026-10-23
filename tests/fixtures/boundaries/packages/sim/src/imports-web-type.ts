// Fixture: a type-only import still couples the sim to the web app; must violate sim-only-shared-content.
import type { EngineHandle } from '../../../apps/web/src/engine/renderer';
export type Handle = EngineHandle;
