import { describe, expect, it } from 'vitest';
import { LOCAL_PROJECT_DIRECTORIES } from './local-projects';
describe('local project layout',()=>{it('keeps originals and outputs separate',()=>{expect(LOCAL_PROJECT_DIRECTORIES).toContain('assets/originals');expect(LOCAL_PROJECT_DIRECTORIES).toContain('outputs/images')})});
