import oauthHandler from '../netlify/functions/oauth';
import { restoreRewrittenRequest } from './_shared';

export default {
  async fetch(request: Request): Promise<Response> {
    return oauthHandler(restoreRewrittenRequest(request));
  },
};
