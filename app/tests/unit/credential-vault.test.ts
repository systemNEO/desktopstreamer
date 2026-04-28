import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCredentialVault } from '../../src/main/credential-vault';

describe('InMemoryCredentialVault', () => {
  let vault: InMemoryCredentialVault;

  beforeEach(() => {
    vault = new InMemoryCredentialVault();
  });

  it('setSecret + getSecret round-trip', async () => {
    await vault.setSecret('twitch', 'user1', 'token-abc');
    expect(await vault.getSecret('twitch', 'user1')).toBe('token-abc');
  });

  it('getSecret liefert null wenn nicht gesetzt', async () => {
    expect(await vault.getSecret('twitch', 'unknown')).toBeNull();
  });

  it('deleteSecret entfernt und liefert true', async () => {
    await vault.setSecret('s', 'a', 'x');
    expect(await vault.deleteSecret('s', 'a')).toBe(true);
    expect(await vault.getSecret('s', 'a')).toBeNull();
  });

  it('deleteSecret liefert false wenn nichts da war', async () => {
    expect(await vault.deleteSecret('s', 'a')).toBe(false);
  });

  it('verschiedene services überschreiben sich nicht', async () => {
    await vault.setSecret('twitch', 'u', '1');
    await vault.setSecret('youtube', 'u', '2');
    expect(await vault.getSecret('twitch', 'u')).toBe('1');
    expect(await vault.getSecret('youtube', 'u')).toBe('2');
  });
});
