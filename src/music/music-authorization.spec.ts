import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ROLES_METADATA_KEY } from '../auth/session/interface/roles.decorator';
import { RolesGuard } from '../auth/session/interface/roles.guard';
import { JwtAuthGuard } from '../auth/session/interface/jwt-auth.guard';
import { UserRole } from '../users/domain/user-role.enum';
import { CatalogMusicController } from './catalog/interface/catalog-music.controller';
import { MusicController } from './interface/music.controller';

const WRITE_METHODS = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

type Handler = (...args: unknown[]) => unknown;

function routeHandlers(controller: { prototype: object }) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: proto[name] as Handler }))
    .filter(
      ({ handler }) =>
        typeof handler === 'function' &&
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined,
    )
    .map(({ name, handler }) => ({
      name,
      method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
      path: Reflect.getMetadata(PATH_METADATA, handler) as string,
      roles: Reflect.getMetadata(ROLES_METADATA_KEY, handler) as
        UserRole[] | undefined,
      guards: (Reflect.getMetadata(GUARDS_METADATA, handler) ??
        []) as unknown[],
    }));
}

describe.each([
  ['CatalogMusicController', CatalogMusicController],
  ['MusicController (legacy)', MusicController],
])('%s authorization', (_name, controller) => {
  const routes = routeHandlers(controller);

  it('exposes routes', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.filter((route) => WRITE_METHODS.has(route.method)))(
    'restricts write route $name ($path) to admins',
    (route) => {
      expect(route.roles).toEqual([UserRole.ADMIN]);
      expect(route.guards).toEqual([JwtAuthGuard, RolesGuard]);
    },
  );
});

describe('CatalogMusicController public reads', () => {
  it.each([
    'listTracks',
    'getTrack',
    'listPublicPlaylists',
    'getPublicPlaylist',
  ])('%s stays public', (name) => {
    const route = routeHandlers(CatalogMusicController).find(
      (candidate) => candidate.name === name,
    );
    expect(route).toBeDefined();
    expect(route?.guards).toEqual([]);
  });
});
