import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SANDBOX_BASE_URL = 'https://public-api.sandbox.bunq.com';
const API_VERSION = 'v1';
const CONTEXT_FILE = path.join(process.cwd(), 'bunq_context.json');

interface BunqContext {
  apiKey: string;
  privateKeyPem: string;
  publicKeyPem: string;
  installationToken: string;
  serverPublicKey: string;
  sessionToken: string;
  userId: number;
}

export class BunqClient {
  private apiKey: string;
  private privateKey: crypto.KeyObject | null = null;
  private publicKeyPem = '';

  installationToken: string | null = null;
  serverPublicKey: string | null = null;
  sessionToken: string | null = null;
  userId: number | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.generateKeyPair();
  }

  private generateKeyPair(): void {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = privateKey;
    this.publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  }

  static async createSandboxUser(): Promise<string> {
    const resp = await fetch(`${SANDBOX_BASE_URL}/${API_VERSION}/sandbox-user-person`, {
      method: 'POST',
      headers: buildBaseHeaders(),
    });
    if (!resp.ok) throw new Error(`Create sandbox user failed: ${resp.status}`);
    const data = await resp.json();
    return data.Response[0].ApiKey.api_key;
  }

  async authenticate(): Promise<void> {
    if (this.loadContext() && (await this.testSession())) return;
    await this.step1Installation();
    await this.step2DeviceServer();
    await this.step3SessionServer();
    this.saveContext();
  }

  private async step1Installation(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any[] = await this.rawPost('installation', { client_public_key: this.publicKeyPem }, null);
    for (const item of resp) {
      if (item.Token) this.installationToken = item.Token.token;
      if (item.ServerPublicKey) this.serverPublicKey = item.ServerPublicKey.server_public_key;
    }
  }

  private async step2DeviceServer(): Promise<void> {
    await this.rawPost(
      'device-server',
      { description: 'snag-bunq-client', secret: this.apiKey, permitted_ips: ['*'] },
      this.installationToken,
    );
  }

  private async step3SessionServer(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any[] = await this.rawPost('session-server', { secret: this.apiKey }, this.installationToken);
    for (const item of resp) {
      if (item.Token) this.sessionToken = item.Token.token;
      if (item.UserPerson) this.userId = item.UserPerson.id;
      if (item.UserCompany) this.userId = item.UserCompany.id;
      if (item.UserApiKey) this.userId = item.UserApiKey.id;
    }
  }

  private async testSession(): Promise<boolean> {
    try {
      await this.get(`user/${this.userId}`);
      return true;
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(endpoint: string, params?: Record<string, string>): Promise<any[]> {
    return this.request('GET', endpoint, undefined, params);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post(endpoint: string, body: Record<string, unknown>): Promise<any[]> {
    return this.request('POST', endpoint, body);
  }

  async getPrimaryAccountId(): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any[] = await this.get(`user/${this.userId}/monetary-account-bank`);
    for (const item of resp) {
      const acc = item.MonetaryAccountBank;
      if (acc?.status === 'ACTIVE') return acc.id as number;
    }
    throw new Error('No active monetary account found');
  }

  private async request(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    const url = new URL(`${SANDBOX_BASE_URL}/${API_VERSION}/${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      ...buildBaseHeaders(),
      'X-Bunq-Client-Authentication': this.sessionToken!,
    };
    if (bodyStr) headers['X-Bunq-Client-Signature'] = this.sign(bodyStr);

    const resp = await fetch(url.toString(), { method, headers, body: bodyStr });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`bunq ${resp.status}: ${text}`);
    }
    return (await resp.json()).Response ?? [];
  }

  private async rawPost(
    endpoint: string,
    body: Record<string, unknown>,
    authToken: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    const bodyStr = JSON.stringify(body);
    const headers: Record<string, string> = {
      ...buildBaseHeaders(),
      'X-Bunq-Client-Signature': this.sign(bodyStr),
    };
    if (authToken) headers['X-Bunq-Client-Authentication'] = authToken;

    const resp = await fetch(`${SANDBOX_BASE_URL}/${API_VERSION}/${endpoint}`, {
      method: 'POST',
      headers,
      body: bodyStr,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`bunq ${resp.status}: ${text}`);
    }
    return (await resp.json()).Response ?? [];
  }

  private sign(body: string): string {
    const signer = crypto.createSign('SHA256');
    signer.update(body);
    return signer.sign(this.privateKey!).toString('base64');
  }

  private saveContext(): void {
    const ctx: BunqContext = {
      apiKey: this.apiKey,
      privateKeyPem: this.privateKey!.export({ type: 'pkcs8', format: 'pem' }) as string,
      publicKeyPem: this.publicKeyPem,
      installationToken: this.installationToken!,
      serverPublicKey: this.serverPublicKey!,
      sessionToken: this.sessionToken!,
      userId: this.userId!,
    };
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2));
  }

  private loadContext(): boolean {
    if (!fs.existsSync(CONTEXT_FILE)) return false;
    try {
      const ctx: BunqContext = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf-8'));
      if (ctx.apiKey !== this.apiKey) return false;
      this.privateKey = crypto.createPrivateKey(ctx.privateKeyPem);
      this.publicKeyPem = ctx.publicKeyPem;
      this.installationToken = ctx.installationToken;
      this.serverPublicKey = ctx.serverPublicKey;
      this.sessionToken = ctx.sessionToken;
      this.userId = ctx.userId;
      return true;
    } catch {
      return false;
    }
  }
}

function buildBaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'User-Agent': 'snag-bunq-client/1.0',
    'X-Bunq-Client-Request-Id': crypto.randomUUID(),
    'X-Bunq-Language': 'en_US',
    'X-Bunq-Region': 'nl_NL',
    'X-Bunq-Geolocation': '0 0 0 0 000',
  };
}
