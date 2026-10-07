import { TestSphereError, formatDuration, sleep } from './util.js';

const SESSION_COOKIE = 'buildai_session';
const MAX_RATE_LIMIT_RETRIES = 5;

/**
 * Talks to BuildAI the way its web app does: sign in, open a conversation in a
 * knowledge base, ask, and read the answer back from the Server-Sent Events
 * stream. Each knowledge base is one department agent.
 *
 * Every question starts a fresh conversation unless it's marked followUp, so
 * earlier answers never leak into the one being tested.
 */
export class BuildAIClient {
  /** `cookie` reuses a session from an earlier flow in the same run, so a run signs in once per account. */
  constructor(target, { fetch = globalThis.fetch, cookie = '' } = {}) {
    this.target = target;
    this.fetch = fetch;
    this.cookie = cookie;
    this.workspace = null;
    this.conversationId = null;
    this.created = [];
  }

  async connect() {
    let boot = this.cookie ? await this.request('GET', '/bootstrap') : null;
    if (!boot?.ok) {
      this.cookie = '';
      // BuildAI allows 10 sign-ins per account every 15 minutes; never retry this one.
      const { email, password } = this.target;
      const login = await this.request('POST', '/auth/login', { email, password });
      if (login.status === 401) throw new TestSphereError(`BuildAI at ${this.target.url} didn't accept the sign-in for ${email}. Check the email and password for this target.`);
      if (!login.ok) throw new TestSphereError(`BuildAI sign-in failed: ${await errorMessage(login)}`);
      boot = await this.request('GET', '/bootstrap');
    }
    if (!boot.ok) throw new TestSphereError(`BuildAI GET /bootstrap failed: ${await errorMessage(boot)}`);
    boot = await boot.json();
    this.user = boot.user;
    this.org = boot.org?.name ?? null;
    if (this.target.knowledgeBase) {
      const wanted = this.target.knowledgeBase.toLowerCase();
      this.workspace = (boot.workspaces ?? []).find((w) => w.name.toLowerCase() === wanted) ?? null;
      if (!this.workspace) {
        const names = (boot.workspaces ?? []).map((w) => `"${w.name}"`).join(', ') || 'none';
        throw new TestSphereError(`${this.target.email} has no knowledge base called "${this.target.knowledgeBase}" in BuildAI. Available to them: ${names}.`);
      }
    }
    return this.describe();
  }

  describe() {
    return {
      platform: 'buildai',
      url: this.target.url,
      organization: this.org,
      knowledgeBase: this.workspace?.name ?? 'All knowledge',
      documents: this.workspace ? `${this.workspace.readyDocuments ?? '?'} ready of ${this.workspace.documents ?? '?'}` : null,
      signedInAs: this.user?.email ?? this.target.email,
      mode: this.target.mode ?? 'default',
    };
  }

  async ask(question, { followUp = false, mode = null } = {}) {
    if (!followUp || !this.conversationId) {
      const { conversation } = await this.json('POST', '/conversations', { workspaceId: this.workspace?.id ?? null });
      this.conversationId = conversation.id;
      this.created.push(conversation.id);
    }

    const started = Date.now();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.target.answerTimeout);
    try {
      const res = await this.withRateLimitRetry(() =>
        this.request('POST', `/conversations/${this.conversationId}/messages`, { text: question, mode: mode ?? this.target.mode ?? undefined }, {
          signal: abort.signal,
          accept: 'text/event-stream',
        }),
      );
      if (!res.ok) throw new TestSphereError(`BuildAI didn't take the question: ${await errorMessage(res)}`);
      const answer = await readAnswer(res.body);
      return { question, conversationId: this.conversationId, ...answer, latencyMs: answer.latencyMs ?? Date.now() - started };
    } catch (err) {
      if (abort.signal.aborted) throw new TestSphereError(`No answer from BuildAI within ${formatDuration(this.target.answerTimeout)}.`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Remove the conversations this client created (unless keepConversations), and sign out unless the session is shared. */
  async close({ signOut = true } = {}) {
    if (!this.cookie) return;
    if (!this.target.keepConversations) {
      for (const id of this.created) await this.request('DELETE', `/conversations/${id}`).catch(() => {});
    }
    this.created = [];
    if (signOut) {
      await this.request('POST', '/auth/logout').catch(() => {});
      this.cookie = '';
    }
  }

  // ------------------------------------------------------------- transport

  async request(method, route, body, { signal, accept = 'application/json' } = {}) {
    let res;
    try {
      res = await this.fetch(`${this.target.url}/api${route}`, {
        method,
        headers: {
          Accept: accept,
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new TestSphereError(`Can't reach BuildAI at ${this.target.url} (${err.cause?.code ?? err.message}). Is it running?`);
    }
    const session = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    if (session) this.cookie = session.split(';')[0];
    return res;
  }

  async json(method, route, body) {
    const res = await this.withRateLimitRetry(() => this.request(method, route, body));
    if (!res.ok) throw new TestSphereError(`BuildAI ${method} ${route} failed: ${await errorMessage(res)}`);
    return res.json();
  }

  /** BuildAI limits questions per person per minute; wait it out instead of failing the case. */
  async withRateLimitRetry(send) {
    for (let attempt = 0; ; attempt += 1) {
      const res = await send();
      if (res.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return res;
      await res.body?.cancel().catch(() => {});
      await sleep(retryDelay(res));
    }
  }
}

/** Collect one answer from BuildAI's event stream. */
export async function readAnswer(stream) {
  const answer = { answer: '', citations: [], sources: [], status: 'incomplete', model: null, costUsd: null, latencyMs: null, notices: [], error: null };
  let text = '';
  for await (const { event, data } of parseEventStream(stream)) {
    switch (event) {
      case 'delta':
        text += data.text ?? '';
        break;
      case 'sources':
        answer.sources = data.sources ?? [];
        break;
      case 'citations':
        answer.citations = data.citations ?? [];
        break;
      case 'notice':
        answer.notices.push(data.message);
        break;
      case 'error':
        answer.error = data;
        if (data.code === 'refused') answer.status = 'refused';
        break;
      case 'done':
        answer.status = data.status ?? 'complete';
        answer.model = data.model ?? null;
        answer.costUsd = data.costUsd ?? null;
        answer.latencyMs = data.latencyMs ?? null;
        break;
      default:
        break;
    }
  }
  if (answer.error && answer.error.code !== 'refused') throw new TestSphereError(`BuildAI couldn't answer: ${answer.error.message}`);
  // A refusal mid-answer leaves partial text that BuildAI itself discards.
  answer.answer = answer.status === 'refused' ? '' : text.trim();
  return answer;
}

async function* parseEventStream(stream) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true }).replaceAll('\r\n', '\n');
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue; // keep-alive comment
      try {
        yield { event, data: JSON.parse(data.join('\n')) };
      } catch {
        yield { event, data: { text: data.join('\n') } };
      }
    }
  }
}

function retryDelay(res) {
  const retryAfter = Number(res.headers.get('retry-after'));
  if (retryAfter > 0) return retryAfter * 1000;
  // draft-8 RateLimit header: "name";r=0;t=42
  const reset = /;\s*t=(\d+)/.exec(res.headers.get('ratelimit') ?? '');
  return reset ? (Number(reset[1]) + 1) * 1000 : 15_000;
}

async function errorMessage(res) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? `HTTP ${res.status}`;
}
