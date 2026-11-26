import apiHandler from './_core/api.js';
import { restoreRewrittenRequest } from './_shared.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return apiHandler(restoreRewrittenRequest(request));
  },
};
