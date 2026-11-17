// @arvo/whats-new on the server. createWhatsNew(config) reads the app's
// config once and gives back what the app wires up: the route handlers under
// basePath, and forgetAccount for the app's delete-account code. Keep one per
// process (README.md, "One server file").
//
// Server only: it uses Node's crypto. The pages are in ./client.
import { normalizeConfig, type WhatsNewConfig, type WhatsNewUser } from './config';
import { createRouteHandlers, type WhatsNewRouteHandlers } from './server/routes';

export type WhatsNew = Readonly<{
  /** GET, POST and DELETE for one catch-all route file at basePath. */
  routeHandlers: WhatsNewRouteHandlers;
  /**
   * Removes how far one account has seen. Call it from the app's
   * delete-account code. True when it went through; never throws (a failure
   * is logged and answers false, so the caller can try again later).
   */
  forgetAccount: (userId: string) => Promise<boolean>;
}>;

/** Never throws, whatever the config: what is wrong is logged. */
export function createWhatsNew<User extends WhatsNewUser = WhatsNewUser>(input: WhatsNewConfig<User>): WhatsNew {
  const config = normalizeConfig(input);
  return {
    routeHandlers: createRouteHandlers(config),
    forgetAccount: async (userId) => {
      try {
        if (typeof userId !== 'string' || !userId) return true;
        const sql = await config.db();
        if (!sql) return false;
        await sql`delete from whats_new_readers where user_id = ${userId}`;
        return true;
      } catch (error) {
        config.log("[What's New] an account's mark was not removed", error);
        return false;
      }
    },
  };
}

export type { WhatsNewConfig, WhatsNewLog, WhatsNewSql, WhatsNewUser } from './config';
export type { Audience, PostView } from './shared/api';
