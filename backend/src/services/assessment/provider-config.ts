export const parseProviderConfig = (provider: any) => {
  if (!provider?.config_json) return {};
  try {
    return JSON.parse(provider.config_json);
  } catch {
    return {};
  }
};

export const resolveProviderKey = (provider: any, config: any) => {
  if (config?.api_key) return config.api_key;
  if (provider?.api_key_secret_name && process.env[provider.api_key_secret_name]) {
    return process.env[provider.api_key_secret_name];
  }
  return null;
};

export const resolveProviderSecret = (provider: any, config: any) => {
  if (config?.api_secret) return config.api_secret;
  if (provider?.api_secret_key_name && process.env[provider.api_secret_key_name]) {
    return process.env[provider.api_secret_key_name];
  }
  return null;
};
