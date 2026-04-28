// Plan B3 ersetzt die In-Memory-Variante durch echte keytar-Aufrufe.
// Interface jetzt schon definieren, damit nachfolgende Module dagegen programmieren.

export interface ICredentialVault {
  setSecret(service: string, account: string, secret: string): Promise<void>;
  getSecret(service: string, account: string): Promise<string | null>;
  deleteSecret(service: string, account: string): Promise<boolean>;
}

export class InMemoryCredentialVault implements ICredentialVault {
  private secrets = new Map<string, string>();

  private key(service: string, account: string): string {
    return `${service}::${account}`;
  }

  async setSecret(service: string, account: string, secret: string): Promise<void> {
    this.secrets.set(this.key(service, account), secret);
  }

  async getSecret(service: string, account: string): Promise<string | null> {
    return this.secrets.get(this.key(service, account)) ?? null;
  }

  async deleteSecret(service: string, account: string): Promise<boolean> {
    return this.secrets.delete(this.key(service, account));
  }
}
