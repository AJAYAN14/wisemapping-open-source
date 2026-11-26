import oauthHandler from '../netlify/functions/oauth.js';
import { restoreRewrittenRequest } from './_shared.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return oauthHandler(restoreRewrittenRequest(request));
  },
};
