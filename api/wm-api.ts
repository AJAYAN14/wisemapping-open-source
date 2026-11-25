import apiHandler from '../netlify/functions/api';
import { restoreRewrittenRequest } from './_shared';

export default {
  async fetch(request: Request): Promise<Response> {
    return apiHandler(restoreRewrittenRequest(request));
  },
};
